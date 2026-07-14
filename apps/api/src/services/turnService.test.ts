import { describe, expect, it } from "vitest";
import { calculateLocationYield } from "./turnService.js";
import { levelForXp } from "./progression.js";

describe("turn progression helpers", () => {
  it("scales farm production by development level", () => {
    expect(calculateLocationYield({ type: "FARM", resourceType: "FOOD", developmentLevel: 3 })).toEqual({
      treasury: 18,
      resources: { FOOD: 158 },
      upkeep: 11,
      multiplier: 1.75,
      agentBonusPercent: 0
    });
  });

  it("targets deterministic agent levels from XP", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(900)).toBe(4);
    expect(levelForXp(100_000)).toBe(20);
  });
});
