import { describe, expect, it } from "vitest";
import { calculateLocationYield } from "./developmentService.js";
import { terrainCombatForLocation } from "./terrainService.js";

describe("terrain mechanics", () => {
  it("increases farm food on plains and timber in forests", () => {
    const plainsFarm = calculateLocationYield({
      id: "farm",
      type: "FARM",
      resourceType: "FOOD",
      developmentLevel: 1,
      terrain: "PLAINS"
    });
    const forestSite = calculateLocationYield({
      id: "site",
      type: "RESOURCE_SITE",
      resourceType: "TIMBER",
      developmentLevel: 1,
      terrain: "FOREST"
    });
    expect(plainsFarm.resources.FOOD).toBeGreaterThan(90);
    expect(forestSite.resources.TIMBER).toBeGreaterThan(35);
  });

  it("exposes future combat modifiers without resolving combat", () => {
    const forestArmor = terrainCombatForLocation({ type: "MILITARY_BASE", terrain: "FOREST" }, "ARMOR");
    const mountainInfantry = terrainCombatForLocation({ type: "MILITARY_BASE", terrain: "MOUNTAIN" }, "INFANTRY");
    expect(forestArmor.attackPercent).toBe(-10);
    expect(mountainInfantry.defensePercent).toBe(35);
    expect(mountainInfantry.movementCost).toBe(3);
  });
});
