import type {
  Prisma,
  PrismaClient,
  ResourceType as PrismaResourceType,
  TerrainType as PrismaTerrainType
} from "@prisma/client";
import {
  STARTING_PACKAGES,
  TERRAIN_DEFINITIONS,
  type HomelandPlacement,
  type HomelandPreview,
  type LocationType,
  type ResourceType,
  type TerrainType,
  type WorldMapOverview,
  type WorldTile,
  type WorldViewport
} from "@statecraft/shared";
import { ApiError, notFound } from "../errors.js";
import { getConfig } from "../config.js";
import { prisma } from "../prisma.js";

export const WORLD_ID = "statecraft-world";
export const WORLD_WIDTH = 96;
export const WORLD_HEIGHT = 64;
export const WORLD_SEED = "statecraft-foundation-8";
export const WORLD_GENERATION_VERSION = 1;
const MAX_VIEWPORT_SIZE = 40;

type WorldClient =
  Pick<PrismaClient, "worldMap" | "worldTile" | "mapLocation" | "infrastructureLink"> | Prisma.TransactionClient;
type GeneratedTile = Omit<WorldTile, "claimedAt"> & { claimedAt: null };

function hash32(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomAt(seed: string, x: number, y: number, salt: string) {
  return hash32(`${seed}:${salt}:${x}:${y}`) / 0xffffffff;
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value);
}

function valueNoise(seed: string, x: number, y: number, scale: number, salt: string) {
  const gx = Math.floor(x / scale);
  const gy = Math.floor(y / scale);
  const tx = smoothstep((x % scale) / scale);
  const ty = smoothstep((y % scale) / scale);
  const a = randomAt(seed, gx, gy, salt);
  const b = randomAt(seed, gx + 1, gy, salt);
  const c = randomAt(seed, gx, gy + 1, salt);
  const d = randomAt(seed, gx + 1, gy + 1, salt);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

function elevationAt(seed: string, x: number, y: number) {
  const broad = valueNoise(seed, x, y, 16, "elevation-broad");
  const medium = valueNoise(seed, x, y, 7, "elevation-medium");
  const detail = valueNoise(seed, x, y, 3, "elevation-detail");
  const edgeX = Math.min(x / 9, (WORLD_WIDTH - 1 - x) / 9, 1);
  const edgeY = Math.min(y / 7, (WORLD_HEIGHT - 1 - y) / 7, 1);
  const edge = Math.max(0, Math.min(edgeX, edgeY));
  return Math.round(Math.max(0, Math.min(100, (broad * 0.55 + medium * 0.3 + detail * 0.15) * 100 - (1 - edge) * 25)));
}

function baseTerrain(
  seed: string,
  x: number,
  y: number,
  elevation: number,
  moisture: number,
  heat: number
): TerrainType {
  if (elevation < 39) return "OCEAN";
  if (elevation > 82) return "MOUNTAIN";
  if (elevation > 68) return "HILLS";
  if (heat < 0.22) return "TUNDRA";
  if (heat > 0.7 && moisture < 0.35) return "DESERT";
  if (moisture > 0.75 && elevation < 52) return "WETLAND";
  if (moisture > 0.56 || randomAt(seed, x, y, "forest") > 0.78) return "FOREST";
  return "PLAINS";
}

function depositFor(seed: string, x: number, y: number, terrain: TerrainType): ResourceType | null {
  const roll = randomAt(seed, x, y, "deposit");
  if (terrain === "OCEAN" || terrain === "COAST") return roll > 0.58 ? "FISH" : null;
  if (terrain === "FOREST") return roll > 0.48 ? "TIMBER" : roll < 0.08 ? "FOOD" : null;
  if (terrain === "PLAINS" || terrain === "WETLAND") return roll > 0.5 ? "FOOD" : roll < 0.08 ? "ENERGY" : null;
  if (terrain === "HILLS") return roll > 0.55 ? "IRON" : roll < 0.12 ? "RARE_EARTH" : null;
  if (terrain === "MOUNTAIN") return roll > 0.45 ? "IRON" : roll < 0.22 ? "RARE_EARTH" : null;
  if (terrain === "DESERT") return roll > 0.58 ? "OIL" : roll < 0.18 ? "ENERGY" : null;
  if (terrain === "TUNDRA") return roll > 0.65 ? "OIL" : roll < 0.16 ? "ENERGY" : null;
  return null;
}

export function generateWorldTiles(seed = WORLD_SEED): GeneratedTile[] {
  const provisional = Array.from({ length: WORLD_WIDTH * WORLD_HEIGHT }, (_, index) => {
    const x = index % WORLD_WIDTH;
    const y = Math.floor(index / WORLD_WIDTH);
    const elevation = elevationAt(seed, x, y);
    const moisture = valueNoise(seed, x, y, 9, "moisture");
    const latitudeHeat = 1 - Math.abs(y / (WORLD_HEIGHT - 1) - 0.5) * 1.35;
    const heat = Math.max(0, Math.min(1, latitudeHeat * 0.7 + valueNoise(seed, x, y, 11, "heat") * 0.3));
    return { x, y, elevation, moisture, heat, terrain: baseTerrain(seed, x, y, elevation, moisture, heat) };
  });
  const byCoordinate = new Map(provisional.map((tile) => [`${tile.x}:${tile.y}`, tile]));
  return provisional.map((tile) => {
    const neighbors = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]
      .map(([dx, dy]) => byCoordinate.get(`${tile.x + dx!}:${tile.y + dy!}`))
      .filter(Boolean);
    const terrain =
      tile.terrain !== "OCEAN" && neighbors.some((neighbor) => neighbor?.terrain === "OCEAN") ? "COAST" : tile.terrain;
    const fertility = Math.round(
      Math.max(
        0,
        Math.min(100, tile.moisture * 70 + (terrain === "PLAINS" ? 20 : 0) - Math.max(0, tile.elevation - 65))
      )
    );
    return {
      id: `world-tile-${tile.x}-${tile.y}`,
      worldMapId: WORLD_ID,
      x: tile.x,
      y: tile.y,
      terrain,
      elevation: tile.elevation,
      fertility,
      resourceDeposit: depositFor(seed, tile.x, tile.y, terrain),
      ownerNationId: null,
      controlLevel: null,
      claimedAt: null
    };
  });
}

let memoryTiles: WorldTile[] = generateWorldTiles();

export function resetMemoryWorld() {
  memoryTiles = generateWorldTiles();
}

export function updateMemoryWorldTiles(
  tileIds: string[],
  update: Partial<Pick<WorldTile, "ownerNationId" | "controlLevel" | "claimedAt" | "regionId">>
) {
  const ids = new Set(tileIds);
  memoryTiles = memoryTiles.map((tile) => (ids.has(tile.id) ? { ...tile, ...update } : tile));
  return memoryTiles.filter((tile) => ids.has(tile.id));
}

function worldOverview(tiles: WorldTile[]): WorldMapOverview {
  return {
    id: WORLD_ID,
    name: "Statecraft World",
    seed: WORLD_SEED,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    generationVersion: WORLD_GENERATION_VERSION,
    claimedTileCount: tiles.filter((tile) => tile.ownerNationId).length,
    nationCount: new Set(tiles.flatMap((tile) => (tile.ownerNationId ? [tile.ownerNationId] : []))).size
  };
}

function serializeDbTile(tile: {
  id: string;
  worldMapId: string;
  x: number;
  y: number;
  terrain: PrismaTerrainType;
  elevation: number;
  fertility: number;
  resourceDeposit: PrismaResourceType | null;
  ownerNationId: string | null;
  controlLevel?: import("@prisma/client").TerritorialControlLevel | null;
  claimedAt: Date | null;
}): WorldTile {
  return {
    ...tile,
    terrain: tile.terrain as TerrainType,
    resourceDeposit: tile.resourceDeposit as ResourceType | null,
    controlLevel: tile.controlLevel ?? (tile.ownerNationId ? "SECURED" : null),
    claimedAt: tile.claimedAt?.toISOString() ?? null
  };
}

export async function ensureWorld(client: WorldClient = prisma) {
  const existing = await client.worldMap.findUnique({ where: { id: WORLD_ID } });
  if (existing) return existing;
  await client.worldMap.create({
    data: {
      id: WORLD_ID,
      name: "Statecraft World",
      seed: WORLD_SEED,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      generationVersion: WORLD_GENERATION_VERSION
    }
  });
  const generated = generateWorldTiles();
  for (let offset = 0; offset < generated.length; offset += 750) {
    await client.worldTile.createMany({
      data: generated.slice(offset, offset + 750).map(({ claimedAt: _claimedAt, ...tile }) => ({
        ...tile,
        terrain: tile.terrain as PrismaTerrainType,
        resourceDeposit: tile.resourceDeposit as PrismaResourceType | null
      }))
    });
  }
  return client.worldMap.findUniqueOrThrow({ where: { id: WORLD_ID } });
}

async function allTiles(client?: WorldClient): Promise<WorldTile[]> {
  if (getConfig().DATA_MODE === "memory") return memoryTiles;
  await ensureWorld(client ?? prisma);
  return (
    await (client ?? prisma).worldTile.findMany({
      where: { worldMapId: WORLD_ID },
      orderBy: [{ y: "asc" }, { x: "asc" }]
    })
  ).map(serializeDbTile);
}

export async function getAllWorldTiles(client?: WorldClient) {
  return allTiles(client);
}

export async function getWorldOverview(): Promise<WorldMapOverview> {
  const tiles = await allTiles();
  return worldOverview(tiles);
}

export async function getWorldViewport(bounds: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}): Promise<WorldViewport> {
  const minX = Math.max(0, Math.trunc(bounds.minX));
  const minY = Math.max(0, Math.trunc(bounds.minY));
  const maxX = Math.min(WORLD_WIDTH - 1, Math.trunc(bounds.maxX), minX + MAX_VIEWPORT_SIZE - 1);
  const maxY = Math.min(WORLD_HEIGHT - 1, Math.trunc(bounds.maxY), minY + MAX_VIEWPORT_SIZE - 1);
  const tiles = (await allTiles()).filter(
    (tile) => tile.x >= minX && tile.x <= maxX && tile.y >= minY && tile.y <= maxY
  );
  if (getConfig().DATA_MODE === "memory")
    return {
      world: worldOverview(await allTiles()),
      bounds: { minX, minY, maxX, maxY },
      tiles,
      locations: [],
      links: []
    };
  const [locations, links] = await Promise.all([
    prisma.mapLocation.findMany({
      where: { x: { gte: minX, lte: maxX }, y: { gte: minY, lte: maxY } },
      select: { id: true, nationId: true, name: true, type: true, x: true, y: true }
    }),
    prisma.infrastructureLink.findMany({
      where: {
        scope: "MAJOR",
        enabled: true,
        tiles: { some: { tile: { x: { gte: minX, lte: maxX }, y: { gte: minY, lte: maxY } } } }
      },
      include: { tiles: { include: { tile: true }, orderBy: { sequence: "asc" } } }
    })
  ]);
  return {
    world: worldOverview(await allTiles()),
    bounds: { minX, minY, maxX, maxY },
    tiles,
    locations: locations as WorldViewport["locations"],
    links: links.map((link) => ({
      ...link,
      type: link.type as import("@statecraft/shared").InfrastructureType,
      routeTiles: link.tiles.map((item) => serializeDbTile(item.tile)),
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString()
    }))
  };
}

function compatibleTerrain(type: LocationType, tile: WorldTile) {
  if (type === "PORT") return tile.terrain === "COAST";
  if (type === "FARM") return tile.terrain === "PLAINS" || tile.terrain === "WETLAND";
  if (type === "MINE") return tile.terrain === "HILLS" || tile.terrain === "MOUNTAIN";
  if (type === "CAPITAL" || type === "CITY" || type === "TOWN")
    return ["PLAINS", "FOREST", "HILLS", "COAST"].includes(tile.terrain);
  return TERRAIN_DEFINITIONS[tile.terrain].allowedLocationTypes.includes(type);
}

function claimTilesAround(capital: WorldTile, tiles: WorldTile[]) {
  const tileMap = new Map(tiles.map((tile) => [`${tile.x}:${tile.y}`, tile]));
  const claimed: WorldTile[] = [];
  const seen = new Set<string>();
  const queue = [capital];
  while (queue.length && claimed.length < 64) {
    const tile = queue.shift()!;
    const key = `${tile.x}:${tile.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (tile.terrain === "OCEAN" || tile.ownerNationId) continue;
    claimed.push(tile);
    [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1]
    ]
      .map(([dx, dy]) => tileMap.get(`${tile.x + dx!}:${tile.y + dy!}`))
      .filter((item): item is WorldTile => Boolean(item))
      .sort(
        (a, b) =>
          Math.abs(a.x - capital.x) +
          Math.abs(a.y - capital.y) -
          (Math.abs(b.x - capital.x) + Math.abs(b.y - capital.y))
      )
      .forEach((item) => queue.push(item));
  }
  const coastal = tiles
    .filter(
      (tile) =>
        tile.terrain === "OCEAN" &&
        !tile.ownerNationId &&
        claimed.some((land) => Math.abs(land.x - tile.x) + Math.abs(land.y - tile.y) === 1)
    )
    .slice(0, 16);
  return [...claimed, ...coastal];
}

function buildPreview(
  tiles: WorldTile[],
  capitalX: number,
  capitalY: number,
  startingPackageId: string
): HomelandPreview {
  const capital = tiles.find((tile) => tile.x === capitalX && tile.y === capitalY);
  if (!capital) throw notFound("World tile not found");
  const pack = STARTING_PACKAGES.find((item) => item.id === startingPackageId) ?? STARTING_PACKAGES[0]!;
  const warnings: string[] = [];
  if (capital.ownerNationId) warnings.push("The selected capital tile is already claimed.");
  if (!compatibleTerrain("CAPITAL", capital)) warnings.push("The selected tile cannot support a capital.");
  const claimedTiles = claimTilesAround(capital, tiles);
  if (claimedTiles.filter((tile) => tile.terrain !== "OCEAN").length < 64)
    warnings.push("This area cannot form a complete contiguous homeland.");
  const used = new Set<string>();
  const locationPlacements = pack.locations.flatMap((location) => {
    const candidates = claimedTiles
      .filter((tile) => !used.has(tile.id) && compatibleTerrain(location.type, tile))
      .sort((a, b) => {
        if (location.key === "capital") return a.id === capital.id ? -1 : b.id === capital.id ? 1 : 0;
        const depositA = location.resourceType && a.resourceDeposit === location.resourceType ? -10 : 0;
        const depositB = location.resourceType && b.resourceDeposit === location.resourceType ? -10 : 0;
        return (
          depositA -
          depositB +
          Math.abs(a.x - capital.x) +
          Math.abs(a.y - capital.y) -
          Math.abs(b.x - capital.x) -
          Math.abs(b.y - capital.y)
        );
      });
    const tile = location.key === "capital" ? capital : candidates[0];
    if (!tile || !compatibleTerrain(location.type, tile)) {
      warnings.push(`No viable ${location.name} tile is available in this homeland.`);
      return [];
    }
    used.add(tile.id);
    return [{ key: location.key, name: location.name, type: location.type, tile }];
  });
  const previewVersion = hash32(
    `${startingPackageId}:${claimedTiles
      .map((tile) => tile.id)
      .sort()
      .join("|")}`
  ).toString(16);
  if (
    locationPlacements.some(
      (placement) => Math.max(Math.abs(placement.tile.x - capital.x), Math.abs(placement.tile.y - capital.y)) > 5
    )
  )
    warnings.push("Starting locations would be too dispersed for early movement.");
  return {
    valid: warnings.length === 0 && locationPlacements.length === pack.locations.length,
    previewVersion,
    capital,
    claimedTiles,
    locationPlacements,
    terrainSummary: claimedTiles.reduce(
      (summary, tile) => ({ ...summary, [tile.terrain]: (summary[tile.terrain] ?? 0) + 1 }),
      {} as Partial<Record<TerrainType, number>>
    ),
    deposits: claimedTiles.reduce(
      (summary, tile) =>
        tile.resourceDeposit
          ? { ...summary, [tile.resourceDeposit]: (summary[tile.resourceDeposit] ?? 0) + 1 }
          : summary,
      {} as Partial<Record<ResourceType, number>>
    ),
    warnings
  };
}

export async function previewHomeland(
  capitalX: number,
  capitalY: number,
  startingPackageId: string,
  client?: WorldClient
) {
  return buildPreview(await allTiles(client), capitalX, capitalY, startingPackageId);
}

export async function claimHomeland(
  client: Prisma.TransactionClient,
  nationId: string,
  placement: HomelandPlacement,
  startingPackageId: string
) {
  const preview = await previewHomeland(placement.capitalX, placement.capitalY, startingPackageId, client);
  if (!preview.valid || preview.previewVersion !== placement.previewVersion)
    throw new ApiError(409, "HOMELAND_CONFLICT", "Homeland selection is no longer valid.");
  const ids = preview.claimedTiles.map((tile) => tile.id);
  const claimed = await client.worldTile.updateMany({
    where: { id: { in: ids }, ownerNationId: null },
    data: { ownerNationId: nationId, controlLevel: "SECURED", claimedAt: new Date() }
  });
  if (claimed.count !== ids.length)
    throw new ApiError(409, "HOMELAND_CONFLICT", "Another nation claimed part of this homeland.");
  return preview;
}

export function claimMemoryHomeland(nationId: string, placement: HomelandPlacement, startingPackageId: string) {
  const preview = buildPreview(memoryTiles, placement.capitalX, placement.capitalY, startingPackageId);
  if (!preview.valid || preview.previewVersion !== placement.previewVersion)
    throw new ApiError(409, "HOMELAND_CONFLICT", "Homeland selection is no longer valid.");
  const ids = new Set(preview.claimedTiles.map((tile) => tile.id));
  const claimedAt = new Date().toISOString();
  memoryTiles = memoryTiles.map((tile) =>
    ids.has(tile.id) ? { ...tile, ownerNationId: nationId, controlLevel: "SECURED", claimedAt } : tile
  );
  return preview;
}

export async function findAutomaticHomeland(startingPackageId: string, client?: WorldClient) {
  const tiles = await allTiles(client);
  for (const tile of tiles.filter((item) => !item.ownerNationId && compatibleTerrain("CAPITAL", item))) {
    const preview = buildPreview(tiles, tile.x, tile.y, startingPackageId);
    if (preview.valid)
      return {
        worldMapId: WORLD_ID,
        capitalX: tile.x,
        capitalY: tile.y,
        previewVersion: preview.previewVersion
      } satisfies HomelandPlacement;
  }
  throw new ApiError(409, "WORLD_CAPACITY_REACHED", "The world has no viable homeland remaining.");
}

export function findAutomaticMemoryHomeland(startingPackageId: string) {
  for (const tile of memoryTiles.filter((item) => !item.ownerNationId && compatibleTerrain("CAPITAL", item))) {
    const preview = buildPreview(memoryTiles, tile.x, tile.y, startingPackageId);
    if (preview.valid)
      return {
        worldMapId: WORLD_ID,
        capitalX: tile.x,
        capitalY: tile.y,
        previewVersion: preview.previewVersion
      } satisfies HomelandPlacement;
  }
  throw new ApiError(409, "WORLD_CAPACITY_REACHED", "The world has no viable homeland remaining.");
}

export function placeMemoryExistingNation<
  T extends { id: string; name: string; type: LocationType; resourceType?: ResourceType | null; x: number; y: number }
>(nationId: string, locations: T[]) {
  if (!locations.length || locations.every((location) => "worldTileId" in location && location.worldTileId))
    return locations;
  const packageId = packageForExistingLocations(locations);
  const placement = findAutomaticMemoryHomeland(packageId);
  const homeland = claimMemoryHomeland(nationId, placement, packageId);
  const used = new Set<string>();
  return locations
    .sort((a, b) => (a.type === "CAPITAL" ? -1 : b.type === "CAPITAL" ? 1 : a.id.localeCompare(b.id)))
    .map((location) => {
      const candidates = homeland.claimedTiles
        .filter((tile) => !used.has(tile.id) && compatibleTerrain(location.type, tile))
        .sort((a, b) => {
          const depositA = location.resourceType && a.resourceDeposit === location.resourceType ? -20 : 0;
          const depositB = location.resourceType && b.resourceDeposit === location.resourceType ? -20 : 0;
          return (
            depositA -
            depositB +
            Math.abs(a.x - homeland.capital.x) +
            Math.abs(a.y - homeland.capital.y) -
            Math.abs(b.x - homeland.capital.x) -
            Math.abs(b.y - homeland.capital.y)
          );
        });
      const tile = location.type === "CAPITAL" ? homeland.capital : candidates[0];
      if (!tile) return location;
      used.add(tile.id);
      return {
        ...location,
        x: tile.x,
        y: tile.y,
        worldTileId: tile.id,
        terrain: tile.terrain,
        worldTile: tile,
        resourceType: ["MINE", "RESOURCE_SITE"].includes(location.type)
          ? (tile.resourceDeposit ?? location.resourceType ?? null)
          : (location.resourceType ?? null)
      };
    });
}

function packageForExistingLocations(locations: Array<{ type: LocationType }>) {
  if (locations.some((location) => location.type === "PORT")) return "maritime_trader";
  if (locations.some((location) => location.type === "MINE")) return "industrial_power";
  if (locations.filter((location) => location.type === "FARM").length > 1) return "agrarian_federation";
  return "balanced_republic";
}

export async function initializeExistingNations() {
  if (getConfig().DATA_MODE === "memory") return { placedNationIds: [] as string[] };
  await ensureWorld();
  const nations = await prisma.nation.findMany({
    include: { mapLocations: { orderBy: [{ type: "asc" }, { id: "asc" }] }, worldTiles: { take: 1 } },
    orderBy: { createdAt: "asc" }
  });
  const placedNationIds: string[] = [];
  for (const nation of nations) {
    if (nation.worldTiles.length || !nation.mapLocations.length) continue;
    const packageId = packageForExistingLocations(nation.mapLocations as Array<{ type: LocationType }>);
    const placement = await findAutomaticHomeland(packageId);
    await prisma.$transaction(async (client) => {
      const homeland = await claimHomeland(client, nation.id, placement, packageId);
      const used = new Set<string>();
      for (const location of nation.mapLocations.sort((a, b) =>
        a.type === "CAPITAL" ? -1 : b.type === "CAPITAL" ? 1 : a.id.localeCompare(b.id)
      )) {
        const candidates = homeland.claimedTiles
          .filter((tile) => !used.has(tile.id) && compatibleTerrain(location.type as LocationType, tile))
          .sort((a, b) => {
            const depositA = location.resourceType && a.resourceDeposit === location.resourceType ? -20 : 0;
            const depositB = location.resourceType && b.resourceDeposit === location.resourceType ? -20 : 0;
            return (
              depositA -
              depositB +
              Math.abs(a.x - homeland.capital.x) +
              Math.abs(a.y - homeland.capital.y) -
              Math.abs(b.x - homeland.capital.x) -
              Math.abs(b.y - homeland.capital.y)
            );
          });
        const tile = location.type === "CAPITAL" ? homeland.capital : candidates[0];
        if (!tile)
          throw new ApiError(409, "WORLD_CAPACITY_REACHED", `No valid terrain was found for ${location.name}.`);
        used.add(tile.id);
        await client.mapLocation.update({
          where: { id: location.id },
          data: {
            worldTileId: tile.id,
            x: tile.x,
            y: tile.y,
            resourceType: ["MINE", "RESOURCE_SITE"].includes(location.type)
              ? ((tile.resourceDeposit as PrismaResourceType | null) ?? location.resourceType)
              : location.resourceType
          }
        });
      }
    });
    placedNationIds.push(nation.id);
  }
  return { placedNationIds };
}
