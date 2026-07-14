import type { AgentAssignment, AgentRole, MapLocationType, Prisma, ResourceType } from "@prisma/client";
import {
  DEVELOPMENT_LEVEL_MULTIPLIERS,
  type AgentTurnContribution,
  type CharacterAgent,
  type LocationDevelopmentView,
  type LocationUpgradePreview,
  type LocationUpgradeProject as SharedUpgradeProject,
  type LocationYieldBreakdown,
  type TechnologyEffects
} from "@statecraft/shared";
import type { TerrainType } from "@statecraft/shared";
import { ApiError, conflict, notFound } from "../errors.js";
import { prisma } from "../prisma.js";
import { ensureNationEconomy, getEconomySnapshot, type ServiceClient } from "./economyService.js";
import { serializeAgent, serializeLocation } from "./serializers.js";
import { runSerializable } from "./transactions.js";
import { getActiveTechnologyEffects } from "./technologyService.js";
import { terrainYieldForLocation } from "./terrainService.js";
import { constructionProjectLimit, effectiveAdministrativeCapacity } from "./constructionService.js";
import { calculateInfrastructureNetworkBenefits } from "./infrastructureRules.js";

type AgentLike = {
  id: string;
  name: string;
  nationId: string;
  role: AgentRole;
  assignment: AgentAssignment;
  level: number;
  assignedLocationId?: string | null;
  currentWorldTileId?: string | null;
};

type LocationLike = {
  id?: string;
  nationId?: string | null;
  name: string;
  type: MapLocationType;
  resourceType?: ResourceType | null;
  developmentLevel: number;
  terrain?: TerrainType | null;
  worldTile?: { terrain: TerrainType; resourceDeposit?: ResourceType | null } | null;
  worldTileId?: string | null;
};

type ResourceCost = Partial<Record<ResourceType, number>>;

const BASE_OUTPUT: Record<MapLocationType, { treasury: number; resources: ResourceCost; upkeep: number }> = {
  CAPITAL: { treasury: 80, resources: {}, upkeep: 12 },
  CITY: { treasury: 55, resources: {}, upkeep: 8 },
  TOWN: { treasury: 30, resources: {}, upkeep: 5 },
  OUTPOST: { treasury: 8, resources: {}, upkeep: 3 },
  FORT: { treasury: 0, resources: {}, upkeep: 28 },
  PORT_SITE: { treasury: 40, resources: { FISH: 20 }, upkeep: 8 },
  PORT: { treasury: 55, resources: { FISH: 25 }, upkeep: 10 },
  MILITARY_BASE: { treasury: 0, resources: {}, upkeep: 35 },
  MINE: { treasury: 15, resources: { IRON: 35 }, upkeep: 9 },
  FARM: { treasury: 10, resources: { FOOD: 90 }, upkeep: 6 },
  RESOURCE_SITE: { treasury: 10, resources: { ENERGY: 25 }, upkeep: 8 }
};

const BASE_UPGRADE_COSTS: Record<MapLocationType, { treasury: number; resources: ResourceCost }> = {
  CAPITAL: { treasury: 500, resources: { TIMBER: 30, IRON: 20 } },
  CITY: { treasury: 450, resources: { TIMBER: 25, IRON: 20 } },
  TOWN: { treasury: 300, resources: { TIMBER: 20 } },
  OUTPOST: { treasury: 220, resources: { TIMBER: 20 } },
  FORT: { treasury: 420, resources: { IRON: 30, ENERGY: 15 } },
  PORT_SITE: { treasury: 480, resources: { TIMBER: 25, IRON: 20 } },
  PORT: { treasury: 500, resources: { TIMBER: 25, IRON: 25 } },
  MILITARY_BASE: { treasury: 450, resources: { IRON: 35, ENERGY: 20 } },
  MINE: { treasury: 350, resources: { TIMBER: 15, IRON: 10 } },
  FARM: { treasury: 250, resources: { TIMBER: 15 } },
  RESOURCE_SITE: { treasury: 400, resources: { IRON: 20, ENERGY: 10 } }
};

const COST_MULTIPLIERS = [0, 0, 1, 1.6, 2.5, 4] as const;
const BASE_DURATIONS = [0, 0, 1, 1, 2, 3] as const;
export const MAX_DEVELOPMENT_LEVEL = 5;
export const CANCELLATION_REFUND_PERCENT = 75;

function boundedLevel(level: number) {
  return Math.max(1, Math.min(MAX_DEVELOPMENT_LEVEL, Math.trunc(level)));
}

export function developmentMultiplier(level: number) {
  return DEVELOPMENT_LEVEL_MULTIPLIERS[boundedLevel(level)] ?? 1;
}

function locationAgents(location: LocationLike, agents: AgentLike[]) {
  return agents.filter(
    (agent) =>
      agent.assignedLocationId === location.id &&
      (!agent.currentWorldTileId || !location.worldTileId || agent.currentWorldTileId === location.worldTileId)
  );
}

function agentIsPresent(location: LocationLike, agent: AgentLike | null | undefined) {
  return Boolean(
    agent &&
    agent.assignedLocationId === location.id &&
    (!agent.currentWorldTileId || !location.worldTileId || agent.currentWorldTileId === location.worldTileId)
  );
}

function outputBonusPercents(location: LocationLike, agents: AgentLike[]) {
  let treasuryPercent = 0;
  let resourcePercent = 0;
  for (const agent of locationAgents(location, agents)) {
    if (agent.role === "GOVERNOR" && agent.assignment === "GOVERNING") treasuryPercent += agent.level * 3;
    if (
      agent.role === "TRADE_MINISTER" &&
      agent.assignment === "GOVERNING" &&
      ["CAPITAL", "CITY", "TOWN", "PORT"].includes(location.type)
    ) {
      treasuryPercent += agent.level * 4;
      resourcePercent += agent.level * 2;
    }
    if (
      agent.role === "SCIENTIST_ADVISOR" &&
      agent.assignment === "IMPROVING" &&
      ["CITY", "RESOURCE_SITE"].includes(location.type)
    ) {
      resourcePercent += agent.level * 4;
    }
  }
  return { treasuryPercent: Math.min(25, treasuryPercent), resourcePercent: Math.min(25, resourcePercent) };
}

export function calculateLocationYield(
  location: Pick<LocationLike, "id" | "type" | "resourceType" | "developmentLevel" | "terrain" | "worldTile">,
  agents: AgentLike[] = [],
  technologyEffects: TechnologyEffects = {},
  infrastructureBonus: number | { treasuryPercent: number; resourcePercent: number } = 0
): LocationYieldBreakdown {
  const base = BASE_OUTPUT[location.type];
  const multiplier = developmentMultiplier(location.developmentLevel);
  const bonuses = outputBonusPercents({ ...location, id: location.id ?? "" } as LocationLike, agents);
  const technologyTreasuryPercent = technologyEffects.locationTreasuryPercent?.[location.type] ?? 0;
  const technologyLocationResourcePercent = technologyEffects.locationResourcePercent?.[location.type] ?? 0;
  const terrain = terrainYieldForLocation(location);
  const infrastructureTreasuryPercent =
    typeof infrastructureBonus === "number" ? infrastructureBonus : infrastructureBonus.treasuryPercent;
  const infrastructureResourcePercent =
    typeof infrastructureBonus === "number" ? infrastructureBonus : infrastructureBonus.resourcePercent;
  const treasuryBonusPercent = Math.max(
    -30,
    Math.min(
      25,
      bonuses.treasuryPercent + technologyTreasuryPercent + terrain.treasuryPercent + infrastructureTreasuryPercent
    )
  );
  const treasuryBeforeBonus = base.treasury * multiplier;
  const resourceBonus = (type: ResourceType) =>
    Math.max(
      -30,
      Math.min(
        25,
        bonuses.resourcePercent +
          technologyLocationResourcePercent +
          (technologyEffects.resourceYieldPercent?.[type] ?? 0) +
          terrain.productionPercent +
          (terrain.resourcePercent[type] ?? 0) +
          infrastructureResourcePercent
      )
    );
  const resources = Object.fromEntries(
    Object.entries(base.resources).map(([type, amount]) => [
      type,
      Math.round((amount ?? 0) * multiplier * (1 + resourceBonus(type as ResourceType) / 100))
    ])
  ) as ResourceCost;
  if ((location.type === "RESOURCE_SITE" || location.type === "MINE") && location.resourceType) {
    resources[location.resourceType] = Math.round(35 * multiplier * (1 + resourceBonus(location.resourceType) / 100));
  }
  return {
    treasury: Math.round(treasuryBeforeBonus * (1 + treasuryBonusPercent / 100)),
    resources,
    upkeep: Math.round(base.upkeep * multiplier),
    multiplier,
    agentBonusPercent: Math.max(bonuses.treasuryPercent, bonuses.resourcePercent),
    ...(terrain.terrain
      ? {
          developmentMultiplier: multiplier,
          technologyBonusPercent: Math.max(technologyTreasuryPercent, technologyLocationResourcePercent),
          terrainBonusPercent: Math.max(
            terrain.treasuryPercent,
            terrain.productionPercent,
            ...Object.values(terrain.resourcePercent).map((value) => value ?? 0)
          ),
          infrastructureBonusPercent: Math.max(infrastructureTreasuryPercent, infrastructureResourcePercent),
          terrain: terrain.terrain
        }
      : infrastructureTreasuryPercent || infrastructureResourcePercent
        ? { infrastructureBonusPercent: Math.max(infrastructureTreasuryPercent, infrastructureResourcePercent) }
        : {})
  };
}

export function projectLimit(administrativeCapacity: number) {
  return constructionProjectLimit(administrativeCapacity);
}

export function calculateUpgradeQuote(
  location: LocationLike,
  engineer?: AgentLike | null,
  technologyEffects: TechnologyEffects = {}
) {
  const targetLevel = location.developmentLevel + 1;
  if (targetLevel > MAX_DEVELOPMENT_LEVEL) return null;
  const base = BASE_UPGRADE_COSTS[location.type];
  const terrain = terrainYieldForLocation(location);
  const multiplier = COST_MULTIPLIERS[targetLevel] ?? 1;
  const eligibleEngineer =
    engineer?.role === "ENGINEER" && engineer.assignment === "IMPROVING" && agentIsPresent(location, engineer);
  const discount = eligibleEngineer ? Math.min(20, engineer.level * 5) : 0;
  const durationReduction = eligibleEngineer && engineer.level >= 2 ? 1 : 0;
  return {
    targetLevel,
    treasuryCost: Math.round(
      base.treasury *
        multiplier *
        (1 - discount / 100) *
        (1 + (technologyEffects.upgradeTreasuryCostPercent ?? 0) / 100) *
        (1 + terrain.constructionCostPercent / 100)
    ),
    resourceCosts: Object.fromEntries(
      Object.entries(base.resources).map(([type, amount]) => [
        type,
        Math.round(
          (amount ?? 0) *
            multiplier *
            (1 + (technologyEffects.upgradeResourceCostPercent ?? 0) / 100) *
            (1 + terrain.constructionCostPercent / 100)
        )
      ])
    ) as ResourceCost,
    durationTurns: Math.max(1, (BASE_DURATIONS[targetLevel] ?? 1) - durationReduction),
    costDiscountPercent: discount,
    durationReduction
  };
}

export function buildAgentContributions(
  location: LocationLike,
  agents: AgentLike[],
  technologyEffects: TechnologyEffects = {}
): AgentTurnContribution[] {
  let appliedYield = calculateLocationYield(location, [], technologyEffects);
  const appliedAgents: AgentLike[] = [];
  const contributions: AgentTurnContribution[] = [];
  for (const agent of locationAgents(location, agents).sort((a, b) => a.id.localeCompare(b.id))) {
    const nextYield = calculateLocationYield(location, [...appliedAgents, agent], technologyEffects);
    const treasuryBonus = Math.max(0, nextYield.treasury - appliedYield.treasury);
    const resourceBonuses = Object.fromEntries(
      Object.entries(nextYield.resources)
        .map(([type, amount]) => [
          type,
          Math.max(0, (amount ?? 0) - (appliedYield.resources[type as ResourceType] ?? 0))
        ])
        .filter(([, amount]) => Number(amount) > 0)
    ) as ResourceCost;
    if (treasuryBonus || Object.keys(resourceBonuses).length) {
      contributions.push({
        agentId: agent.id,
        agentName: agent.name,
        role: agent.role,
        locationId: location.id,
        description: `${agent.name} improved output at ${location.name}.`,
        treasuryBonus,
        resourceBonuses
      });
    }
    appliedAgents.push(agent);
    appliedYield = nextYield;
  }
  return contributions;
}

function projectToShared(project: {
  id: string;
  nationId: string;
  locationId: string;
  status: "QUEUED" | "COMPLETED" | "CANCELLED";
  fromLevel: number;
  targetLevel: number;
  startedTurn: number;
  completesTurn: number;
  treasuryCost: number;
  resourceCostsJson: unknown;
  engineerAgentId: string | null;
  engineer?: { name: string } | null;
  costDiscountPercent: number;
  durationReduction: number;
  createdAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
}): SharedUpgradeProject {
  return {
    ...project,
    resourceCosts: (project.resourceCostsJson ?? {}) as ResourceCost,
    engineerName: project.engineer?.name ?? null,
    createdAt: project.createdAt.toISOString(),
    completedAt: project.completedAt?.toISOString() ?? null,
    cancelledAt: project.cancelledAt?.toISOString() ?? null
  };
}

export function buildLocationUpgradePreview(
  location: LocationLike,
  assignedAgents: AgentLike[],
  economy: { treasury: number },
  resources: Array<{ type: ResourceType; amount: number }>,
  activeProjectCount: number,
  limit: number,
  technologyEffects: TechnologyEffects = {}
): LocationUpgradePreview {
  const engineers = assignedAgents.filter(
    (agent) => agent.role === "ENGINEER" && agent.assignment === "IMPROVING" && agentIsPresent(location, agent)
  );
  const quote = calculateUpgradeQuote(location, null, technologyEffects);
  const blockers: string[] = [];
  if (!quote) blockers.push("Maximum development level reached.");
  if (activeProjectCount >= limit) blockers.push("All national construction slots are in use.");
  if (quote && economy.treasury < quote.treasuryCost) blockers.push("Insufficient treasury.");
  if (quote) {
    for (const [type, amount] of Object.entries(quote.resourceCosts) as Array<[ResourceType, number]>) {
      if ((resources.find((resource) => resource.type === type)?.amount ?? 0) < amount)
        blockers.push(`Insufficient ${type.toLowerCase().replace("_", " ")}.`);
    }
  }
  return {
    locationId: location.id ?? "",
    currentLevel: location.developmentLevel,
    targetLevel: quote?.targetLevel ?? null,
    treasuryCost: quote?.treasuryCost ?? 0,
    resourceCosts: quote?.resourceCosts ?? {},
    durationTurns: quote?.durationTurns ?? 0,
    currentYield: calculateLocationYield(location, assignedAgents, technologyEffects),
    upgradedYield: quote
      ? calculateLocationYield({ ...location, developmentLevel: quote.targetLevel }, assignedAgents, technologyEffects)
      : null,
    affordable: Boolean(quote) && blockers.length === 0,
    blockers,
    eligibleEngineers: engineers.map((agent) => {
      const engineerQuote = calculateUpgradeQuote(location, agent, technologyEffects)!;
      return {
        id: agent.id,
        name: agent.name,
        level: agent.level,
        assignedLocationId: agent.assignedLocationId,
        treasuryCost: engineerQuote.treasuryCost,
        durationTurns: engineerQuote.durationTurns,
        costDiscountPercent: engineerQuote.costDiscountPercent
      };
    }) as LocationUpgradePreview["eligibleEngineers"]
  };
}

export async function getNationDevelopment(nationId: string): Promise<LocationDevelopmentView> {
  await ensureNationEconomy(prisma as unknown as ServiceClient, nationId);
  const technologyEffects = await getActiveTechnologyEffects(nationId);
  const nation = await prisma.nation.findUnique({
    where: { id: nationId },
    include: {
      economy: true,
      resources: true,
      mapLocations: { include: { assignedAgents: true, worldTile: true }, orderBy: [{ y: "asc" }, { x: "asc" }] },
      upgradeProjects: { include: { engineer: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      infrastructureLinks: { where: { enabled: true } },
      infrastructureProjects: { where: { status: "QUEUED" } },
      settlementProjects: { where: { status: "QUEUED" } }
    }
  });
  if (!nation?.economy) throw notFound("Nation not found");
  const activeProjects = nation.upgradeProjects.filter((project) => project.status === "QUEUED");
  const allActiveProjectCount =
    activeProjects.length + nation.infrastructureProjects.length + nation.settlementProjects.length;
  const limit = projectLimit(
    await effectiveAdministrativeCapacity(
      nationId,
      nation.economy.administrativeCapacity,
      prisma as unknown as ServiceClient
    )
  );
  const infrastructureBenefits = calculateInfrastructureNetworkBenefits(
    nation.infrastructureLinks,
    nation.mapLocations,
    nation.mapLocations.flatMap((location) => location.assignedAgents) as unknown as CharacterAgent[],
    technologyEffects
  );
  return {
    nationId,
    currentTurn: nation.currentTurn,
    activeProjectCount: allActiveProjectCount,
    projectLimit: limit,
    economy: await getEconomySnapshot(nationId),
    locations: nation.mapLocations.map((location) => {
      const agents = location.assignedAgents as AgentLike[];
      return {
        location: serializeLocation(location) as unknown as import("@statecraft/shared").MapLocation,
        yield: calculateLocationYield(
          location,
          agents,
          technologyEffects,
          infrastructureBenefits.find((benefit) => benefit.locationId === location.id) ?? {
            treasuryPercent: 0,
            resourcePercent: 0
          }
        ),
        preview: buildLocationUpgradePreview(
          location,
          agents,
          nation.economy!,
          nation.resources,
          allActiveProjectCount,
          limit,
          technologyEffects
        ),
        activeProject: activeProjects.find((project) => project.locationId === location.id)
          ? projectToShared(activeProjects.find((project) => project.locationId === location.id)!)
          : null,
        assignedAgents: location.assignedAgents.map(serializeAgent) as unknown as CharacterAgent[]
      };
    }),
    projectHistory: nation.upgradeProjects.map(projectToShared)
  };
}

export async function startLocationUpgrade(locationId: string, engineerAgentId?: string | null) {
  return runSerializable(async (client) => {
    const location = await client.mapLocation.findUnique({
      where: { id: locationId },
      include: { nation: { include: { economy: true, resources: true } }, assignedAgents: true, worldTile: true }
    });
    if (!location?.nationId || !location.nation) throw notFound("Map location not found");
    if (["CAPITAL", "CITY", "TOWN"].includes(location.type))
      throw conflict("Full settlements are developed through settlement projects.");
    const technologyEffects = await getActiveTechnologyEffects(location.nationId, client as unknown as ServiceClient);
    await ensureNationEconomy(client as unknown as ServiceClient, location.nationId);
    const economy = await client.nationEconomy.findUniqueOrThrow({ where: { nationId: location.nationId } });
    const [
      activeAtLocation,
      activeCount,
      activeInfrastructureCount,
      activeSettlementCount,
      activeOutposts,
      activeFounding
    ] = await Promise.all([
      client.locationUpgradeProject.findFirst({ where: { locationId, status: "QUEUED" } }),
      client.locationUpgradeProject.count({ where: { nationId: location.nationId, status: "QUEUED" } }),
      client.infrastructureProject.count({ where: { nationId: location.nationId, status: "QUEUED" } }),
      client.settlementProject.count({ where: { nationId: location.nationId, status: "QUEUED" } }),
      client.outpostState.count({ where: { nationId: location.nationId, status: "BUILDING" } }),
      client.settlementFoundingProject.count({ where: { nationId: location.nationId, status: "QUEUED" } })
    ]);
    if (activeAtLocation) throw conflict("This location already has an active upgrade project.");
    const availableAdministration = await effectiveAdministrativeCapacity(
      location.nationId,
      economy.administrativeCapacity,
      client as unknown as ServiceClient
    );
    if (
      activeCount + activeInfrastructureCount + activeSettlementCount + activeOutposts + activeFounding >=
      projectLimit(availableAdministration)
    )
      throw conflict("All national construction slots are in use.");

    let engineer: AgentLike | null = null;
    if (engineerAgentId) {
      engineer = await client.characterAgent.findFirst({
        where: { id: engineerAgentId, nationId: location.nationId }
      });
      if (!engineer) throw notFound("Engineer not found");
      if (engineer.role !== "ENGINEER" || engineer.assignment !== "IMPROVING" || !agentIsPresent(location, engineer))
        throw new ApiError(
          400,
          "INVALID_REQUEST",
          "Engineer must be assigned and physically present to improve this location."
        );
      const existingEngineerProject = await client.locationUpgradeProject.findFirst({
        where: { engineerAgentId, status: "QUEUED" }
      });
      if (existingEngineerProject) throw conflict("This engineer is already supporting another active project.");
    }

    const quote = calculateUpgradeQuote(location, engineer, technologyEffects);
    if (!quote) throw conflict("This location is already at maximum development.");
    if (economy.treasury < quote.treasuryCost) throw conflict("Insufficient treasury for this upgrade.");
    const stockpiles = await client.resourceStockpile.findMany({ where: { nationId: location.nationId } });
    for (const [type, amount] of Object.entries(quote.resourceCosts) as Array<[ResourceType, number]>) {
      if ((stockpiles.find((resource) => resource.type === type)?.amount ?? 0) < amount)
        throw conflict(`Insufficient ${type.toLowerCase().replace("_", " ")} for this upgrade.`);
    }

    const project = await client.locationUpgradeProject.create({
      data: {
        nationId: location.nationId,
        locationId,
        fromLevel: location.developmentLevel,
        targetLevel: quote.targetLevel,
        startedTurn: location.nation.currentTurn,
        completesTurn: location.nation.currentTurn + quote.durationTurns,
        treasuryCost: quote.treasuryCost,
        resourceCostsJson: quote.resourceCosts as Prisma.InputJsonValue,
        engineerAgentId: engineer?.id ?? null,
        costDiscountPercent: quote.costDiscountPercent,
        durationReduction: quote.durationReduction
      },
      include: { engineer: { select: { name: true } } }
    });
    await client.nationEconomy.update({
      where: { nationId: location.nationId },
      data: { treasury: { decrement: quote.treasuryCost } }
    });
    for (const [type, amount] of Object.entries(quote.resourceCosts) as Array<[ResourceType, number]>) {
      await client.resourceStockpile.update({
        where: { nationId_type: { nationId: location.nationId, type } },
        data: { amount: { decrement: amount } }
      });
    }
    await client.economyLedgerEntry.createMany({
      data: [
        {
          nationId: location.nationId,
          turn: location.nation.currentTurn,
          kind: "TREASURY",
          amount: -quote.treasuryCost,
          reason: `Started ${location.name} development level ${quote.targetLevel}`,
          sourceType: "LOCATION_UPGRADE",
          sourceId: project.id
        },
        ...Object.entries(quote.resourceCosts).map(([type, amount]) => ({
          nationId: location.nationId!,
          turn: location.nation!.currentTurn,
          kind: "RESOURCE" as const,
          resourceType: type as ResourceType,
          amount: -(amount ?? 0),
          reason: `Construction materials for ${location.name}`,
          sourceType: "LOCATION_UPGRADE",
          sourceId: project.id
        }))
      ]
    });
    return projectToShared(project);
  });
}

export async function cancelLocationUpgrade(projectId: string) {
  return runSerializable(async (client) => {
    const project = await client.locationUpgradeProject.findUnique({
      where: { id: projectId },
      include: { engineer: { select: { name: true } }, nation: { include: { resources: true } } }
    });
    if (!project) throw notFound("Location upgrade project not found");
    if (project.status !== "QUEUED") throw conflict("Only queued projects can be cancelled.");
    const treasuryRefund = Math.floor((project.treasuryCost * CANCELLATION_REFUND_PERCENT) / 100);
    const costs = project.resourceCostsJson as ResourceCost;
    await client.nationEconomy.update({
      where: { nationId: project.nationId },
      data: { treasury: { increment: treasuryRefund } }
    });
    const ledger: Prisma.EconomyLedgerEntryCreateManyInput[] = [
      {
        nationId: project.nationId,
        turn: project.nation.currentTurn,
        kind: "TREASURY",
        amount: treasuryRefund,
        reason: "Cancelled location development project (75% refund)",
        sourceType: "LOCATION_UPGRADE_REFUND",
        sourceId: project.id
      }
    ];
    for (const [type, paid] of Object.entries(costs) as Array<[ResourceType, number]>) {
      const stockpile = project.nation.resources.find((item) => item.type === type)!;
      const refund = Math.min(
        Math.floor((paid * CANCELLATION_REFUND_PERCENT) / 100),
        stockpile.capacity - stockpile.amount
      );
      if (refund > 0) {
        await client.resourceStockpile.update({ where: { id: stockpile.id }, data: { amount: { increment: refund } } });
        ledger.push({
          nationId: project.nationId,
          turn: project.nation.currentTurn,
          kind: "RESOURCE",
          resourceType: type,
          amount: refund,
          reason: "Recovered construction materials (75% refund)",
          sourceType: "LOCATION_UPGRADE_REFUND",
          sourceId: project.id
        });
      }
    }
    await client.economyLedgerEntry.createMany({ data: ledger });
    const cancelled = await client.locationUpgradeProject.update({
      where: { id: project.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
      include: { engineer: { select: { name: true } } }
    });
    return projectToShared(cancelled);
  });
}

export async function completeDueUpgradeProjects(client: ServiceClient, nationId: string, currentTurn: number) {
  const due = await client.locationUpgradeProject.findMany({
    where: { nationId, status: "QUEUED", completesTurn: { lte: currentTurn } },
    include: { engineer: { select: { name: true } }, location: true },
    orderBy: [{ completesTurn: "asc" }, { createdAt: "asc" }]
  });
  const completed: SharedUpgradeProject[] = [];
  for (const project of due) {
    await client.mapLocation.update({
      where: { id: project.locationId },
      data: { developmentLevel: Math.max(project.location.developmentLevel, project.targetLevel) }
    });
    const updated = await client.locationUpgradeProject.update({
      where: { id: project.id },
      data: { status: "COMPLETED", completedAt: new Date() },
      include: { engineer: { select: { name: true } } }
    });
    await client.economyLedgerEntry.create({
      data: {
        nationId,
        turn: currentTurn,
        kind: "CAPACITY",
        amount: 1,
        reason: `${project.location.name} reached development level ${project.targetLevel}`,
        sourceType: "LOCATION_UPGRADE",
        sourceId: project.id
      }
    });
    completed.push(projectToShared(updated));
  }
  return completed;
}
