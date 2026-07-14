import { Prisma, type ResourceType } from "@prisma/client";
import {
  POPULATION_PER_LEVEL,
  REGIONAL_IMPROVEMENTS,
  SETTLEMENT_BUILDINGS,
  SETTLEMENT_LEVELS,
  SETTLEMENT_SPECIALIZATIONS,
  housingForSettlement,
  settlementCapacity,
  settlementGrowthRequired,
  type GovernorPriority,
  type EventChoiceEffect,
  type NationalSettlementSummary,
  type RegionDevelopmentView,
  type SettlementContentDefinition,
  type SettlementJobCategory,
  type SettlementLevel,
  type SettlementProject,
  type SettlementProjectInput,
  type SettlementProjectPreview,
  type SettlementSitePreview,
  type SettlementSpecialization,
  type SettlementTurnOutcome,
  type SettlementType,
  type SettlementView,
  type SettlementWorkforceAssignment,
  type TransportationLevel
} from "@statecraft/shared";
import { getConfig } from "../config.js";
import { ApiError, conflict, notFound } from "../errors.js";
import { prisma } from "../prisma.js";
import { constructionProjectLimit, effectiveAdministrativeCapacity } from "./constructionService.js";
import { type ServiceClient } from "./economyService.js";
import {
  chargeFallbackConstruction,
  getFallbackAgents,
  getFallbackDevelopment,
  getFallbackEconomySnapshot,
  getFallbackLocations,
  getFallbackNation,
  refundFallbackConstruction
} from "./fallbackDemo.js";
import { calculateSettlementTurn, validateWorkforce } from "./settlementRules.js";
import { runSerializable } from "./transactions.js";

type ResourceCosts = Partial<Record<ResourceType, number>>;
type SettlementRecord = Awaited<ReturnType<typeof loadSettlementRecord>>;
interface SettlementProjectSource {
  id: string;
  settlementId: string;
  nationId: string;
  regionId?: string | null;
  type: SettlementProject["type"];
  specializationSlot?: "PRIMARY" | "SECONDARY" | null;
  definitionKey: string;
  status: SettlementProject["status"];
  startedTurn: number;
  completesTurn: number;
  effectiveTurn: number;
  treasuryCost: number;
  resourceCostsJson?: unknown;
  resourceCosts?: ResourceCosts;
  createdAt: Date | string;
  completedAt?: Date | string | null;
  cancelledAt?: Date | string | null;
}

const FULL_SETTLEMENT_TYPES = new Set(["CAPITAL", "CITY", "TOWN"]);
const LEVEL_ORDER: SettlementLevel[] = ["TOWN", "CITY", "MAJOR_CITY", "METROPOLIS"];

interface MemorySettlement {
  id: string;
  nationId: string;
  locationId: string;
  regionId: string;
  type: SettlementType;
  level: SettlementLevel;
  residentPopulation: number;
  populationLevel: number;
  growthProgress: number;
  storedFood: number;
  health: number;
  stability: number;
  primarySpecialization: SettlementSpecialization | null;
  secondarySpecialization: SettlementSpecialization | null;
  governorPriority: GovernorPriority;
  governorAgentId: string | null;
  foundingCharter?: import("@statecraft/shared").FoundingCharter | null;
  charterExpiresTurn?: number | null;
  foodShortageTurns: number;
  workforce: SettlementWorkforceAssignment[];
  buildings: Array<{
    id: string;
    definitionKey: string;
    completedTurn: number;
    effectiveTurn: number;
    createdAt: string;
  }>;
  projects: SettlementProject[];
  region: RegionDevelopmentView;
  history: Array<{ id: string; turn: number; type: string; summary: string; createdAt: string }>;
}

const memorySettlements = new Map<string, MemorySettlement[]>();

export function memoryActiveSettlementProjectCount(nationId: string) {
  return ensureMemorySettlements(nationId)
    .flatMap((item) => item.projects)
    .filter((item) => item.status === "QUEUED").length;
}

export function syncMemoryGovernorAssignment(agent: {
  id: string;
  nationId: string;
  role: string;
  assignment: string;
  assignedLocationId?: string | null;
}) {
  const settlements = ensureMemorySettlements(agent.nationId);
  for (const settlement of settlements) {
    if (settlement.governorAgentId === agent.id) settlement.governorAgentId = null;
  }
  if (agent.role !== "GOVERNOR" || agent.assignment !== "GOVERNING" || !agent.assignedLocationId) return;
  const target = settlements.find((settlement) => settlement.locationId === agent.assignedLocationId);
  if (target) target.governorAgentId = agent.id;
}

function iso(value: Date | string | null | undefined) {
  return value instanceof Date ? value.toISOString() : (value ?? null);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function defaultLevel(location: { type: string; population?: number | null }): SettlementLevel {
  const populationLevel = Math.max(1, Math.round((location.population ?? POPULATION_PER_LEVEL) / POPULATION_PER_LEVEL));
  if (populationLevel >= 13) return "METROPOLIS";
  if (populationLevel >= 8) return "MAJOR_CITY";
  if (location.type === "TOWN" && populationLevel <= 3) return "TOWN";
  return "CITY";
}

function transportForLinks(links: Array<{ type: string; level: number; enabled: boolean }>): TransportationLevel {
  const active = links.filter((link) => link.enabled);
  if (active.some((link) => link.type === "RAIL" && link.level >= 3)) return "ADVANCED_NETWORK";
  if (active.some((link) => link.type === "RAIL")) return "RAIL";
  if (active.some((link) => link.type === "ROAD" && link.level >= 2)) return "IMPROVED_ROADS";
  if (active.some((link) => link.type === "ROAD")) return "ROADS";
  return "TRAILS";
}

function downgradeTransport(level: TransportationLevel): TransportationLevel {
  const order: TransportationLevel[] = ["ISOLATED", "TRAILS", "ROADS", "IMPROVED_ROADS", "RAIL", "ADVANCED_NETWORK"];
  return order[Math.max(0, order.indexOf(level) - 1)]!;
}

function terrainSummary(tiles: Array<{ terrain: string }>) {
  return Object.fromEntries(
    [...new Set(tiles.map((tile) => tile.terrain))]
      .sort()
      .map((terrain) => [terrain, tiles.filter((tile) => tile.terrain === terrain).length])
  );
}

function buildingEffects(keys: string[]) {
  return SETTLEMENT_BUILDINGS.filter((definition) => keys.includes(definition.key)).map((item) => item.effects);
}

function availableJobs(input: {
  populationLevel: number;
  buildingKeys: string[];
  improvementKeys: string[];
  sites: Array<{
    id: string;
    name: string;
    type: string;
    resourceType?: ResourceType | null;
    developmentLevel?: number;
  }>;
  existing?: Array<{
    jobKey: string;
    category: SettlementJobCategory;
    assigned: number;
    targetLocationId?: string | null;
  }>;
}): SettlementWorkforceAssignment[] {
  const jobs: SettlementWorkforceAssignment[] = [
    {
      jobKey: "local-food",
      category: "FOOD",
      assigned: 0,
      capacity: Math.max(1, input.populationLevel),
      label: "Local food production"
    },
    { jobKey: "local-commerce", category: "COMMERCE", assigned: 0, capacity: 2, label: "Local commerce" },
    {
      jobKey: "local-administration",
      category: "ADMINISTRATION",
      assigned: 0,
      capacity: 1,
      label: "Local administration"
    }
  ];
  for (const site of input.sites) {
    jobs.push({
      jobKey: `site:${site.id}`,
      category: site.resourceType === "FOOD" || site.type === "FARM" ? "FOOD" : "RESOURCE_SITE",
      assigned: 0,
      capacity: Math.max(1, Math.ceil((site.developmentLevel ?? 1) / 2)),
      label: site.name,
      targetLocationId: site.id
    });
  }
  const effects = [
    ...SETTLEMENT_BUILDINGS.filter((item) => input.buildingKeys.includes(item.key)),
    ...REGIONAL_IMPROVEMENTS.filter((item) => input.improvementKeys.includes(item.key))
  ];
  for (const definition of effects) {
    if (!definition.effects.jobCategory || !definition.effects.jobs) continue;
    jobs.push({
      jobKey: `content:${definition.key}`,
      category: definition.effects.jobCategory,
      assigned: 0,
      capacity: definition.effects.jobs,
      label: definition.label
    });
  }
  const existing = new Map((input.existing ?? []).map((item) => [item.jobKey, item]));
  for (const job of jobs) job.assigned = Math.min(job.capacity, existing.get(job.jobKey)?.assigned ?? 0);
  if (!input.existing?.length) {
    let remaining = input.populationLevel;
    const food = jobs.filter((job) => job.category === "FOOD");
    for (const job of food) {
      const assigned = Math.min(
        job.capacity,
        remaining,
        Math.max(1, Math.ceil(input.populationLevel / 2) - food.indexOf(job))
      );
      job.assigned = assigned;
      remaining -= assigned;
      if (!remaining) break;
    }
    for (const job of jobs.filter(
      (item) => item.category === "RESOURCE_SITE" || item.category === "ADMINISTRATION" || item.category === "COMMERCE"
    )) {
      if (!remaining) break;
      job.assigned = Math.min(job.capacity, 1, remaining);
      remaining -= job.assigned;
    }
  }
  return jobs;
}

function projectShared(project: SettlementProjectSource): SettlementProject {
  return {
    id: project.id,
    settlementId: project.settlementId,
    nationId: project.nationId,
    regionId: project.regionId ?? null,
    type: project.type,
    specializationSlot: project.specializationSlot ?? null,
    definitionKey: project.definitionKey,
    status: project.status,
    startedTurn: project.startedTurn,
    completesTurn: project.completesTurn,
    effectiveTurn: project.effectiveTurn,
    treasuryCost: project.treasuryCost,
    resourceCosts: (project.resourceCostsJson ?? project.resourceCosts ?? {}) as ResourceCosts,
    createdAt: iso(project.createdAt)!,
    completedAt: iso(project.completedAt),
    cancelledAt: iso(project.cancelledAt)
  };
}

async function loadSettlementRecord(id: string, client: ServiceClient = prisma) {
  return client.settlement.findUnique({
    where: { id },
    include: {
      nation: { include: { stats: true, economy: true, technologyUnlocks: true } },
      location: { include: { worldTile: true } },
      governor: true,
      workforce: true,
      buildings: true,
      projects: { orderBy: { createdAt: "desc" } },
      region: { include: { tiles: true, improvements: true } },
      history: { orderBy: { createdAt: "desc" }, take: 20 }
    }
  });
}

async function ensurePostgresSettlements(nationId: string, client: ServiceClient = prisma) {
  const nation = await client.nation.findUnique({
    where: { id: nationId },
    include: {
      stats: true,
      economy: true,
      mapLocations: { include: { worldTile: true } },
      agents: true,
      infrastructureLinks: true,
      worldTiles: true
    }
  });
  if (!nation || !nation.stats) throw notFound("Nation not found");
  const full = nation.mapLocations.filter((location) => FULL_SETTLEMENT_TYPES.has(location.type));
  if (!full.length) return;
  const existing = await client.settlement.findMany({ where: { nationId }, include: { region: true } });
  for (const location of full.filter((location) => !existing.some((item) => item.locationId === location.id))) {
    const region = await client.worldRegion.create({
      data: {
        nationId,
        name: `${location.name} Region`,
        transportationLevel: transportForLinks(nation.infrastructureLinks)
      }
    });
    const secondaryPopulation = full
      .filter((item) => item.type !== "CAPITAL")
      .reduce((sum, item) => sum + (item.population ?? 0), 0);
    const residentPopulation = Math.max(
      1,
      location.type === "CAPITAL"
        ? (nation.economy?.population ?? location.population ?? POPULATION_PER_LEVEL) - secondaryPopulation
        : (location.population ?? POPULATION_PER_LEVEL)
    );
    const governor = nation.agents.find(
      (agent) => agent.role === "GOVERNOR" && agent.assignedLocationId === location.id
    );
    await client.settlement.create({
      data: {
        nationId,
        locationId: location.id,
        regionId: region.id,
        type: location.type === "CAPITAL" ? "CAPITAL" : "SECONDARY",
        level: defaultLevel(location),
        residentPopulation,
        populationLevel: Math.max(1, Math.round(residentPopulation / POPULATION_PER_LEVEL)),
        stability: nation.stats.stability,
        governorAgentId: governor?.id ?? null,
        activatedTurn: nation.currentTurn
      }
    });
  }
  const settlements = await client.settlement.findMany({
    where: { nationId },
    include: { location: true, region: true, workforce: true, buildings: true }
  });
  const byRegion = new Map<string, string[]>();
  for (const tile of nation.worldTiles) {
    const nearest = settlements.reduce(
      (best, settlement) => (distance(tile, settlement.location) < distance(tile, best.location) ? settlement : best),
      settlements[0]!
    );
    if (nearest?.regionId) byRegion.set(nearest.regionId, [...(byRegion.get(nearest.regionId) ?? []), tile.id]);
  }
  for (const [regionId, ids] of byRegion)
    await client.worldTile.updateMany({ where: { id: { in: ids } }, data: { regionId } });
  for (const settlement of settlements) {
    if (settlement.workforce.length) continue;
    const sites = nation.mapLocations.filter(
      (location) =>
        !FULL_SETTLEMENT_TYPES.has(location.type) &&
        settlement.regionId &&
        byRegion.get(settlement.regionId)?.includes(location.worldTileId ?? "")
    );
    const jobs = availableJobs({
      populationLevel: settlement.populationLevel,
      buildingKeys: [],
      improvementKeys: [],
      sites
    });
    await client.settlementWorkforceAssignment.createMany({
      data: jobs.map((job) => ({
        settlementId: settlement.id,
        jobKey: job.jobKey,
        category: job.category,
        assigned: job.assigned,
        targetLocationId: job.targetLocationId ?? null
      })),
      skipDuplicates: true
    });
  }
}

export async function ensureNationSettlements(nationId: string, client: ServiceClient = prisma) {
  if (getConfig().DATA_MODE === "memory") {
    ensureMemorySettlements(nationId);
    return;
  }
  await ensurePostgresSettlements(nationId, client);
}

function ensureMemorySettlements(nationId: string) {
  if (memorySettlements.has(nationId)) return memorySettlements.get(nationId)!;
  const nation = getFallbackNation(nationId);
  const economy = getFallbackEconomySnapshot(nationId);
  const locations = getFallbackLocations(nationId) ?? [];
  if (!nation || !economy) throw notFound("Nation not found");
  const full = locations.filter((location) => FULL_SETTLEMENT_TYPES.has(location.type));
  const agents = getFallbackAgents(nationId) ?? [];
  const secondaryPopulation = full
    .filter((item) => item.type !== "CAPITAL")
    .reduce((sum, item) => sum + (item.population ?? 0), 0);
  const created: MemorySettlement[] = full.map((location): MemorySettlement => {
    const residentPopulation = Math.max(
      1,
      location.type === "CAPITAL"
        ? economy.economy.population - secondaryPopulation
        : (location.population ?? POPULATION_PER_LEVEL)
    );
    const regionId = `memory-region-${location.id}`;
    const sites = locations.filter(
      (item) =>
        !FULL_SETTLEMENT_TYPES.has(item.type) &&
        distance(item, location) <=
          Math.min(...full.filter((other) => other.id !== location.id).map((other) => distance(item, other)), 99)
    );
    const workforce = availableJobs({
      populationLevel: Math.max(1, Math.round(residentPopulation / POPULATION_PER_LEVEL)),
      buildingKeys: [],
      improvementKeys: [],
      sites
    });
    const governor = agents.find((agent) => agent.role === "GOVERNOR" && agent.assignedLocationId === location.id);
    return {
      id: `memory-settlement-${location.id}`,
      nationId,
      locationId: location.id,
      regionId,
      type: location.type === "CAPITAL" ? ("CAPITAL" as const) : ("SECONDARY" as const),
      level: defaultLevel(location),
      residentPopulation,
      populationLevel: Math.max(1, Math.round(residentPopulation / POPULATION_PER_LEVEL)),
      growthProgress: 0,
      storedFood: 20,
      health: 70,
      stability: nation.stats?.stability ?? 60,
      primarySpecialization: null,
      secondarySpecialization: null,
      governorPriority: "BALANCED" as const,
      governorAgentId: governor?.id ?? null,
      foodShortageTurns: 0,
      workforce,
      buildings: [],
      projects: [],
      region: {
        id: regionId,
        name: `${location.name} Region`,
        settlementId: `memory-settlement-${location.id}`,
        transportationLevel: "TRAILS" as const,
        networkReliability: 100,
        neglectTurns: 0,
        terrainSummary: location.terrain ? { [location.terrain]: 1 } : {},
        improvementSlots: SETTLEMENT_LEVELS[defaultLevel(location)].improvementSlots,
        improvements: [],
        strategicSites: sites.map((site) => ({
          id: site.id,
          name: site.name,
          type: site.type,
          resourceType: site.resourceType
        }))
      },
      history: []
    } satisfies MemorySettlement;
  });
  memorySettlements.set(nationId, created);
  return created;
}

export function reserveMemorySettlementPopulation(settlementId: string) {
  for (const records of memorySettlements.values()) {
    const settlement = records.find((item) => item.id === settlementId);
    if (!settlement) continue;
    if (settlement.populationLevel < 2)
      throw conflict("A source settlement must retain at least one population level.");
    settlement.populationLevel -= 1;
    settlement.residentPopulation = Math.max(1, settlement.residentPopulation - POPULATION_PER_LEVEL);
    return { nationId: settlement.nationId, residentPopulation: POPULATION_PER_LEVEL };
  }
  throw notFound("Settlement not found");
}

export function restoreMemorySettlementPopulation(settlementId: string, residentPopulation = POPULATION_PER_LEVEL) {
  for (const records of memorySettlements.values()) {
    const settlement = records.find((item) => item.id === settlementId);
    if (!settlement) continue;
    settlement.populationLevel += 1;
    settlement.residentPopulation += residentPopulation;
    return;
  }
  throw notFound("Settlement not found");
}

export function createMemoryFoundedSettlement(input: {
  nationId: string;
  locationId: string;
  name: string;
  currentTurn: number;
  charter?: import("@statecraft/shared").FoundingCharter;
}) {
  const records = ensureMemorySettlements(input.nationId);
  const existing = records.find((item) => item.locationId === input.locationId);
  if (existing) return existing.id;
  const id = `memory-settlement-${input.locationId}`;
  records.push({
    id,
    nationId: input.nationId,
    locationId: input.locationId,
    regionId: `memory-region-${input.locationId}`,
    type: "SECONDARY",
    level: "TOWN",
    residentPopulation: POPULATION_PER_LEVEL,
    populationLevel: 1,
    growthProgress: 0,
    storedFood: 16,
    health: 65,
    stability: 55,
    primarySpecialization: null,
    secondarySpecialization: null,
    governorPriority: "BALANCED",
    governorAgentId: null,
    foundingCharter: input.charter ?? null,
    charterExpiresTurn: input.charter ? input.currentTurn + 10 : null,
    foodShortageTurns: 0,
    workforce: [{ jobKey: "food", category: "FOOD", assigned: 1, capacity: 1, label: "Food production" }],
    buildings: [],
    projects: [],
    region: {
      id: `memory-region-${input.locationId}`,
      name: `${input.name} Region`,
      settlementId: id,
      transportationLevel: "TRAILS",
      networkReliability: 70,
      neglectTurns: 0,
      terrainSummary: {},
      improvementSlots: SETTLEMENT_LEVELS.TOWN.improvementSlots,
      improvements: [],
      strategicSites: []
    },
    history: []
  });
  return id;
}

async function capacityForNation(nationId: string, count: number, client: ServiceClient = prisma) {
  if (getConfig().DATA_MODE === "memory") {
    const nation = getFallbackNation(nationId);
    const economy = getFallbackEconomySnapshot(nationId);
    if (!nation || !economy) throw notFound("Nation not found");
    return settlementCapacity({
      administrativeCapacity: await effectiveAdministrativeCapacity(nationId, economy.economy.administrativeCapacity),
      governmentType: nation.governmentType,
      nationalStability: nation.stats?.stability ?? 50,
      settlementCount: count
    });
  }
  const nation = await client.nation.findUniqueOrThrow({
    where: { id: nationId },
    include: { stats: true, economy: true, technologyUnlocks: true }
  });
  return settlementCapacity({
    administrativeCapacity: await effectiveAdministrativeCapacity(
      nationId,
      nation.economy?.administrativeCapacity ?? 50,
      client
    ),
    governmentType: nation.governmentType,
    nationalStability: nation.stats?.stability ?? 50,
    technologyKeys: nation.technologyUnlocks.map((item) => item.nodeKey),
    settlementCount: count
  });
}

function memoryView(record: MemorySettlement, capacity: Awaited<ReturnType<typeof capacityForNation>>): SettlementView {
  const location = (getFallbackLocations(record.nationId) ?? []).find((item) => item.id === record.locationId)!;
  const governor = (getFallbackAgents(record.nationId) ?? []).find((item) => item.id === record.governorAgentId);
  const activeProject = record.projects.find((project) => project.status === "QUEUED") ?? null;
  const housingBonus = buildingEffects(record.buildings.map((item) => item.definitionKey)).reduce(
    (sum, effect) => sum + (effect.housing ?? 0),
    0
  );
  const housing = housingForSettlement(record.level, record.type, housingBonus);
  const production = record.workforce
    .filter((item) => item.category === "FOOD")
    .reduce((sum, item) => sum + item.assigned * 12, 0);
  const consumption = record.populationLevel * 8;
  const required = settlementGrowthRequired(record.populationLevel);
  return {
    id: record.id,
    nationId: record.nationId,
    locationId: record.locationId,
    name: location.name,
    type: record.type,
    level: record.level,
    residentPopulation: record.residentPopulation,
    populationLevel: record.populationLevel,
    growth: {
      progress: record.growthProgress,
      required,
      projectedPerTurn: 6 + record.populationLevel * 2,
      estimatedTurns: Math.max(
        1,
        Math.ceil((required - record.growthProgress) / Math.max(1, 6 + record.populationLevel * 2))
      ),
      modifiers: []
    },
    food: {
      production,
      consumption,
      stored: record.storedFood,
      storageCapacity:
        20 +
        buildingEffects(record.buildings.map((item) => item.definitionKey)).reduce(
          (sum, effect) => sum + (effect.foodStorage ?? 0),
          0
        ),
      nationalAccessPercent: record.region.networkReliability,
      security: record.foodShortageTurns ? "SHORTAGE" : production >= consumption ? "SURPLUS" : "STRAINED",
      shortageTurns: record.foodShortageTurns
    },
    housing: {
      capacity: housing,
      populationLevel: record.populationLevel,
      available: Math.max(0, housing - record.populationLevel),
      overcrowding: Math.max(0, record.populationLevel - housing)
    },
    health: { value: record.health, factors: [] },
    stability: { value: record.stability, projectedChange: 0, factors: [] },
    primarySpecialization: record.primarySpecialization,
    secondarySpecialization: record.secondarySpecialization,
    governorPriority: record.governorPriority,
    governor: governor ? { id: governor.id, name: governor.name, level: governor.level } : null,
    workforce: record.workforce,
    buildings: record.buildings,
    activeProject,
    buildingSlots: SETTLEMENT_LEVELS[record.level].buildingSlots + (record.type === "CAPITAL" ? 1 : 0),
    region: record.region,
    warnings: [
      ...(record.foodShortageTurns ? ["Food shortage is suppressing growth."] : []),
      ...(record.populationLevel > housing ? ["Housing capacity is exceeded."] : []),
      ...(capacity.excess ? ["National settlement capacity is exceeded."] : [])
    ]
  };
}

async function postgresView(
  record: NonNullable<SettlementRecord>,
  count: number,
  client: ServiceClient = prisma
): Promise<SettlementView> {
  const capacity = await capacityForNation(record.nationId, count, client);
  const currentTurn = record.nation.currentTurn;
  const buildingKeys = record.buildings
    .filter((item) => item.effectiveTurn <= currentTurn)
    .map((item) => item.definitionKey);
  const improvements = record.region?.improvements.filter((item) => item.effectiveTurn <= currentTurn) ?? [];
  const sites = record.region
    ? await client.mapLocation.findMany({
        where: {
          nationId: record.nationId,
          worldTile: { regionId: record.region.id },
          type: { notIn: ["CAPITAL", "CITY", "TOWN"] }
        }
      })
    : [];
  const workforce = availableJobs({
    populationLevel: record.populationLevel,
    buildingKeys,
    improvementKeys: improvements.map((item) => item.definitionKey),
    sites,
    existing: record.workforce
  });
  const housingBonus = buildingEffects(buildingKeys).reduce((sum, effect) => sum + (effect.housing ?? 0), 0);
  const housing = housingForSettlement(record.level, record.type, housingBonus);
  const production = workforce
    .filter((item) => item.category === "FOOD")
    .reduce((sum, item) => sum + item.assigned * 12, 0);
  const consumption = record.populationLevel * 8;
  const required = settlementGrowthRequired(record.populationLevel);
  const region: RegionDevelopmentView = {
    id: record.region?.id ?? "",
    name: record.region?.name ?? `${record.location.name} Region`,
    settlementId: record.id,
    transportationLevel: record.region?.transportationLevel ?? "ISOLATED",
    networkReliability: record.region?.networkReliability ?? 0,
    neglectTurns: record.region?.neglectTurns ?? 0,
    terrainSummary: terrainSummary(record.region?.tiles ?? []),
    improvementSlots: SETTLEMENT_LEVELS[record.level].improvementSlots,
    improvements: improvements.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    strategicSites: sites.map((site) => ({
      id: site.id,
      name: site.name,
      type: site.type,
      resourceType: site.resourceType
    }))
  };
  return {
    id: record.id,
    nationId: record.nationId,
    locationId: record.locationId,
    name: record.location.name,
    type: record.type,
    level: record.level,
    residentPopulation: record.residentPopulation,
    populationLevel: record.populationLevel,
    growth: {
      progress: record.growthProgress,
      required,
      projectedPerTurn: 6 + record.populationLevel * 2,
      estimatedTurns: Math.max(
        1,
        Math.ceil((required - record.growthProgress) / Math.max(1, 6 + record.populationLevel * 2))
      ),
      modifiers: []
    },
    food: {
      production,
      consumption,
      stored: record.storedFood,
      storageCapacity: 20 + buildingEffects(buildingKeys).reduce((sum, effect) => sum + (effect.foodStorage ?? 0), 0),
      nationalAccessPercent: region.networkReliability,
      security: record.foodShortageTurns ? "SHORTAGE" : production >= consumption ? "SURPLUS" : "STRAINED",
      shortageTurns: record.foodShortageTurns
    },
    housing: {
      capacity: housing,
      populationLevel: record.populationLevel,
      available: Math.max(0, housing - record.populationLevel),
      overcrowding: Math.max(0, record.populationLevel - housing)
    },
    health: { value: record.health, factors: [] },
    stability: { value: record.stability, projectedChange: 0, factors: [] },
    primarySpecialization: record.primarySpecialization,
    secondarySpecialization: record.secondarySpecialization,
    governorPriority: record.governorPriority,
    governor: record.governor
      ? { id: record.governor.id, name: record.governor.name, level: record.governor.level }
      : null,
    workforce,
    buildings: record.buildings.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    activeProject: record.projects.find((item) => item.status === "QUEUED")
      ? projectShared(record.projects.find((item) => item.status === "QUEUED")!)
      : null,
    buildingSlots: SETTLEMENT_LEVELS[record.level].buildingSlots + (record.type === "CAPITAL" ? 1 : 0),
    region,
    warnings: [
      ...(record.foodShortageTurns ? ["Food shortage is suppressing growth."] : []),
      ...(record.populationLevel > housing ? ["Housing capacity is exceeded."] : []),
      ...(capacity.excess ? ["National settlement capacity is exceeded."] : [])
    ]
  };
}

function summary(
  nationId: string,
  capacity: Awaited<ReturnType<typeof capacityForNation>>,
  settlements: SettlementView[]
): NationalSettlementSummary {
  return {
    nationId,
    totalPopulation: settlements.reduce((sum, item) => sum + item.residentPopulation, 0),
    settlementCount: settlements.length,
    capacity,
    growingCount: settlements.filter((item) => item.growth.projectedPerTurn > 0).length,
    shortageCount: settlements.filter((item) => item.food.security === "SHORTAGE").length,
    overcrowdedCount: settlements.filter((item) => item.housing.overcrowding > 0).length,
    unstableCount: settlements.filter((item) => item.stability.value < 40).length,
    activeProjectCount: settlements.filter((item) => item.activeProject).length,
    disconnectedRegionCount: settlements.filter((item) => item.region.transportationLevel === "ISOLATED").length,
    settlements
  };
}

export async function getNationSettlementSummary(
  nationId: string,
  client: ServiceClient = prisma
): Promise<NationalSettlementSummary> {
  if (getConfig().DATA_MODE === "memory") {
    const records = ensureMemorySettlements(nationId);
    const capacity = await capacityForNation(nationId, records.length);
    return summary(
      nationId,
      capacity,
      records.map((record) => memoryView(record, capacity))
    );
  }
  await ensurePostgresSettlements(nationId, client);
  const records = await client.settlement.findMany({
    where: { nationId },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }]
  });
  const views = await Promise.all(
    records.map(async (item) => postgresView((await loadSettlementRecord(item.id, client))!, records.length, client))
  );
  return summary(nationId, await capacityForNation(nationId, records.length, client), views);
}

export async function getSettlementView(settlementId: string, client: ServiceClient = prisma) {
  if (getConfig().DATA_MODE === "memory") {
    for (const records of memorySettlements.values()) {
      const record = records.find((item) => item.id === settlementId);
      if (record) return memoryView(record, await capacityForNation(record.nationId, records.length));
    }
    for (const nationId of ["demo-nation"]) ensureMemorySettlements(nationId);
    for (const records of memorySettlements.values()) {
      const record = records.find((item) => item.id === settlementId);
      if (record) return memoryView(record, await capacityForNation(record.nationId, records.length));
    }
    throw notFound("Settlement not found");
  }
  const record = await loadSettlementRecord(settlementId, client);
  if (!record) throw notFound("Settlement not found");
  const count = await client.settlement.count({ where: { nationId: record.nationId } });
  return postgresView(record, count, client);
}

export async function settlementNationId(settlementId: string) {
  if (getConfig().DATA_MODE === "memory") {
    for (const records of memorySettlements.values()) {
      const found = records.find((item) => item.id === settlementId);
      if (found) return found.nationId;
    }
    return null;
  }
  return (
    (await prisma.settlement.findUnique({ where: { id: settlementId }, select: { nationId: true } }))?.nationId ?? null
  );
}

export async function updateSettlementWorkforce(
  settlementId: string,
  input: Array<{ jobKey: string; assigned: number }>
) {
  if (getConfig().DATA_MODE === "memory") {
    for (const records of memorySettlements.values()) {
      const record = records.find((item) => item.id === settlementId);
      if (!record) continue;
      const merged = record.workforce.map((job) => ({
        ...job,
        assigned: input.find((item) => item.jobKey === job.jobKey)?.assigned ?? 0
      }));
      const issues = validateWorkforce(record.populationLevel, merged);
      if (issues.length) throw new ApiError(409, "WORKFORCE_CONFLICT", "Invalid workforce allocation", issues);
      record.workforce = merged;
      return getSettlementView(settlementId);
    }
    throw notFound("Settlement not found");
  }
  return runSerializable(async (client) => {
    const view = await getSettlementView(settlementId, client as unknown as ServiceClient);
    const merged = view.workforce.map((job) => ({
      ...job,
      assigned: input.find((item) => item.jobKey === job.jobKey)?.assigned ?? 0
    }));
    const issues = validateWorkforce(view.populationLevel, merged);
    if (issues.length) throw new ApiError(409, "WORKFORCE_CONFLICT", "Invalid workforce allocation", issues);
    for (const job of merged)
      await client.settlementWorkforceAssignment.upsert({
        where: { settlementId_jobKey: { settlementId, jobKey: job.jobKey } },
        create: {
          settlementId,
          jobKey: job.jobKey,
          category: job.category,
          assigned: job.assigned,
          targetLocationId: job.targetLocationId ?? null
        },
        update: { assigned: job.assigned, category: job.category, targetLocationId: job.targetLocationId ?? null }
      });
    return getSettlementView(settlementId, client as unknown as ServiceClient);
  });
}

export async function updateGovernorPriority(settlementId: string, priority: GovernorPriority) {
  if (getConfig().DATA_MODE === "memory") {
    for (const records of memorySettlements.values()) {
      const record = records.find((item) => item.id === settlementId);
      if (record) {
        record.governorPriority = priority;
        return getSettlementView(settlementId);
      }
    }
    throw notFound("Settlement not found");
  }
  await prisma.settlement.update({ where: { id: settlementId }, data: { governorPriority: priority } }).catch(() => {
    throw notFound("Settlement not found");
  });
  return getSettlementView(settlementId);
}

function definitionFor(
  input: SettlementProjectInput,
  view: SettlementView
): SettlementContentDefinition & { definitionKey: string } {
  if (input.type === "BUILDING") {
    const definition = SETTLEMENT_BUILDINGS.find((item) => item.key === input.definitionKey);
    if (!definition) throw new ApiError(400, "INVALID_REQUEST", "Unknown settlement building");
    return { ...definition, definitionKey: definition.key };
  }
  if (input.type === "REGIONAL_IMPROVEMENT") {
    const definition = REGIONAL_IMPROVEMENTS.find((item) => item.key === input.definitionKey);
    if (!definition) throw new ApiError(400, "INVALID_REQUEST", "Unknown regional improvement");
    return { ...definition, definitionKey: definition.key };
  }
  if (input.type === "SPECIALIZATION_CHANGE") {
    if (!SETTLEMENT_SPECIALIZATIONS.some((item) => item.value === input.definitionKey))
      throw new ApiError(400, "INVALID_REQUEST", "Unknown settlement specialization");
    return {
      key: input.definitionKey,
      definitionKey: input.definitionKey,
      label: "Specialization change",
      description: "Reorganize the settlement economy.",
      category: "SPECIALIZATION",
      treasuryCost: 300,
      resourceCosts: { TIMBER: 20, IRON: 15 },
      durationTurns: 3,
      effects: {}
    };
  }
  if (input.type === "NETWORK_RESTORATION")
    return {
      key: "network_restoration",
      definitionKey: "network_restoration",
      label: "Network restoration",
      description: "Restore neglected regional connections.",
      category: "TRANSPORT",
      treasuryCost: 220,
      resourceCosts: { TIMBER: 25, IRON: 20, ENERGY: 10 },
      durationTurns: 2,
      effects: { networkReliability: 35 }
    };
  const nextLevel = LEVEL_ORDER[LEVEL_ORDER.indexOf(view.level) + 1];
  if (!nextLevel) throw conflict("This settlement is already a Metropolis.");
  const scale = LEVEL_ORDER.indexOf(nextLevel) + 1;
  return {
    key: nextLevel,
    definitionKey: nextLevel,
    label: `Upgrade to ${SETTLEMENT_LEVELS[nextLevel].label}`,
    description: "Expand the settlement's institutions and urban capacity.",
    category: "SETTLEMENT",
    treasuryCost: 350 * scale,
    resourceCosts: { TIMBER: 40 * scale, IRON: 30 * scale, ENERGY: 10 * scale },
    durationTurns: 2 + scale,
    effects: {}
  };
}

function levelAtLeast(actual: SettlementLevel, required: SettlementLevel) {
  return LEVEL_ORDER.indexOf(actual) >= LEVEL_ORDER.indexOf(required);
}

export async function previewSettlementProject(
  settlementId: string,
  input: SettlementProjectInput
): Promise<SettlementProjectPreview> {
  const view = await getSettlementView(settlementId);
  const definition = definitionFor(input, view);
  const blockers: string[] = [];
  if (view.activeProject) blockers.push("This settlement already has an active project.");
  if (definition.requiredLevel && !levelAtLeast(view.level, definition.requiredLevel))
    blockers.push(`${definition.label} requires ${SETTLEMENT_LEVELS[definition.requiredLevel].label}.`);
  if (input.type === "BUILDING" && view.buildings.some((item) => item.definitionKey === definition.key))
    blockers.push("This building already exists here.");
  if (input.type === "BUILDING" && view.buildings.length >= view.buildingSlots)
    blockers.push("All settlement building slots are occupied.");
  if (input.type === "REGIONAL_IMPROVEMENT" && view.region.improvements.length >= view.region.improvementSlots)
    blockers.push("All regional improvement slots are occupied.");
  if (
    input.type === "REGIONAL_IMPROVEMENT" &&
    view.region.improvements.some((item) => item.definitionKey === definition.key)
  )
    blockers.push("This regional improvement already exists.");
  if (input.type === "SPECIALIZATION_CHANGE") {
    const slot = input.specializationSlot ?? "PRIMARY";
    if (slot === "SECONDARY" && !levelAtLeast(view.level, "MAJOR_CITY"))
      blockers.push("Secondary specialization requires a Major City or Metropolis.");
    if ((slot === "PRIMARY" ? view.primarySpecialization : view.secondarySpecialization) === input.definitionKey)
      blockers.push("This specialization is already active in that slot.");
    if (slot === "SECONDARY" && view.primarySpecialization === input.definitionKey)
      blockers.push("Primary and secondary specializations must be different.");
  }
  if (definition.requiredTerrain && !definition.requiredTerrain.some((terrain) => view.region.terrainSummary[terrain]))
    blockers.push(`${definition.label} requires ${definition.requiredTerrain.join(" or ").toLowerCase()} terrain.`);
  let treasury: number;
  let administrativeCapacity: number;
  let resources: Array<{ type: string; amount: number }>;
  let currentTurn: number;
  if (getConfig().DATA_MODE === "memory") {
    const nation = getFallbackNation(view.nationId);
    const economy = getFallbackEconomySnapshot(view.nationId);
    if (!nation || !economy) throw notFound("Nation not found");
    treasury = economy.economy.treasury;
    administrativeCapacity = economy.economy.administrativeCapacity;
    resources = economy.resources;
    currentTurn = nation.currentTurn ?? 1;
  } else {
    const nation = await prisma.nation.findUnique({
      where: { id: view.nationId },
      include: { economy: true, resources: true }
    });
    if (!nation?.economy) throw notFound("Nation not found");
    treasury = nation.economy.treasury;
    administrativeCapacity = nation.economy.administrativeCapacity;
    resources = nation.resources;
    currentTurn = nation.currentTurn;
  }
  const activeCounts =
    getConfig().DATA_MODE === "memory"
      ? [
          getFallbackDevelopment(view.nationId)?.activeProjectCount ?? 0,
          memoryActiveSettlementProjectCount(view.nationId)
        ]
      : await Promise.all([
          prisma.settlementProject.count({ where: { nationId: view.nationId, status: "QUEUED" } }),
          prisma.locationUpgradeProject.count({ where: { nationId: view.nationId, status: "QUEUED" } }),
          prisma.infrastructureProject.count({ where: { nationId: view.nationId, status: "QUEUED" } }),
          prisma.outpostState.count({ where: { nationId: view.nationId, status: "BUILDING" } }),
          prisma.settlementFoundingProject.count({ where: { nationId: view.nationId, status: "QUEUED" } })
        ]);
  const availableAdministration = await effectiveAdministrativeCapacity(
    view.nationId,
    administrativeCapacity,
    getConfig().DATA_MODE === "memory" ? undefined : (prisma as unknown as ServiceClient)
  );
  if (activeCounts.reduce((a, b) => a + b, 0) >= constructionProjectLimit(availableAdministration))
    blockers.push("All national construction slots are in use.");
  const affordable =
    treasury >= definition.treasuryCost &&
    Object.entries(definition.resourceCosts).every(
      ([type, amount]) => (resources.find((item) => item.type === type)?.amount ?? 0) >= (amount ?? 0)
    );
  return {
    valid: blockers.length === 0,
    blockers,
    project: input,
    treasuryCost: definition.treasuryCost,
    resourceCosts: definition.resourceCosts,
    durationTurns: definition.durationTurns,
    completesTurn: currentTurn + definition.durationTurns,
    effectiveTurn: currentTurn + definition.durationTurns + 1,
    affordable
  };
}

export async function settlementProjectNationId(projectId: string) {
  if (getConfig().DATA_MODE === "memory") {
    for (const records of memorySettlements.values()) {
      for (const record of records) {
        const project = record.projects.find((item) => item.id === projectId);
        if (project) return project.nationId;
      }
    }
    return null;
  }
  return (
    (await prisma.settlementProject.findUnique({ where: { id: projectId }, select: { nationId: true } }))?.nationId ??
    null
  );
}

export async function startSettlementProject(settlementId: string, input: SettlementProjectInput) {
  const preview = await previewSettlementProject(settlementId, input);
  if (!preview.valid) throw conflict(preview.blockers.join(" "));
  if (!preview.affordable) throw conflict("The nation cannot afford this settlement project.");
  const view = await getSettlementView(settlementId);
  if (getConfig().DATA_MODE === "memory") {
    chargeFallbackConstruction(
      view.nationId,
      preview.treasuryCost,
      preview.resourceCosts,
      `Started ${input.definitionKey}`,
      `memory-settlement-project-${Date.now()}`
    );
    const record = ensureMemorySettlements(view.nationId).find((item) => item.id === settlementId)!;
    const project: SettlementProject = {
      id: `memory-settlement-project-${Date.now()}`,
      settlementId,
      nationId: view.nationId,
      regionId: view.region.id,
      type: input.type,
      specializationSlot: input.type === "SPECIALIZATION_CHANGE" ? (input.specializationSlot ?? "PRIMARY") : null,
      definitionKey: input.definitionKey,
      status: "QUEUED",
      startedTurn: getFallbackNation(view.nationId)!.currentTurn ?? 1,
      completesTurn: preview.completesTurn,
      effectiveTurn: preview.effectiveTurn,
      treasuryCost: preview.treasuryCost,
      resourceCosts: preview.resourceCosts,
      createdAt: new Date().toISOString()
    };
    record.projects.unshift(project);
    return project;
  }
  return runSerializable(async (client) => {
    const economy = await client.nationEconomy.findUniqueOrThrow({ where: { nationId: view.nationId } });
    if (economy.treasury < preview.treasuryCost) throw conflict("Insufficient treasury.");
    const stockpiles = await client.resourceStockpile.findMany({ where: { nationId: view.nationId } });
    for (const [type, amount] of Object.entries(preview.resourceCosts) as Array<[ResourceType, number]>)
      if ((stockpiles.find((item) => item.type === type)?.amount ?? 0) < amount)
        throw conflict(`Insufficient ${type.toLowerCase().replaceAll("_", " ")}.`);
    const project = await client.settlementProject.create({
      data: {
        nationId: view.nationId,
        settlementId,
        regionId: view.region.id,
        type: input.type,
        specializationSlot: input.type === "SPECIALIZATION_CHANGE" ? (input.specializationSlot ?? "PRIMARY") : null,
        definitionKey: input.definitionKey,
        startedTurn: (await client.nation.findUniqueOrThrow({ where: { id: view.nationId } })).currentTurn,
        completesTurn: preview.completesTurn,
        effectiveTurn: preview.effectiveTurn,
        treasuryCost: preview.treasuryCost,
        resourceCostsJson: preview.resourceCosts as Prisma.InputJsonValue
      }
    });
    await client.nationEconomy.update({
      where: { nationId: view.nationId },
      data: { treasury: { decrement: preview.treasuryCost } }
    });
    for (const [type, amount] of Object.entries(preview.resourceCosts) as Array<[ResourceType, number]>)
      await client.resourceStockpile.update({
        where: { nationId_type: { nationId: view.nationId, type } },
        data: { amount: { decrement: amount } }
      });
    await client.economyLedgerEntry.createMany({
      data: [
        {
          nationId: view.nationId,
          turn: project.startedTurn,
          kind: "TREASURY",
          amount: -preview.treasuryCost,
          reason: `Started settlement project: ${input.definitionKey}`,
          sourceType: "SETTLEMENT_PROJECT",
          sourceId: project.id
        },
        ...Object.entries(preview.resourceCosts).map(([type, amount]) => ({
          nationId: view.nationId,
          turn: project.startedTurn,
          kind: "RESOURCE" as const,
          resourceType: type as ResourceType,
          amount: -(amount ?? 0),
          reason: `Materials for settlement project: ${input.definitionKey}`,
          sourceType: "SETTLEMENT_PROJECT",
          sourceId: project.id
        }))
      ]
    });
    return projectShared(project);
  });
}

export async function cancelSettlementProject(projectId: string) {
  if (getConfig().DATA_MODE === "memory") {
    for (const records of memorySettlements.values())
      for (const record of records) {
        const project = record.projects.find((item) => item.id === projectId);
        if (!project) continue;
        if (project.status !== "QUEUED") throw conflict("Only queued projects can be cancelled.");
        refundFallbackConstruction(
          project.nationId,
          Math.floor(project.treasuryCost * 0.75),
          Object.fromEntries(
            Object.entries(project.resourceCosts).map(([key, value]) => [key, Math.floor((value ?? 0) * 0.75)])
          ),
          "Cancelled settlement project",
          project.id
        );
        project.status = "CANCELLED";
        project.cancelledAt = new Date().toISOString();
        return project;
      }
    throw notFound("Settlement project not found");
  }
  return runSerializable(async (client) => {
    const project = await client.settlementProject.findUnique({ where: { id: projectId } });
    if (!project) throw notFound("Settlement project not found");
    if (project.status !== "QUEUED") throw conflict("Only queued projects can be cancelled.");
    const resources = project.resourceCostsJson as ResourceCosts;
    const treasuryRefund = Math.floor(project.treasuryCost * 0.75);
    await client.nationEconomy.update({
      where: { nationId: project.nationId },
      data: { treasury: { increment: treasuryRefund } }
    });
    for (const [type, amount] of Object.entries(resources) as Array<[ResourceType, number]>)
      await client.resourceStockpile.update({
        where: { nationId_type: { nationId: project.nationId, type } },
        data: { amount: { increment: Math.floor(amount * 0.75) } }
      });
    const updated = await client.settlementProject.update({
      where: { id: projectId },
      data: { status: "CANCELLED", cancelledAt: new Date() }
    });
    return projectShared(updated);
  });
}

export async function previewSettlementSite(nationId: string, x: number, y: number): Promise<SettlementSitePreview> {
  const summaryView = await getNationSettlementSummary(nationId);
  const locations =
    getConfig().DATA_MODE === "memory"
      ? (getFallbackLocations(nationId) ?? [])
      : await prisma.mapLocation.findMany({ where: { nationId } });
  const full = locations.filter((item) => FULL_SETTLEMENT_TYPES.has(item.type));
  const nearest = full.length ? Math.min(...full.map((item) => distance(item, { x, y }))) : null;
  const warnings = [
    ...(nearest !== null && nearest < 6 ? ["Full settlements must be at least six tiles apart."] : []),
    ...(summaryView.capacity.excess ? ["The nation is already beyond settlement capacity."] : [])
  ];
  return {
    valid: warnings.length === 0,
    x,
    y,
    projectedType: "SECONDARY",
    projectedLevel: "TOWN",
    capacity: {
      ...summaryView.capacity,
      count: summaryView.capacity.count + 1,
      excess: Math.max(0, summaryView.capacity.count + 1 - summaryView.capacity.capacity)
    },
    minimumDistance: 6,
    nearestSettlementDistance: nearest,
    treasuryCost: 900,
    populationTransfer: POPULATION_PER_LEVEL,
    warnings
  };
}

async function completePostgresProjects(client: ServiceClient, nationId: string, currentTurn: number) {
  const due = await client.settlementProject.findMany({
    where: { nationId, status: "QUEUED", completesTurn: { lte: currentTurn } },
    include: { settlement: true, region: true }
  });
  const completed = new Map<string, SettlementProject>();
  for (const project of due) {
    if (project.type === "BUILDING")
      await client.settlementBuilding.upsert({
        where: {
          settlementId_definitionKey: { settlementId: project.settlementId, definitionKey: project.definitionKey }
        },
        create: {
          settlementId: project.settlementId,
          definitionKey: project.definitionKey,
          completedTurn: currentTurn,
          effectiveTurn: currentTurn + 1
        },
        update: {}
      });
    if (project.type === "REGIONAL_IMPROVEMENT" && project.regionId)
      await client.regionalImprovement.upsert({
        where: { regionId_definitionKey: { regionId: project.regionId, definitionKey: project.definitionKey } },
        create: {
          regionId: project.regionId,
          definitionKey: project.definitionKey,
          completedTurn: currentTurn,
          effectiveTurn: currentTurn + 1
        },
        update: { level: { increment: 1 }, completedTurn: currentTurn, effectiveTurn: currentTurn + 1 }
      });
    if (project.type === "SPECIALIZATION_CHANGE")
      await client.settlement.update({
        where: { id: project.settlementId },
        data:
          project.specializationSlot === "SECONDARY"
            ? { secondarySpecialization: project.definitionKey as SettlementSpecialization }
            : { primarySpecialization: project.definitionKey as SettlementSpecialization }
      });
    if (project.type === "SETTLEMENT_UPGRADE")
      await client.settlement.update({
        where: { id: project.settlementId },
        data: { level: project.definitionKey as SettlementLevel }
      });
    if (project.type === "NETWORK_RESTORATION" && project.regionId)
      await client.worldRegion.update({
        where: { id: project.regionId },
        data: { networkReliability: 75, neglectTurns: 0 }
      });
    const updated = await client.settlementProject.update({
      where: { id: project.id },
      data: { status: "COMPLETED", completedAt: new Date(), effectiveTurn: currentTurn + 1 }
    });
    await client.settlementHistoryEntry.create({
      data: {
        nationId,
        settlementId: project.settlementId,
        turn: currentTurn,
        type: "PROJECT_COMPLETED",
        summary: `${project.definitionKey.replaceAll("_", " ")} completed; effects begin next turn.`,
        detailsJson: { projectId: project.id }
      }
    });
    completed.set(project.settlementId, projectShared(updated));
  }
  return completed;
}

export async function processSettlementTurn(
  client: ServiceClient,
  nationId: string,
  currentTurn: number,
  nationalFoodAvailable: number
) {
  await ensurePostgresSettlements(nationId, client);
  const records = await client.settlement.findMany({
    where: { nationId },
    include: {
      location: true,
      governor: true,
      workforce: true,
      buildings: true,
      projects: true,
      region: { include: { improvements: true, tiles: true } }
    }
  });
  const capacity = await capacityForNation(nationId, records.length, client);
  const outcomes: SettlementTurnOutcome[] = [];
  let treasuryIncome = 0;
  let foodProduced = 0;
  let foodConsumed = 0;
  let nationalFoodDraw = 0;
  let populationDelta = 0;
  let researchPoints = 0;
  const [economy, energy, links] = await Promise.all([
    client.nationEconomy.findUniqueOrThrow({ where: { nationId } }),
    client.resourceStockpile.findUnique({ where: { nationId_type: { nationId, type: "ENERGY" } } }),
    client.infrastructureLink.findMany({ where: { nationId, scope: "MAJOR", enabled: true } })
  ]);
  const regionalTreasuryUpkeep = records.length * 5;
  const regionalEnergyUpkeep =
    records.filter((record) => ["RAIL", "ADVANCED_NETWORK"].includes(record.region?.transportationLevel ?? "")).length *
    2;
  const networksFunded = economy.treasury >= regionalTreasuryUpkeep && (energy?.amount ?? 0) >= regionalEnergyUpkeep;
  for (const record of records) {
    const touchingLinks = links.filter(
      (link) => link.fromLocationId === record.locationId || link.toLocationId === record.locationId
    );
    let transportationLevel = transportForLinks(touchingLinks);
    if (
      record.region?.improvements.some(
        (item) => item.definitionKey === "local_transport" && item.effectiveTurn <= currentTurn
      ) &&
      ["ISOLATED", "TRAILS"].includes(transportationLevel)
    )
      transportationLevel = "ROADS";
    let networkReliability = record.region?.networkReliability ?? 100;
    let neglectTurns = record.region?.neglectTurns ?? 0;
    if (networksFunded) {
      if (neglectTurns < 3) {
        networkReliability = Math.min(100, networkReliability + 10);
        neglectTurns = Math.max(0, neglectTurns - 1);
      } else networkReliability = Math.min(60, networkReliability);
    } else {
      networkReliability = Math.max(0, networkReliability - 15);
      neglectTurns += 1;
      if (neglectTurns >= 3 && networkReliability < 50) {
        transportationLevel = downgradeTransport(transportationLevel);
        neglectTurns = 3;
      }
    }
    if (record.region)
      await client.worldRegion.update({
        where: { id: record.region.id },
        data: { transportationLevel, networkReliability, neglectTurns }
      });
    const sites = record.regionId
      ? await client.mapLocation.findMany({
          where: { nationId, worldTile: { regionId: record.regionId }, type: { notIn: ["CAPITAL", "CITY", "TOWN"] } }
        })
      : [];
    const workforce = availableJobs({
      populationLevel: record.populationLevel,
      buildingKeys: record.buildings
        .filter((item) => item.effectiveTurn <= currentTurn)
        .map((item) => item.definitionKey),
      improvementKeys:
        record.region?.improvements
          .filter((item) => item.effectiveTurn <= currentTurn)
          .map((item) => item.definitionKey) ?? [],
      sites,
      existing: record.workforce
    });
    const result = calculateSettlementTurn({
      id: record.id,
      name: record.location.name,
      type: record.type,
      level: record.level,
      residentPopulation: record.residentPopulation,
      populationLevel: record.populationLevel,
      growthProgress: record.growthProgress,
      storedFood: record.storedFood,
      health: record.health,
      stability: record.stability,
      shortageTurns: record.foodShortageTurns,
      primarySpecialization: record.primarySpecialization,
      secondarySpecialization: record.secondarySpecialization,
      governorPriority: record.governorPriority,
      governorLevel:
        record.governor &&
        (!record.governor.currentWorldTileId ||
          !record.location.worldTileId ||
          record.governor.currentWorldTileId === record.location.worldTileId)
          ? record.governor.level
          : undefined,
      workforce,
      buildingKeys: record.buildings
        .filter((item) => item.effectiveTurn <= currentTurn)
        .map((item) => item.definitionKey),
      improvementKeys:
        record.region?.improvements
          .filter((item) => item.effectiveTurn <= currentTurn)
          .map((item) => item.definitionKey) ?? [],
      transportationLevel,
      networkReliability,
      capacity,
      nationalFoodAvailable: Math.max(0, nationalFoodAvailable - nationalFoodDraw),
      populationPerLevel: POPULATION_PER_LEVEL,
      foundingCharter: record.foundingCharter,
      charterActive: Boolean(
        record.foundingCharter && record.charterExpiresTurn && currentTurn <= record.charterExpiresTurn
      )
    });
    if (!networksFunded)
      result.outcome.warnings.push("Regional transport reliability declined because upkeep was not funded.");
    await client.settlement.update({
      where: { id: record.id },
      data: {
        residentPopulation: result.next.residentPopulation,
        populationLevel: result.next.populationLevel,
        growthProgress: result.next.growthProgress,
        storedFood: result.next.storedFood,
        health: result.next.health,
        stability: result.next.stability,
        foodShortageTurns: result.next.shortageTurns
      }
    });
    if (result.outcome.populationLevelChange || result.outcome.shortageStarted || result.outcome.shortageEnded)
      await client.settlementHistoryEntry.create({
        data: {
          nationId,
          settlementId: record.id,
          turn: currentTurn,
          type:
            result.outcome.populationLevelChange > 0
              ? "POPULATION_GROWN"
              : result.outcome.populationLevelChange < 0
                ? "POPULATION_LOST"
                : result.outcome.shortageStarted
                  ? "SHORTAGE_STARTED"
                  : "SHORTAGE_ENDED",
          summary:
            result.outcome.populationLevelChange > 0
              ? `${record.location.name} gained a population level.`
              : result.outcome.populationLevelChange < 0
                ? `${record.location.name} lost a population level.`
                : result.outcome.shortageStarted
                  ? `${record.location.name} entered food shortage.`
                  : `${record.location.name}'s food shortage ended.`,
          detailsJson: result.outcome as unknown as Prisma.InputJsonValue
        }
      });
    outcomes.push(result.outcome);
    treasuryIncome += result.treasuryIncome;
    foodProduced += result.foodProduced;
    foodConsumed += result.foodConsumed;
    nationalFoodDraw += result.nationalFoodDraw;
    populationDelta += result.outcome.populationChange;
    researchPoints += result.researchPoints;
  }
  const completed = await completePostgresProjects(client, nationId, currentTurn);
  for (const outcome of outcomes) outcome.projectCompleted = completed.get(outcome.settlementId) ?? null;
  return {
    outcomes,
    treasuryIncome,
    foodProduced,
    foodConsumed,
    nationalFoodDraw,
    populationDelta,
    researchPoints,
    regionalTreasuryUpkeep: networksFunded ? regionalTreasuryUpkeep : 0,
    regionalEnergyUpkeep: networksFunded ? regionalEnergyUpkeep : 0
  };
}

export function processMemorySettlementTurn(nationId: string, currentTurn: number): SettlementTurnOutcome[] {
  const records = ensureMemorySettlements(nationId);
  const nation = getFallbackNation(nationId);
  const economy = getFallbackEconomySnapshot(nationId);
  if (!nation || !economy) throw notFound("Nation not found");
  const capacity = settlementCapacity({
    administrativeCapacity: economy.economy.administrativeCapacity,
    governmentType: nation.governmentType,
    nationalStability: nation.stats?.stability ?? 50,
    settlementCount: records.length
  });
  const outcomes: SettlementTurnOutcome[] = [];
  for (const record of records) {
    const networksFunded =
      economy.economy.treasury >= records.length * 5 &&
      (economy.resources.find((item) => item.type === "ENERGY")?.amount ?? 0) >= 0;
    if (networksFunded && record.region.neglectTurns < 3) {
      record.region.networkReliability = Math.min(100, record.region.networkReliability + 10);
      record.region.neglectTurns = Math.max(0, record.region.neglectTurns - 1);
    }
    if (!networksFunded) {
      record.region.networkReliability = Math.max(0, record.region.networkReliability - 15);
      record.region.neglectTurns = Math.min(3, record.region.neglectTurns + 1);
      if (record.region.neglectTurns >= 3 && record.region.networkReliability < 50)
        record.region.transportationLevel = downgradeTransport(record.region.transportationLevel);
    }
    const result = calculateSettlementTurn({
      id: record.id,
      name: record.region.name.replace(/ Region$/, ""),
      type: record.type,
      level: record.level,
      residentPopulation: record.residentPopulation,
      populationLevel: record.populationLevel,
      growthProgress: record.growthProgress,
      storedFood: record.storedFood,
      health: record.health,
      stability: record.stability,
      shortageTurns: record.foodShortageTurns,
      primarySpecialization: record.primarySpecialization,
      secondarySpecialization: record.secondarySpecialization,
      governorPriority: record.governorPriority,
      governorLevel: (() => {
        const governor = (getFallbackAgents(nationId) ?? []).find((agent) => agent.id === record.governorAgentId);
        const location = (getFallbackLocations(nationId) ?? []).find((item) => item.id === record.locationId);
        return governor &&
          (!governor.currentWorldTileId ||
            !location?.worldTileId ||
            governor.currentWorldTileId === location.worldTileId)
          ? governor.level
          : undefined;
      })(),
      workforce: record.workforce,
      buildingKeys: record.buildings
        .filter((item) => item.effectiveTurn <= currentTurn)
        .map((item) => item.definitionKey),
      improvementKeys: record.region.improvements
        .filter((item) => item.effectiveTurn <= currentTurn)
        .map((item) => item.definitionKey),
      transportationLevel: record.region.transportationLevel,
      networkReliability: record.region.networkReliability,
      capacity,
      nationalFoodAvailable: economy.resources.find((item) => item.type === "FOOD")?.amount ?? 0,
      populationPerLevel: POPULATION_PER_LEVEL,
      foundingCharter: record.foundingCharter,
      charterActive: Boolean(
        record.foundingCharter && record.charterExpiresTurn && currentTurn <= record.charterExpiresTurn
      )
    });
    Object.assign(record, result.next);
    const due = record.projects.filter(
      (project) => project.status === "QUEUED" && project.completesTurn <= currentTurn
    );
    for (const project of due) {
      project.status = "COMPLETED";
      project.completedAt = new Date().toISOString();
      project.effectiveTurn = currentTurn + 1;
      if (project.type === "BUILDING")
        record.buildings.push({
          id: `memory-building-${project.id}`,
          definitionKey: project.definitionKey,
          completedTurn: currentTurn,
          effectiveTurn: currentTurn + 1,
          createdAt: new Date().toISOString()
        });
      if (project.type === "REGIONAL_IMPROVEMENT")
        record.region.improvements.push({
          id: `memory-improvement-${project.id}`,
          definitionKey: project.definitionKey,
          level: 1,
          completedTurn: currentTurn,
          effectiveTurn: currentTurn + 1,
          createdAt: new Date().toISOString()
        });
      if (project.type === "SPECIALIZATION_CHANGE") {
        if (project.specializationSlot === "SECONDARY")
          record.secondarySpecialization = project.definitionKey as SettlementSpecialization;
        else record.primarySpecialization = project.definitionKey as SettlementSpecialization;
      }
      if (project.type === "SETTLEMENT_UPGRADE") record.level = project.definitionKey as SettlementLevel;
      if (project.type === "NETWORK_RESTORATION") {
        record.region.networkReliability = 75;
        record.region.neglectTurns = 0;
      }
      result.outcome.projectCompleted = project;
    }
    outcomes.push(result.outcome);
  }
  return outcomes;
}

export function applyMemorySettlementEventEffects(nationId: string, effects: EventChoiceEffect) {
  const records = ensureMemorySettlements(nationId);
  for (const change of effects.settlementChanges ?? []) {
    const candidates = change.settlementId ? records.filter((item) => item.id === change.settlementId) : [...records];
    candidates.sort((a, b) =>
      change.selector === "LOWEST_STABILITY"
        ? a.stability - b.stability || a.id.localeCompare(b.id)
        : change.selector === "HIGHEST_GROWTH"
          ? b.growthProgress - a.growthProgress || a.id.localeCompare(b.id)
          : a.type === "CAPITAL"
            ? -1
            : b.type === "CAPITAL"
              ? 1
              : a.id.localeCompare(b.id)
    );
    const record = candidates[0];
    if (!record) continue;
    record.stability = clamp(record.stability + (change.stability ?? 0), 0, 100);
    record.health = clamp(record.health + (change.health ?? 0), 0, 100);
    record.growthProgress = Math.max(0, record.growthProgress + (change.growthProgress ?? 0));
    record.storedFood = Math.max(0, record.storedFood + (change.storedFood ?? 0));
  }
  for (const change of effects.regionReliabilityChanges ?? []) {
    const record = records.find((item) =>
      change.regionId
        ? item.region.id === change.regionId
        : change.settlementId
          ? item.id === change.settlementId
          : true
    );
    if (record) record.region.networkReliability = clamp(record.region.networkReliability + change.amount, 0, 100);
  }
}
