import type {
  StrategicMapAgentMarker,
  StrategicMapClaimMarker,
  StrategicMapLocationMarker,
  StrategicMapViewport,
  StrategicTileContents,
  WorldTile
} from "@statecraft/shared";
import { getConfig } from "../config.js";
import { notFound } from "../errors.js";
import { prisma } from "../prisma.js";
import {
  getFallbackAgents,
  getFallbackLocations,
  getFallbackMilitaryUnits,
  getFallbackNation,
  getFallbackNations
} from "./fallbackDemo.js";
import { getNationSurveyedTileIds, getNationTerritory } from "./expansionService.js";
import { getNationSettlementSummary } from "./settlementService.js";
import { getWorldViewport } from "./worldService.js";

const inBounds = (x: number, y: number, bounds: StrategicMapViewport["bounds"]) =>
  x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;

function emptyContents(tile: WorldTile): StrategicTileContents {
  return {
    tileId: tile.id,
    terrain: tile.terrain,
    resourceDeposit: tile.resourceDeposit,
    ownerNationId: tile.ownerNationId,
    controlLevel: tile.controlLevel,
    locationIds: [],
    infrastructureLinkIds: [],
    militaryUnitIds: [],
    characterAgentIds: [],
    civilianUnitIds: [],
    outpostIds: [],
    claimIds: [],
    surveyed: false
  };
}

export function indexStrategicMapContents(view: Omit<StrategicMapViewport, "contentsByTileId">) {
  const contents = Object.fromEntries(view.tiles.map((tile) => [tile.id, emptyContents(tile)]));
  const add = (tileId: string | null | undefined, key: keyof StrategicTileContents, id: string) => {
    const entry = tileId ? contents[tileId] : undefined;
    const values = entry?.[key];
    if (Array.isArray(values) && !values.includes(id)) values.push(id);
  };
  for (const location of view.locations) add(location.worldTileId, "locationIds", location.id);
  for (const link of view.links) for (const tile of link.routeTiles) add(tile.id, "infrastructureLinkIds", link.id);
  for (const unit of view.units) add(unit.worldTileId, "militaryUnitIds", unit.id);
  for (const agent of view.agents) add(agent.currentWorldTileId, "characterAgentIds", agent.id);
  for (const unit of view.civilianUnits) add(unit.currentWorldTileId, "civilianUnitIds", unit.id);
  for (const outpost of view.outposts) add(outpost.worldTileId, "outpostIds", outpost.id);
  for (const claim of view.claims) for (const tileId of claim.plannedTileIds) add(tileId, "claimIds", claim.id);
  return contents;
}

export async function getStrategicMapViewport(
  nationId: string,
  bounds: StrategicMapViewport["bounds"]
): Promise<StrategicMapViewport> {
  const viewport = await getWorldViewport(bounds);
  const tileIds = new Set(viewport.tiles.map((tile) => tile.id));
  const surveyedIds = new Set(await getNationSurveyedTileIds(nationId));
  let locations: StrategicMapLocationMarker[];
  let units: StrategicMapViewport["units"];
  let agents: StrategicMapAgentMarker[];

  if (getConfig().DATA_MODE === "memory") {
    if (!getFallbackNation(nationId)) throw notFound("Nation not found");
    const nations = getFallbackNations().flatMap((nation) => (nation ? [nation] : []));
    const summaries = await Promise.all(
      nations.map((nation) => getNationSettlementSummary(nation.id).catch(() => null))
    );
    const settlementByLocation = new Map(
      summaries
        .flatMap((summary) => summary?.settlements ?? [])
        .map((settlement) => [settlement.locationId, settlement])
    );
    locations = nations.flatMap((nation) =>
      (getFallbackLocations(nation.id) ?? [])
        .filter((location) => location.worldTileId && inBounds(location.x, location.y, viewport.bounds))
        .map((location) => {
          const settlement = settlementByLocation.get(location.id);
          return {
            id: location.id,
            nationId: location.nationId,
            nationName: nation.name,
            name: location.name,
            type: location.type,
            worldTileId: location.worldTileId!,
            x: location.x,
            y: location.y,
            developmentLevel: location.developmentLevel,
            settlementId: settlement?.id,
            settlementLevel: settlement?.level
          };
        })
    );
    const ownLocations = new Map((getFallbackLocations(nationId) ?? []).map((location) => [location.id, location]));
    units = (getFallbackMilitaryUnits(nationId) ?? []).flatMap((unit) => {
      const location = unit.locationId ? ownLocations.get(unit.locationId) : undefined;
      return location?.worldTileId && tileIds.has(location.worldTileId)
        ? [
            {
              id: unit.id,
              name: unit.name,
              type: unit.type,
              locationId: location.id,
              worldTileId: location.worldTileId,
              strength: unit.strength,
              readiness: unit.readiness ?? 100,
              supply: unit.supply ?? 100
            }
          ]
        : [];
    });
    agents = (getFallbackAgents(nationId) ?? []).flatMap((agent) => {
      const assigned = agent.assignedLocationId ? ownLocations.get(agent.assignedLocationId) : undefined;
      const tileId = agent.currentWorldTileId ?? assigned?.worldTileId;
      return tileId && tileIds.has(tileId)
        ? [
            {
              id: agent.id,
              name: agent.name,
              role: agent.role,
              currentWorldTileId: tileId,
              assignedLocationId: agent.assignedLocationId,
              level: agent.level,
              health: agent.health,
              actionPoints: agent.actionPoints ?? 0
            }
          ]
        : [];
    });
  } else {
    const nation = await prisma.nation.findUnique({ where: { id: nationId }, select: { id: true } });
    if (!nation) throw notFound("Nation not found");
    const [locationRows, unitRows, agentRows] = await Promise.all([
      prisma.mapLocation.findMany({
        where: {
          x: { gte: viewport.bounds.minX, lte: viewport.bounds.maxX },
          y: { gte: viewport.bounds.minY, lte: viewport.bounds.maxY },
          worldTileId: { not: null }
        },
        include: { nation: { select: { name: true } }, settlement: { select: { id: true, level: true } } }
      }),
      prisma.militaryUnit.findMany({
        where: {
          nationId,
          location: {
            x: { gte: viewport.bounds.minX, lte: viewport.bounds.maxX },
            y: { gte: viewport.bounds.minY, lte: viewport.bounds.maxY },
            worldTileId: { not: null }
          }
        },
        include: { location: true }
      }),
      prisma.characterAgent.findMany({
        where: {
          nationId,
          currentWorldTile: {
            x: { gte: viewport.bounds.minX, lte: viewport.bounds.maxX },
            y: { gte: viewport.bounds.minY, lte: viewport.bounds.maxY }
          }
        }
      })
    ]);
    locations = locationRows.map((location) => ({
      id: location.id,
      nationId: location.nationId,
      nationName: location.nation?.name,
      name: location.name,
      type: location.type,
      worldTileId: location.worldTileId!,
      x: location.x,
      y: location.y,
      developmentLevel: location.developmentLevel,
      settlementId: location.settlement?.id,
      settlementLevel: location.settlement?.level
    }));
    units = unitRows.map((unit) => ({
      id: unit.id,
      name: unit.name,
      type: unit.type,
      locationId: unit.locationId!,
      worldTileId: unit.location!.worldTileId!,
      strength: unit.strength,
      readiness: unit.readiness,
      supply: unit.supply
    }));
    agents = agentRows
      .filter((agent) => agent.currentWorldTileId)
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        currentWorldTileId: agent.currentWorldTileId!,
        assignedLocationId: agent.assignedLocationId,
        level: agent.level,
        health: agent.health,
        actionPoints: agent.actionPoints
      }));
  }

  const territory = await getNationTerritory(nationId);
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const civilianUnits = territory.civilianUnits
    .filter((unit) => tileIds.has(unit.currentWorldTileId))
    .map((unit) => ({
      id: unit.id,
      name: unit.name,
      type: unit.type,
      status: unit.status,
      currentWorldTileId: unit.currentWorldTileId,
      health: unit.health,
      supply: unit.supply
    }));
  const outposts = territory.outposts.flatMap((outpost) => {
    const location = locationById.get(outpost.locationId);
    return location && tileIds.has(location.worldTileId)
      ? [
          {
            id: outpost.id,
            locationId: outpost.locationId,
            worldTileId: location.worldTileId,
            status: outpost.status,
            mature: outpost.mature,
            suppliedTurns: outpost.suppliedTurns
          }
        ]
      : [];
  });
  const claims: StrategicMapClaimMarker[] = territory.claims
    .filter((claim) => claim.tiles.some((item) => tileIds.has(item.tile.id)))
    .map((claim) => ({
      id: claim.id,
      status: claim.status,
      targetTileId: claim.targetTileId,
      anchorLocationId: claim.anchorLocationId,
      plannedTileIds: claim.tiles.map((item) => item.tile.id),
      claimedTileIds: claim.tiles.filter((item) => item.claimedTurn != null).map((item) => item.tile.id)
    }));
  const base = {
    nationId,
    generatedAt: new Date().toISOString(),
    world: viewport.world,
    bounds: viewport.bounds,
    tiles: viewport.tiles,
    locations,
    links: viewport.links,
    units,
    agents,
    civilianUnits,
    outposts,
    claims
  };
  const contentsByTileId = indexStrategicMapContents(base);
  for (const tileId of surveyedIds) if (contentsByTileId[tileId]) contentsByTileId[tileId].surveyed = true;
  return { ...base, contentsByTileId };
}
