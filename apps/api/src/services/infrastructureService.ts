import EasyStar from "easystarjs";
import type { InfrastructureType as PrismaInfrastructureType, Prisma, ResourceType } from "@prisma/client";
import {
  type CharacterAgent,
  type InfrastructureLink,
  type InfrastructurePreview,
  type InfrastructureProject,
  type InfrastructureType,
  type NationInfrastructureView,
  type TechnologyEffects,
  type WorldTile
} from "@statecraft/shared";
import { getConfig } from "../config.js";
import { ApiError, conflict, notFound } from "../errors.js";
import { prisma } from "../prisma.js";
import {
  getFallbackAgents,
  getFallbackDevelopment,
  getFallbackEconomySnapshot,
  getFallbackLocations,
  getFallbackNation,
  getFallbackTechnology,
  getFallbackTechnologyEffects,
  chargeFallbackConstruction,
  refundFallbackConstruction
} from "./fallbackDemo.js";
import { constructionProjectLimit as projectLimit, effectiveAdministrativeCapacity } from "./constructionService.js";
import type { ServiceClient } from "./economyService.js";
import { runSerializable } from "./transactions.js";
import { getAllWorldTiles } from "./worldService.js";
import { getActiveTechnologyEffects, getNationTechnology } from "./technologyService.js";
import { calculateInfrastructureNetworkBenefits } from "./infrastructureRules.js";
import { memoryActiveSettlementProjectCount } from "./settlementService.js";
export { calculateInfrastructureNetworkBenefits } from "./infrastructureRules.js";
import {
  memoryInfrastructureLinks as memoryLinks,
  memoryInfrastructureProjects as memoryProjects
} from "./memoryInfrastructureStore.js";

const REFUND_PERCENT = 75;
type PrismaLinkRecord = Prisma.InfrastructureLinkGetPayload<{
  include: { tiles: { include: { tile: true } } };
}>;
type PrismaProjectRecord = Prisma.InfrastructureProjectGetPayload<{
  include: { engineer: { select: { name: true } } };
}>;
const MAX_LINK_LEVEL = 3;
const TERRAIN_CODE: Record<WorldTile["terrain"], number> = {
  OCEAN: 0,
  COAST: 1,
  PLAINS: 2,
  FOREST: 3,
  HILLS: 4,
  MOUNTAIN: 5,
  DESERT: 6,
  WETLAND: 7,
  TUNDRA: 8
};
const ROUTE_COST: Record<InfrastructureType, Partial<Record<WorldTile["terrain"], number>>> = {
  ROAD: { COAST: 2, PLAINS: 1, FOREST: 2, HILLS: 2, MOUNTAIN: 5, DESERT: 2, WETLAND: 4, TUNDRA: 2 },
  RAIL: { COAST: 2, PLAINS: 1, FOREST: 2, HILLS: 3, MOUNTAIN: 8, DESERT: 2, WETLAND: 5, TUNDRA: 3 },
  SEA_LANE: { OCEAN: 1, COAST: 1 }
};

type LocationRecord = {
  id: string;
  nationId?: string | null;
  name: string;
  type: string;
  x: number;
  y: number;
  worldTileId?: string | null;
  worldTile?: WorldTile | null;
};
type QuoteContext = {
  nationId: string;
  currentTurn: number;
  administrativeCapacity: number;
  treasury: number;
  resources: Partial<Record<ResourceType, number>>;
  locations: LocationRecord[];
  agents: CharacterAgent[];
  links: InfrastructureLink[];
  activeLocationProjects: number;
  activeInfrastructureProjects: number;
  activeSettlementProjects?: number;
  technologyKeys: Set<string>;
  technologyEffects: TechnologyEffects;
  activeEngineerAgentIds: Set<string>;
  tiles: WorldTile[];
};

const nowIso = () => new Date().toISOString();
const normalizedPair = (left: string, right: string) =>
  left.localeCompare(right) <= 0 ? ([left, right] as const) : ([right, left] as const);

function routePath(
  tiles: WorldTile[],
  nationId: string,
  from: LocationRecord,
  to: LocationRecord,
  type: InfrastructureType
): Promise<WorldTile[]> {
  const tileMap = new Map(tiles.map((tile) => [`${tile.x}:${tile.y}`, tile]));
  const grid = Array.from({ length: 64 }, (_, y) =>
    Array.from({ length: 96 }, (_, x) => {
      const tile = tileMap.get(`${x}:${y}`);
      if (!tile || tile.ownerNationId !== nationId || ROUTE_COST[type][tile.terrain] === undefined) return 99;
      return TERRAIN_CODE[tile.terrain];
    })
  );
  const finder = new EasyStar.js();
  finder.setGrid(grid);
  const acceptable = [
    ...new Set(
      tiles
        .filter((tile) => tile.ownerNationId === nationId && ROUTE_COST[type][tile.terrain] !== undefined)
        .map((tile) => TERRAIN_CODE[tile.terrain])
    )
  ];
  finder.setAcceptableTiles(acceptable);
  for (const [terrain, cost] of Object.entries(ROUTE_COST[type]))
    finder.setTileCost(TERRAIN_CODE[terrain as WorldTile["terrain"]], cost!);
  finder.disableDiagonals();
  finder.setIterationsPerCalculation(100000);
  return new Promise((resolve) => {
    finder.findPath(from.x, from.y, to.x, to.y, (positions) =>
      resolve((positions ?? []).map((position) => tileMap.get(`${position.x}:${position.y}`)!).filter(Boolean))
    );
    finder.calculate();
  });
}

function technologyActive(keys: Set<string>, key: string) {
  return keys.has(key);
}

export async function buildInfrastructureQuote(
  context: QuoteContext,
  input: { fromLocationId: string; toLocationId: string; type: InfrastructureType; engineerAgentId?: string | null }
): Promise<InfrastructurePreview> {
  const blockers: string[] = [];
  const [fromId, toId] = normalizedPair(input.fromLocationId, input.toLocationId);
  const from = context.locations.find((item) => item.id === fromId);
  const to = context.locations.find((item) => item.id === toId);
  if (!from || !to || from.nationId !== context.nationId || to.nationId !== context.nationId)
    throw notFound("Infrastructure endpoints not found");
  if (from.id === to.id)
    throw new ApiError(400, "INVALID_REQUEST", "Infrastructure endpoints must be different locations.");
  if (input.type === "SEA_LANE" && (from.type !== "PORT" || to.type !== "PORT"))
    blockers.push("Sea lanes require two ports.");
  if (input.type === "SEA_LANE" && !technologyActive(context.technologyKeys, "sailing"))
    blockers.push("Sailing technology is required.");
  if (input.type === "RAIL" && !technologyActive(context.technologyKeys, "steam_power"))
    blockers.push("Steam Power technology is required.");
  if (
    input.type === "RAIL" &&
    !context.links.some(
      (link) =>
        link.type === "ROAD" &&
        link.level >= 2 &&
        normalizedPair(link.fromLocationId, link.toLocationId).join(":") === [fromId, toId].join(":")
    )
  )
    blockers.push("A level 2 road corridor is required before rail construction.");
  const existing = context.links.find(
    (link) =>
      link.type === input.type &&
      normalizedPair(link.fromLocationId, link.toLocationId).join(":") === [fromId, toId].join(":")
  );
  const targetLevel = (existing?.level ?? 0) + 1;
  if (targetLevel > MAX_LINK_LEVEL) blockers.push("This corridor is already at maximum level.");
  if (
    context.activeLocationProjects + context.activeInfrastructureProjects + (context.activeSettlementProjects ?? 0) >=
    projectLimit(context.administrativeCapacity)
  )
    blockers.push("All national construction slots are in use.");
  const engineer = input.engineerAgentId ? context.agents.find((item) => item.id === input.engineerAgentId) : null;
  if (
    input.engineerAgentId &&
    (!engineer ||
      engineer.role !== "ENGINEER" ||
      engineer.assignment !== "IMPROVING" ||
      ![from.id, to.id].includes(engineer.assignedLocationId ?? ""))
  )
    blockers.push("Engineer must be improving one of the corridor endpoints.");
  if (engineer && context.activeEngineerAgentIds.has(engineer.id))
    blockers.push("This engineer is already supporting another project.");
  const routeTiles = blockers.some(
    (blocker) => blocker.includes("ports") || blocker.includes("technology") || blocker.includes("road corridor")
  )
    ? []
    : await routePath(context.tiles, context.nationId, from, to, input.type);
  if (!routeTiles.length) blockers.push("No valid route exists through owned terrain.");
  const terrainCost = routeTiles.reduce((sum, tile) => sum + (ROUTE_COST[input.type][tile.terrain] ?? 0), 0);
  const scale = [0, 1, 1.6, 2.4][targetLevel] ?? 1;
  const discount = engineer ? Math.min(20, engineer.level * 5) : 0;
  const base =
    input.type === "ROAD"
      ? { treasury: 38, resources: { TIMBER: 3, IRON: 1 } }
      : input.type === "RAIL"
        ? { treasury: 65, resources: { IRON: 4, ENERGY: 1 } }
        : { treasury: 52, resources: { TIMBER: 2, IRON: 2 } };
  const treasuryCost = Math.round(
    base.treasury *
      terrainCost *
      scale *
      (1 - discount / 100) *
      (1 + (context.technologyEffects.infrastructureTreasuryCostPercent ?? 0) / 100)
  );
  const resourceCosts = Object.fromEntries(
    Object.entries(base.resources).map(([type, amount]) => [
      type,
      Math.round(
        amount * terrainCost * scale * (1 + (context.technologyEffects.infrastructureResourceCostPercent ?? 0) / 100)
      )
    ])
  ) as Partial<Record<ResourceType, number>>;
  const durationReduction = engineer && engineer.level >= 2 ? 1 : 0;
  const durationTurns = Math.max(1, Math.min(3, Math.ceil(terrainCost / 18) + targetLevel - 1 - durationReduction));
  const affordable =
    context.treasury >= treasuryCost &&
    Object.entries(resourceCosts).every(
      ([type, amount]) => (context.resources[type as ResourceType] ?? 0) >= (amount ?? 0)
    );
  if (!affordable) blockers.push("The nation cannot afford this project.");
  return {
    valid: blockers.length === 0,
    blockers,
    fromLocationId: fromId,
    toLocationId: toId,
    type: input.type,
    targetLevel,
    routeTiles,
    treasuryCost,
    resourceCosts,
    upkeepTreasury: Math.ceil(routeTiles.length * targetLevel * (input.type === "RAIL" ? 3 : 1.5)),
    upkeepEnergy: input.type === "RAIL" ? Math.ceil((routeTiles.length * targetLevel) / 2) : 0,
    durationTurns,
    affordable,
    terrainCost,
    movementSupplyDiscountPercent: input.type === "RAIL" ? 70 : input.type === "ROAD" ? 50 : 35,
    outputBonusPercent: Math.min(
      25,
      (input.type === "RAIL" ? 4 : 2) + targetLevel * 2 + (context.technologyEffects.infrastructureOutputPercent ?? 0)
    )
  };
}

function sharedLink(link: PrismaLinkRecord): InfrastructureLink {
  return {
    ...link,
    type: link.type as InfrastructureType,
    routeTiles: link.tiles.map((item) => ({
      ...item.tile,
      terrain: item.tile.terrain,
      claimedAt: item.tile.claimedAt?.toISOString() ?? null
    })),
    createdAt: link.createdAt instanceof Date ? link.createdAt.toISOString() : link.createdAt,
    updatedAt: link.updatedAt instanceof Date ? link.updatedAt.toISOString() : link.updatedAt
  };
}
function sharedProject(project: PrismaProjectRecord): InfrastructureProject {
  return {
    ...project,
    type: project.type as InfrastructureType,
    resourceCosts: project.resourceCostsJson as Partial<Record<ResourceType, number>>,
    routeTileIds: project.routeTileIdsJson as string[],
    engineerName: project.engineer?.name ?? null,
    createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
    completedAt:
      project.completedAt instanceof Date ? project.completedAt.toISOString() : (project.completedAt ?? null),
    cancelledAt: project.cancelledAt instanceof Date ? project.cancelledAt.toISOString() : (project.cancelledAt ?? null)
  };
}

async function memoryContext(nationId: string): Promise<QuoteContext> {
  const nation = getFallbackNation(nationId);
  const development = getFallbackDevelopment(nationId);
  const economy = getFallbackEconomySnapshot(nationId);
  const locations = getFallbackLocations(nationId);
  if (!nation || !development || !economy || !locations) throw notFound("Nation not found");
  return {
    nationId,
    currentTurn: nation.currentTurn ?? 1,
    administrativeCapacity: await effectiveAdministrativeCapacity(nationId, economy.economy.administrativeCapacity),
    treasury: economy.economy.treasury,
    resources: Object.fromEntries(economy.resources.map((item) => [item.type, item.amount])),
    locations,
    agents: getFallbackAgents(nationId) ?? [],
    links: memoryLinks.filter((item) => item.nationId === nationId),
    activeLocationProjects: development.projectHistory.filter((item) => item.status === "QUEUED").length,
    activeInfrastructureProjects: memoryProjects.filter(
      (item) => item.nationId === nationId && item.status === "QUEUED"
    ).length,
    activeSettlementProjects: memoryActiveSettlementProjectCount(nationId),
    technologyKeys: new Set(
      (getFallbackTechnology(nationId)?.nodes ?? [])
        .filter((node) => node.status.endsWith("ACTIVE"))
        .map((node) => node.key)
    ),
    technologyEffects: getFallbackTechnologyEffects(nationId),
    activeEngineerAgentIds: new Set([
      ...development.projectHistory
        .filter((item) => item.status === "QUEUED" && item.engineerAgentId)
        .map((item) => item.engineerAgentId!),
      ...memoryProjects
        .filter((item) => item.nationId === nationId && item.status === "QUEUED" && item.engineerAgentId)
        .map((item) => item.engineerAgentId!)
    ]),
    tiles: await getAllWorldTiles()
  };
}

async function postgresContext(nationId: string, client: Prisma.TransactionClient = prisma): Promise<QuoteContext> {
  const [technologyView, technologyEffects] = await Promise.all([
    getNationTechnology(nationId, client),
    getActiveTechnologyEffects(nationId, client)
  ]);
  const nation = await client.nation.findUnique({
    where: { id: nationId },
    include: {
      economy: true,
      resources: true,
      mapLocations: { include: { worldTile: true } },
      agents: true,
      infrastructureLinks: {
        where: { scope: "MAJOR" },
        include: { tiles: { include: { tile: true }, orderBy: { sequence: "asc" } } }
      },
      technologyUnlocks: true,
      upgradeProjects: { where: { status: "QUEUED" } },
      infrastructureProjects: { where: { status: "QUEUED" } },
      settlementProjects: { where: { status: "QUEUED" } },
      outposts: { where: { status: "BUILDING" } },
      foundingProjects: { where: { status: "QUEUED" } }
    }
  });
  if (!nation?.economy) throw notFound("Nation not found");
  return {
    nationId,
    currentTurn: nation.currentTurn,
    administrativeCapacity: await effectiveAdministrativeCapacity(
      nationId,
      nation.economy.administrativeCapacity,
      client as unknown as ServiceClient
    ),
    treasury: nation.economy.treasury,
    resources: Object.fromEntries(nation.resources.map((item) => [item.type, item.amount])),
    locations: nation.mapLocations.map((location) => ({
      ...location,
      worldTile: location.worldTile
        ? { ...location.worldTile, claimedAt: location.worldTile.claimedAt?.toISOString() ?? null }
        : null
    })),
    agents: nation.agents.map((agent) => ({
      ...agent,
      traits: agent.traitsJson as unknown as CharacterAgent["traits"],
      skills: agent.skillsJson as unknown as CharacterAgent["skills"],
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString()
    })),
    links: nation.infrastructureLinks.map(sharedLink),
    activeLocationProjects: nation.upgradeProjects.length,
    activeInfrastructureProjects: nation.infrastructureProjects.length,
    activeSettlementProjects:
      nation.settlementProjects.length + nation.outposts.length + nation.foundingProjects.length,
    technologyKeys: new Set(
      technologyView.nodes.filter((item) => item.status.endsWith("_ACTIVE")).map((item) => item.key)
    ),
    technologyEffects,
    activeEngineerAgentIds: new Set(
      [...nation.upgradeProjects, ...nation.infrastructureProjects]
        .map((item) => item.engineerAgentId)
        .filter((id): id is string => Boolean(id))
    ),
    tiles: await getAllWorldTiles(client)
  };
}

export async function previewInfrastructure(
  nationId: string,
  input: { fromLocationId: string; toLocationId: string; type: InfrastructureType; engineerAgentId?: string | null }
) {
  return buildInfrastructureQuote(
    getConfig().DATA_MODE === "memory" ? await memoryContext(nationId) : await postgresContext(nationId),
    input
  );
}

async function completeMemoryDue(nationId: string, turn: number) {
  const tileById = new Map((await getAllWorldTiles()).map((tile) => [tile.id, tile]));
  for (const project of memoryProjects.filter(
    (item) => item.nationId === nationId && item.status === "QUEUED" && item.completesTurn <= turn
  )) {
    const existing = memoryLinks.find((item) => item.id === project.linkId);
    if (existing) {
      existing.level = project.targetLevel;
      existing.updatedAt = nowIso();
    } else {
      const created: InfrastructureLink = {
        id: `memory-link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nationId,
        fromLocationId: project.fromLocationId,
        toLocationId: project.toLocationId,
        type: project.type,
        level: project.targetLevel,
        enabled: true,
        upkeepTreasury: Math.ceil(
          project.routeTileIds.length * project.targetLevel * (project.type === "RAIL" ? 3 : 1.5)
        ),
        upkeepEnergy: project.type === "RAIL" ? Math.ceil((project.routeTileIds.length * project.targetLevel) / 2) : 0,
        routeTiles: project.routeTileIds
          .map((id) => tileById.get(id))
          .filter((tile): tile is WorldTile => Boolean(tile)),
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      memoryLinks.push(created);
      project.linkId = created.id;
    }
    project.status = "COMPLETED";
    project.completedAt = nowIso();
  }
}

export async function getNationInfrastructure(nationId: string): Promise<NationInfrastructureView> {
  if (getConfig().DATA_MODE === "memory") {
    const context = await memoryContext(nationId);
    await completeMemoryDue(nationId, context.currentTurn);
    const tileById = new Map((await getAllWorldTiles()).map((tile) => [tile.id, tile]));
    for (const link of memoryLinks.filter((item) => item.nationId === nationId && item.routeTiles.length === 0)) {
      const project = memoryProjects.find((item) => item.linkId === link.id && item.status === "COMPLETED");
      if (project)
        link.routeTiles = project.routeTileIds
          .map((id) => tileById.get(id))
          .filter((tile): tile is WorldTile => Boolean(tile));
    }
    const projects = memoryProjects.filter((item) => item.nationId === nationId);
    return {
      nationId,
      currentTurn: context.currentTurn,
      activeProjectCount:
        context.activeLocationProjects +
        (context.activeSettlementProjects ?? 0) +
        projects.filter((item) => item.status === "QUEUED").length,
      projectLimit: projectLimit(context.administrativeCapacity),
      links: memoryLinks.filter((item) => item.nationId === nationId),
      activeProjects: projects.filter((item) => item.status === "QUEUED"),
      projectHistory: projects,
      locationBenefits: calculateInfrastructureNetworkBenefits(
        memoryLinks.filter((item) => item.nationId === nationId),
        context.locations,
        context.agents,
        context.technologyEffects
      )
    };
  }
  const context = await postgresContext(nationId);
  const [links, projects] = await Promise.all([
    prisma.infrastructureLink.findMany({
      where: { nationId, scope: "MAJOR" },
      include: { tiles: { include: { tile: true }, orderBy: { sequence: "asc" } } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.infrastructureProject.findMany({
      where: { nationId },
      include: { engineer: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);
  return {
    nationId,
    currentTurn: context.currentTurn,
    activeProjectCount:
      context.activeLocationProjects +
      (context.activeSettlementProjects ?? 0) +
      projects.filter((item) => item.status === "QUEUED").length,
    projectLimit: projectLimit(context.administrativeCapacity),
    links: links.map(sharedLink),
    activeProjects: projects.filter((item) => item.status === "QUEUED").map(sharedProject),
    projectHistory: projects.map(sharedProject),
    locationBenefits: calculateInfrastructureNetworkBenefits(
      links.map(sharedLink),
      context.locations,
      context.agents,
      context.technologyEffects
    )
  };
}

export async function startInfrastructureProject(
  nationId: string,
  input: { fromLocationId: string; toLocationId: string; type: InfrastructureType; engineerAgentId?: string | null }
) {
  if (getConfig().DATA_MODE === "memory") {
    const context = await memoryContext(nationId);
    const quote = await buildInfrastructureQuote(context, input);
    if (!quote.valid) throw conflict(quote.blockers.join(" "));
    const existing = context.links.find(
      (link) =>
        link.type === quote.type &&
        normalizedPair(link.fromLocationId, link.toLocationId).join(":") ===
          [quote.fromLocationId, quote.toLocationId].join(":")
    );
    if (
      memoryProjects.some(
        (item) =>
          item.nationId === nationId &&
          item.status === "QUEUED" &&
          item.type === quote.type &&
          normalizedPair(item.fromLocationId, item.toLocationId).join(":") ===
            [quote.fromLocationId, quote.toLocationId].join(":")
      )
    )
      throw conflict("This corridor already has an active project.");
    const id = `memory-infrastructure-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    chargeFallbackConstruction(
      nationId,
      quote.treasuryCost,
      quote.resourceCosts,
      `Started ${quote.type.toLowerCase()} corridor`,
      id
    );
    const project: InfrastructureProject = {
      id,
      nationId,
      linkId: existing?.id ?? null,
      fromLocationId: quote.fromLocationId,
      toLocationId: quote.toLocationId,
      type: quote.type,
      targetLevel: quote.targetLevel,
      status: "QUEUED",
      startedTurn: context.currentTurn,
      completesTurn: context.currentTurn + quote.durationTurns,
      treasuryCost: quote.treasuryCost,
      resourceCosts: quote.resourceCosts,
      routeTileIds: quote.routeTiles.map((tile) => tile.id),
      engineerAgentId: input.engineerAgentId ?? null,
      engineerName: context.agents.find((item) => item.id === input.engineerAgentId)?.name ?? null,
      costDiscountPercent: context.agents.find((item) => item.id === input.engineerAgentId)
        ? Math.min(20, context.agents.find((item) => item.id === input.engineerAgentId)!.level * 5)
        : 0,
      durationReduction: context.agents.find((item) => item.id === input.engineerAgentId && item.level >= 2) ? 1 : 0,
      createdAt: nowIso(),
      completedAt: null,
      cancelledAt: null
    };
    memoryProjects.unshift(project);
    return project;
  }
  return runSerializable(async (client) => {
    const context = await postgresContext(nationId, client);
    const quote = await buildInfrastructureQuote(context, input);
    if (!quote.valid) throw conflict(quote.blockers.join(" "));
    const existing = context.links.find(
      (link) =>
        link.type === quote.type &&
        normalizedPair(link.fromLocationId, link.toLocationId).join(":") ===
          [quote.fromLocationId, quote.toLocationId].join(":")
    );
    const duplicate = await client.infrastructureProject.findFirst({
      where: {
        nationId,
        fromLocationId: quote.fromLocationId,
        toLocationId: quote.toLocationId,
        type: quote.type as PrismaInfrastructureType,
        status: "QUEUED"
      }
    });
    if (duplicate) throw conflict("This corridor already has an active project.");
    const project = await client.infrastructureProject.create({
      data: {
        nationId,
        linkId: existing?.id ?? null,
        fromLocationId: quote.fromLocationId,
        toLocationId: quote.toLocationId,
        type: quote.type as PrismaInfrastructureType,
        targetLevel: quote.targetLevel,
        startedTurn: context.currentTurn,
        completesTurn: context.currentTurn + quote.durationTurns,
        treasuryCost: quote.treasuryCost,
        resourceCostsJson: quote.resourceCosts as Prisma.InputJsonValue,
        routeTileIdsJson: quote.routeTiles.map((tile) => tile.id),
        engineerAgentId: input.engineerAgentId ?? null,
        costDiscountPercent: context.agents.find((item) => item.id === input.engineerAgentId)
          ? Math.min(20, context.agents.find((item) => item.id === input.engineerAgentId)!.level * 5)
          : 0,
        durationReduction: context.agents.find((item) => item.id === input.engineerAgentId && item.level >= 2) ? 1 : 0
      },
      include: { engineer: { select: { name: true } } }
    });
    await client.nationEconomy.update({ where: { nationId }, data: { treasury: { decrement: quote.treasuryCost } } });
    for (const [type, amount] of Object.entries(quote.resourceCosts) as Array<[ResourceType, number]>)
      await client.resourceStockpile.update({
        where: { nationId_type: { nationId, type } },
        data: { amount: { decrement: amount } }
      });
    await client.economyLedgerEntry.create({
      data: {
        nationId,
        turn: context.currentTurn,
        kind: "TREASURY",
        amount: -quote.treasuryCost,
        reason: `Started ${quote.type.toLowerCase()} corridor`,
        sourceType: "INFRASTRUCTURE",
        sourceId: project.id
      }
    });
    return sharedProject(project);
  });
}

export async function cancelInfrastructureProject(projectId: string) {
  if (getConfig().DATA_MODE === "memory") {
    const project = memoryProjects.find((item) => item.id === projectId);
    if (!project) throw notFound("Infrastructure project not found");
    if (project.status !== "QUEUED") throw conflict("Only queued projects can be cancelled.");
    const treasury = Math.floor((project.treasuryCost * REFUND_PERCENT) / 100);
    const resources = Object.fromEntries(
      Object.entries(project.resourceCosts).map(([type, amount]) => [
        type,
        Math.floor(((amount ?? 0) * REFUND_PERCENT) / 100)
      ])
    ) as Partial<Record<ResourceType, number>>;
    refundFallbackConstruction(project.nationId, treasury, resources, "Cancelled infrastructure project", project.id);
    project.status = "CANCELLED";
    project.cancelledAt = nowIso();
    return project;
  }
  return runSerializable(async (client) => {
    const project = await client.infrastructureProject.findUnique({
      where: { id: projectId },
      include: { engineer: { select: { name: true } } }
    });
    if (!project) throw notFound("Infrastructure project not found");
    if (project.status !== "QUEUED") throw conflict("Only queued projects can be cancelled.");
    const resourceCosts = project.resourceCostsJson as Partial<Record<ResourceType, number>>;
    const treasury = Math.floor((project.treasuryCost * REFUND_PERCENT) / 100);
    await client.nationEconomy.update({
      where: { nationId: project.nationId },
      data: { treasury: { increment: treasury } }
    });
    for (const [type, amount] of Object.entries(resourceCosts) as Array<[ResourceType, number]>)
      await client.resourceStockpile.update({
        where: { nationId_type: { nationId: project.nationId, type } },
        data: { amount: { increment: Math.floor((amount * REFUND_PERCENT) / 100) } }
      });
    const updated = await client.infrastructureProject.update({
      where: { id: project.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
      include: { engineer: { select: { name: true } } }
    });
    return sharedProject(updated);
  });
}

export async function completeDueInfrastructureProjects(
  client: Prisma.TransactionClient,
  nationId: string,
  turn: number
) {
  const due = await client.infrastructureProject.findMany({
    where: { nationId, status: "QUEUED", completesTurn: { lte: turn } },
    orderBy: { createdAt: "asc" }
  });
  const completed: InfrastructureProject[] = [];
  for (const project of due) {
    const routeIds = project.routeTileIdsJson as string[];
    let linkId = project.linkId;
    if (linkId)
      await client.infrastructureLink.update({
        where: { id: linkId },
        data: { level: project.targetLevel, enabled: true }
      });
    else {
      const routeLength = routeIds.length;
      const link = await client.infrastructureLink.create({
        data: {
          nationId,
          fromLocationId: project.fromLocationId,
          toLocationId: project.toLocationId,
          type: project.type,
          level: project.targetLevel,
          upkeepTreasury: Math.ceil(routeLength * project.targetLevel * (project.type === "RAIL" ? 3 : 1.5)),
          upkeepEnergy: project.type === "RAIL" ? Math.ceil((routeLength * project.targetLevel) / 2) : 0,
          tiles: { create: routeIds.map((tileId, sequence) => ({ tileId, sequence })) }
        }
      });
      linkId = link.id;
    }
    const updated = await client.infrastructureProject.update({
      where: { id: project.id },
      data: { status: "COMPLETED", completedAt: new Date(), linkId },
      include: { engineer: { select: { name: true } } }
    });
    completed.push(sharedProject(updated));
  }
  return completed;
}

export function infrastructureLocationBonus(links: InfrastructureLink[], locationId: string) {
  return Math.min(
    15,
    links
      .filter((link) => link.enabled && (link.fromLocationId === locationId || link.toLocationId === locationId))
      .reduce((sum, link) => sum + (link.type === "RAIL" ? 4 : 2) + link.level * 2, 0)
  );
}
export function movementInfrastructureDiscount(
  links: InfrastructureLink[],
  fromLocationId: string,
  toLocationId: string
) {
  const pair = normalizedPair(fromLocationId, toLocationId).join(":");
  const direct = links.filter(
    (link) => link.enabled && normalizedPair(link.fromLocationId, link.toLocationId).join(":") === pair
  );
  return direct.some((link) => link.type === "RAIL")
    ? 70
    : direct.some((link) => link.type === "ROAD")
      ? 50
      : direct.some((link) => link.type === "SEA_LANE")
        ? 35
        : 0;
}

export async function infrastructureProjectNationId(projectId: string) {
  if (getConfig().DATA_MODE === "memory") return memoryProjects.find((item) => item.id === projectId)?.nationId ?? null;
  return (
    (await prisma.infrastructureProject.findUnique({ where: { id: projectId }, select: { nationId: true } }))
      ?.nationId ?? null
  );
}

export async function loadInfrastructureLinks(client: Prisma.TransactionClient, nationId: string) {
  const links = await client.infrastructureLink.findMany({
    where: { nationId, scope: "MAJOR", enabled: true },
    include: { tiles: { include: { tile: true }, orderBy: { sequence: "asc" } } }
  });
  return links.map(sharedLink);
}
