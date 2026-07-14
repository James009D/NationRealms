import { TERRAIN_DEFINITIONS, type WorldTile } from "@statecraft/shared";

export interface MapPathOptions {
  canEnter: (tile: WorldTile) => boolean;
  cost?: (tile: WorldTile) => number;
  maxCost?: number;
}

const key = (tile: Pick<WorldTile, "x" | "y">) => `${tile.x}:${tile.y}`;

export function findDeterministicTilePath(
  tiles: WorldTile[],
  fromTileId: string,
  toTileId: string,
  options: MapPathOptions
): WorldTile[] {
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  const byCoordinate = new Map(tiles.map((tile) => [key(tile), tile]));
  const start = byId.get(fromTileId);
  const target = byId.get(toTileId);
  if (!start || !target || !options.canEnter(target)) return [];

  const distance = new Map<string, number>([[start.id, 0]]);
  const previous = new Map<string, string>();
  const open = new Set<string>([start.id]);
  while (open.size) {
    const currentId = [...open].sort((left, right) => {
      const delta = (distance.get(left) ?? Number.MAX_SAFE_INTEGER) - (distance.get(right) ?? Number.MAX_SAFE_INTEGER);
      if (delta) return delta;
      const a = byId.get(left)!;
      const b = byId.get(right)!;
      return a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);
    })[0]!;
    open.delete(currentId);
    if (currentId === target.id) break;
    const current = byId.get(currentId)!;
    const neighbors = [
      byCoordinate.get(`${current.x}:${current.y - 1}`),
      byCoordinate.get(`${current.x - 1}:${current.y}`),
      byCoordinate.get(`${current.x + 1}:${current.y}`),
      byCoordinate.get(`${current.x}:${current.y + 1}`)
    ].filter((tile): tile is WorldTile => Boolean(tile && options.canEnter(tile)));
    for (const neighbor of neighbors) {
      const step = options.cost?.(neighbor) ?? TERRAIN_DEFINITIONS[neighbor.terrain].combat.movementCost;
      const candidate = (distance.get(currentId) ?? 0) + step;
      if (candidate > (options.maxCost ?? Number.MAX_SAFE_INTEGER)) continue;
      if (candidate < (distance.get(neighbor.id) ?? Number.MAX_SAFE_INTEGER)) {
        distance.set(neighbor.id, candidate);
        previous.set(neighbor.id, currentId);
        open.add(neighbor.id);
      }
    }
  }
  if (!distance.has(target.id)) return [];
  const path: WorldTile[] = [];
  let cursor: string | undefined = target.id;
  while (cursor) {
    path.unshift(byId.get(cursor)!);
    if (cursor === start.id) break;
    cursor = previous.get(cursor);
  }
  return path[0]?.id === start.id ? path : [];
}

export function pathTerrainCost(path: WorldTile[]) {
  return path.slice(1).reduce((sum, tile) => sum + TERRAIN_DEFINITIONS[tile.terrain].combat.movementCost, 0);
}
