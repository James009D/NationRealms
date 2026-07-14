import type { AgentRole, MapLocationType, ResourceType, TechnologyUnlockSource } from "@prisma/client";
import {
  getTechnologyAge,
  TECHNOLOGY_AGES,
  TECHNOLOGY_NODES,
  type NationTechnologyView,
  type TechnologyEffects,
  type TechnologyNodeDefinition,
  type TechnologyNodeStatus,
  type TechnologyResearchContribution,
  type TechnologyUnlock
} from "@statecraft/shared";
import { conflict, notFound } from "../errors.js";
import { prisma } from "../prisma.js";
import { clampStat } from "./eventEffects.js";
import type { ServiceClient } from "./economyService.js";
import { runSerializable } from "./transactions.js";

type ResearchAgent = {
  id: string;
  name: string;
  role: AgentRole;
  assignment: string;
  level: number;
  assignedLocationId?: string | null;
  currentWorldTileId?: string | null;
};

type ResearchLocation = {
  id: string;
  name: string;
  type: MapLocationType;
  resourceType?: ResourceType | null;
  developmentLevel: number;
  worldTileId?: string | null;
};

const eligibleResearchLocations = new Set<MapLocationType>(["CAPITAL", "CITY", "TOWN", "RESOURCE_SITE"]);

function ageIndex(ageId: string) {
  return TECHNOLOGY_AGES.findIndex((age) => age.id === ageId);
}

function nodeIsAvailableAtLevel(node: TechnologyNodeDefinition, technologyLevel: number) {
  return ageIndex(node.ageId) <= ageIndex(getTechnologyAge(technologyLevel).id);
}

function foundationalNodes(baselineTechnologyLevel: number) {
  const baselineAgeIndex = ageIndex(getTechnologyAge(baselineTechnologyLevel).id);
  return TECHNOLOGY_NODES.filter((node) => ageIndex(node.ageId) < baselineAgeIndex);
}

function serializeUnlock(unlock: {
  id: string;
  nationId: string;
  nodeKey: string;
  source: TechnologyUnlockSource;
  unlockedTurn: number;
  researchCost: number;
  createdAt: Date;
}): TechnologyUnlock {
  return { ...unlock, createdAt: unlock.createdAt.toISOString() };
}

export async function ensureNationTechnology(client: ServiceClient, nationId: string, initialResearchPoints = 0) {
  const nation = await client.nation.findUnique({ where: { id: nationId }, include: { stats: true } });
  if (!nation?.stats) throw notFound("Nation not found");
  const state = await client.nationTechnologyState.upsert({
    where: { nationId },
    create: {
      nationId,
      researchPoints: initialResearchPoints,
      baselineTechnologyLevel: nation.stats.technology,
      lastProcessedTurn: nation.currentTurn
    },
    update: {}
  });
  const nodes = foundationalNodes(state.baselineTechnologyLevel);
  if (nodes.length) {
    await client.technologyUnlock.createMany({
      data: nodes.map((node) => ({
        nationId,
        nodeKey: node.key,
        source: "FOUNDATIONAL" as const,
        unlockedTurn: 0,
        researchCost: 0
      })),
      skipDuplicates: true
    });
  }
  return state;
}

function addRecordValues<T extends string>(
  target: Partial<Record<T, number>>,
  source: Partial<Record<T, number>> | undefined,
  minimum: number,
  maximum: number
) {
  for (const [key, value] of Object.entries(source ?? {}) as Array<[T, number]>) {
    target[key] = Math.max(minimum, Math.min(maximum, (target[key] ?? 0) + value));
  }
}

export function aggregateTechnologyEffects(nodes: TechnologyNodeDefinition[]): TechnologyEffects {
  const result: TechnologyEffects = {
    locationTreasuryPercent: {},
    resourceYieldPercent: {},
    locationResourcePercent: {}
  };
  for (const node of nodes) {
    const effects = node.effects;
    result.researchFlat = (result.researchFlat ?? 0) + (effects.researchFlat ?? 0);
    result.researchPercent = Math.min(50, (result.researchPercent ?? 0) + (effects.researchPercent ?? 0));
    result.treasuryIncomePercent = Math.min(
      25,
      (result.treasuryIncomePercent ?? 0) + (effects.treasuryIncomePercent ?? 0)
    );
    result.upgradeTreasuryCostPercent = Math.max(
      -20,
      (result.upgradeTreasuryCostPercent ?? 0) + (effects.upgradeTreasuryCostPercent ?? 0)
    );
    result.upgradeResourceCostPercent = Math.max(
      -20,
      (result.upgradeResourceCostPercent ?? 0) + (effects.upgradeResourceCostPercent ?? 0)
    );
    result.infrastructureTreasuryCostPercent = Math.max(
      -20,
      (result.infrastructureTreasuryCostPercent ?? 0) + (effects.infrastructureTreasuryCostPercent ?? 0)
    );
    result.infrastructureResourceCostPercent = Math.max(
      -20,
      (result.infrastructureResourceCostPercent ?? 0) + (effects.infrastructureResourceCostPercent ?? 0)
    );
    result.infrastructureOutputPercent = Math.min(
      25,
      (result.infrastructureOutputPercent ?? 0) + (effects.infrastructureOutputPercent ?? 0)
    );
    result.foodConsumptionPercent = Math.max(
      -25,
      (result.foodConsumptionPercent ?? 0) + (effects.foodConsumptionPercent ?? 0)
    );
    result.energyConsumptionPercent = Math.max(
      -25,
      Math.min(25, (result.energyConsumptionPercent ?? 0) + (effects.energyConsumptionPercent ?? 0))
    );
    result.populationGrowthPercent = Math.min(
      25,
      (result.populationGrowthPercent ?? 0) + (effects.populationGrowthPercent ?? 0)
    );
    result.militaryReadinessRecovery =
      (result.militaryReadinessRecovery ?? 0) + (effects.militaryReadinessRecovery ?? 0);
    result.activeAgentXp = (result.activeAgentXp ?? 0) + (effects.activeAgentXp ?? 0);
    addRecordValues(result.locationTreasuryPercent!, effects.locationTreasuryPercent, -25, 25);
    addRecordValues(result.locationResourcePercent!, effects.locationResourcePercent, -25, 25);
    addRecordValues(result.resourceYieldPercent!, effects.resourceYieldPercent, -25, 25);
  }
  return result;
}

export function calculateResearchGeneration(input: {
  technologyLevel: number;
  agents: ResearchAgent[];
  locations: ResearchLocation[];
  effects?: TechnologyEffects;
  energyShortage?: boolean;
}) {
  const contributions: TechnologyResearchContribution[] = [];
  const base = 3 + Math.floor(input.technologyLevel / 10);
  contributions.push({ sourceType: "BASE", label: "National technology base", amount: base });

  const scientistByLocation = new Map<string, ResearchAgent>();
  for (const agent of input.agents) {
    if (agent.role !== "SCIENTIST_ADVISOR" || agent.assignment !== "IMPROVING" || !agent.assignedLocationId) continue;
    const location = input.locations.find((item) => item.id === agent.assignedLocationId);
    if (
      !location ||
      !eligibleResearchLocations.has(location.type) ||
      (agent.currentWorldTileId && location.worldTileId && agent.currentWorldTileId !== location.worldTileId)
    )
      continue;
    const existing = scientistByLocation.get(location.id);
    if (!existing || agent.level > existing.level || (agent.level === existing.level && agent.id < existing.id))
      scientistByLocation.set(location.id, agent);
  }
  let scientistTotal = 0;
  for (const [, scientist] of [...scientistByLocation.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const amount = Math.min(10 - scientistTotal, scientist.level * 2);
    if (amount <= 0) break;
    scientistTotal += amount;
    contributions.push({
      sourceType: "SCIENTIST",
      sourceId: scientist.id,
      label: `${scientist.name} research assignment`,
      amount
    });
  }

  let siteTotal = 0;
  for (const location of input.locations
    .filter((item) => item.type === "RESOURCE_SITE" && item.resourceType === "RARE_EARTH")
    .sort((left, right) => left.id.localeCompare(right.id))) {
    const amount = Math.min(10 - siteTotal, location.developmentLevel);
    if (amount <= 0) break;
    siteTotal += amount;
    contributions.push({
      sourceType: "RARE_EARTH_SITE",
      sourceId: location.id,
      label: `${location.name} research materials`,
      amount
    });
  }

  const technologyFlat = input.effects?.researchFlat ?? 0;
  if (technologyFlat)
    contributions.push({ sourceType: "TECHNOLOGY", label: "Unlocked technologies", amount: technologyFlat });
  const subtotal = contributions.reduce((sum, item) => sum + item.amount, 0);
  const percentBonus = Math.min(50, input.effects?.researchPercent ?? 0);
  const percentAmount = Math.floor((subtotal * percentBonus) / 100);
  if (percentAmount)
    contributions.push({ sourceType: "TECHNOLOGY", label: `${percentBonus}% technology bonus`, amount: percentAmount });
  let total = subtotal + percentAmount;
  if (input.energyShortage) {
    const penalty = -(total - Math.max(1, Math.floor(total / 2)));
    contributions.push({ sourceType: "SHORTAGE", label: "Energy shortage", amount: penalty });
    total += penalty;
  }
  return { total: Math.max(1, total), contributions };
}

async function technologyContext(client: ServiceClient, nationId: string) {
  const state = await ensureNationTechnology(client, nationId);
  const [nation, unlocks, recentLedger] = await Promise.all([
    client.nation.findUnique({
      where: { id: nationId },
      include: { stats: true, agents: true, mapLocations: true }
    }),
    client.technologyUnlock.findMany({ where: { nationId }, orderBy: { createdAt: "asc" } }),
    client.technologyLedgerEntry.findMany({ where: { nationId }, orderBy: { createdAt: "desc" }, take: 12 })
  ]);
  if (!nation?.stats) throw notFound("Nation not found");
  return { state, nation, unlocks, recentLedger };
}

function nodeStatus(
  node: TechnologyNodeDefinition,
  technologyLevel: number,
  unlockMap: Map<string, { source: TechnologyUnlockSource }>
): { status: TechnologyNodeStatus; missing: string[] } {
  const unlock = unlockMap.get(node.key);
  const active = nodeIsAvailableAtLevel(node, technologyLevel);
  if (unlock)
    return {
      status: `${unlock.source}_${active ? "ACTIVE" : "SUSPENDED"}` as TechnologyNodeStatus,
      missing: []
    };
  const missing = node.prerequisiteKeys.filter((key) => !unlockMap.has(key));
  if (!active) return { status: "BLOCKED_AGE", missing };
  if (missing.length) return { status: "BLOCKED_PREREQUISITE", missing };
  return { status: "AVAILABLE", missing: [] };
}

export async function getNationTechnology(
  nationId: string,
  client: ServiceClient = prisma
): Promise<NationTechnologyView> {
  const { state, nation, unlocks, recentLedger } = await technologyContext(client, nationId);
  const technologyLevel = nation.stats!.technology;
  const unlockMap = new Map(unlocks.map((unlock) => [unlock.nodeKey, unlock]));
  const activeNodes = TECHNOLOGY_NODES.filter(
    (node) => unlockMap.has(node.key) && nodeIsAvailableAtLevel(node, technologyLevel)
  );
  const effects = aggregateTechnologyEffects(activeNodes);
  const projection = calculateResearchGeneration({
    technologyLevel,
    agents: nation.agents,
    locations: nation.mapLocations,
    effects
  });
  return {
    nationId,
    technologyLevel,
    currentAge: getTechnologyAge(technologyLevel),
    researchPoints: state.researchPoints,
    lifetimeResearch: state.lifetimeResearch,
    baselineTechnologyLevel: state.baselineTechnologyLevel,
    projectedResearch: projection.total,
    projectedContributions: projection.contributions,
    nodes: TECHNOLOGY_NODES.map((node) => {
      const state = nodeStatus(node, technologyLevel, unlockMap);
      const unlock = unlockMap.get(node.key);
      return {
        ...node,
        status: state.status,
        missingPrerequisiteKeys: state.missing,
        unlock: unlock ? serializeUnlock(unlock) : null
      };
    }),
    recentLedger: recentLedger.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() }))
  };
}

export async function getActiveTechnologyEffects(nationId: string, client: ServiceClient = prisma) {
  const view = await getNationTechnology(nationId, client);
  return aggregateTechnologyEffects(
    view.nodes.filter((node) => node.status.endsWith("_ACTIVE")).map((node) => node as TechnologyNodeDefinition)
  );
}

export async function unlockTechnology(nationId: string, nodeKey: string) {
  return runSerializable(async (tx) => {
    const client = tx as unknown as ServiceClient;
    const { state, nation, unlocks } = await technologyContext(client, nationId);
    const node = TECHNOLOGY_NODES.find((item) => item.key === nodeKey);
    if (!node) throw notFound("Technology node not found");
    if (unlocks.some((unlock) => unlock.nodeKey === nodeKey)) throw conflict("Technology is already unlocked.");
    if (!nodeIsAvailableAtLevel(node, nation.stats!.technology))
      throw conflict("The nation has not reached the required technology age.");
    const unlockedKeys = new Set(unlocks.map((unlock) => unlock.nodeKey));
    const missing = node.prerequisiteKeys.filter((key) => !unlockedKeys.has(key));
    if (missing.length) throw conflict(`Missing prerequisite technologies: ${missing.join(", ")}.`);
    if (state.researchPoints < node.researchCost) throw conflict("Insufficient Research Points.");

    const ageBefore = getTechnologyAge(nation.stats!.technology);
    const technologyLevel = clampStat(nation.stats!.technology + node.technologyGain);
    const balance = state.researchPoints - node.researchCost;
    const unlock = await client.technologyUnlock.create({
      data: {
        nationId,
        nodeKey,
        source: "RESEARCHED",
        unlockedTurn: nation.currentTurn,
        researchCost: node.researchCost
      }
    });
    await client.nationTechnologyState.update({
      where: { nationId },
      data: { researchPoints: balance }
    });
    await client.nationStats.update({ where: { nationId }, data: { technology: technologyLevel } });
    await client.technologyLedgerEntry.create({
      data: {
        nationId,
        turn: nation.currentTurn,
        amount: -node.researchCost,
        balance,
        reason: `Unlocked ${node.title}`,
        nodeKey
      }
    });
    const view = await getNationTechnology(nationId, client);
    return {
      unlock: serializeUnlock(unlock),
      node,
      ageBefore,
      ageAfter: getTechnologyAge(technologyLevel),
      view
    };
  });
}

export async function processTurnResearch(
  client: ServiceClient,
  nationId: string,
  technologyLevel: number,
  energyShortage: boolean,
  turn: number
) {
  const { state, nation, unlocks } = await technologyContext(client, nationId);
  const unlockMap = new Map(unlocks.map((unlock) => [unlock.nodeKey, unlock]));
  const activeNodes = TECHNOLOGY_NODES.filter(
    (node) => unlockMap.has(node.key) && nodeIsAvailableAtLevel(node, technologyLevel)
  );
  const effects = aggregateTechnologyEffects(activeNodes);
  const generation = calculateResearchGeneration({
    technologyLevel,
    agents: nation.agents,
    locations: nation.mapLocations,
    effects,
    energyShortage
  });
  const balance = state.researchPoints + generation.total;
  await client.nationTechnologyState.update({
    where: { nationId },
    data: {
      researchPoints: balance,
      lifetimeResearch: { increment: generation.total },
      lastProcessedTurn: turn
    }
  });
  await client.technologyLedgerEntry.create({
    data: {
      nationId,
      turn,
      amount: generation.total,
      balance,
      reason: "Turn research generation"
    }
  });
  return { ...generation, balance };
}

export function technologyActivationChanges(
  unlocks: Array<{ nodeKey: string }>,
  beforeLevel: number,
  afterLevel: number
) {
  const unlocked = new Set(unlocks.map((unlock) => unlock.nodeKey));
  const beforeActive = new Set(
    TECHNOLOGY_NODES.filter((node) => unlocked.has(node.key) && nodeIsAvailableAtLevel(node, beforeLevel)).map(
      (node) => node.key
    )
  );
  const afterActive = new Set(
    TECHNOLOGY_NODES.filter((node) => unlocked.has(node.key) && nodeIsAvailableAtLevel(node, afterLevel)).map(
      (node) => node.key
    )
  );
  return {
    suspended: [...beforeActive].filter((key) => !afterActive.has(key)),
    reactivated: [...afterActive].filter((key) => !beforeActive.has(key))
  };
}
