import { describe, expect, it } from "vitest";
import type { WorldTile } from "@statecraft/shared";
import { findDeterministicTilePath, pathTerrainCost } from "./mapPathService.js";

const tiles: WorldTile[] = [
  { id: "a", worldMapId: "world", x: 0, y: 0, terrain: "PLAINS", elevation: 0, fertility: 50 },
  { id: "b", worldMapId: "world", x: 1, y: 0, terrain: "MOUNTAIN", elevation: 80, fertility: 10 },
  { id: "c", worldMapId: "world", x: 0, y: 1, terrain: "PLAINS", elevation: 0, fertility: 50 },
  { id: "d", worldMapId: "world", x: 1, y: 1, terrain: "PLAINS", elevation: 0, fertility: 50 }
];

describe("map path service", () => {
  it("chooses the deterministic lower-cost route", () => {
    const path = findDeterministicTilePath(tiles, "a", "d", { canEnter: () => true });
    expect(path.map((tile) => tile.id)).toEqual(["a", "c", "d"]);
    expect(pathTerrainCost(path)).toBe(2);
  });
});
