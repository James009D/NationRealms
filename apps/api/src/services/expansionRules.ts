import {
  EXPANSION_BALANCE,
  influenceCost,
  supplyScore,
  TERRAIN_DEFINITIONS,
  type TerritoryClaimTile,
  type WorldTile
} from "@statecraft/shared";
import { findDeterministicTilePath, pathTerrainCost } from "./mapPathService.js";

export interface ClaimPlanResult {
  valid: boolean;
  blockers: string[];
  tiles: Array<{ tile: WorldTile; influenceCost: number }>;
}

export function buildClaimPlan(
  tiles: WorldTile[],
  nationId: string,
  anchorTileId: string,
  targetTileId: string,
  surveyedTileIds: Set<string>
): ClaimPlanResult {
  const target = tiles.find((tile) => tile.id === targetTileId);
  const anchor = tiles.find((tile) => tile.id === anchorTileId);
  const blockers: string[] = [];
  if (!target || !anchor) return { valid: false, blockers: ["Anchor or target tile was not found."], tiles: [] };
  if (target.ownerNationId) blockers.push("The target tile is already owned.");
  if (target.terrain === "OCEAN") blockers.push("Ocean territory cannot be claimed in this milestone.");
  if (!surveyedTileIds.has(target.id)) blockers.push("The target tile must be surveyed first.");

  const path = findDeterministicTilePath(tiles, anchor.id, target.id, {
    canEnter: (tile) => tile.terrain !== "OCEAN" && (!tile.ownerNationId || tile.ownerNationId === nationId),
    cost: (tile) => influenceCost(tile.terrain, surveyedTileIds.has(tile.id)) ?? 999,
    maxCost: 120
  });
  const unownedPath = path.slice(1).filter((tile) => !tile.ownerNationId);
  if (!path.length) blockers.push("No valid neutral frontier route reaches this tile.");
  if (unownedPath.length > EXPANSION_BALANCE.maxUnownedPathTiles)
    blockers.push(`Frontier targets may be at most ${EXPANSION_BALANCE.maxUnownedPathTiles} unowned tiles away.`);

  const foreignAdjacent = tiles.some(
    (tile) =>
      tile.ownerNationId &&
      tile.ownerNationId !== nationId &&
      Math.abs(tile.x - target.x) + Math.abs(tile.y - target.y) === 1
  );
  if (foreignAdjacent) blockers.push("Foreign territory forms a hard boundary around this target.");

  const planned = [...unownedPath];
  const candidates = tiles
    .filter(
      (tile) =>
        !tile.ownerNationId &&
        tile.terrain !== "OCEAN" &&
        !planned.some((item) => item.id === tile.id) &&
        Math.abs(tile.x - target.x) + Math.abs(tile.y - target.y) <= 2
    )
    .sort((a, b) => {
      const aDistance = Math.abs(a.x - target.x) + Math.abs(a.y - target.y);
      const bDistance = Math.abs(b.x - target.x) + Math.abs(b.y - target.y);
      return aDistance - bDistance || a.y - b.y || a.x - b.x;
    });
  while (planned.length < Math.max(5, Math.min(10, unownedPath.length + 3)) && candidates.length) {
    const nextIndex = candidates.findIndex((candidate) =>
      planned.concat(anchor).some((tile) => Math.abs(tile.x - candidate.x) + Math.abs(tile.y - candidate.y) === 1)
    );
    if (nextIndex < 0) break;
    planned.push(candidates.splice(nextIndex, 1)[0]!);
  }
  const result = planned.map((tile) => ({
    tile,
    influenceCost: influenceCost(tile.terrain, surveyedTileIds.has(tile.id)) ?? 999
  }));
  return { valid: blockers.length === 0, blockers, tiles: result };
}

export function spendClaimInfluence(
  tiles: TerritoryClaimTile[],
  generatedInfluence: number,
  carry = 0
): { tiles: TerritoryClaimTile[]; carry: number; completedTileIds: string[] } {
  let influence = carry + generatedInfluence;
  let claimed = 0;
  const completedTileIds: string[] = [];
  const updated = tiles.map((item) => ({ ...item }));
  for (const item of updated.sort((a, b) => a.sequence - b.sequence)) {
    if (item.claimedTurn || claimed >= EXPANSION_BALANCE.maxTilesClaimedPerTurn) continue;
    const needed = Math.max(0, item.influenceCost - item.influenceProgress);
    const spent = Math.min(needed, influence);
    item.influenceProgress += spent;
    influence -= spent;
    if (item.influenceProgress >= item.influenceCost) {
      completedTileIds.push(item.tile.id);
      claimed += 1;
    }
    if (influence <= 0) break;
  }
  return { tiles: updated, carry: influence, completedTileIds };
}

export function calculateSupplyForPath(path: WorldTile[], transportationBonus: number, reliability: number) {
  return supplyScore(pathTerrainCost(path), transportationBonus, reliability);
}

export function civilianMovement(
  path: WorldTile[],
  routeIndex: number,
  movement = EXPANSION_BALANCE.civilianMovementPerTurn
) {
  let remaining = movement;
  let index = routeIndex;
  let supplyCost = 0;
  while (index + 1 < path.length) {
    const cost = TERRAIN_DEFINITIONS[path[index + 1]!.terrain].combat.movementCost;
    if (cost > remaining) break;
    remaining -= cost;
    supplyCost += cost * 5;
    index += 1;
  }
  return { routeIndex: index, supplyCost, arrived: index >= path.length - 1 };
}
