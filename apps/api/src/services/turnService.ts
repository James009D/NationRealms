import type { ResourceType } from "@prisma/client";
import type {
  AgentTurnContribution,
  NationStatKey,
  StatModifier,
  TurnResolution,
  TurnResourceDelta
} from "@statecraft/shared";
import { getTechnologyAge } from "@statecraft/shared";
import { buildAgentContributions, calculateLocationYield, completeDueUpgradeProjects } from "./developmentService.js";
import { clampStat } from "./eventEffects.js";
import { generateEventForNationWithClient } from "./eventEngineService.js";
import { ensureNationEconomy, getEconomySnapshot, RESOURCE_TYPES, type ServiceClient } from "./economyService.js";
import { levelForXp } from "./progression.js";
import { runSerializable } from "./transactions.js";
import {
  getActiveTechnologyEffects,
  getNationTechnology,
  processTurnResearch,
  technologyActivationChanges
} from "./technologyService.js";
import { completeDueInfrastructureProjects, loadInfrastructureLinks } from "./infrastructureService.js";
import { calculateInfrastructureNetworkBenefits } from "./infrastructureRules.js";
import { getNationSettlementSummary, processSettlementTurn } from "./settlementService.js";
import { processExpansionTurn } from "./expansionService.js";
import { refreshAgentActionPoints } from "./agentActionService.js";

function addResource(target: Record<ResourceType, number>, type: ResourceType, amount: number) {
  target[type] += amount;
}

async function resolveTurn(client: ServiceClient, nationId: string): Promise<TurnResolution> {
  const nation = await client.nation.findUnique({
    where: { id: nationId },
    include: {
      stats: true,
      mapLocations: { include: { worldTile: true } },
      agents: true,
      militaryUnits: true,
      economy: true,
      resources: true
    }
  });
  if (!nation || !nation.stats) throw new Error("Nation not found");

  const previousTurn = nation.currentTurn;
  const currentTurn = previousTurn + 1;
  await ensureNationEconomy(
    client,
    nationId,
    nation.mapLocations.reduce((sum, location) => sum + (location.population ?? 0), 0) || 1_000_000
  );
  const economy = await client.nationEconomy.findUniqueOrThrow({ where: { nationId } });
  const technologyLevelBefore = nation.stats.technology;
  const technologyViewBefore = await getNationTechnology(nationId, client);
  const technologyEffects = await getActiveTechnologyEffects(nationId, client);
  const completedUpgradeProjects = await completeDueUpgradeProjects(client, nationId, currentTurn);
  const completedInfrastructureProjects = await completeDueInfrastructureProjects(
    client as unknown as import("@prisma/client").Prisma.TransactionClient,
    nationId,
    currentTurn
  );
  const infrastructureLinks = await loadInfrastructureLinks(
    client as unknown as import("@prisma/client").Prisma.TransactionClient,
    nationId
  );
  for (const project of completedUpgradeProjects) {
    const location = nation.mapLocations.find((item) => item.id === project.locationId);
    if (location) location.developmentLevel = Math.max(location.developmentLevel, project.targetLevel);
  }
  const currentResources = await client.resourceStockpile.findMany({ where: { nationId } });
  const produced = Object.fromEntries(RESOURCE_TYPES.map((type) => [type, 0])) as Record<ResourceType, number>;
  const consumed = Object.fromEntries(RESOURCE_TYPES.map((type) => [type, 0])) as Record<ResourceType, number>;
  let treasuryIncome = Math.round(nation.stats.economy * 2.5);
  let locationUpkeep = 0;
  let infrastructureTreasuryIncome = 0;
  const infrastructureResourceIncome: Partial<Record<ResourceType, number>> = {};
  const agentContributions: AgentTurnContribution[] = [];
  const infrastructureBenefits = calculateInfrastructureNetworkBenefits(
    infrastructureLinks,
    nation.mapLocations,
    nation.agents as unknown as import("@statecraft/shared").CharacterAgent[],
    technologyEffects
  );

  for (const location of nation.mapLocations) {
    const benefit = infrastructureBenefits.find((item) => item.locationId === location.id) ?? {
      treasuryPercent: 0,
      resourcePercent: 0
    };
    const withoutInfrastructure = calculateLocationYield(location, nation.agents, technologyEffects);
    const result = calculateLocationYield(location, nation.agents, technologyEffects, benefit);
    infrastructureTreasuryIncome += Math.max(0, result.treasury - withoutInfrastructure.treasury);
    treasuryIncome += result.treasury;
    locationUpkeep += result.upkeep;
    agentContributions.push(...buildAgentContributions(location, nation.agents, technologyEffects));
    for (const [type, amount] of Object.entries(result.resources) as Array<[ResourceType, number]>) {
      addResource(produced, type, amount);
      const infrastructureAmount = Math.max(0, amount - (withoutInfrastructure.resources[type] ?? 0));
      if (infrastructureAmount)
        infrastructureResourceIncome[type] = (infrastructureResourceIncome[type] ?? 0) + infrastructureAmount;
    }
  }

  const foodStockpile = currentResources.find((item) => item.type === "FOOD");
  const settlementTurn = await processSettlementTurn(
    client,
    nationId,
    currentTurn,
    (foodStockpile?.amount ?? 0) + produced.FOOD
  );
  treasuryIncome += settlementTurn.treasuryIncome;
  locationUpkeep += settlementTurn.regionalTreasuryUpkeep;
  produced.FOOD += settlementTurn.foodProduced;

  const activeAgents = nation.agents.filter((agent) => agent.assignment !== "IDLE");
  treasuryIncome = Math.round(treasuryIncome * (1 + (technologyEffects.treasuryIncomePercent ?? 0) / 100));
  const unitUpkeep = nation.militaryUnits.length * 22;
  const infrastructureTreasuryUpkeep = infrastructureLinks.reduce((sum, link) => sum + link.upkeepTreasury, 0);
  const infrastructureEnergyUpkeep = infrastructureLinks.reduce((sum, link) => sum + link.upkeepEnergy, 0);
  const treasuryDelta = treasuryIncome - unitUpkeep - locationUpkeep - infrastructureTreasuryUpkeep;
  consumed.FOOD = Math.max(
    10,
    Math.ceil(
      (settlementTurn.foodConsumed || economy.population / 10_000) *
        (1 + (technologyEffects.foodConsumptionPercent ?? 0) / 100)
    )
  );
  consumed.ENERGY = Math.max(
    5,
    Math.ceil(
      (Math.ceil(economy.industrialCapacity / 5) + nation.militaryUnits.length * 4) *
        (1 + (technologyEffects.energyConsumptionPercent ?? 0) / 100)
    )
  );
  consumed.ENERGY += infrastructureEnergyUpkeep;
  consumed.ENERGY += settlementTurn.regionalEnergyUpkeep;

  const warnings: string[] = [];
  const resourceDeltas: TurnResourceDelta[] = [];
  let foodShortage = false;
  let energyShortage = false;
  for (const type of RESOURCE_TYPES) {
    const stockpile = currentResources.find((item) => item.type === type)!;
    const available = stockpile.amount + produced[type];
    const shortage = available < consumed[type];
    if (type === "FOOD") foodShortage = shortage;
    if (type === "ENERGY") energyShortage = shortage;
    const nextAmount = Math.max(0, Math.min(stockpile.capacity, available - consumed[type]));
    await client.resourceStockpile.update({ where: { id: stockpile.id }, data: { amount: nextAmount } });
    const net = nextAmount - stockpile.amount;
    resourceDeltas.push({ type, produced: produced[type], consumed: consumed[type], net, balance: nextAmount });
    if (net !== 0) {
      await client.economyLedgerEntry.create({
        data: {
          nationId,
          turn: currentTurn,
          kind: "RESOURCE",
          resourceType: type,
          amount: net,
          reason: "Turn production and consumption",
          sourceType: "TURN"
        }
      });
    }
  }

  if (foodShortage) warnings.push("Food reserves could not meet population demand.");
  if (energyShortage) warnings.push("Energy shortages reduced industrial and military readiness.");
  let populationDelta = settlementTurn.outcomes.length
    ? settlementTurn.populationDelta
    : foodShortage
      ? -Math.max(100, Math.floor(economy.population * 0.005))
      : Math.max(100, Math.floor(economy.population * 0.003));
  if (!settlementTurn.outcomes.length && !foodShortage)
    populationDelta = Math.round(populationDelta * (1 + (technologyEffects.populationGrowthPercent ?? 0) / 100));
  const nextTreasury = Math.max(0, economy.treasury + treasuryDelta);
  if (economy.treasury + treasuryDelta < 0) warnings.push("Treasury obligations exceeded available funds.");
  const disabledInfrastructureLinkIds =
    energyShortage || nextTreasury === 0
      ? infrastructureLinks.filter((link) => nextTreasury === 0 || link.upkeepEnergy > 0).map((link) => link.id)
      : [];
  if (disabledInfrastructureLinkIds.length) {
    await client.infrastructureLink.updateMany({
      where: { id: { in: disabledInfrastructureLinkIds } },
      data: { enabled: false }
    });
    warnings.push(
      `${disabledInfrastructureLinkIds.length} infrastructure link${disabledInfrastructureLinkIds.length === 1 ? " was" : "s were"} disabled because upkeep could not be paid.`
    );
  }

  await client.nationEconomy.update({
    where: { nationId },
    data: {
      treasury: nextTreasury,
      population: Math.max(1000, economy.population + populationDelta),
      administrativeCapacity: Math.min(
        100,
        economy.administrativeCapacity + activeAgents.filter((agent) => agent.assignment === "GOVERNING").length
      ),
      industrialCapacity: Math.max(0, Math.min(100, economy.industrialCapacity + (energyShortage ? -2 : 1))),
      lastProcessedTurn: currentTurn
    }
  });
  await client.economyLedgerEntry.createMany({
    data: [
      {
        nationId,
        turn: currentTurn,
        kind: "TREASURY",
        amount: nextTreasury - economy.treasury,
        reason: "Turn income and upkeep",
        sourceType: "TURN"
      },
      {
        nationId,
        turn: currentTurn,
        kind: "POPULATION",
        amount: populationDelta,
        reason: foodShortage ? "Food shortage" : "Population growth",
        sourceType: "TURN"
      }
    ]
  });

  const statChanges: StatModifier = {};
  let technologyLevelAfter = technologyLevelBefore;
  if (foodShortage) Object.assign(statChanges, { stability: -3, publicTrust: -3 });
  if (energyShortage) Object.assign(statChanges, { economy: -2, technology: -1 });
  if (nextTreasury === 0)
    Object.assign(statChanges, {
      stability: (statChanges.stability ?? 0) - 2,
      publicTrust: (statChanges.publicTrust ?? 0) - 2
    });
  if (Object.keys(statChanges).length) {
    const data = Object.fromEntries(
      Object.entries(statChanges).map(([key, amount]) => [key, clampStat(nation.stats![key as NationStatKey] + amount)])
    );
    await client.nationStats.update({ where: { nationId }, data });
    if (typeof data.technology === "number") technologyLevelAfter = data.technology;
  }

  for (const agent of activeAgents) {
    const xp = agent.xp + 5 + (technologyEffects.activeAgentXp ?? 0);
    await client.characterAgent.update({ where: { id: agent.id }, data: { xp, level: levelForXp(xp) } });
  }

  const supplied = !foodShortage && !energyShortage;
  for (const unit of nation.militaryUnits) {
    const unitLocation = nation.mapLocations.find((location) => location.id === unit.locationId);
    const generals = activeAgents.filter(
      (agent) =>
        agent.role === "GENERAL" &&
        ["COMMANDING", "GUARDING"].includes(agent.assignment) &&
        agent.assignedLocationId === unit.locationId &&
        unitLocation?.type === "MILITARY_BASE"
    );
    const commandBonus = Math.min(
      25,
      generals.reduce((sum, general) => sum + general.level * 2, 0)
    );
    const infrastructureRecovery =
      infrastructureBenefits.find((benefit) => benefit.locationId === unit.locationId)?.militaryRecoveryBonus ?? 0;
    await client.militaryUnit.update({
      where: { id: unit.id },
      data: {
        supply: Math.max(0, Math.min(100, unit.supply + (supplied ? 5 : -12) + commandBonus + infrastructureRecovery)),
        readiness: Math.max(
          0,
          Math.min(
            100,
            unit.readiness +
              (supplied ? 3 + (technologyEffects.militaryReadinessRecovery ?? 0) : -10) +
              commandBonus +
              infrastructureRecovery
          )
        )
      }
    });
    for (const general of generals) {
      if (
        !agentContributions.some((entry) => entry.agentId === general.id && entry.description.includes("readiness"))
      ) {
        agentContributions.push({
          agentId: general.id,
          agentName: general.name,
          role: general.role,
          locationId: general.assignedLocationId,
          description: `${general.name} improved supply and readiness for units at ${unitLocation?.name}.`,
          supplyBonus: general.level * 2,
          readinessBonus: general.level * 2
        });
      }
    }
  }

  const expired = await client.activeEvent.findMany({
    where: { nationId, status: "ACTIVE", expiresTurn: { lte: currentTurn } },
    select: { id: true }
  });
  if (expired.length)
    await client.activeEvent.updateMany({
      where: { id: { in: expired.map((item) => item.id) }, status: "ACTIVE" },
      data: { status: "EXPIRED" }
    });
  await client.nation.update({ where: { id: nationId }, data: { currentTurn } });
  const expansion = await processExpansionTurn(client, nationId, currentTurn);
  await refreshAgentActionPoints(client, nationId, currentTurn);
  const research = await processTurnResearch(client, nationId, technologyLevelAfter, energyShortage, currentTurn);
  if (settlementTurn.researchPoints > 0) {
    const state = await client.nationTechnologyState.update({
      where: { nationId },
      data: {
        researchPoints: { increment: settlementTurn.researchPoints },
        lifetimeResearch: { increment: settlementTurn.researchPoints }
      }
    });
    await client.technologyLedgerEntry.create({
      data: {
        nationId,
        turn: currentTurn,
        amount: settlementTurn.researchPoints,
        balance: state.researchPoints,
        reason: "Settlement research workforce"
      }
    });
    research.total += settlementTurn.researchPoints;
    research.balance = state.researchPoints;
    research.contributions.push({
      sourceType: "TECHNOLOGY",
      sourceId: "settlement-workforce",
      label: "Settlement research workforce",
      amount: settlementTurn.researchPoints
    });
  }
  const purchasedUnlocks = technologyViewBefore.nodes
    .filter((node) => node.unlock)
    .map((node) => ({ nodeKey: node.key }));
  const activationChanges = technologyActivationChanges(purchasedUnlocks, technologyLevelBefore, technologyLevelAfter);
  const generation = await generateEventForNationWithClient(nationId, client);
  const snapshot = await getEconomySnapshot(nationId, client);

  return {
    nationId,
    previousTurn,
    currentTurn,
    treasuryDelta: snapshot.economy.treasury - economy.treasury,
    populationDelta,
    resourceDeltas,
    statChanges,
    warnings,
    expiredEventIds: expired.map((item) => item.id),
    generation,
    economy: snapshot,
    completedUpgradeProjects,
    completedInfrastructureProjects,
    infrastructureTreasuryDelta: -infrastructureTreasuryUpkeep,
    infrastructureEnergyDelta: -infrastructureEnergyUpkeep,
    infrastructureTreasuryIncome,
    infrastructureResourceIncome,
    disabledInfrastructureLinkIds,
    settlementOutcomes: settlementTurn.outcomes,
    settlementSummary: await getNationSettlementSummary(nationId, client),
    expansion,
    agentContributions,
    researchPointsGenerated: research.total,
    researchPointBalance: research.balance,
    researchContributions: research.contributions,
    technologyAgeBefore: getTechnologyAge(technologyLevelBefore),
    technologyAgeAfter: getTechnologyAge(technologyLevelAfter),
    suspendedTechnologyKeys: activationChanges.suspended,
    reactivatedTechnologyKeys: activationChanges.reactivated
  };
}

export { calculateLocationYield } from "./developmentService.js";

export async function advanceNationTurn(nationId: string): Promise<TurnResolution> {
  return runSerializable((tx) => resolveTurn(tx as unknown as ServiceClient, nationId));
}
