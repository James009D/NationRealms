import { describe, expect, it } from "vitest";
import { settlementCapacity, settlementGrowthRequired } from "@statecraft/shared";
import {
  calculateSettlementTurn,
  transportationFoodAccess,
  validateWorkforce,
  type SettlementRuleInput
} from "./settlementRules.js";

function input(overrides: Partial<SettlementRuleInput> = {}): SettlementRuleInput {
  return {
    id: "settlement-1",
    name: "Teston",
    type: "CAPITAL",
    level: "TOWN",
    residentPopulation: 200_000,
    populationLevel: 2,
    growthProgress: 0,
    storedFood: 20,
    health: 75,
    stability: 70,
    shortageTurns: 0,
    primarySpecialization: null,
    secondarySpecialization: null,
    governorPriority: "BALANCED",
    governorLevel: 0,
    workforce: [
      { category: "FOOD", assigned: 1 },
      { category: "COMMERCE", assigned: 1 }
    ],
    buildingKeys: [],
    improvementKeys: [],
    transportationLevel: "ROADS",
    networkReliability: 100,
    capacity: settlementCapacity({
      administrativeCapacity: 70,
      governmentType: "DEMOCRATIC_REPUBLIC",
      nationalStability: 60,
      settlementCount: 1
    }),
    nationalFoodAvailable: 100,
    populationPerLevel: 100_000,
    ...overrides
  };
}

describe("settlement rules", () => {
  it("uses escalating population growth requirements", () => {
    expect(settlementGrowthRequired(1)).toBe(60);
    expect(settlementGrowthRequired(4)).toBeGreaterThan(settlementGrowthRequired(3));
    expect(settlementGrowthRequired(10)).toBeGreaterThan(settlementGrowthRequired(4) * 2);
  });

  it("does not grow a well-managed town in fewer than eight turns", () => {
    let state = input();
    let grewAt = 0;
    for (let turn = 1; turn <= 12; turn += 1) {
      const result = calculateSettlementTurn(state);
      state = { ...state, ...result.next };
      if (result.outcome.populationLevelChange > 0) {
        grewAt = turn;
        break;
      }
    }
    expect(grewAt).toBeGreaterThanOrEqual(8);
  });

  it("stops growth before severe shortages cause population loss", () => {
    let state = input({
      populationLevel: 3,
      residentPopulation: 300_000,
      growthProgress: 30,
      storedFood: 0,
      workforce: [],
      nationalFoodAvailable: 0,
      transportationLevel: "ISOLATED"
    });
    const first = calculateSettlementTurn(state);
    expect(first.outcome.shortageStarted).toBe(true);
    expect(first.next.growthProgress).toBe(30);
    expect(first.next.populationLevel).toBe(3);

    state = { ...state, ...first.next };
    state = { ...state, ...calculateSettlementTurn(state).next };
    const third = calculateSettlementTurn(state);
    expect(third.next.populationLevel).toBe(2);
    expect(third.outcome.populationLevelChange).toBe(-1);
  });

  it("applies housing pressure and warns about overcrowding", () => {
    const result = calculateSettlementTurn(
      input({ populationLevel: 6, residentPopulation: 600_000, level: "TOWN", workforce: [] })
    );
    expect(result.outcome.stabilityChange).toBeLessThan(0);
    expect(result.outcome.warnings.some((warning) => warning.includes("Housing"))).toBe(true);
  });

  it("rejects workforce beyond population and job capacity", () => {
    expect(
      validateWorkforce(2, [
        { jobKey: "food", assigned: 2, capacity: 1 },
        { jobKey: "commerce", assigned: 1, capacity: 2 }
      ])
    ).toEqual(expect.arrayContaining([expect.stringContaining("only supports"), expect.stringContaining("exceeds")]));
  });

  it("scales national food access with transport reliability", () => {
    expect(transportationFoodAccess("ROADS", 100)).toBe(75);
    expect(transportationFoodAccess("ROADS", 50)).toBe(38);
    expect(transportationFoodAccess("ISOLATED", 100)).toBe(25);
  });

  it("applies escalating settlement capacity penalties", () => {
    const atCapacity = settlementCapacity({
      administrativeCapacity: 70,
      governmentType: "DEMOCRATIC_REPUBLIC",
      nationalStability: 50,
      settlementCount: 3
    });
    const overCapacity = settlementCapacity({
      administrativeCapacity: 70,
      governmentType: "DEMOCRATIC_REPUBLIC",
      nationalStability: 50,
      settlementCount: 5
    });
    expect(atCapacity.excess).toBe(0);
    expect(overCapacity.excess).toBe(2);
    expect(overCapacity.upkeepPenaltyPercent).toBe(30);
    expect(overCapacity.constructionTurnPenalty).toBe(1);
  });

  it("applies founding charters only while their ten-turn benefit is active", () => {
    const baseline = calculateSettlementTurn(input());
    const agrarian = calculateSettlementTurn(input({ foundingCharter: "AGRARIAN", charterActive: true }));
    const expired = calculateSettlementTurn(input({ foundingCharter: "AGRARIAN", charterActive: false }));
    expect(agrarian.foodProduced).toBeGreaterThan(baseline.foodProduced);
    expect(expired.foodProduced).toBe(baseline.foodProduced);

    const commercial = calculateSettlementTurn(input({ foundingCharter: "COMMERCIAL", charterActive: true }));
    expect(commercial.treasuryIncome).toBeGreaterThan(baseline.treasuryIncome);
  });
});
