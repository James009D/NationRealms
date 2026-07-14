import type { DateString, ID, LocationType, MilitaryUnitType, ResourceType } from "./index.js";

export type TerrainType =
  "OCEAN" | "COAST" | "PLAINS" | "FOREST" | "HILLS" | "MOUNTAIN" | "DESERT" | "WETLAND" | "TUNDRA";

export type InfrastructureType = "ROAD" | "RAIL" | "SEA_LANE";
export type InfrastructureProjectStatus = "QUEUED" | "COMPLETED" | "CANCELLED";

export interface TerrainYieldModifier {
  settlementTreasuryPercent: number;
  productionPercent: number;
  resourcePercent: Partial<Record<ResourceType, number>>;
  constructionCostPercent: number;
}

export interface TerrainCombatModifier {
  movementCost: number;
  navalMovementCost?: number;
  defensePercent: number;
  supplyCostPercent: number;
  attackPercentByUnitType?: Partial<Record<MilitaryUnitType, number>>;
}

export interface TerrainDefinition {
  type: TerrainType;
  label: string;
  description: string;
  color: string;
  yield: TerrainYieldModifier;
  combat: TerrainCombatModifier;
  allowedLocationTypes: LocationType[];
}

const landLocations: LocationType[] = [
  "CAPITAL",
  "CITY",
  "TOWN",
  "OUTPOST",
  "FORT",
  "PORT_SITE",
  "MILITARY_BASE",
  "MINE",
  "FARM",
  "RESOURCE_SITE"
];
const extractiveLocations: LocationType[] = ["FORT", "MILITARY_BASE", "MINE", "RESOURCE_SITE"];

export const TERRAIN_DEFINITIONS: Record<TerrainType, TerrainDefinition> = {
  OCEAN: {
    type: "OCEAN",
    label: "Ocean",
    description: "Deep water navigable only by naval forces.",
    color: "#163d59",
    yield: {
      settlementTreasuryPercent: 0,
      productionPercent: 0,
      resourcePercent: { FISH: 30 },
      constructionCostPercent: 0
    },
    combat: { movementCost: 99, navalMovementCost: 1, defensePercent: 0, supplyCostPercent: 0 },
    allowedLocationTypes: []
  },
  COAST: {
    type: "COAST",
    label: "Coast",
    description: "Productive shoreline suited to ports and fisheries.",
    color: "#2d7585",
    yield: {
      settlementTreasuryPercent: 0,
      productionPercent: 0,
      resourcePercent: { FISH: 25, FOOD: 5 },
      constructionCostPercent: 0
    },
    combat: { movementCost: 2, navalMovementCost: 1, defensePercent: 0, supplyCostPercent: 0 },
    allowedLocationTypes: [...landLocations, "PORT"]
  },
  PLAINS: {
    type: "PLAINS",
    label: "Plains",
    description: "Open fertile land ideal for farms and settlements.",
    color: "#718a4a",
    yield: {
      settlementTreasuryPercent: 5,
      productionPercent: 0,
      resourcePercent: { FOOD: 20 },
      constructionCostPercent: 0
    },
    combat: { movementCost: 1, defensePercent: 0, supplyCostPercent: 0 },
    allowedLocationTypes: landLocations
  },
  FOREST: {
    type: "FOREST",
    label: "Forest",
    description: "Dense woodland rich in timber and natural cover.",
    color: "#315c3a",
    yield: {
      settlementTreasuryPercent: -5,
      productionPercent: 0,
      resourcePercent: { TIMBER: 25 },
      constructionCostPercent: 0
    },
    combat: { movementCost: 2, defensePercent: 15, supplyCostPercent: 0, attackPercentByUnitType: { ARMOR: -10 } },
    allowedLocationTypes: landLocations
  },
  HILLS: {
    type: "HILLS",
    label: "Hills",
    description: "Broken highland with strong mineral potential.",
    color: "#756c4d",
    yield: {
      settlementTreasuryPercent: 0,
      productionPercent: 10,
      resourcePercent: { IRON: 15, RARE_EARTH: 15, FOOD: -10 },
      constructionCostPercent: 0
    },
    combat: { movementCost: 2, defensePercent: 20, supplyCostPercent: 0, attackPercentByUnitType: { ARTILLERY: 10 } },
    allowedLocationTypes: landLocations
  },
  MOUNTAIN: {
    type: "MOUNTAIN",
    label: "Mountain",
    description: "Severe terrain with rich mineral deposits.",
    color: "#696b66",
    yield: {
      settlementTreasuryPercent: -15,
      productionPercent: 0,
      resourcePercent: { IRON: 30, RARE_EARTH: 30, FOOD: -30 },
      constructionCostPercent: 0
    },
    combat: { movementCost: 3, defensePercent: 35, supplyCostPercent: 0, attackPercentByUnitType: { ARMOR: -25 } },
    allowedLocationTypes: extractiveLocations
  },
  DESERT: {
    type: "DESERT",
    label: "Desert",
    description: "Arid land with difficult logistics and energy potential.",
    color: "#a7834d",
    yield: {
      settlementTreasuryPercent: 0,
      productionPercent: 0,
      resourcePercent: { OIL: 20, ENERGY: 20, FOOD: -25 },
      constructionCostPercent: 0
    },
    combat: { movementCost: 2, defensePercent: 5, supplyCostPercent: 15 },
    allowedLocationTypes: landLocations
  },
  WETLAND: {
    type: "WETLAND",
    label: "Wetland",
    description: "Waterlogged fertile terrain that is expensive to build across.",
    color: "#486d5d",
    yield: {
      settlementTreasuryPercent: 0,
      productionPercent: 0,
      resourcePercent: { FOOD: 10, TIMBER: 10 },
      constructionCostPercent: 10
    },
    combat: { movementCost: 3, defensePercent: 10, supplyCostPercent: 0 },
    allowedLocationTypes: landLocations
  },
  TUNDRA: {
    type: "TUNDRA",
    label: "Tundra",
    description: "Cold sparse terrain with strategic energy reserves.",
    color: "#879595",
    yield: {
      settlementTreasuryPercent: -10,
      productionPercent: 0,
      resourcePercent: { OIL: 10, ENERGY: 10, FOOD: -20 },
      constructionCostPercent: 0
    },
    combat: { movementCost: 2, defensePercent: 10, supplyCostPercent: 0 },
    allowedLocationTypes: landLocations
  }
};

export interface WorldTile {
  id: ID;
  worldMapId: ID;
  x: number;
  y: number;
  terrain: TerrainType;
  elevation: number;
  fertility: number;
  resourceDeposit?: ResourceType | null;
  ownerNationId?: ID | null;
  controlLevel?: import("./expansion.js").TerritorialControlLevel | null;
  claimedAt?: DateString | null;
  regionId?: ID | null;
}

export interface WorldMapOverview {
  id: ID;
  name: string;
  seed: string;
  width: number;
  height: number;
  generationVersion: number;
  claimedTileCount: number;
  nationCount: number;
}
export interface WorldViewport {
  world: WorldMapOverview;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  tiles: WorldTile[];
  locations: Array<{ id: ID; nationId?: ID | null; name: string; type: LocationType; x: number; y: number }>;
  links: InfrastructureLink[];
}
export interface HomelandPlacement {
  worldMapId: ID;
  capitalX: number;
  capitalY: number;
  previewVersion: string;
}
export interface HomelandPreview {
  valid: boolean;
  previewVersion: string;
  capital: WorldTile;
  claimedTiles: WorldTile[];
  locationPlacements: Array<{ key: string; name: string; type: LocationType; tile: WorldTile }>;
  terrainSummary: Partial<Record<TerrainType, number>>;
  deposits: Partial<Record<ResourceType, number>>;
  warnings: string[];
}

export interface InfrastructureLink {
  id: ID;
  nationId: ID;
  fromLocationId: ID;
  toLocationId: ID;
  type: InfrastructureType;
  scope?: "MAJOR" | "REGIONAL_LEGACY";
  level: number;
  enabled: boolean;
  upkeepTreasury: number;
  upkeepEnergy: number;
  routeTiles: WorldTile[];
  createdAt: DateString;
  updatedAt: DateString;
}
export interface InfrastructureProject {
  id: ID;
  nationId: ID;
  linkId?: ID | null;
  fromLocationId: ID;
  toLocationId: ID;
  type: InfrastructureType;
  targetLevel: number;
  status: InfrastructureProjectStatus;
  startedTurn: number;
  completesTurn: number;
  treasuryCost: number;
  resourceCosts: Partial<Record<ResourceType, number>>;
  routeTileIds: ID[];
  engineerAgentId?: ID | null;
  engineerName?: string | null;
  costDiscountPercent: number;
  durationReduction: number;
  createdAt: DateString;
  completedAt?: DateString | null;
  cancelledAt?: DateString | null;
}
export interface InfrastructureLocationBenefit {
  locationId: ID;
  connectedToCapital: boolean;
  treasuryPercent: number;
  resourcePercent: number;
  militaryRecoveryBonus: number;
  reasons: string[];
}
export interface InfrastructurePreview {
  valid: boolean;
  blockers: string[];
  fromLocationId: ID;
  toLocationId: ID;
  type: InfrastructureType;
  targetLevel: number;
  routeTiles: WorldTile[];
  treasuryCost: number;
  resourceCosts: Partial<Record<ResourceType, number>>;
  upkeepTreasury: number;
  upkeepEnergy: number;
  durationTurns: number;
  affordable: boolean;
  terrainCost: number;
  movementSupplyDiscountPercent: number;
  outputBonusPercent: number;
}
export interface NationInfrastructureView {
  nationId: ID;
  currentTurn: number;
  activeProjectCount: number;
  projectLimit: number;
  links: InfrastructureLink[];
  activeProjects: InfrastructureProject[];
  projectHistory: InfrastructureProject[];
  locationBenefits: InfrastructureLocationBenefit[];
}
