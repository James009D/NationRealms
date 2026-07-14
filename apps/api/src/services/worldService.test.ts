import { describe, expect, it } from "vitest";
import { TERRAIN_DEFINITIONS } from "@statecraft/shared";
import { generateWorldTiles, WORLD_HEIGHT, WORLD_WIDTH } from "./worldService.js";

describe("shared world generation", () => {
  it("is deterministic and fills the configured world", () => {
    const first = generateWorldTiles("repeatable-seed");
    const second = generateWorldTiles("repeatable-seed");
    expect(first).toEqual(second);
    expect(first).toHaveLength(WORLD_WIDTH * WORLD_HEIGHT);
    expect(new Set(first.map((tile) => tile.id)).size).toBe(first.length);
  });

  it("creates varied land, ocean, coast, and strategic deposits", () => {
    const tiles = generateWorldTiles();
    const terrains = new Set(tiles.map((tile) => tile.terrain));
    expect(terrains.has("OCEAN")).toBe(true);
    expect(terrains.has("COAST")).toBe(true);
    expect(terrains.has("PLAINS")).toBe(true);
    expect(terrains.has("MOUNTAIN")).toBe(true);
    expect(new Set(tiles.flatMap((tile) => (tile.resourceDeposit ? [tile.resourceDeposit] : []))).size).toBeGreaterThan(
      4
    );
  });

  it("defines movement, defense, yields, and placement for every terrain", () => {
    for (const definition of Object.values(TERRAIN_DEFINITIONS)) {
      expect(definition.combat.movementCost).toBeGreaterThan(0);
      expect(definition.yield.resourcePercent).toBeDefined();
      expect(definition.description.length).toBeGreaterThan(10);
    }
    expect(TERRAIN_DEFINITIONS.MOUNTAIN.combat.defensePercent).toBe(35);
    expect(TERRAIN_DEFINITIONS.FOREST.combat.attackPercentByUnitType?.ARMOR).toBe(-10);
  });
});
