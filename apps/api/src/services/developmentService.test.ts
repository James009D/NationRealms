import { describe, expect, it } from "vitest";
import {
  calculateLocationYield,
  calculateUpgradeQuote,
  developmentMultiplier,
  projectLimit
} from "./developmentService.js";

const town = {
  id: "town",
  nationId: "nation",
  name: "Test Town",
  type: "TOWN" as const,
  resourceType: null,
  developmentLevel: 3
};

describe("location development rules", () => {
  it("uses diminishing development multipliers and clamps levels", () => {
    expect([1, 2, 3, 4, 5].map(developmentMultiplier)).toEqual([1, 1.35, 1.75, 2.2, 2.7]);
    expect(developmentMultiplier(99)).toBe(2.7);
  });

  it("calculates target-level costs and engineer discounts deterministically", () => {
    const quote = calculateUpgradeQuote(town, {
      id: "engineer",
      nationId: "nation",
      name: "Ari Vale",
      role: "ENGINEER",
      assignment: "IMPROVING",
      level: 2,
      assignedLocationId: "town"
    });
    expect(quote).toMatchObject({
      targetLevel: 4,
      treasuryCost: 675,
      resourceCosts: { TIMBER: 50 },
      durationTurns: 1,
      costDiscountPercent: 10,
      durationReduction: 1
    });
  });

  it("derives construction slots from administrative capacity", () => {
    expect(projectLimit(39)).toBe(1);
    expect(projectLimit(40)).toBe(2);
    expect(projectLimit(80)).toBe(3);
  });

  it("applies assigned governor bonuses to location output", () => {
    const output = calculateLocationYield(town, [
      {
        id: "governor",
        nationId: "nation",
        name: "Governor",
        role: "GOVERNOR",
        assignment: "GOVERNING",
        level: 2,
        assignedLocationId: "town"
      }
    ]);
    expect(output).toMatchObject({ treasury: 56, multiplier: 1.75, agentBonusPercent: 6 });
  });
});
