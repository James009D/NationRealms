import { describe, expect, it } from "vitest";
import {
  frontierAdministrativeLoad,
  influenceCost,
  territoryClaimLimit,
  type TerritoryClaimTile,
  type WorldTile
} from "@statecraft/shared";
import { buildClaimPlan, calculateSupplyForPath, civilianMovement, spendClaimInfluence } from "./expansionRules.js";

function lineTiles(): WorldTile[] {
  return Array.from({ length: 8 }, (_, x) => ({
    id: `tile-${x}`,
    worldMapId: "world",
    x,
    y: 0,
    terrain: x === 4 ? "HILLS" : "PLAINS",
    elevation: 0,
    fertility: 50,
    ownerNationId: x < 2 ? "nation" : null,
    controlLevel: x < 2 ? "SECURED" : null
  }));
}

describe("expansion rules", () => {
  it("requires survey and limits frontier reach", () => {
    const tiles = lineTiles();
    expect(buildClaimPlan(tiles, "nation", "tile-1", "tile-4", new Set()).valid).toBe(false);
    const plan = buildClaimPlan(tiles, "nation", "tile-1", "tile-4", new Set(["tile-4"]));
    expect(plan.valid).toBe(true);
    expect(plan.tiles.some((item) => item.tile.id === "tile-4")).toBe(true);
  });

  it("claims no more than two tiles per turn", () => {
    const tiles: TerritoryClaimTile[] = lineTiles()
      .slice(2, 5)
      .map((tile, sequence) => ({
        tile,
        sequence,
        influenceCost: 6,
        influenceProgress: 0
      }));
    expect(spendClaimInfluence(tiles, 30).completedTileIds).toHaveLength(2);
  });

  it("moves colonists according to terrain cost", () => {
    const movement = civilianMovement(lineTiles().slice(2, 6), 0, 2);
    expect(movement.routeIndex).toBe(1);
    expect(movement.supplyCost).toBe(5);
    expect(movement.arrived).toBe(false);
  });

  it("discounts surveyed influence and exposes frontier administration pressure", () => {
    expect(influenceCost("HILLS", false)).toBe(8);
    expect(influenceCost("HILLS", true)).toBe(6);
    expect(frontierAdministrativeLoad(2, 1, 5)).toBe(15);
    expect(territoryClaimLimit(120)).toBe(3);
  });

  it("scales supply bonuses by network reliability", () => {
    const path = lineTiles().slice(2, 5);
    expect(calculateSupplyForPath(path, 20, 100)).toBe(100);
    expect(calculateSupplyForPath(path, 20, 50)).toBe(95);
  });
});
