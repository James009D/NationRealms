import type { DateString, GovernmentType, ID, ResourceType } from "./index.js";

export type SettlementType = "CAPITAL" | "SECONDARY";
export type SettlementLevel = "TOWN" | "CITY" | "MAJOR_CITY" | "METROPOLIS";
export type SettlementSpecialization =
  | "AGRICULTURAL"
  | "INDUSTRIAL"
  | "COMMERCIAL"
  | "RESEARCH"
  | "MILITARY"
  | "ADMINISTRATIVE"
  | "CULTURAL"
  | "PORT_CITY"
  | "MINING"
  | "ENERGY";
export type GovernorPriority =
  "GROWTH" | "PRODUCTION" | "FOOD_SECURITY" | "COMMERCE" | "RESEARCH" | "MILITARY" | "STABILITY" | "BALANCED";
export type TransportationLevel = "ISOLATED" | "TRAILS" | "ROADS" | "IMPROVED_ROADS" | "RAIL" | "ADVANCED_NETWORK";
export type SettlementProjectType =
  | "BUILDING"
  | "SETTLEMENT_UPGRADE"
  | "REGIONAL_IMPROVEMENT"
  | "SPECIALIZATION_CHANGE"
  | "NETWORK_RESTORATION"
  | "COLONIST_TRAINING";
export type SettlementProjectStatus = "QUEUED" | "COMPLETED" | "CANCELLED";
export type SettlementJobCategory =
  "FOOD" | "RESOURCE_SITE" | "INDUSTRY" | "COMMERCE" | "RESEARCH" | "ADMINISTRATION" | "MILITARY" | "SPECIALIST";

export interface SettlementDefinitionEffect {
  housing?: number;
  foodStorage?: number;
  growthPercent?: number;
  localTaxPercent?: number;
  constructionPercent?: number;
  researchPerWorker?: number;
  health?: number;
  stability?: number;
  defensePercent?: number;
  resourcePercent?: number;
  networkReliability?: number;
  jobCategory?: SettlementJobCategory;
  jobs?: number;
}

export interface SettlementContentDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
  treasuryCost: number;
  resourceCosts: Partial<Record<ResourceType, number>>;
  durationTurns: number;
  requiredLevel?: SettlementLevel;
  requiredTerrain?: string[];
  requiredResource?: ResourceType[];
  effects: SettlementDefinitionEffect;
}

export const SETTLEMENT_LEVELS: Record<
  SettlementLevel,
  { label: string; housing: number; buildingSlots: number; improvementSlots: number }
> = {
  TOWN: { label: "Town", housing: 3, buildingSlots: 2, improvementSlots: 2 },
  CITY: { label: "City", housing: 7, buildingSlots: 4, improvementSlots: 3 },
  MAJOR_CITY: { label: "Major City", housing: 12, buildingSlots: 6, improvementSlots: 4 },
  METROPOLIS: { label: "Metropolis", housing: 18, buildingSlots: 8, improvementSlots: 5 }
};

export const SETTLEMENT_BUILDINGS: SettlementContentDefinition[] = [
  {
    key: "granary",
    label: "Granary",
    description: "Stores harvests and protects steady growth.",
    category: "AGRICULTURE",
    treasuryCost: 150,
    resourceCosts: { TIMBER: 20, IRON: 10 },
    durationTurns: 2,
    effects: { foodStorage: 40, growthPercent: 10, jobCategory: "FOOD", jobs: 1 }
  },
  {
    key: "housing_quarter",
    label: "Housing Quarter",
    description: "Planned housing for two additional population levels.",
    category: "HOUSING",
    treasuryCost: 250,
    resourceCosts: { TIMBER: 35, IRON: 20 },
    durationTurns: 3,
    effects: { housing: 2 }
  },
  {
    key: "workshop_district",
    label: "Workshop District",
    description: "Concentrates skilled production and construction trades.",
    category: "INDUSTRY",
    treasuryCost: 250,
    resourceCosts: { TIMBER: 30, IRON: 30, ENERGY: 10 },
    durationTurns: 3,
    effects: { constructionPercent: 15, jobCategory: "INDUSTRY", jobs: 1 }
  },
  {
    key: "market_hall",
    label: "Market Hall",
    description: "Organizes local commerce and tax collection.",
    category: "COMMERCE",
    treasuryCost: 250,
    resourceCosts: { TIMBER: 30, IRON: 15 },
    durationTurns: 3,
    effects: { localTaxPercent: 15, jobCategory: "COMMERCE", jobs: 1 }
  },
  {
    key: "academy",
    label: "Academy",
    description: "Supports scholars and structured national research.",
    category: "RESEARCH",
    treasuryCost: 400,
    resourceCosts: { TIMBER: 40, IRON: 35, RARE_EARTH: 10, ENERGY: 15 },
    durationTurns: 4,
    requiredLevel: "CITY",
    effects: { researchPerWorker: 1, jobCategory: "RESEARCH", jobs: 1 }
  },
  {
    key: "administrative_hall",
    label: "Administrative Hall",
    description: "Improves local administration and revenue collection.",
    category: "ADMINISTRATION",
    treasuryCost: 250,
    resourceCosts: { TIMBER: 25, IRON: 20 },
    durationTurns: 3,
    effects: { localTaxPercent: 10, jobCategory: "ADMINISTRATION", jobs: 1 }
  },
  {
    key: "clinic",
    label: "Clinic",
    description: "Improves public health and crisis resilience.",
    category: "HEALTH",
    treasuryCost: 250,
    resourceCosts: { TIMBER: 20, IRON: 15, ENERGY: 10 },
    durationTurns: 3,
    effects: { health: 10 }
  },
  {
    key: "cultural_hall",
    label: "Cultural Hall",
    description: "Strengthens civic identity and local confidence.",
    category: "CULTURE",
    treasuryCost: 250,
    resourceCosts: { TIMBER: 30, IRON: 10 },
    durationTurns: 3,
    effects: { stability: 5, jobCategory: "SPECIALIST", jobs: 1 }
  },
  {
    key: "barracks",
    label: "Barracks",
    description: "Supports local readiness and future recruitment.",
    category: "MILITARY",
    treasuryCost: 250,
    resourceCosts: { TIMBER: 25, IRON: 35, ENERGY: 10 },
    durationTurns: 3,
    effects: { jobCategory: "MILITARY", jobs: 1 }
  },
  {
    key: "fortifications",
    label: "Fortifications",
    description: "Permanent defenses protecting the settlement center.",
    category: "FORTIFICATION",
    treasuryCost: 400,
    resourceCosts: { TIMBER: 40, IRON: 50, ENERGY: 20 },
    durationTurns: 4,
    requiredLevel: "CITY",
    effects: { defensePercent: 20 }
  }
];

export const REGIONAL_IMPROVEMENTS: SettlementContentDefinition[] = [
  {
    key: "farm_network",
    label: "Farm Network",
    description: "Coordinates regional farms and food labor.",
    category: "AGRICULTURE",
    treasuryCost: 180,
    resourceCosts: { TIMBER: 25, ENERGY: 10 },
    durationTurns: 2,
    effects: { resourcePercent: 15, jobCategory: "FOOD", jobs: 1 }
  },
  {
    key: "irrigation_system",
    label: "Irrigation System",
    description: "Stabilizes harvests in fertile lowlands.",
    category: "AGRICULTURE",
    treasuryCost: 260,
    resourceCosts: { TIMBER: 35, IRON: 20, ENERGY: 15 },
    durationTurns: 3,
    requiredTerrain: ["PLAINS", "WETLAND"],
    effects: { resourcePercent: 10, growthPercent: 8 }
  },
  {
    key: "extraction_complex",
    label: "Extraction Complex",
    description: "Expands a region's strategic resource operations.",
    category: "RESOURCE",
    treasuryCost: 300,
    resourceCosts: { TIMBER: 25, IRON: 40, ENERGY: 20 },
    durationTurns: 3,
    effects: { resourcePercent: 20, jobCategory: "RESOURCE_SITE", jobs: 1 }
  },
  {
    key: "industrial_zone",
    label: "Industrial Zone",
    description: "Provides space and services for heavy production.",
    category: "INDUSTRY",
    treasuryCost: 350,
    resourceCosts: { TIMBER: 30, IRON: 50, ENERGY: 25 },
    durationTurns: 4,
    effects: { constructionPercent: 15, jobCategory: "INDUSTRY", jobs: 1 }
  },
  {
    key: "power_network",
    label: "Power Network",
    description: "Improves energy access and network reliability.",
    category: "ENERGY",
    treasuryCost: 300,
    resourceCosts: { TIMBER: 20, IRON: 35, ENERGY: 30 },
    durationTurns: 3,
    effects: { networkReliability: 15, resourcePercent: 8 }
  },
  {
    key: "local_transport",
    label: "Local Transport Network",
    description: "Abstracts routine roads between settlements and sites.",
    category: "TRANSPORT",
    treasuryCost: 280,
    resourceCosts: { TIMBER: 40, IRON: 25, ENERGY: 10 },
    durationTurns: 3,
    effects: { networkReliability: 20, localTaxPercent: 8 }
  },
  {
    key: "port_facilities",
    label: "Port Facilities",
    description: "Connects coastal production to maritime commerce.",
    category: "TRANSPORT",
    treasuryCost: 320,
    resourceCosts: { TIMBER: 45, IRON: 30, ENERGY: 15 },
    durationTurns: 4,
    requiredTerrain: ["COAST"],
    effects: { localTaxPercent: 12, resourcePercent: 12 }
  },
  {
    key: "communications_network",
    label: "Communications Network",
    description: "Improves administration across the region.",
    category: "ADMINISTRATION",
    treasuryCost: 300,
    resourceCosts: { TIMBER: 15, IRON: 30, RARE_EARTH: 10, ENERGY: 20 },
    durationTurns: 3,
    requiredLevel: "CITY",
    effects: { networkReliability: 10, localTaxPercent: 10 }
  }
];

export const SETTLEMENT_SPECIALIZATIONS: Array<{
  value: SettlementSpecialization;
  label: string;
  description: string;
}> = [
  { value: "AGRICULTURAL", label: "Agricultural Center", description: "Food output and growth." },
  { value: "INDUSTRIAL", label: "Industrial Center", description: "Production and construction." },
  { value: "COMMERCIAL", label: "Commercial Hub", description: "Commerce and taxation." },
  { value: "RESEARCH", label: "Research Center", description: "Research Point generation." },
  { value: "MILITARY", label: "Military Stronghold", description: "Readiness and defense." },
  { value: "ADMINISTRATIVE", label: "Administrative Center", description: "Taxation and capacity." },
  { value: "CULTURAL", label: "Cultural Center", description: "Stability and public trust." },
  { value: "PORT_CITY", label: "Port City", description: "Maritime trade and fisheries." },
  { value: "MINING", label: "Mining Center", description: "Mineral extraction." },
  { value: "ENERGY", label: "Energy Center", description: "Oil and energy production." }
];

export interface SettlementWorkforceAssignment {
  jobKey: string;
  category: SettlementJobCategory;
  assigned: number;
  capacity: number;
  label: string;
  targetLocationId?: ID | null;
}
export interface SettlementBuilding {
  id: ID;
  definitionKey: string;
  completedTurn: number;
  effectiveTurn: number;
  createdAt: DateString;
}
export interface RegionalImprovement {
  id: ID;
  definitionKey: string;
  level: number;
  completedTurn: number;
  effectiveTurn: number;
  createdAt: DateString;
}
export interface SettlementProject {
  id: ID;
  settlementId: ID;
  nationId: ID;
  regionId?: ID | null;
  type: SettlementProjectType;
  specializationSlot?: "PRIMARY" | "SECONDARY" | null;
  definitionKey: string;
  status: SettlementProjectStatus;
  startedTurn: number;
  completesTurn: number;
  effectiveTurn: number;
  treasuryCost: number;
  resourceCosts: Partial<Record<ResourceType, number>>;
  createdAt: DateString;
  completedAt?: DateString | null;
  cancelledAt?: DateString | null;
}
export interface SettlementCapacityView {
  count: number;
  capacity: number;
  excess: number;
  taxPenaltyPercent: number;
  upkeepPenaltyPercent: number;
  growthPenaltyPercent: number;
  stabilityPenalty: number;
  governorPenaltyPercent: number;
  constructionTurnPenalty: number;
  reasons: string[];
}
export interface SettlementGrowthView {
  progress: number;
  required: number;
  projectedPerTurn: number;
  estimatedTurns?: number | null;
  modifiers: string[];
}
export interface SettlementFoodView {
  production: number;
  consumption: number;
  stored: number;
  storageCapacity: number;
  nationalAccessPercent: number;
  security: "SURPLUS" | "SECURE" | "STRAINED" | "SHORTAGE";
  shortageTurns: number;
}
export interface SettlementHousingView {
  capacity: number;
  populationLevel: number;
  available: number;
  overcrowding: number;
}
export interface SettlementStabilityView {
  value: number;
  projectedChange: number;
  factors: string[];
}
export interface SettlementHealthView {
  value: number;
  factors: string[];
}
export interface RegionDevelopmentView {
  id: ID;
  name: string;
  settlementId: ID;
  transportationLevel: TransportationLevel;
  networkReliability: number;
  neglectTurns: number;
  terrainSummary: Record<string, number>;
  improvementSlots: number;
  improvements: RegionalImprovement[];
  strategicSites: Array<{ id: ID; name: string; type: string; resourceType?: ResourceType | null }>;
}
export interface SettlementView {
  id: ID;
  nationId: ID;
  locationId: ID;
  name: string;
  type: SettlementType;
  level: SettlementLevel;
  residentPopulation: number;
  populationLevel: number;
  growth: SettlementGrowthView;
  food: SettlementFoodView;
  housing: SettlementHousingView;
  health: SettlementHealthView;
  stability: SettlementStabilityView;
  primarySpecialization?: SettlementSpecialization | null;
  secondarySpecialization?: SettlementSpecialization | null;
  governorPriority: GovernorPriority;
  governor?: { id: ID; name: string; level: number } | null;
  workforce: SettlementWorkforceAssignment[];
  buildings: SettlementBuilding[];
  activeProject?: SettlementProject | null;
  buildingSlots: number;
  region: RegionDevelopmentView;
  warnings: string[];
}
export interface NationalSettlementSummary {
  nationId: ID;
  totalPopulation: number;
  settlementCount: number;
  capacity: SettlementCapacityView;
  growingCount: number;
  shortageCount: number;
  overcrowdedCount: number;
  unstableCount: number;
  activeProjectCount: number;
  disconnectedRegionCount: number;
  settlements: SettlementView[];
}
export interface SettlementTurnOutcome {
  settlementId: ID;
  settlementName: string;
  populationChange: number;
  populationLevelChange: number;
  growthProgressChange: number;
  foodProduced: number;
  foodConsumed: number;
  stabilityChange: number;
  healthChange: number;
  projectCompleted?: SettlementProject | null;
  shortageStarted: boolean;
  shortageEnded: boolean;
  warnings: string[];
}
export interface SettlementSitePreview {
  valid: boolean;
  x: number;
  y: number;
  projectedType: SettlementType;
  projectedLevel: SettlementLevel;
  capacity: SettlementCapacityView;
  minimumDistance: number;
  nearestSettlementDistance?: number | null;
  treasuryCost: number;
  populationTransfer: number;
  warnings: string[];
}
export interface SettlementProjectInput {
  type: SettlementProjectType;
  definitionKey: string;
  specializationSlot?: "PRIMARY" | "SECONDARY";
}
export interface SettlementProjectPreview {
  valid: boolean;
  blockers: string[];
  project: SettlementProjectInput;
  treasuryCost: number;
  resourceCosts: Partial<Record<ResourceType, number>>;
  durationTurns: number;
  completesTurn: number;
  effectiveTurn: number;
  affordable: boolean;
}

export const POPULATION_PER_LEVEL = 100_000;
export function settlementGrowthRequired(populationLevel: number) {
  return Math.round(60 * Math.max(1, populationLevel) ** 1.1);
}
export function baseSettlementGrowth(populationLevel: number) {
  return 6 + Math.max(1, populationLevel) * 2;
}
export function housingForSettlement(level: SettlementLevel, type: SettlementType, buildingBonus = 0) {
  return SETTLEMENT_LEVELS[level].housing + (type === "CAPITAL" ? 1 : 0) + buildingBonus;
}
export function settlementCapacity(input: {
  administrativeCapacity: number;
  governmentType: GovernmentType;
  nationalStability: number;
  technologyKeys?: Iterable<string>;
  settlementCount: number;
  lawModifier?: number;
  leaderModifier?: number;
}): SettlementCapacityView {
  const keys = new Set(input.technologyKeys ?? []);
  const governmentBonus = ["FEDERAL_UNION", "CITY_STATE_LEAGUE", "TRIBAL_CONFEDERATION"].includes(input.governmentType)
    ? 1
    : 0;
  const stabilityBonus = input.nationalStability > 70 ? 1 : input.nationalStability < 30 ? -1 : 0;
  const technologyBonus = (keys.has("civil_engineering") ? 1 : 0) + (keys.has("global_networks") ? 1 : 0);
  const capacity = Math.max(
    1,
    Math.min(
      12,
      1 +
        Math.floor(input.administrativeCapacity / 35) +
        governmentBonus +
        stabilityBonus +
        technologyBonus +
        (input.lawModifier ?? 0) +
        (input.leaderModifier ?? 0)
    )
  );
  const excess = Math.max(0, input.settlementCount - capacity);
  return {
    count: input.settlementCount,
    capacity,
    excess,
    taxPenaltyPercent: Math.min(40, excess * 8),
    upkeepPenaltyPercent: excess * 15,
    growthPenaltyPercent: Math.min(60, excess * 10),
    stabilityPenalty: excess * 2,
    governorPenaltyPercent: Math.min(60, excess * 10),
    constructionTurnPenalty: Math.floor(excess / 2),
    reasons: [
      `Administrative capacity supports ${capacity} full settlement${capacity === 1 ? "" : "s"}.`,
      ...(excess ? [`${excess} settlement${excess === 1 ? " is" : "s are"} beyond capacity.`] : [])
    ]
  };
}
