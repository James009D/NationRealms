import {
  REGIONAL_IMPROVEMENTS,
  SETTLEMENT_BUILDINGS,
  baseSettlementGrowth,
  housingForSettlement,
  settlementGrowthRequired,
  type GovernorPriority,
  type FoundingCharter,
  type SettlementCapacityView,
  type SettlementJobCategory,
  type SettlementLevel,
  type SettlementSpecialization,
  type SettlementTurnOutcome,
  type SettlementType,
  type TransportationLevel
} from "@statecraft/shared";

export interface SettlementRuleInput {
  id: string;
  name: string;
  type: SettlementType;
  level: SettlementLevel;
  residentPopulation: number;
  populationLevel: number;
  growthProgress: number;
  storedFood: number;
  health: number;
  stability: number;
  shortageTurns: number;
  primarySpecialization?: SettlementSpecialization | null;
  secondarySpecialization?: SettlementSpecialization | null;
  governorPriority: GovernorPriority;
  governorLevel?: number;
  workforce: Array<{ category: SettlementJobCategory; assigned: number }>;
  buildingKeys: string[];
  improvementKeys: string[];
  transportationLevel: TransportationLevel;
  networkReliability: number;
  capacity: SettlementCapacityView;
  nationalFoodAvailable: number;
  populationPerLevel: number;
  foundingCharter?: FoundingCharter | null;
  charterActive?: boolean;
}

export interface SettlementRuleResult {
  next: {
    residentPopulation: number;
    populationLevel: number;
    growthProgress: number;
    storedFood: number;
    health: number;
    stability: number;
    shortageTurns: number;
  };
  outcome: SettlementTurnOutcome;
  foodProduced: number;
  foodConsumed: number;
  nationalFoodDraw: number;
  treasuryIncome: number;
  researchPoints: number;
  resourceOutputPercent: number;
  constructionPercent: number;
}

const networkAccess: Record<TransportationLevel, number> = {
  ISOLATED: 25,
  TRAILS: 50,
  ROADS: 75,
  IMPROVED_ROADS: 100,
  RAIL: 100,
  ADVANCED_NETWORK: 100
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function workers(input: SettlementRuleInput, category: SettlementJobCategory) {
  return input.workforce.filter((item) => item.category === category).reduce((sum, item) => sum + item.assigned, 0);
}

function activeEffects(input: SettlementRuleInput) {
  return [
    ...SETTLEMENT_BUILDINGS.filter((item) => input.buildingKeys.includes(item.key)),
    ...REGIONAL_IMPROVEMENTS.filter((item) => input.improvementKeys.includes(item.key))
  ].map((item) => item.effects);
}

export function transportationFoodAccess(level: TransportationLevel, reliability: number) {
  return Math.round((networkAccess[level] * clamp(reliability, 0, 100)) / 100);
}

export function calculateSettlementTurn(input: SettlementRuleInput): SettlementRuleResult {
  const effects = activeEffects(input);
  const foodWorkers = workers(input, "FOOD");
  const commerceWorkers = workers(input, "COMMERCE");
  const researchWorkers = workers(input, "RESEARCH");
  const administrationWorkers = workers(input, "ADMINISTRATION");
  const industryWorkers = workers(input, "INDUSTRY");
  const assigned = input.workforce.reduce((sum, item) => sum + item.assigned, 0);
  const unemployed = Math.max(0, input.populationLevel - assigned);
  const specializationFood =
    input.primarySpecialization === "AGRICULTURAL" || input.secondarySpecialization === "AGRICULTURAL" ? 20 : 0;
  const specializationCommerce =
    input.primarySpecialization === "COMMERCIAL" || input.secondarySpecialization === "COMMERCIAL" ? 20 : 0;
  const specializationResearch =
    input.primarySpecialization === "RESEARCH" || input.secondarySpecialization === "RESEARCH" ? 20 : 0;
  const improvementFood = input.improvementKeys.includes("farm_network") ? 15 : 0;
  const charterFood = input.charterActive && input.foundingCharter === "AGRARIAN" ? 10 : 0;
  const foodProduced = Math.max(
    0,
    Math.round(foodWorkers * 12 * (1 + (specializationFood + improvementFood + charterFood) / 100))
  );
  const foodConsumed = Math.max(8, input.populationLevel * 8);
  const storageCapacity = 20 + effects.reduce((sum, effect) => sum + (effect.foodStorage ?? 0), 0);
  const localAvailable = input.storedFood + foodProduced;
  const localUsed = Math.min(localAvailable, foodConsumed);
  const deficit = Math.max(0, foodConsumed - localUsed);
  const accessPercent = transportationFoodAccess(input.transportationLevel, input.networkReliability);
  const nationalFoodDraw = Math.min(deficit, Math.floor((input.nationalFoodAvailable * accessPercent) / 100));
  const shortage = localUsed + nationalFoodDraw < foodConsumed;
  const shortageEnded = input.shortageTurns > 0 && !shortage;
  const shortageStarted = input.shortageTurns === 0 && shortage;
  let shortageTurns = shortage ? input.shortageTurns + 1 : 0;
  const storedFood = clamp(localAvailable - localUsed, 0, storageCapacity);

  const housingBonus = effects.reduce((sum, effect) => sum + (effect.housing ?? 0), 0);
  const housing = housingForSettlement(input.level, input.type, housingBonus);
  const overcrowding = Math.max(0, input.populationLevel - housing);
  const spareHousing = Math.max(0, housing - input.populationLevel);
  const growthPercent =
    effects.reduce((sum, effect) => sum + (effect.growthPercent ?? 0), 0) +
    (input.charterActive && input.foundingCharter === "CIVIC" ? 10 : 0);
  const priorityGrowth = ["GROWTH", "FOOD_SECURITY"].includes(input.governorPriority) ? 2 : 0;
  const foodGrowth = shortage
    ? -baseSettlementGrowth(input.populationLevel)
    : Math.min(8, Math.floor(Math.max(0, foodProduced - foodConsumed) / 4));
  const stabilityGrowth = input.stability >= 70 ? 3 : input.stability < 40 ? -4 : 0;
  const healthGrowth = input.health >= 75 ? 2 : input.health < 40 ? -3 : 0;
  const housingGrowth = Math.min(4, spareHousing) - overcrowding * 5;
  let growth =
    baseSettlementGrowth(input.populationLevel) +
    foodGrowth +
    stabilityGrowth +
    healthGrowth +
    housingGrowth +
    priorityGrowth;
  growth = Math.round(growth * (1 + growthPercent / 100) * (1 - input.capacity.growthPenaltyPercent / 100));
  if (shortage) growth = 0;

  let populationLevel = input.populationLevel;
  let residentPopulation = input.residentPopulation;
  let growthProgress = Math.max(0, input.growthProgress + Math.max(0, growth));
  let populationLevelChange = 0;
  const requiredGrowth = settlementGrowthRequired(input.populationLevel);
  if (growthProgress >= requiredGrowth && !shortage && overcrowding === 0) {
    growthProgress -= requiredGrowth;
    populationLevel += 1;
    residentPopulation += input.populationPerLevel;
    populationLevelChange = 1;
  }
  if (shortageTurns >= 3 && localUsed + nationalFoodDraw < Math.ceil(foodConsumed / 2) && populationLevel > 1) {
    populationLevel -= 1;
    residentPopulation = Math.max(input.populationPerLevel, residentPopulation - input.populationPerLevel);
    growthProgress = 0;
    shortageTurns = 1;
    populationLevelChange = -1;
  }

  const governorBonus =
    Math.min(3, input.governorLevel ?? 0) * (input.charterActive && input.foundingCharter === "CIVIC" ? 1.1 : 1);
  let stabilityChange =
    (shortage ? -2 : 1) -
    overcrowding * 2 -
    Math.max(0, unemployed - 1) -
    input.capacity.stabilityPenalty +
    governorBonus;
  if (input.governorPriority === "STABILITY") stabilityChange += 2;
  stabilityChange = clamp(stabilityChange, -5, 3);
  const buildingStability = effects.reduce((sum, effect) => sum + (effect.stability ?? 0), 0);
  const stability = clamp(input.stability + stabilityChange, 0, 100);
  const healthChange = clamp(
    (shortage ? -2 : 1) - overcrowding + effects.reduce((sum, effect) => sum + (effect.health ?? 0), 0) / 10,
    -3,
    2
  );
  const health = clamp(input.health + healthChange, 0, 100);
  const taxBonus =
    effects.reduce((sum, effect) => sum + (effect.localTaxPercent ?? 0), 0) +
    specializationCommerce +
    (input.charterActive && input.foundingCharter === "COMMERCIAL" ? 8 : 0);
  const charterStability = input.charterActive && input.foundingCharter === "DEFENSIVE" ? 5 : 0;
  const stabilityMultiplier = 0.5 + (stability + buildingStability + charterStability) / 200;
  const treasuryIncome = Math.max(
    0,
    Math.round(
      (input.populationLevel * 2 + commerceWorkers * 8 + administrationWorkers * 4) *
        stabilityMultiplier *
        (1 + taxBonus / 100) *
        (1 - input.capacity.taxPenaltyPercent / 100)
    )
  );
  const researchBonus = effects.reduce((sum, effect) => sum + (effect.researchPerWorker ?? 0), 0);
  const researchPoints = Math.max(
    0,
    Math.floor(researchWorkers * (1 + researchBonus) * (1 + specializationResearch / 100))
  );
  const resourceOutputPercent = Math.min(
    25,
    effects.reduce((sum, effect) => sum + (effect.resourcePercent ?? 0), 0) +
      (input.charterActive && input.foundingCharter === "INDUSTRIAL" ? 8 : 0)
  );
  const constructionPercent = Math.min(
    25,
    effects.reduce((sum, effect) => sum + (effect.constructionPercent ?? 0), 0) +
      industryWorkers * 2 +
      (input.charterActive && input.foundingCharter === "INDUSTRIAL" ? 8 : 0)
  );
  const warnings = [
    ...(shortage ? ["Food access did not meet local demand."] : []),
    ...(overcrowding ? [`Housing is short by ${overcrowding} population level${overcrowding === 1 ? "" : "s"}.`] : []),
    ...(unemployed > 1 ? [`${unemployed} workforce units are unassigned.`] : []),
    ...(input.capacity.excess ? ["National administrative strain is reducing growth and taxation."] : [])
  ];

  return {
    next: { residentPopulation, populationLevel, growthProgress, storedFood, health, stability, shortageTurns },
    outcome: {
      settlementId: input.id,
      settlementName: input.name,
      populationChange: residentPopulation - input.residentPopulation,
      populationLevelChange,
      growthProgressChange: growthProgress - input.growthProgress,
      foodProduced,
      foodConsumed,
      stabilityChange,
      healthChange,
      shortageStarted,
      shortageEnded,
      warnings
    },
    foodProduced,
    foodConsumed,
    nationalFoodDraw,
    treasuryIncome,
    researchPoints,
    resourceOutputPercent,
    constructionPercent
  };
}

export function validateWorkforce(
  populationLevel: number,
  assignments: Array<{ jobKey: string; assigned: number; capacity: number }>
) {
  const issues: string[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const assignment of assignments) {
    if (seen.has(assignment.jobKey)) issues.push(`Job ${assignment.jobKey} was provided more than once.`);
    seen.add(assignment.jobKey);
    if (!Number.isInteger(assignment.assigned) || assignment.assigned < 0)
      issues.push(`${assignment.jobKey} must use a non-negative whole number.`);
    if (assignment.assigned > assignment.capacity)
      issues.push(`${assignment.jobKey} only supports ${assignment.capacity} workforce.`);
    total += assignment.assigned;
  }
  if (total > populationLevel) issues.push(`Assigned workforce ${total} exceeds population level ${populationLevel}.`);
  return issues;
}
