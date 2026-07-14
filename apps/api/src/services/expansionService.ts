import { randomUUID } from "node:crypto";
import type { ResourceType, SettlementFoundingProject as PrismaFoundingProject } from "@prisma/client";
import {
  COLONIST_TRAINING_COST,
  EXPANSION_BALANCE,
  FOUNDING_CHARTERS,
  OUTPOST_COST,
  POPULATION_PER_LEVEL,
  SETTLEMENT_FOUNDING_COST,
  TERRAIN_DEFINITIONS,
  frontierAdministrativeLoad,
  territoryClaimLimit,
  type CivilianUnit,
  type ExpansionProject,
  type ExpansionTurnOutcome,
  type FoundingCharter,
  type FoundingPreview,
  type NationTerritoryView,
  type OutpostView,
  type ResourceType as SharedResourceType,
  type TerritoryClaim,
  type TerritoryClaimPreview,
  type WorldTile
} from "@statecraft/shared";
import { getConfig } from "../config.js";
import { conflict, notFound } from "../errors.js";
import { prisma } from "../prisma.js";
import { constructionProjectLimit, effectiveAdministrativeCapacity } from "./constructionService.js";
import type { ServiceClient } from "./economyService.js";
import { buildClaimPlan, calculateSupplyForPath, civilianMovement, spendClaimInfluence } from "./expansionRules.js";
import {
  addFallbackLocation,
  chargeFallbackConstruction,
  getFallbackEconomySnapshot,
  getFallbackDevelopment,
  getFallbackLocations,
  getFallbackNation,
  refundFallbackConstruction,
  updateFallbackLocation
} from "./fallbackDemo.js";
import { findDeterministicTilePath } from "./mapPathService.js";
import {
  createMemoryFoundedSettlement,
  getNationSettlementSummary,
  memoryActiveSettlementProjectCount,
  reserveMemorySettlementPopulation,
  restoreMemorySettlementPopulation
} from "./settlementService.js";
import { runSerializable } from "./transactions.js";
import { getAllWorldTiles, updateMemoryWorldTiles } from "./worldService.js";

type ResourceCosts = Partial<Record<SharedResourceType, number>>;

const memoryClaims: TerritoryClaim[] = [];
const memorySurveys = new Set<string>();
const memoryOutposts: OutpostView[] = [];
const memoryCivilians: CivilianUnit[] = [];
const memoryProjects: Array<
  ExpansionProject & {
    outpostId?: string;
    settlementId?: string;
    colonistId?: string;
    settlementName?: string;
    charter?: FoundingCharter;
    locationId?: string;
    reservedResidentPopulation?: number;
  }
> = [];

export async function getNationSurveyedTileIds(nationId: string) {
  if (getConfig().DATA_MODE === "memory") {
    return [...memorySurveys]
      .filter((key) => key.startsWith(`${nationId}:`))
      .map((key) => key.slice(nationId.length + 1));
  }
  const surveys = await prisma.tileSurvey.findMany({ where: { nationId }, select: { tileId: true } });
  return surveys.map((survey) => survey.tileId);
}

const now = () => new Date().toISOString();
const resourceCosts = (value: unknown) => (value ?? {}) as ResourceCosts;
const iso = (value: Date | string | null | undefined) =>
  value instanceof Date ? value.toISOString() : (value ?? null);

function serializeClaim(record: {
  id: string;
  nationId: string;
  anchorLocationId: string;
  targetTileId: string;
  status: TerritoryClaim["status"];
  startedTurn: number;
  completedTurn: number | null;
  influenceCarry: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  tiles: Array<{
    id: string;
    sequence: number;
    influenceCost: number;
    influenceProgress: number;
    claimedTurn: number | null;
    tile: WorldTile & { claimedAt?: Date | string | null };
  }>;
}): TerritoryClaim {
  return {
    ...record,
    createdAt: iso(record.createdAt)!,
    updatedAt: iso(record.updatedAt)!,
    tiles: record.tiles.map((item) => ({
      ...item,
      tile: { ...item.tile, claimedAt: iso(item.tile.claimedAt) }
    }))
  };
}

function serializeOutpost(record: {
  id: string;
  nationId: string;
  locationId: string;
  parentSettlementId: string;
  claimId: string | null;
  status: OutpostView["status"];
  suppliedTurns: number;
  unsuppliedTurns: number;
  supplyScore: number;
  establishedTurn: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): OutpostView {
  return {
    ...record,
    establishedTurn: record.establishedTurn,
    mature: record.status === "ACTIVE" && record.suppliedTurns >= EXPANSION_BALANCE.outpostMaturityTurns,
    createdAt: iso(record.createdAt)!,
    updatedAt: iso(record.updatedAt)!
  };
}

function serializeCivilian(record: {
  id: string;
  nationId: string;
  type: CivilianUnit["type"];
  name: string;
  status: CivilianUnit["status"];
  sourceSettlementId: string;
  currentWorldTileId: string;
  populationLevel: number;
  residentPopulation: number;
  health: number;
  supply: number;
  travelRouteTileIdsJson?: unknown;
  travelRouteTileIds?: string[];
  travelRouteIndex: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}): CivilianUnit {
  return {
    ...record,
    travelRouteTileIds: (record.travelRouteTileIds ?? record.travelRouteTileIdsJson ?? []) as string[],
    createdAt: iso(record.createdAt)!,
    updatedAt: iso(record.updatedAt)!
  };
}

async function charge(
  client: ServiceClient,
  nationId: string,
  turn: number,
  treasury: number,
  resources: ResourceCosts,
  reason: string,
  sourceId: string
) {
  const economy = await client.nationEconomy.findUniqueOrThrow({ where: { nationId } });
  if (economy.treasury < treasury) throw conflict("Insufficient treasury.");
  for (const [type, amount] of Object.entries(resources) as Array<[ResourceType, number]>) {
    const stock = await client.resourceStockpile.findUnique({ where: { nationId_type: { nationId, type } } });
    if (!stock || stock.amount < amount) throw conflict(`Insufficient ${type.toLowerCase().replaceAll("_", " ")}.`);
  }
  await client.nationEconomy.update({ where: { nationId }, data: { treasury: { decrement: treasury } } });
  for (const [type, amount] of Object.entries(resources) as Array<[ResourceType, number]>)
    await client.resourceStockpile.update({
      where: { nationId_type: { nationId, type } },
      data: { amount: { decrement: amount } }
    });
  await client.economyLedgerEntry.createMany({
    data: [
      { nationId, turn, kind: "TREASURY", amount: -treasury, reason, sourceType: "EXPANSION", sourceId },
      ...Object.entries(resources).map(([type, amount]) => ({
        nationId,
        turn,
        kind: "RESOURCE" as const,
        resourceType: type as ResourceType,
        amount: -(amount ?? 0),
        reason,
        sourceType: "EXPANSION",
        sourceId
      }))
    ]
  });
}

async function refund(
  client: ServiceClient,
  nationId: string,
  turn: number,
  treasury: number,
  resources: ResourceCosts,
  reason: string,
  sourceId: string
) {
  await client.nationEconomy.update({ where: { nationId }, data: { treasury: { increment: treasury } } });
  for (const [type, amount] of Object.entries(resources) as Array<[ResourceType, number]>)
    await client.resourceStockpile.update({
      where: { nationId_type: { nationId, type } },
      data: { amount: { increment: amount } }
    });
  await client.economyLedgerEntry.create({
    data: { nationId, turn, kind: "TREASURY", amount: treasury, reason, sourceType: "EXPANSION", sourceId }
  });
}

async function postgresProjectCount(client: ServiceClient, nationId: string) {
  const [location, infrastructure, settlement, outposts, founding] = await Promise.all([
    client.locationUpgradeProject.count({ where: { nationId, status: "QUEUED" } }),
    client.infrastructureProject.count({ where: { nationId, status: "QUEUED" } }),
    client.settlementProject.count({ where: { nationId, status: "QUEUED" } }),
    client.outpostState.count({ where: { nationId, status: "BUILDING" } }),
    client.settlementFoundingProject.count({ where: { nationId, status: "QUEUED" } })
  ]);
  return location + infrastructure + settlement + outposts + founding;
}

function memoryProjectCount(nationId: string) {
  return (
    (getFallbackDevelopment(nationId)?.activeProjectCount ?? 0) +
    memoryActiveSettlementProjectCount(nationId) +
    memoryProjects.filter((item) => item.nationId === nationId && item.status === "QUEUED").length
  );
}

export async function recordTileSurvey(nationId: string, tileId: string, agentId?: string | null) {
  const nation = getConfig().DATA_MODE === "memory" ? getFallbackNation(nationId) : null;
  if (getConfig().DATA_MODE === "memory") {
    if (!nation) throw notFound("Nation not found");
    memorySurveys.add(`${nationId}:${tileId}`);
    return { nationId, tileId, agentId: agentId ?? null, turn: nation.currentTurn ?? 1 };
  }
  const current = await prisma.nation.findUnique({ where: { id: nationId }, select: { currentTurn: true } });
  if (!current) throw notFound("Nation not found");
  return prisma.tileSurvey.upsert({
    where: { nationId_tileId: { nationId, tileId } },
    create: { nationId, tileId, agentId: agentId ?? null, turn: current.currentTurn },
    update: { agentId: agentId ?? null, turn: current.currentTurn }
  });
}

export async function previewTerritoryClaim(
  nationId: string,
  anchorLocationId: string,
  targetTileId: string
): Promise<TerritoryClaimPreview> {
  const tiles = await getAllWorldTiles();
  if (getConfig().DATA_MODE === "memory") {
    const nation = getFallbackNation(nationId);
    const economy = getFallbackEconomySnapshot(nationId);
    const anchor = getFallbackLocations(nationId)?.find((item) => item.id === anchorLocationId);
    if (!nation || !economy || !anchor?.worldTileId) throw notFound("Nation or anchor location not found");
    const surveyed = new Set(
      tiles.filter((tile) => memorySurveys.has(`${nationId}:${tile.id}`)).map((tile) => tile.id)
    );
    const plan = buildClaimPlan(tiles, nationId, anchor.worldTileId, targetTileId, surveyed);
    const active = memoryClaims.filter(
      (claim) => claim.nationId === nationId && ["ACTIVE", "PAUSED"].includes(claim.status)
    ).length;
    const limit = territoryClaimLimit(economy.economy.administrativeCapacity);
    if (active >= limit) plan.blockers.push("All frontier focus slots are in use.");
    return {
      valid: plan.blockers.length === 0,
      blockers: plan.blockers,
      anchorLocationId,
      targetTile:
        tiles.find((tile) => tile.id === targetTileId) ??
        (() => {
          throw notFound("Target tile not found");
        })(),
      plannedTiles: plan.tiles,
      estimatedTurns: Math.max(
        1,
        Math.ceil(plan.tiles.reduce((sum, item) => sum + item.influenceCost, 0) / EXPANSION_BALANCE.settlementInfluence)
      ),
      activeClaimCount: active,
      claimLimit: limit,
      treasuryUpkeep: EXPANSION_BALANCE.claimTreasuryUpkeep
    };
  }
  const [nation, anchor, surveys, active] = await Promise.all([
    prisma.nation.findUnique({ where: { id: nationId }, include: { economy: true } }),
    prisma.mapLocation.findFirst({
      where: { id: anchorLocationId, nationId },
      include: { settlement: true, outpost: true }
    }),
    prisma.tileSurvey.findMany({ where: { nationId }, select: { tileId: true } }),
    prisma.territoryClaim.count({ where: { nationId, status: { in: ["ACTIVE", "PAUSED"] } } })
  ]);
  if (!nation?.economy || !anchor?.worldTileId) throw notFound("Nation or anchor location not found");
  if (!anchor.settlement && !(anchor.outpost?.status === "ACTIVE" && anchor.outpost.suppliedTurns >= 4))
    throw conflict("Frontier claims require a settlement or mature supplied outpost anchor.");
  const plan = buildClaimPlan(
    tiles,
    nationId,
    anchor.worldTileId,
    targetTileId,
    new Set(surveys.map((item) => item.tileId))
  );
  const limit = territoryClaimLimit(nation.economy.administrativeCapacity);
  if (active >= limit) plan.blockers.push("All frontier focus slots are in use.");
  const target = tiles.find((tile) => tile.id === targetTileId);
  if (!target) throw notFound("Target tile not found");
  return {
    valid: plan.blockers.length === 0,
    blockers: plan.blockers,
    anchorLocationId,
    targetTile: target,
    plannedTiles: plan.tiles,
    estimatedTurns: Math.max(
      1,
      Math.ceil(plan.tiles.reduce((sum, item) => sum + item.influenceCost, 0) / EXPANSION_BALANCE.settlementInfluence)
    ),
    activeClaimCount: active,
    claimLimit: limit,
    treasuryUpkeep: EXPANSION_BALANCE.claimTreasuryUpkeep
  };
}

export async function startTerritoryClaim(nationId: string, anchorLocationId: string, targetTileId: string) {
  const preview = await previewTerritoryClaim(nationId, anchorLocationId, targetTileId);
  if (!preview.valid) throw conflict(preview.blockers.join(" "));
  if (getConfig().DATA_MODE === "memory") {
    const nation = getFallbackNation(nationId)!;
    const claim: TerritoryClaim = {
      id: `memory-claim-${randomUUID()}`,
      nationId,
      anchorLocationId,
      targetTileId,
      status: "ACTIVE",
      startedTurn: nation.currentTurn ?? 1,
      completedTurn: null,
      influenceCarry: 0,
      tiles: preview.plannedTiles.map((item, sequence) => ({
        tile: item.tile,
        sequence,
        influenceCost: item.influenceCost,
        influenceProgress: 0,
        claimedTurn: null
      })),
      createdAt: now(),
      updatedAt: now()
    };
    memoryClaims.push(claim);
    return claim;
  }
  return runSerializable(async (client) => {
    const nation = await client.nation.findUniqueOrThrow({ where: { id: nationId } });
    const created = await client.territoryClaim.create({
      data: {
        nationId,
        anchorLocationId,
        targetTileId,
        startedTurn: nation.currentTurn,
        tiles: {
          create: preview.plannedTiles.map((item, sequence) => ({
            tileId: item.tile.id,
            sequence,
            influenceCost: item.influenceCost
          }))
        }
      },
      include: { tiles: { include: { tile: true }, orderBy: { sequence: "asc" } } }
    });
    return serializeClaim(created as never);
  });
}

export async function cancelTerritoryClaim(claimId: string) {
  if (getConfig().DATA_MODE === "memory") {
    const claim = memoryClaims.find((item) => item.id === claimId);
    if (!claim) throw notFound("Territory claim not found");
    if (!["ACTIVE", "PAUSED"].includes(claim.status)) throw conflict("This claim can no longer be cancelled.");
    claim.status = "CANCELLED";
    claim.updatedAt = now();
    return claim;
  }
  return runSerializable(async (client) => {
    const claim = await client.territoryClaim.findUnique({ where: { id: claimId } });
    if (!claim) throw notFound("Territory claim not found");
    if (!(["ACTIVE", "PAUSED"] as string[]).includes(claim.status))
      throw conflict("This claim can no longer be cancelled.");
    const updated = await client.territoryClaim.update({
      where: { id: claimId },
      data: { status: "CANCELLED" },
      include: { tiles: { include: { tile: true } } }
    });
    await client.territoryHistoryEntry.create({
      data: {
        nationId: claim.nationId,
        tileId: claim.targetTileId,
        claimId,
        reason: "CLAIM_CANCELLED",
        turn: (await client.nation.findUniqueOrThrow({ where: { id: claim.nationId } })).currentTurn
      }
    });
    return serializeClaim(updated as never);
  });
}

export async function getNationTerritory(nationId: string): Promise<NationTerritoryView> {
  if (getConfig().DATA_MODE === "memory") {
    const nation = getFallbackNation(nationId);
    const economy = getFallbackEconomySnapshot(nationId);
    if (!nation || !economy) throw notFound("Nation not found");
    const tiles = (await getAllWorldTiles()).filter((tile) => tile.ownerNationId === nationId);
    const claims = memoryClaims.filter((item) => item.nationId === nationId);
    const outposts = memoryOutposts.filter((item) => item.nationId === nationId);
    const unsecured = tiles.filter((tile) => tile.controlLevel === "CLAIMED").length;
    const active = claims.filter((item) => ["ACTIVE", "PAUSED"].includes(item.status)).length;
    const load = frontierAdministrativeLoad(
      active,
      outposts.filter((item) => !["CONVERTED", "CANCELLED"].includes(item.status)).length,
      unsecured
    );
    return {
      nationId,
      currentTurn: nation.currentTurn ?? 1,
      claimedTileCount: tiles.length,
      securedTileCount: tiles.filter((tile) => tile.controlLevel !== "CLAIMED").length,
      frontierLoad: load,
      effectiveAdministrativeCapacity: Math.max(0, economy.economy.administrativeCapacity - load),
      activeClaimCount: active,
      claimLimit: territoryClaimLimit(economy.economy.administrativeCapacity),
      claims,
      outposts,
      civilianUnits: memoryCivilians.filter((item) => item.nationId === nationId),
      projects: memoryProjects.filter((item) => item.nationId === nationId)
    };
  }
  const [nation, claims, outposts, civilians, founding, training] = await Promise.all([
    prisma.nation.findUnique({ where: { id: nationId }, include: { economy: true, worldTiles: true } }),
    prisma.territoryClaim.findMany({
      where: { nationId },
      include: { tiles: { include: { tile: true }, orderBy: { sequence: "asc" } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.outpostState.findMany({ where: { nationId }, orderBy: { createdAt: "desc" } }),
    prisma.civilianUnit.findMany({
      where: { nationId, status: { in: ["READY", "TRAVELING", "FOUNDING"] } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.settlementFoundingProject.findMany({ where: { nationId }, orderBy: { createdAt: "desc" } }),
    prisma.settlementProject.findMany({
      where: { nationId, type: "COLONIST_TRAINING" },
      orderBy: { createdAt: "desc" }
    })
  ]);
  if (!nation?.economy) throw notFound("Nation not found");
  const active = claims.filter((item) => ["ACTIVE", "PAUSED"].includes(item.status)).length;
  const unsecured = nation.worldTiles.filter((tile) => tile.controlLevel === "CLAIMED").length;
  const load = frontierAdministrativeLoad(
    active,
    outposts.filter((item) => !["CONVERTED", "CANCELLED"].includes(item.status)).length,
    unsecured
  );
  const projects: ExpansionProject[] = [
    ...outposts.map((item) => ({
      id: item.id,
      nationId,
      type: "OUTPOST" as const,
      status:
        item.status === "BUILDING"
          ? ("QUEUED" as const)
          : item.status === "CANCELLED"
            ? ("CANCELLED" as const)
            : ("COMPLETED" as const),
      startedTurn: item.startedTurn,
      completesTurn: item.completesTurn,
      treasuryCost: item.treasuryCost,
      resourceCosts: resourceCosts(item.resourceCostsJson),
      createdAt: item.createdAt.toISOString(),
      completedAt: item.establishedTurn ? item.updatedAt.toISOString() : null,
      cancelledAt: item.status === "CANCELLED" ? item.updatedAt.toISOString() : null,
      outpostId: item.id
    })),
    ...training.map((item) => ({
      id: item.id,
      nationId,
      type: "COLONIST_TRAINING" as const,
      status: item.status,
      startedTurn: item.startedTurn,
      completesTurn: item.completesTurn,
      treasuryCost: item.treasuryCost,
      resourceCosts: resourceCosts(item.resourceCostsJson),
      createdAt: item.createdAt.toISOString(),
      completedAt: iso(item.completedAt),
      cancelledAt: iso(item.cancelledAt),
      settlementId: item.settlementId
    })),
    ...founding.map((item) => ({
      id: item.id,
      nationId,
      type: "SETTLEMENT_FOUNDING" as const,
      status: item.status,
      startedTurn: item.startedTurn,
      completesTurn: item.completesTurn,
      treasuryCost: item.treasuryCost,
      resourceCosts: resourceCosts(item.resourceCostsJson),
      createdAt: item.createdAt.toISOString(),
      completedAt: iso(item.completedAt),
      cancelledAt: iso(item.cancelledAt),
      outpostId: item.outpostId,
      colonistId: item.colonistId
    }))
  ];
  return {
    nationId,
    currentTurn: nation.currentTurn,
    claimedTileCount: nation.worldTiles.length,
    securedTileCount: nation.worldTiles.filter((tile) => tile.controlLevel !== "CLAIMED").length,
    frontierLoad: load,
    effectiveAdministrativeCapacity: Math.max(0, nation.economy.administrativeCapacity - load),
    activeClaimCount: active,
    claimLimit: territoryClaimLimit(nation.economy.administrativeCapacity),
    claims: claims.map((item) => serializeClaim(item as never)),
    outposts: outposts.map(serializeOutpost),
    civilianUnits: civilians.map(serializeCivilian),
    projects
  };
}

export async function previewOutpost(nationId: string, claimId: string, parentSettlementId: string) {
  const territory = await getNationTerritory(nationId);
  const claim = territory.claims.find((item) => item.id === claimId);
  const blockers: string[] = [];
  if (!claim) throw notFound("Territory claim not found");
  if (claim.status !== "COMPLETED") blockers.push("The frontier claim must be completed first.");
  if (territory.outposts.some((item) => item.claimId === claimId && !["CONVERTED", "CANCELLED"].includes(item.status)))
    blockers.push("This claim already has an outpost.");
  const target = claim.tiles.find((item) => item.tile.id === claim.targetTileId)?.tile;
  if (!target || target.ownerNationId !== nationId) blockers.push("The claim target is not owned.");
  if (!target || !TERRAIN_DEFINITIONS[target.terrain].allowedLocationTypes.includes("OUTPOST"))
    blockers.push("This terrain cannot support an outpost.");
  const summary = await getNationSettlementSummary(nationId);
  const parentSettlement = summary.settlements.find((item) => item.id === parentSettlementId);
  if (!parentSettlement) blockers.push("Parent settlement not found.");
  const locations =
    getConfig().DATA_MODE === "memory"
      ? (getFallbackLocations(nationId) ?? [])
      : await prisma.mapLocation.findMany({ where: { nationId } });
  const parentLocation = locations.find((item) => item.id === parentSettlement?.locationId);
  const worldTiles = await getAllWorldTiles();
  const supplyPath =
    parentLocation?.worldTileId && target
      ? findDeterministicTilePath(worldTiles, parentLocation.worldTileId, target.id, {
          canEnter: (tile) =>
            tile.id === target.id || (tile.ownerNationId === nationId && tile.controlLevel !== "CLAIMED")
        })
      : [];
  const supply = supplyPath.length
    ? calculateSupplyForPath(supplyPath, 10, parentSettlement?.region.networkReliability ?? 100)
    : 0;
  if (target && (!supplyPath.length || supply < 50))
    blockers.push("No reliable secured supply route reaches this outpost site.");
  return {
    valid: blockers.length === 0,
    blockers,
    claimId,
    parentSettlementId,
    targetTile: target,
    treasuryCost: OUTPOST_COST.treasury,
    resourceCosts: OUTPOST_COST.resources,
    durationTurns: OUTPOST_COST.durationTurns,
    completesTurn: territory.currentTurn + OUTPOST_COST.durationTurns,
    effectiveAdministrativeCapacity: territory.effectiveAdministrativeCapacity,
    supplyScore: supply,
    supplyRouteTileIds: supplyPath.map((tile) => tile.id)
  };
}

export async function startOutpost(nationId: string, claimId: string, parentSettlementId: string, name: string) {
  const preview = await previewOutpost(nationId, claimId, parentSettlementId);
  if (!preview.valid || !preview.targetTile) throw conflict(preview.blockers.join(" "));
  if (getConfig().DATA_MODE === "memory") {
    if (memoryProjectCount(nationId) >= constructionProjectLimit(preview.effectiveAdministrativeCapacity))
      throw conflict("All national construction slots are in use.");
    const projectId = `memory-outpost-${randomUUID()}`;
    chargeFallbackConstruction(nationId, OUTPOST_COST.treasury, OUTPOST_COST.resources, "Frontier outpost", projectId);
    const cancelled = memoryOutposts.find((item) => item.claimId === claimId && item.status === "CANCELLED");
    if (cancelled) {
      const location = getFallbackLocations(nationId)?.find((item) => item.id === cancelled.locationId);
      if (location) updateFallbackLocation(location.id, { name, updatedAt: now() });
      Object.assign(cancelled, {
        status: "BUILDING",
        suppliedTurns: 0,
        unsuppliedTurns: 0,
        supplyScore: 0,
        establishedTurn: null,
        updatedAt: now()
      });
      memoryProjects.push({
        id: projectId,
        nationId,
        type: "OUTPOST",
        status: "QUEUED",
        startedTurn: getFallbackNation(nationId)!.currentTurn ?? 1,
        completesTurn: preview.completesTurn,
        treasuryCost: OUTPOST_COST.treasury,
        resourceCosts: OUTPOST_COST.resources,
        locationId: cancelled.locationId,
        outpostId: cancelled.id,
        createdAt: now()
      });
      return cancelled;
    }
    const locationId = `memory-location-${randomUUID()}`;
    addFallbackLocation({
      id: locationId,
      nationId,
      name,
      type: "OUTPOST",
      x: preview.targetTile.x,
      y: preview.targetTile.y,
      resourceType: preview.targetTile.resourceDeposit ?? null,
      population: null,
      developmentLevel: 1,
      worldTileId: preview.targetTile.id,
      terrain: preview.targetTile.terrain,
      worldTile: preview.targetTile,
      createdAt: now(),
      updatedAt: now()
    });
    const outpost: OutpostView = {
      id: projectId,
      nationId,
      locationId,
      parentSettlementId,
      claimId,
      status: "BUILDING",
      suppliedTurns: 0,
      unsuppliedTurns: 0,
      supplyScore: 0,
      establishedTurn: null,
      mature: false,
      createdAt: now(),
      updatedAt: now()
    };
    memoryOutposts.push(outpost);
    memoryProjects.push({
      id: projectId,
      nationId,
      type: "OUTPOST",
      status: "QUEUED",
      startedTurn: getFallbackNation(nationId)!.currentTurn ?? 1,
      completesTurn: preview.completesTurn,
      treasuryCost: OUTPOST_COST.treasury,
      resourceCosts: OUTPOST_COST.resources,
      locationId,
      createdAt: now()
    });
    return outpost;
  }
  return runSerializable(async (client) => {
    const nation = await client.nation.findUniqueOrThrow({ where: { id: nationId }, include: { economy: true } });
    const occupied = await client.mapLocation.findUnique({
      where: { worldTileId: preview.targetTile!.id },
      include: { outpost: true }
    });
    if (occupied && occupied.outpost?.status !== "CANCELLED") throw conflict("A location already occupies this tile.");
    const availableAdministration = await effectiveAdministrativeCapacity(
      nationId,
      nation.economy?.administrativeCapacity ?? 0,
      client
    );
    if ((await postgresProjectCount(client, nationId)) >= constructionProjectLimit(availableAdministration))
      throw conflict("All national construction slots are in use.");
    const id = randomUUID();
    await charge(
      client,
      nationId,
      nation.currentTurn,
      OUTPOST_COST.treasury,
      OUTPOST_COST.resources,
      "Frontier outpost",
      id
    );
    if (occupied?.outpost?.status === "CANCELLED") {
      await client.mapLocation.update({ where: { id: occupied.id }, data: { name } });
      const revived = await client.outpostState.update({
        where: { id: occupied.outpost.id },
        data: {
          status: "BUILDING",
          parentSettlementId,
          startedTurn: nation.currentTurn,
          completesTurn: nation.currentTurn + OUTPOST_COST.durationTurns,
          suppliedTurns: 0,
          unsuppliedTurns: 0,
          supplyScore: 0,
          establishedTurn: null,
          treasuryCost: OUTPOST_COST.treasury,
          resourceCostsJson: OUTPOST_COST.resources
        }
      });
      return serializeOutpost(revived);
    }
    const location = await client.mapLocation.create({
      data: {
        nationId,
        name,
        type: "OUTPOST",
        x: preview.targetTile!.x,
        y: preview.targetTile!.y,
        resourceType: preview.targetTile!.resourceDeposit as ResourceType | null,
        developmentLevel: 1,
        worldTileId: preview.targetTile!.id
      }
    });
    const outpost = await client.outpostState.create({
      data: {
        id,
        nationId,
        locationId: location.id,
        parentSettlementId,
        claimId,
        startedTurn: nation.currentTurn,
        completesTurn: nation.currentTurn + OUTPOST_COST.durationTurns,
        treasuryCost: OUTPOST_COST.treasury,
        resourceCostsJson: OUTPOST_COST.resources
      }
    });
    return serializeOutpost(outpost);
  });
}

export async function cancelOutpostProject(outpostId: string) {
  if (getConfig().DATA_MODE === "memory") {
    const outpost = memoryOutposts.find((item) => item.id === outpostId);
    const project = memoryProjects.find((item) => item.id === outpostId);
    if (!outpost || !project) throw notFound("Outpost project not found");
    if (outpost.status !== "BUILDING") throw conflict("Only an outpost under construction can be cancelled.");
    const treasury = Math.floor(project.treasuryCost * 0.75);
    const resources = Object.fromEntries(
      Object.entries(project.resourceCosts).map(([key, value]) => [key, Math.floor((value ?? 0) * 0.75)])
    );
    refundFallbackConstruction(outpost.nationId, treasury, resources, "Cancelled outpost project", outpost.id);
    outpost.status = "CANCELLED";
    project.status = "CANCELLED";
    project.cancelledAt = now();
    return outpost;
  }
  return runSerializable(async (client) => {
    const outpost = await client.outpostState.findUnique({ where: { id: outpostId }, include: { nation: true } });
    if (!outpost) throw notFound("Outpost project not found");
    if (outpost.status !== "BUILDING") throw conflict("Only an outpost under construction can be cancelled.");
    const treasury = Math.floor(outpost.treasuryCost * 0.75);
    const resources = Object.fromEntries(
      Object.entries(resourceCosts(outpost.resourceCostsJson)).map(([key, value]) => [
        key,
        Math.floor((value ?? 0) * 0.75)
      ])
    );
    await refund(
      client,
      outpost.nationId,
      outpost.nation.currentTurn,
      treasury,
      resources,
      "Cancelled outpost project",
      outpost.id
    );
    return client.outpostState.update({ where: { id: outpostId }, data: { status: "CANCELLED" } });
  });
}

export async function startColonistTraining(nationId: string, settlementId: string) {
  const summary = await getNationSettlementSummary(nationId);
  const territory = await getNationTerritory(nationId);
  const settlement = summary.settlements.find((item) => item.id === settlementId);
  if (!settlement) throw notFound("Settlement not found");
  const blockers = [
    ...(settlement.populationLevel < 2 ? ["The source settlement must retain one population level."] : []),
    ...(settlement.stability.value < 45 ? ["The source settlement requires at least 45 stability."] : []),
    ...(settlement.food.shortageTurns >= 2 ? ["A settlement in severe food shortage cannot train colonists."] : []),
    ...(settlement.activeProject ? ["The settlement already has an active project."] : [])
  ];
  if (blockers.length) throw conflict(blockers.join(" "));
  if (getConfig().DATA_MODE === "memory") {
    if (memoryProjectCount(nationId) >= constructionProjectLimit(territory.effectiveAdministrativeCapacity))
      throw conflict("All national construction slots are in use.");
    const id = `memory-colonist-training-${randomUUID()}`;
    chargeFallbackConstruction(
      nationId,
      COLONIST_TRAINING_COST.treasury,
      COLONIST_TRAINING_COST.resources,
      "Colonist training",
      id
    );
    reserveMemorySettlementPopulation(settlementId);
    const currentTurn = getFallbackNation(nationId)!.currentTurn ?? 1;
    const project = {
      id,
      nationId,
      type: "COLONIST_TRAINING" as const,
      status: "QUEUED" as const,
      startedTurn: currentTurn,
      completesTurn: currentTurn + COLONIST_TRAINING_COST.durationTurns,
      treasuryCost: COLONIST_TRAINING_COST.treasury,
      resourceCosts: COLONIST_TRAINING_COST.resources,
      settlementId,
      reservedResidentPopulation: POPULATION_PER_LEVEL,
      createdAt: now()
    };
    memoryProjects.push(project);
    return project;
  }
  return runSerializable(async (client) => {
    const record = await client.settlement.findUnique({
      where: { id: settlementId },
      include: { nation: { include: { economy: true } } }
    });
    if (!record || record.nationId !== nationId) throw notFound("Settlement not found");
    const availableAdministration = await effectiveAdministrativeCapacity(
      nationId,
      record.nation.economy?.administrativeCapacity ?? 0,
      client
    );
    if ((await postgresProjectCount(client, nationId)) >= constructionProjectLimit(availableAdministration))
      throw conflict("All national construction slots are in use.");
    const id = randomUUID();
    await charge(
      client,
      nationId,
      record.nation.currentTurn,
      COLONIST_TRAINING_COST.treasury,
      COLONIST_TRAINING_COST.resources,
      "Colonist training",
      id
    );
    const reserved = await client.settlement.updateMany({
      where: { id: settlementId, populationLevel: { gte: 2 }, stability: { gte: 45 }, foodShortageTurns: { lt: 2 } },
      data: { populationLevel: { decrement: 1 }, residentPopulation: { decrement: POPULATION_PER_LEVEL } }
    });
    if (reserved.count !== 1) throw conflict("The settlement can no longer provide a colonist population.");
    await client.nationEconomy.update({
      where: { nationId },
      data: { population: { decrement: POPULATION_PER_LEVEL } }
    });
    return client.settlementProject.create({
      data: {
        id,
        nationId,
        settlementId,
        regionId: record.regionId,
        type: "COLONIST_TRAINING",
        definitionKey: "colonist_training",
        startedTurn: record.nation.currentTurn,
        completesTurn: record.nation.currentTurn + COLONIST_TRAINING_COST.durationTurns,
        effectiveTurn: record.nation.currentTurn + COLONIST_TRAINING_COST.durationTurns,
        treasuryCost: COLONIST_TRAINING_COST.treasury,
        resourceCostsJson: COLONIST_TRAINING_COST.resources,
        reservedPopulationLevel: 1,
        reservedResidentPopulation: POPULATION_PER_LEVEL
      }
    });
  });
}

export async function cancelColonistTraining(projectId: string) {
  if (getConfig().DATA_MODE === "memory") {
    const project = memoryProjects.find((item) => item.id === projectId && item.type === "COLONIST_TRAINING");
    if (!project) throw notFound("Colonist training project not found");
    if (project.status !== "QUEUED") throw conflict("Only queued training can be cancelled.");
    restoreMemorySettlementPopulation(project.settlementId!, project.reservedResidentPopulation);
    refundFallbackConstruction(
      project.nationId,
      Math.floor(project.treasuryCost * 0.75),
      Object.fromEntries(
        Object.entries(project.resourceCosts).map(([key, value]) => [key, Math.floor((value ?? 0) * 0.75)])
      ),
      "Cancelled colonist training",
      project.id
    );
    project.status = "CANCELLED";
    project.cancelledAt = now();
    return project;
  }
  return runSerializable(async (client) => {
    const project = await client.settlementProject.findUnique({ where: { id: projectId }, include: { nation: true } });
    if (!project || project.type !== "COLONIST_TRAINING") throw notFound("Colonist training project not found");
    if (project.status !== "QUEUED") throw conflict("Only queued training can be cancelled.");
    await client.settlement.update({
      where: { id: project.settlementId },
      data: {
        populationLevel: { increment: project.reservedPopulationLevel },
        residentPopulation: { increment: project.reservedResidentPopulation }
      }
    });
    await client.nationEconomy.update({
      where: { nationId: project.nationId },
      data: { population: { increment: project.reservedResidentPopulation } }
    });
    const treasury = Math.floor(project.treasuryCost * 0.75);
    const resources = Object.fromEntries(
      Object.entries(resourceCosts(project.resourceCostsJson)).map(([key, value]) => [
        key,
        Math.floor((value ?? 0) * 0.75)
      ])
    );
    await refund(
      client,
      project.nationId,
      project.nation.currentTurn,
      treasury,
      resources,
      "Cancelled colonist training",
      project.id
    );
    return client.settlementProject.update({
      where: { id: projectId },
      data: { status: "CANCELLED", cancelledAt: new Date() }
    });
  });
}

export async function orderCivilianTravel(nationId: string, unitId: string, targetTileId: string) {
  const tiles = await getAllWorldTiles();
  if (getConfig().DATA_MODE === "memory") {
    const unit = memoryCivilians.find((item) => item.id === unitId && item.nationId === nationId);
    if (!unit) throw notFound("Civilian unit not found");
    const path = findDeterministicTilePath(tiles, unit.currentWorldTileId, targetTileId, {
      canEnter: (tile) => tile.terrain !== "OCEAN" && (!tile.ownerNationId || tile.ownerNationId === nationId)
    });
    if (!path.length) throw conflict("No valid civilian route reaches that tile.");
    unit.travelRouteTileIds = path.map((tile) => tile.id);
    unit.travelRouteIndex = 0;
    unit.status = "TRAVELING";
    unit.updatedAt = now();
    return unit;
  }
  return runSerializable(async (client) => {
    const unit = await client.civilianUnit.findFirst({ where: { id: unitId, nationId } });
    if (!unit) throw notFound("Civilian unit not found");
    if (unit.status === "FOUNDING") throw conflict("This colonist is committed to a founding project.");
    const path = findDeterministicTilePath(tiles, unit.currentWorldTileId, targetTileId, {
      canEnter: (tile) => tile.terrain !== "OCEAN" && (!tile.ownerNationId || tile.ownerNationId === nationId)
    });
    if (!path.length) throw conflict("No valid civilian route reaches that tile.");
    const updated = await client.civilianUnit.update({
      where: { id: unitId },
      data: { status: "TRAVELING", travelRouteTileIdsJson: path.map((tile) => tile.id), travelRouteIndex: 0 }
    });
    return serializeCivilian(updated);
  });
}

export async function resettleCivilianUnit(nationId: string, unitId: string, settlementId: string) {
  if (getConfig().DATA_MODE === "memory") {
    const unit = memoryCivilians.find((item) => item.id === unitId && item.nationId === nationId);
    const settlement = (await getNationSettlementSummary(nationId)).settlements.find(
      (item) => item.id === settlementId
    );
    const location = getFallbackLocations(nationId)?.find((item) => item.id === settlement?.locationId);
    if (!unit || !settlement || unit.currentWorldTileId !== location?.worldTileId)
      throw conflict("The colonist must be at the receiving settlement.");
    restoreMemorySettlementPopulation(settlementId, unit.residentPopulation);
    unit.status = "RESETTLED";
    return unit;
  }
  return runSerializable(async (client) => {
    const [unit, settlement] = await Promise.all([
      client.civilianUnit.findFirst({ where: { id: unitId, nationId } }),
      client.settlement.findFirst({ where: { id: settlementId, nationId }, include: { location: true } })
    ]);
    if (!unit || !settlement) throw notFound("Colonist or settlement not found");
    if (unit.status === "FOUNDING" || unit.currentWorldTileId !== settlement.location.worldTileId)
      throw conflict("The colonist must be free and physically present at the receiving settlement.");
    await client.settlement.update({
      where: { id: settlementId },
      data: {
        populationLevel: { increment: unit.populationLevel },
        residentPopulation: { increment: unit.residentPopulation }
      }
    });
    await client.nationEconomy.update({
      where: { nationId },
      data: { population: { increment: unit.residentPopulation } }
    });
    const updated = await client.civilianUnit.update({ where: { id: unitId }, data: { status: "RESETTLED" } });
    return serializeCivilian(updated);
  });
}

export async function previewSettlementFounding(
  nationId: string,
  outpostId: string,
  colonistId: string,
  settlementName: string,
  charter: FoundingCharter
): Promise<FoundingPreview> {
  const territory = await getNationTerritory(nationId);
  const outpost = territory.outposts.find((item) => item.id === outpostId);
  if (!outpost) throw notFound("Outpost not found");
  const colonist = territory.civilianUnits.find((item) => item.id === colonistId);
  const summary = await getNationSettlementSummary(nationId);
  const locations =
    getConfig().DATA_MODE === "memory"
      ? (getFallbackLocations(nationId) ?? [])
      : await prisma.mapLocation.findMany({ where: { nationId }, include: { worldTile: true } });
  const outpostLocation = locations.find((item) => item.id === outpost.locationId);
  if (!outpostLocation?.worldTileId) throw notFound("Outpost location not found");
  const nearest = summary.settlements.length
    ? Math.min(
        ...summary.settlements.map((item) => {
          const location = locations.find((candidate) => candidate.id === item.locationId)!;
          return Math.max(Math.abs(location.x - outpostLocation.x), Math.abs(location.y - outpostLocation.y));
        })
      )
    : null;
  const blockers = [
    ...(!outpost.mature || outpost.status !== "ACTIVE"
      ? ["The outpost must be active and supplied for four turns."]
      : []),
    ...(!colonist ? ["A colonist is required."] : []),
    ...(colonist && colonist.currentWorldTileId !== outpostLocation.worldTileId
      ? ["The colonist must be at the outpost."]
      : []),
    ...(colonist && colonist.supply < 50 ? ["The colonist requires at least 50 supply."] : []),
    ...(nearest !== null && nearest < EXPANSION_BALANCE.minimumSettlementDistance
      ? ["Full settlements must be at least six tiles apart."]
      : []),
    ...(summary.settlementCount >= EXPANSION_BALANCE.hardSettlementCap
      ? ["The campaign settlement hard cap has been reached."]
      : []),
    ...(!settlementName.trim() || settlementName.trim().length > 60
      ? ["Settlement name must be 1 to 60 characters."]
      : [])
  ];
  const projectedCapacity = {
    ...summary.capacity,
    count: summary.settlementCount + 1,
    excess: Math.max(0, summary.settlementCount + 1 - summary.capacity.capacity)
  };
  return {
    valid: blockers.length === 0,
    blockers,
    outpost,
    colonist,
    settlementName: settlementName.trim(),
    charter,
    capacity: projectedCapacity,
    nearestSettlementDistance: nearest,
    treasuryCost: SETTLEMENT_FOUNDING_COST.treasury,
    resourceCosts: SETTLEMENT_FOUNDING_COST.resources,
    durationTurns: SETTLEMENT_FOUNDING_COST.durationTurns,
    completesTurn: territory.currentTurn + SETTLEMENT_FOUNDING_COST.durationTurns
  };
}

export async function startSettlementFounding(
  nationId: string,
  outpostId: string,
  colonistId: string,
  settlementName: string,
  charter: FoundingCharter,
  founderAgentId?: string | null
) {
  const preview = await previewSettlementFounding(nationId, outpostId, colonistId, settlementName, charter);
  if (!preview.valid) throw conflict(preview.blockers.join(" "));
  if (getConfig().DATA_MODE === "memory") {
    const territory = await getNationTerritory(nationId);
    if (memoryProjectCount(nationId) >= constructionProjectLimit(territory.effectiveAdministrativeCapacity))
      throw conflict("All national construction slots are in use.");
    if (
      memoryProjects.some(
        (item) => item.outpostId === outpostId && item.type === "SETTLEMENT_FOUNDING" && item.status === "QUEUED"
      )
    )
      throw conflict("This outpost already has an active founding project.");
    const id = `memory-founding-${randomUUID()}`;
    chargeFallbackConstruction(
      nationId,
      SETTLEMENT_FOUNDING_COST.treasury,
      SETTLEMENT_FOUNDING_COST.resources,
      "Settlement founding",
      id
    );
    const colonist = memoryCivilians.find((item) => item.id === colonistId)!;
    colonist.status = "FOUNDING";
    const project = {
      id,
      nationId,
      type: "SETTLEMENT_FOUNDING" as const,
      status: "QUEUED" as const,
      startedTurn: getFallbackNation(nationId)!.currentTurn ?? 1,
      completesTurn: preview.completesTurn,
      treasuryCost: SETTLEMENT_FOUNDING_COST.treasury,
      resourceCosts: SETTLEMENT_FOUNDING_COST.resources,
      outpostId,
      colonistId,
      settlementName: preview.settlementName,
      charter,
      createdAt: now()
    };
    memoryProjects.push(project);
    return project;
  }
  return runSerializable(async (client) => {
    const [nation, outpost, colonist] = await Promise.all([
      client.nation.findUniqueOrThrow({ where: { id: nationId }, include: { economy: true } }),
      client.outpostState.findFirst({ where: { id: outpostId, nationId } }),
      client.civilianUnit.findFirst({ where: { id: colonistId, nationId } })
    ]);
    if (!outpost || !colonist) throw notFound("Outpost or colonist not found");
    if (await client.settlementFoundingProject.findFirst({ where: { outpostId, status: "QUEUED" } }))
      throw conflict("This outpost already has an active founding project.");
    const availableAdministration = await effectiveAdministrativeCapacity(
      nationId,
      nation.economy?.administrativeCapacity ?? 0,
      client
    );
    if ((await postgresProjectCount(client, nationId)) >= constructionProjectLimit(availableAdministration))
      throw conflict("All national construction slots are in use.");
    const id = randomUUID();
    await charge(
      client,
      nationId,
      nation.currentTurn,
      SETTLEMENT_FOUNDING_COST.treasury,
      SETTLEMENT_FOUNDING_COST.resources,
      "Settlement founding",
      id
    );
    const locked = await client.civilianUnit.updateMany({
      where: { id: colonistId, status: { in: ["READY", "TRAVELING"] } },
      data: { status: "FOUNDING" }
    });
    if (locked.count !== 1) throw conflict("The colonist is already committed.");
    return client.settlementFoundingProject.create({
      data: {
        id,
        nationId,
        outpostId,
        colonistId,
        sourceSettlementId: colonist.sourceSettlementId,
        founderAgentId: founderAgentId ?? null,
        settlementName: preview.settlementName,
        charter,
        startedTurn: nation.currentTurn,
        completesTurn: preview.completesTurn,
        treasuryCost: SETTLEMENT_FOUNDING_COST.treasury,
        resourceCostsJson: SETTLEMENT_FOUNDING_COST.resources
      }
    });
  });
}

export async function cancelSettlementFounding(projectId: string) {
  if (getConfig().DATA_MODE === "memory") {
    const project = memoryProjects.find((item) => item.id === projectId && item.type === "SETTLEMENT_FOUNDING");
    if (!project) throw notFound("Settlement founding project not found");
    if (project.status !== "QUEUED") throw conflict("Only queued founding projects can be cancelled.");
    refundFallbackConstruction(
      project.nationId,
      Math.floor(project.treasuryCost * 0.75),
      Object.fromEntries(
        Object.entries(project.resourceCosts).map(([key, value]) => [key, Math.floor((value ?? 0) * 0.75)])
      ),
      "Cancelled settlement founding",
      project.id
    );
    const colonist = memoryCivilians.find((item) => item.id === project.colonistId);
    if (colonist) colonist.status = "READY";
    project.status = "CANCELLED";
    project.cancelledAt = now();
    return project;
  }
  return runSerializable(async (client) => {
    const project = await client.settlementFoundingProject.findUnique({
      where: { id: projectId },
      include: { nation: true }
    });
    if (!project) throw notFound("Settlement founding project not found");
    if (project.status !== "QUEUED") throw conflict("Only queued founding projects can be cancelled.");
    const treasury = Math.floor(project.treasuryCost * 0.75);
    const resources = Object.fromEntries(
      Object.entries(resourceCosts(project.resourceCostsJson)).map(([key, value]) => [
        key,
        Math.floor((value ?? 0) * 0.75)
      ])
    );
    await refund(
      client,
      project.nationId,
      project.nation.currentTurn,
      treasury,
      resources,
      "Cancelled settlement founding",
      project.id
    );
    await client.civilianUnit.update({ where: { id: project.colonistId }, data: { status: "READY" } });
    return client.settlementFoundingProject.update({
      where: { id: projectId },
      data: { status: "CANCELLED", cancelledAt: new Date() }
    });
  });
}

async function repartitionRegions(client: ServiceClient, nationId: string) {
  const [settlements, tiles] = await Promise.all([
    client.settlement.findMany({ where: { nationId }, include: { location: true } }),
    client.worldTile.findMany({ where: { ownerNationId: nationId, controlLevel: "SECURED" } })
  ]);
  const assignments = new Map<string, string[]>();
  for (const tile of tiles) {
    const nearest = settlements
      .filter((item) => item.regionId)
      .sort((a, b) => {
        const da = Math.abs(a.location.x - tile.x) + Math.abs(a.location.y - tile.y);
        const db = Math.abs(b.location.x - tile.x) + Math.abs(b.location.y - tile.y);
        return da - db || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
      })[0];
    if (nearest?.regionId) assignments.set(nearest.regionId, [...(assignments.get(nearest.regionId) ?? []), tile.id]);
  }
  for (const [regionId, ids] of assignments)
    await client.worldTile.updateMany({ where: { id: { in: ids } }, data: { regionId } });
}

async function completeFoundingProject(client: ServiceClient, project: PrismaFoundingProject, currentTurn: number) {
  const outpost = await client.outpostState.findUniqueOrThrow({
    where: { id: project.outpostId },
    include: { location: { include: { worldTile: true } } }
  });
  const region = await client.worldRegion.create({
    data: {
      nationId: project.nationId,
      name: `${project.settlementName} Region`,
      transportationLevel: "TRAILS",
      networkReliability: 70
    }
  });
  await client.mapLocation.update({
    where: { id: outpost.locationId },
    data: { name: project.settlementName, type: "TOWN", population: POPULATION_PER_LEVEL }
  });
  const settlement = await client.settlement.create({
    data: {
      nationId: project.nationId,
      locationId: outpost.locationId,
      regionId: region.id,
      type: "SECONDARY",
      level: "TOWN",
      residentPopulation: POPULATION_PER_LEVEL,
      populationLevel: 1,
      storedFood: 16,
      health: 65,
      stability: 55,
      activatedTurn: currentTurn + 1,
      foundedTurn: currentTurn,
      foundingCharter: project.charter,
      charterExpiresTurn: currentTurn + FOUNDING_CHARTERS[project.charter].durationTurns,
      founderAgentId: project.founderAgentId,
      originSettlementId: project.sourceSettlementId,
      flavorTagsJson: [project.charter.toLowerCase(), outpost.location.worldTile?.terrain.toLowerCase() ?? "frontier"]
    }
  });
  await client.settlementWorkforceAssignment.create({
    data: { settlementId: settlement.id, jobKey: "food", category: "FOOD", assigned: 1 }
  });
  await client.nationEconomy.update({
    where: { nationId: project.nationId },
    data: { population: { increment: POPULATION_PER_LEVEL } }
  });
  await client.outpostState.update({ where: { id: outpost.id }, data: { status: "CONVERTED" } });
  await client.civilianUnit.update({ where: { id: project.colonistId }, data: { status: "CONSUMED" } });
  await client.settlementFoundingProject.update({
    where: { id: project.id },
    data: { status: "COMPLETED", completedAt: new Date() }
  });
  await client.settlementHistoryEntry.create({
    data: {
      nationId: project.nationId,
      settlementId: settlement.id,
      turn: currentTurn,
      type: "SETTLEMENT_FOUNDED",
      summary: `${project.settlementName} was founded under an ${project.charter.toLowerCase()} charter.`,
      detailsJson: { projectId: project.id, outpostId: outpost.id, founderAgentId: project.founderAgentId }
    }
  });
  await client.nationPost.create({
    data: {
      nationId: project.nationId,
      type: "GOVERNMENT_UPDATE",
      title: `${project.settlementName} Founded`,
      body: `The frontier outpost has become **${project.settlementName}**, a new town founded under the ${FOUNDING_CHARTERS[project.charter].label}.`,
      format: "MARKDOWN",
      sourceType: "PLAYER",
      visibility: "PUBLIC",
      tagsJson: ["founding", "settlement", project.charter.toLowerCase()],
      excerpt: `${project.settlementName} has become the nation's newest town.`,
      publishedAt: new Date(),
      tags: { create: [{ value: "founding" }, { value: "settlement" }, { value: project.charter.toLowerCase() }] }
    }
  });
  await repartitionRegions(client, project.nationId);
  return settlement.id;
}

function emptyOutcome(): ExpansionTurnOutcome {
  return {
    treasuryUpkeep: 0,
    foodUpkeep: 0,
    frontierLoad: 0,
    claimedTileIds: [],
    securedTileIds: [],
    pausedClaimIds: [],
    maturedOutpostIds: [],
    inactiveOutpostIds: [],
    movedCivilianUnitIds: [],
    completedProjectIds: [],
    foundedSettlementIds: [],
    warnings: []
  };
}

function memorySupplyPath(
  tiles: WorldTile[],
  nationId: string,
  locations: Array<{ type: string; worldTileId?: string | null }>,
  targetTileId: string
) {
  const starts = locations.filter((item) => ["CAPITAL", "CITY", "TOWN"].includes(item.type) && item.worldTileId);
  return (
    starts
      .map((item) =>
        findDeterministicTilePath(tiles, item.worldTileId!, targetTileId, {
          canEnter: (tile) => tile.ownerNationId === nationId && tile.controlLevel !== "CLAIMED"
        })
      )
      .filter((path) => path.length)
      .sort((a, b) => a.length - b.length)[0] ?? []
  );
}

export async function processMemoryExpansionTurn(nationId: string, currentTurn: number): Promise<ExpansionTurnOutcome> {
  const outcome = emptyOutcome();
  const nation = getFallbackNation(nationId);
  const economy = getFallbackEconomySnapshot(nationId);
  if (!nation || !economy) throw notFound("Nation not found");
  let tiles = await getAllWorldTiles();
  const locations = getFallbackLocations(nationId) ?? [];

  for (const project of memoryProjects.filter(
    (item) => item.nationId === nationId && item.status === "QUEUED" && item.completesTurn <= currentTurn
  )) {
    if (project.type === "OUTPOST") {
      const outpost = memoryOutposts.find((item) => item.id === project.id)!;
      outpost.status = "ACTIVE";
      outpost.establishedTurn = currentTurn;
      outpost.updatedAt = now();
      project.status = "COMPLETED";
      project.completedAt = now();
      const claim = memoryClaims.find((item) => item.id === outpost.claimId);
      const targetSequence = claim?.tiles.find((item) => item.tile.id === claim.targetTileId)?.sequence ?? -1;
      const securedIds =
        claim?.tiles.filter((item) => item.sequence <= targetSequence).map((item) => item.tile.id) ?? [];
      updateMemoryWorldTiles(securedIds, { controlLevel: "SECURED" });
      outcome.securedTileIds.push(...securedIds);
    }
    if (project.type === "COLONIST_TRAINING") {
      const source = (await getNationSettlementSummary(nationId)).settlements.find(
        (item) => item.id === project.settlementId
      )!;
      const location = locations.find((item) => item.id === source.locationId)!;
      memoryCivilians.push({
        id: `memory-colonist-${randomUUID()}`,
        nationId,
        type: "COLONIST",
        name: `${source.name} Colonist Expedition`,
        status: "READY",
        sourceSettlementId: source.id,
        currentWorldTileId: location.worldTileId!,
        populationLevel: 1,
        residentPopulation: POPULATION_PER_LEVEL,
        health: 100,
        supply: 100,
        travelRouteTileIds: [],
        travelRouteIndex: 0,
        createdAt: now(),
        updatedAt: now()
      });
      project.status = "COMPLETED";
      project.completedAt = now();
    }
    if (project.type === "SETTLEMENT_FOUNDING") {
      const outpost = memoryOutposts.find((item) => item.id === project.outpostId)!;
      const colonist = memoryCivilians.find((item) => item.id === project.colonistId)!;
      updateFallbackLocation(outpost.locationId, {
        type: "TOWN",
        name: project.settlementName!,
        population: POPULATION_PER_LEVEL
      });
      const settlementId = createMemoryFoundedSettlement({
        nationId,
        locationId: outpost.locationId,
        name: project.settlementName!,
        currentTurn,
        charter: project.charter
      });
      outpost.status = "CONVERTED";
      colonist.status = "CONSUMED";
      project.status = "COMPLETED";
      project.completedAt = now();
      outcome.foundedSettlementIds.push(settlementId);
    }
    outcome.completedProjectIds.push(project.id);
  }

  for (const unit of memoryCivilians.filter((item) => item.nationId === nationId && item.status === "TRAVELING")) {
    const route = unit.travelRouteTileIds.map((id) => tiles.find((tile) => tile.id === id)!).filter(Boolean);
    const movement = civilianMovement(route, unit.travelRouteIndex);
    unit.travelRouteIndex = movement.routeIndex;
    unit.currentWorldTileId = route[movement.routeIndex]?.id ?? unit.currentWorldTileId;
    unit.supply = Math.max(0, unit.supply - movement.supplyCost);
    if (movement.arrived) unit.status = "READY";
    unit.updatedAt = now();
    if (movement.routeIndex) outcome.movedCivilianUnitIds.push(unit.id);
  }

  for (const outpost of memoryOutposts.filter(
    (item) => item.nationId === nationId && ["ACTIVE", "INACTIVE"].includes(item.status)
  )) {
    const location =
      locations.find((item) => item.id === outpost.locationId) ??
      (getFallbackLocations(nationId) ?? []).find((item) => item.id === outpost.locationId);
    if (!location?.worldTileId) continue;
    const path = memorySupplyPath(tiles, nationId, getFallbackLocations(nationId) ?? [], location.worldTileId);
    const supplied =
      path.length > 0 &&
      economy.economy.treasury >= EXPANSION_BALANCE.outpostTreasuryUpkeep &&
      (economy.resources.find((item) => item.type === "FOOD")?.amount ?? 0) >= EXPANSION_BALANCE.outpostFoodUpkeep;
    outpost.supplyScore = supplied ? calculateSupplyForPath(path, 10, 100) : 0;
    if (supplied && outpost.supplyScore >= 50) {
      chargeFallbackConstruction(
        nationId,
        EXPANSION_BALANCE.outpostTreasuryUpkeep,
        { FOOD: EXPANSION_BALANCE.outpostFoodUpkeep },
        "Frontier outpost upkeep",
        outpost.id
      );
      outcome.treasuryUpkeep += EXPANSION_BALANCE.outpostTreasuryUpkeep;
      outcome.foodUpkeep += EXPANSION_BALANCE.outpostFoodUpkeep;
      outpost.suppliedTurns += 1;
      outpost.unsuppliedTurns = 0;
      outpost.status = "ACTIVE";
      const adjacent = tiles
        .filter(
          (tile) =>
            tile.ownerNationId === nationId &&
            tile.controlLevel === "CLAIMED" &&
            Math.abs(tile.x - location.x) + Math.abs(tile.y - location.y) <= 1
        )
        .slice(0, 2);
      updateMemoryWorldTiles(
        adjacent.map((tile) => tile.id),
        { controlLevel: "SECURED" }
      );
      outcome.securedTileIds.push(...adjacent.map((tile) => tile.id));
      if (outpost.suppliedTurns === EXPANSION_BALANCE.outpostMaturityTurns) outcome.maturedOutpostIds.push(outpost.id);
    } else {
      outpost.suppliedTurns = 0;
      outpost.unsuppliedTurns += 1;
      if (outpost.unsuppliedTurns >= 3) {
        outpost.status = "INACTIVE";
        outcome.inactiveOutpostIds.push(outpost.id);
      }
    }
  }
  tiles = await getAllWorldTiles();
  for (const claim of memoryClaims.filter(
    (item) => item.nationId === nationId && ["ACTIVE", "PAUSED"].includes(item.status)
  )) {
    if (economy.economy.treasury < EXPANSION_BALANCE.claimTreasuryUpkeep) {
      claim.status = "PAUSED";
      outcome.pausedClaimIds.push(claim.id);
      continue;
    }
    chargeFallbackConstruction(nationId, EXPANSION_BALANCE.claimTreasuryUpkeep, {}, "Frontier influence", claim.id);
    outcome.treasuryUpkeep += EXPANSION_BALANCE.claimTreasuryUpkeep;
    claim.status = "ACTIVE";
    const anchorOutpost = memoryOutposts.find((item) => item.locationId === claim.anchorLocationId);
    const generated = anchorOutpost ? EXPANSION_BALANCE.outpostInfluence : EXPANSION_BALANCE.settlementInfluence;
    const spent = spendClaimInfluence(claim.tiles, generated, claim.influenceCarry);
    claim.influenceCarry = spent.carry;
    for (const tile of claim.tiles) {
      const next = spent.tiles.find((item) => item.sequence === tile.sequence)!;
      tile.influenceProgress = next.influenceProgress;
      if (spent.completedTileIds.includes(tile.tile.id) && !tile.claimedTurn) {
        tile.claimedTurn = currentTurn;
        tile.tile = { ...tile.tile, ownerNationId: nationId, controlLevel: "CLAIMED", claimedAt: now() };
        updateMemoryWorldTiles([tile.tile.id], { ownerNationId: nationId, controlLevel: "CLAIMED", claimedAt: now() });
        outcome.claimedTileIds.push(tile.tile.id);
      }
    }
    if (claim.tiles.every((item) => item.claimedTurn)) {
      claim.status = "COMPLETED";
      claim.completedTurn = currentTurn;
    }
    claim.updatedAt = now();
  }
  const owned = (await getAllWorldTiles()).filter((tile) => tile.ownerNationId === nationId);
  outcome.frontierLoad = frontierAdministrativeLoad(
    memoryClaims.filter((item) => item.nationId === nationId && ["ACTIVE", "PAUSED"].includes(item.status)).length,
    memoryOutposts.filter((item) => item.nationId === nationId && !["CONVERTED", "CANCELLED"].includes(item.status))
      .length,
    owned.filter((tile) => tile.controlLevel === "CLAIMED").length
  );
  return outcome;
}

export async function processExpansionTurn(
  client: ServiceClient,
  nationId: string,
  currentTurn: number
): Promise<ExpansionTurnOutcome> {
  if (getConfig().DATA_MODE === "memory") return processMemoryExpansionTurn(nationId, currentTurn);
  const outcome = emptyOutcome();
  const dueOutposts = await client.outpostState.findMany({
    where: { nationId, status: "BUILDING", completesTurn: { lte: currentTurn } }
  });
  for (const outpost of dueOutposts) {
    await client.outpostState.update({
      where: { id: outpost.id },
      data: { status: "ACTIVE", establishedTurn: currentTurn }
    });
    const location = await client.mapLocation.findUniqueOrThrow({ where: { id: outpost.locationId } });
    const claim = outpost.claimId
      ? await client.territoryClaim.findUnique({ where: { id: outpost.claimId }, include: { tiles: true } })
      : null;
    const targetSequence = claim?.tiles.find((item) => item.tileId === claim.targetTileId)?.sequence ?? -1;
    const securedIds = claim?.tiles.filter((item) => item.sequence <= targetSequence).map((item) => item.tileId) ?? [
      location.worldTileId!
    ];
    await client.worldTile.updateMany({ where: { id: { in: securedIds } }, data: { controlLevel: "SECURED" } });
    outcome.securedTileIds.push(...securedIds);
    outcome.completedProjectIds.push(outpost.id);
  }

  const dueTraining = await client.settlementProject.findMany({
    where: { nationId, type: "COLONIST_TRAINING", status: "QUEUED", completesTurn: { lte: currentTurn } },
    include: { settlement: { include: { location: true } } }
  });
  for (const project of dueTraining) {
    if (!project.settlement.location.worldTileId) continue;
    const unit = await client.civilianUnit.create({
      data: {
        nationId,
        name: `${project.settlement.location.name} Colonist Expedition`,
        sourceSettlementId: project.settlementId,
        currentWorldTileId: project.settlement.location.worldTileId,
        populationLevel: project.reservedPopulationLevel || 1,
        residentPopulation: project.reservedResidentPopulation || POPULATION_PER_LEVEL,
        trainingProjectId: project.id
      }
    });
    await client.settlementProject.update({
      where: { id: project.id },
      data: { status: "COMPLETED", completedAt: new Date() }
    });
    outcome.completedProjectIds.push(project.id);
    outcome.warnings.push(`${unit.name} is ready to travel.`);
  }

  const dueFounding = await client.settlementFoundingProject.findMany({
    where: { nationId, status: "QUEUED", completesTurn: { lte: currentTurn } }
  });
  for (const project of dueFounding) {
    const settlementId = await completeFoundingProject(client, project as never, currentTurn);
    outcome.completedProjectIds.push(project.id);
    outcome.foundedSettlementIds.push(settlementId);
  }

  const tiles = (await client.worldTile.findMany({ where: { worldMapId: "statecraft-world" } })).map((tile) => ({
    ...tile,
    claimedAt: iso(tile.claimedAt)
  })) as WorldTile[];
  const traveling = await client.civilianUnit.findMany({ where: { nationId, status: "TRAVELING" } });
  for (const unit of traveling) {
    const routeIds = unit.travelRouteTileIdsJson as string[];
    const route = routeIds.map((id) => tiles.find((tile) => tile.id === id)!).filter(Boolean);
    const movement = civilianMovement(route, unit.travelRouteIndex);
    const target = route[movement.routeIndex];
    if (!target) continue;
    await client.civilianUnit.update({
      where: { id: unit.id },
      data: {
        currentWorldTileId: target.id,
        travelRouteIndex: movement.routeIndex,
        supply: Math.max(0, unit.supply - movement.supplyCost),
        status: movement.arrived ? "READY" : "TRAVELING"
      }
    });
    if (movement.routeIndex !== unit.travelRouteIndex) outcome.movedCivilianUnitIds.push(unit.id);
  }

  const [settlements, outposts] = await Promise.all([
    client.settlement.findMany({ where: { nationId }, include: { location: true, region: true } }),
    client.outpostState.findMany({
      where: { nationId, status: { in: ["ACTIVE", "INACTIVE"] } },
      include: { location: true }
    })
  ]);
  const economy = await client.nationEconomy.findUniqueOrThrow({ where: { nationId } });
  const food = await client.resourceStockpile.findUniqueOrThrow({
    where: { nationId_type: { nationId, type: "FOOD" } }
  });
  let treasuryBalance = economy.treasury;
  let foodBalance = food.amount;
  for (const outpost of outposts) {
    const routes = settlements
      .filter((settlement) => settlement.location.worldTileId)
      .map((settlement) => ({
        settlement,
        path: findDeterministicTilePath(tiles, settlement.location.worldTileId!, outpost.location.worldTileId!, {
          canEnter: (tile) => tile.ownerNationId === nationId && tile.controlLevel !== "CLAIMED"
        })
      }))
      .filter((item) => item.path.length)
      .sort((a, b) => a.path.length - b.path.length);
    const route = routes[0];
    const score = route
      ? calculateSupplyForPath(route.path, 10, route.settlement.region?.networkReliability ?? 100)
      : 0;
    const funded =
      score >= 50 &&
      treasuryBalance >= EXPANSION_BALANCE.outpostTreasuryUpkeep &&
      foodBalance >= EXPANSION_BALANCE.outpostFoodUpkeep;
    if (funded) {
      treasuryBalance -= EXPANSION_BALANCE.outpostTreasuryUpkeep;
      foodBalance -= EXPANSION_BALANCE.outpostFoodUpkeep;
      outcome.treasuryUpkeep += EXPANSION_BALANCE.outpostTreasuryUpkeep;
      outcome.foodUpkeep += EXPANSION_BALANCE.outpostFoodUpkeep;
      const suppliedTurns = outpost.suppliedTurns + 1;
      await client.outpostState.update({
        where: { id: outpost.id },
        data: { status: "ACTIVE", supplyScore: score, suppliedTurns, unsuppliedTurns: 0 }
      });
      const adjacent = tiles
        .filter(
          (tile) =>
            tile.ownerNationId === nationId &&
            tile.controlLevel === "CLAIMED" &&
            Math.abs(tile.x - outpost.location.x) + Math.abs(tile.y - outpost.location.y) <= 1
        )
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .slice(0, 2);
      if (adjacent.length) {
        await client.worldTile.updateMany({
          where: { id: { in: adjacent.map((tile) => tile.id) } },
          data: { controlLevel: "SECURED" }
        });
        outcome.securedTileIds.push(...adjacent.map((tile) => tile.id));
      }
      if (suppliedTurns === EXPANSION_BALANCE.outpostMaturityTurns) outcome.maturedOutpostIds.push(outpost.id);
    } else {
      const unsuppliedTurns = outpost.unsuppliedTurns + 1;
      await client.outpostState.update({
        where: { id: outpost.id },
        data: {
          status: unsuppliedTurns >= 3 ? "INACTIVE" : outpost.status,
          supplyScore: score,
          suppliedTurns: 0,
          unsuppliedTurns
        }
      });
      if (unsuppliedTurns >= 3) outcome.inactiveOutpostIds.push(outpost.id);
    }
  }

  const claims = await client.territoryClaim.findMany({
    where: { nationId, status: { in: ["ACTIVE", "PAUSED"] } },
    include: {
      anchorLocation: { include: { outpost: true, worldTile: true } },
      tiles: { include: { tile: true }, orderBy: { sequence: "asc" } }
    }
  });
  for (const claim of claims) {
    if (treasuryBalance < EXPANSION_BALANCE.claimTreasuryUpkeep) {
      await client.territoryClaim.update({ where: { id: claim.id }, data: { status: "PAUSED" } });
      outcome.pausedClaimIds.push(claim.id);
      continue;
    }
    treasuryBalance -= EXPANSION_BALANCE.claimTreasuryUpkeep;
    outcome.treasuryUpkeep += EXPANSION_BALANCE.claimTreasuryUpkeep;
    const generated = claim.anchorLocation.outpost
      ? EXPANSION_BALANCE.outpostInfluence
      : EXPANSION_BALANCE.settlementInfluence;
    const sharedTiles = claim.tiles.map((item) => ({
      ...item,
      tile: { ...item.tile, claimedAt: iso(item.tile.claimedAt) }
    })) as never;
    const spent = spendClaimInfluence(sharedTiles, generated, claim.influenceCarry);
    let blocked = false;
    for (const tileId of spent.completedTileIds) {
      const updated = await client.worldTile.updateMany({
        where: { id: tileId, ownerNationId: null },
        data: {
          ownerNationId: nationId,
          controlLevel: "CLAIMED",
          claimedAt: new Date(),
          regionId: claim.anchorLocation.worldTile?.regionId ?? null
        }
      });
      if (updated.count !== 1) {
        blocked = true;
        break;
      }
      await client.territoryClaimTile.update({
        where: { claimId_tileId: { claimId: claim.id, tileId } },
        data: {
          influenceProgress: claim.tiles.find((item) => item.tileId === tileId)!.influenceCost,
          claimedTurn: currentTurn
        }
      });
      await client.territoryHistoryEntry.create({
        data: {
          nationId,
          tileId,
          claimId: claim.id,
          newOwnerNationId: nationId,
          reason: "FRONTIER_INFLUENCE",
          turn: currentTurn
        }
      });
      outcome.claimedTileIds.push(tileId);
    }
    for (const item of spent.tiles.filter((item) => !spent.completedTileIds.includes(item.tile.id)))
      await client.territoryClaimTile.update({
        where: { id: item.id! },
        data: { influenceProgress: item.influenceProgress }
      });
    const remaining = await client.territoryClaimTile.count({ where: { claimId: claim.id, claimedTurn: null } });
    await client.territoryClaim.update({
      where: { id: claim.id },
      data: {
        status: blocked ? "BLOCKED" : remaining === 0 ? "COMPLETED" : "ACTIVE",
        influenceCarry: spent.carry,
        completedTurn: !blocked && remaining === 0 ? currentTurn : null
      }
    });
  }
  await client.nationEconomy.update({ where: { nationId }, data: { treasury: treasuryBalance } });
  await client.resourceStockpile.update({
    where: { nationId_type: { nationId, type: "FOOD" } },
    data: { amount: foodBalance }
  });
  const [activeClaims, activeOutposts, unsecured] = await Promise.all([
    client.territoryClaim.count({ where: { nationId, status: { in: ["ACTIVE", "PAUSED"] } } }),
    client.outpostState.count({ where: { nationId, status: { notIn: ["CONVERTED", "CANCELLED"] } } }),
    client.worldTile.count({ where: { ownerNationId: nationId, controlLevel: "CLAIMED" } })
  ]);
  outcome.frontierLoad = frontierAdministrativeLoad(activeClaims, activeOutposts, unsecured);
  return outcome;
}

export async function expansionEntityNationId(
  kind: "claim" | "outpost" | "civilian" | "training" | "founding",
  id: string
) {
  if (getConfig().DATA_MODE === "memory") {
    if (kind === "claim") return memoryClaims.find((item) => item.id === id)?.nationId ?? null;
    if (kind === "outpost") return memoryOutposts.find((item) => item.id === id)?.nationId ?? null;
    if (kind === "civilian") return memoryCivilians.find((item) => item.id === id)?.nationId ?? null;
    return memoryProjects.find((item) => item.id === id)?.nationId ?? null;
  }
  if (kind === "claim")
    return (await prisma.territoryClaim.findUnique({ where: { id }, select: { nationId: true } }))?.nationId ?? null;
  if (kind === "outpost")
    return (await prisma.outpostState.findUnique({ where: { id }, select: { nationId: true } }))?.nationId ?? null;
  if (kind === "civilian")
    return (await prisma.civilianUnit.findUnique({ where: { id }, select: { nationId: true } }))?.nationId ?? null;
  if (kind === "training")
    return (await prisma.settlementProject.findUnique({ where: { id }, select: { nationId: true } }))?.nationId ?? null;
  return (
    (await prisma.settlementFoundingProject.findUnique({ where: { id }, select: { nationId: true } }))?.nationId ?? null
  );
}
