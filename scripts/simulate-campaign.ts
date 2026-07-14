import {
  COLONIST_TRAINING_COST,
  EXPANSION_BALANCE,
  OUTPOST_COST,
  SETTLEMENT_FOUNDING_COST,
  influenceCost,
  settlementCapacity,
  settlementGrowthRequired,
  type SettlementJobCategory
} from "@statecraft/shared";
import { calculateSettlementTurn, type SettlementRuleInput } from "../apps/api/src/services/settlementRules.js";

type Strategy =
  "unattended" | "food-first" | "growth-first" | "production-first" | "military-first" | "expansion-first" | "balanced";

interface Scenario {
  name: string;
  transport: SettlementRuleInput["transportationLevel"];
  reliability: number;
  storedFood: number;
  stability: number;
  health: number;
  foodModifier: number;
  treasury: number;
}

const scenarios: Scenario[] = [
  {
    name: "agrarian",
    transport: "ROADS",
    reliability: 95,
    storedFood: 35,
    stability: 68,
    health: 72,
    foodModifier: 1,
    treasury: 1_200
  },
  {
    name: "coastal",
    transport: "IMPROVED_ROADS",
    reliability: 90,
    storedFood: 25,
    stability: 64,
    health: 70,
    foodModifier: 0,
    treasury: 1_350
  },
  {
    name: "mineral",
    transport: "ROADS",
    reliability: 85,
    storedFood: 20,
    stability: 60,
    health: 66,
    foodModifier: -1,
    treasury: 1_450
  },
  {
    name: "frontier",
    transport: "ISOLATED",
    reliability: 65,
    storedFood: 30,
    stability: 55,
    health: 64,
    foodModifier: 0,
    treasury: 1_050
  },
  {
    name: "fertile-lowland",
    transport: "TRAILS",
    reliability: 90,
    storedFood: 40,
    stability: 70,
    health: 75,
    foodModifier: 1,
    treasury: 1_150
  },
  {
    name: "damaged-network",
    transport: "TRAILS",
    reliability: 35,
    storedFood: 25,
    stability: 50,
    health: 60,
    foodModifier: 0,
    treasury: 1_000
  }
];

const strategies: Strategy[] = [
  "unattended",
  "food-first",
  "growth-first",
  "production-first",
  "military-first",
  "expansion-first",
  "balanced"
];

function workforce(
  strategy: Strategy,
  foodModifier: number
): Array<{ category: SettlementJobCategory; assigned: number }> {
  if (strategy === "military-first")
    return [
      { category: "FOOD", assigned: 1 },
      { category: "MILITARY", assigned: 1 }
    ];
  if (strategy === "production-first")
    return [
      { category: "FOOD", assigned: 1 },
      { category: "INDUSTRY", assigned: 1 }
    ];
  if (strategy === "balanced")
    return [
      { category: "FOOD", assigned: 1 + Math.max(0, foodModifier) },
      { category: "COMMERCE", assigned: 1 }
    ];
  if (["food-first", "growth-first", "expansion-first"].includes(strategy)) return [{ category: "FOOD", assigned: 2 }];
  return [
    { category: "FOOD", assigned: 1 },
    { category: "COMMERCE", assigned: 1 }
  ];
}

function simulate(scenario: Scenario, strategy: Strategy) {
  const settlementCount = strategy === "expansion-first" ? 3 : 1;
  const capacity = settlementCapacity({
    administrativeCapacity: strategy === "expansion-first" ? 40 : 70,
    governmentType: "DEMOCRATIC_REPUBLIC",
    nationalStability: scenario.stability,
    settlementCount
  });
  let state: SettlementRuleInput = {
    id: `${scenario.name}-${strategy}`,
    name: "Capital",
    type: "CAPITAL",
    level: "TOWN",
    residentPopulation: 200_000,
    populationLevel: 2,
    growthProgress: 0,
    storedFood: scenario.storedFood,
    health: scenario.health,
    stability: scenario.stability,
    shortageTurns: 0,
    primarySpecialization: strategy === "growth-first" || strategy === "food-first" ? "AGRICULTURAL" : null,
    secondarySpecialization: null,
    governorPriority:
      strategy === "growth-first"
        ? "GROWTH"
        : strategy === "food-first"
          ? "FOOD_SECURITY"
          : strategy === "production-first"
            ? "PRODUCTION"
            : strategy === "military-first"
              ? "MILITARY"
              : "BALANCED",
    governorLevel: strategy === "unattended" ? 0 : 2,
    workforce: workforce(strategy, scenario.foodModifier),
    buildingKeys: [],
    improvementKeys: strategy === "food-first" ? ["farm_network"] : [],
    transportationLevel: scenario.transport,
    networkReliability: scenario.reliability,
    capacity,
    nationalFoodAvailable: 120,
    populationPerLevel: 100_000
  };
  let treasury = scenario.treasury;
  let research = 0;
  let foodSurplus = 0;
  let populationGrowths = 0;
  let shortages = 0;
  let constructionCompleted = 0;
  let militaryProduction = 0;
  for (let turn = 1; turn <= 30; turn += 1) {
    if (turn === 4 && strategy !== "unattended" && strategy !== "military-first") {
      state = { ...state, buildingKeys: strategy === "growth-first" ? ["housing_quarter"] : ["granary"] };
      constructionCompleted += 1;
    }
    if (turn === 8 && strategy === "production-first") {
      state = { ...state, improvementKeys: ["industrial_zone"] };
      constructionCompleted += 1;
    }
    const result = calculateSettlementTurn(state);
    if (strategy === "unattended" && turn <= 5 && result.outcome.populationLevelChange < 0) {
      throw new Error(`${scenario.name} unattended population loss on turn ${turn}`);
    }
    state = { ...state, ...result.next };
    treasury += result.treasuryIncome - (5 + capacity.excess * 3);
    research += result.researchPoints;
    foodSurplus += result.foodProduced - result.foodConsumed;
    populationGrowths += Math.max(0, result.outcome.populationLevelChange);
    shortages += result.outcome.shortageStarted ? 1 : 0;
    militaryProduction += strategy === "military-first" ? 2 : 0;
  }
  return {
    scenario: scenario.name,
    strategy,
    settlements: settlementCount,
    capacity: capacity.capacity,
    population: state.residentPopulation,
    growths: populationGrowths,
    food: foodSurplus,
    housingPressure: Math.max(0, state.populationLevel - (state.type === "CAPITAL" ? 4 : 3)),
    stability: state.stability,
    construction: constructionCompleted,
    adminPenalty: capacity.excess,
    treasury: Math.round(treasury),
    research,
    militaryProduction,
    networkInvestment: strategy === "production-first" || strategy === "balanced" ? 1 : 0,
    shortages
  };
}

if (settlementGrowthRequired(8) <= settlementGrowthRequired(2)) {
  throw new Error("Large settlements must require more growth than small settlements.");
}

const report = scenarios.flatMap((scenario) => strategies.map((strategy) => simulate(scenario, strategy)));
if (report.some((row) => row.strategy !== "expansion-first" && row.settlements >= 6)) {
  throw new Error("Normal campaigns exceeded the first-30-turn settlement guardrail.");
}

console.table(report);
console.log(`Simulated ${report.length} deterministic 30-turn settlement campaigns.`);

type FrontierStrategy = "conservative" | "methodical" | "expansion-first";

function simulateFrontier(strategy: FrontierStrategy, horizon: 30 | 60) {
  const waitAfterFounding = strategy === "conservative" ? Number.POSITIVE_INFINITY : strategy === "methodical" ? 4 : 0;
  const plannedTileCost = [true, false, false, false, false].reduce(
    (sum, surveyed) => sum + (influenceCost("PLAINS", surveyed) ?? 0),
    0
  );
  let turn = 0;
  let treasury = 5_000;
  let food = 180;
  let timber = 150;
  let iron = 80;
  let settlementCount = 1;
  let sourcePopulationLevels = 5;
  let nextClaimTurn = 1;
  let firstFoundingTurn: number | null = null;
  let peakFrontierLoad = 0;
  let totalClaimUpkeep = 0;
  let active:
    | {
        influence: number;
        claimCompleteTurn?: number;
        outpostCompleteTurn?: number;
        maturityTurns: number;
        colonistReadyTurn?: number;
        colonistArrivalTurn?: number;
        foundingCompleteTurn?: number;
      }
    | undefined;

  while (turn < horizon) {
    turn += 1;
    treasury += 120 + settlementCount * 20;
    food += settlementCount * 10;
    timber += settlementCount * 2;
    iron += settlementCount;

    if (!active && turn >= nextClaimTurn && sourcePopulationLevels >= 2) {
      active = { influence: 0, maturityTurns: 0 };
    }
    if (!active) continue;

    if (!active.claimCompleteTurn) {
      if (treasury < EXPANSION_BALANCE.claimTreasuryUpkeep) continue;
      treasury -= EXPANSION_BALANCE.claimTreasuryUpkeep;
      totalClaimUpkeep += EXPANSION_BALANCE.claimTreasuryUpkeep;
      active.influence += EXPANSION_BALANCE.settlementInfluence;
      peakFrontierLoad = Math.max(peakFrontierLoad, 3 + Math.ceil(active.influence / 6));
      if (active.influence >= plannedTileCost) active.claimCompleteTurn = turn;
      continue;
    }

    if (!active.outpostCompleteTurn) {
      if (
        treasury < OUTPOST_COST.treasury ||
        timber < (OUTPOST_COST.resources.TIMBER ?? 0) ||
        food < (OUTPOST_COST.resources.FOOD ?? 0)
      )
        continue;
      treasury -= OUTPOST_COST.treasury;
      timber -= OUTPOST_COST.resources.TIMBER ?? 0;
      food -= OUTPOST_COST.resources.FOOD ?? 0;
      active.outpostCompleteTurn = turn + OUTPOST_COST.durationTurns;
      continue;
    }

    if (
      !active.colonistReadyTurn &&
      sourcePopulationLevels >= 2 &&
      treasury >= COLONIST_TRAINING_COST.treasury &&
      food >= (COLONIST_TRAINING_COST.resources.FOOD ?? 0) &&
      timber >= (COLONIST_TRAINING_COST.resources.TIMBER ?? 0)
    ) {
      treasury -= COLONIST_TRAINING_COST.treasury;
      food -= COLONIST_TRAINING_COST.resources.FOOD ?? 0;
      timber -= COLONIST_TRAINING_COST.resources.TIMBER ?? 0;
      sourcePopulationLevels -= 1;
      active.colonistReadyTurn = turn + COLONIST_TRAINING_COST.durationTurns;
    }

    if (turn < active.outpostCompleteTurn) continue;
    if (treasury < EXPANSION_BALANCE.outpostTreasuryUpkeep || food < EXPANSION_BALANCE.outpostFoodUpkeep) {
      active.maturityTurns = 0;
      continue;
    }
    treasury -= EXPANSION_BALANCE.outpostTreasuryUpkeep;
    food -= EXPANSION_BALANCE.outpostFoodUpkeep;
    active.maturityTurns += 1;
    peakFrontierLoad = Math.max(peakFrontierLoad, 4);
    if (active.colonistReadyTurn && !active.colonistArrivalTurn && turn >= active.colonistReadyTurn)
      active.colonistArrivalTurn = turn + 2;

    if (
      active.maturityTurns >= EXPANSION_BALANCE.outpostMaturityTurns &&
      active.colonistArrivalTurn &&
      turn >= active.colonistArrivalTurn &&
      !active.foundingCompleteTurn &&
      treasury >= SETTLEMENT_FOUNDING_COST.treasury &&
      timber >= (SETTLEMENT_FOUNDING_COST.resources.TIMBER ?? 0) &&
      iron >= (SETTLEMENT_FOUNDING_COST.resources.IRON ?? 0) &&
      food >= (SETTLEMENT_FOUNDING_COST.resources.FOOD ?? 0)
    ) {
      treasury -= SETTLEMENT_FOUNDING_COST.treasury;
      timber -= SETTLEMENT_FOUNDING_COST.resources.TIMBER ?? 0;
      iron -= SETTLEMENT_FOUNDING_COST.resources.IRON ?? 0;
      food -= SETTLEMENT_FOUNDING_COST.resources.FOOD ?? 0;
      active.foundingCompleteTurn = turn + SETTLEMENT_FOUNDING_COST.durationTurns;
    }
    if (active.foundingCompleteTurn && turn >= active.foundingCompleteTurn) {
      settlementCount += 1;
      firstFoundingTurn ??= turn;
      nextClaimTurn = turn + waitAfterFounding + 1;
      active = undefined;
    }
  }

  return {
    strategy,
    horizon,
    settlements: settlementCount,
    firstFoundingTurn,
    sourcePopulationLevels,
    treasury: Math.round(treasury),
    food,
    timber,
    iron,
    totalClaimUpkeep,
    peakFrontierLoad
  };
}

const frontierReport = ([30, 60] as const).flatMap((horizon) =>
  (["conservative", "methodical", "expansion-first"] as const).map((strategy) => simulateFrontier(strategy, horizon))
);
if (frontierReport.some((row) => row.firstFoundingTurn !== null && row.firstFoundingTurn < 12))
  throw new Error("A second settlement was founded before the turn-12 pacing guardrail.");
if (frontierReport.some((row) => row.horizon === 30 && row.settlements >= 4))
  throw new Error("A frontier strategy reached four settlements during the first 30 turns.");
if (frontierReport.some((row) => row.treasury < 0 || row.food < 0 || row.timber < 0 || row.iron < 0))
  throw new Error("A frontier simulation committed resources it did not possess.");

console.table(frontierReport);
console.log(`Simulated ${frontierReport.length} deterministic 30/60-turn frontier campaigns.`);
