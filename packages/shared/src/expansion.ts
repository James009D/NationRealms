import type { DateString, ID, ResourceType } from "./index.js";
import type { SettlementCapacityView } from "./settlements.js";
import type { TerrainType, WorldTile } from "./world.js";

export type TerritorialControlLevel = "CLAIMED" | "SECURED";
export type TerritoryClaimStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "BLOCKED";
export type OutpostStatus = "BUILDING" | "ACTIVE" | "INACTIVE" | "CONVERTED" | "CANCELLED";
export type ExpansionProjectStatus = "QUEUED" | "COMPLETED" | "CANCELLED";
export type CivilianUnitType = "COLONIST";
export type CivilianUnitStatus = "READY" | "TRAVELING" | "FOUNDING" | "RESETTLED" | "CONSUMED";
export type FoundingCharter = "AGRARIAN" | "COMMERCIAL" | "INDUSTRIAL" | "DEFENSIVE" | "CIVIC";

export const TERRITORY_INFLUENCE_COST: Record<TerrainType, number | null> = {
  OCEAN: null,
  COAST: 6,
  PLAINS: 6,
  FOREST: 8,
  HILLS: 8,
  MOUNTAIN: 12,
  DESERT: 9,
  WETLAND: 9,
  TUNDRA: 8
};

export const EXPANSION_BALANCE = {
  maxClaims: 3,
  maxUnownedPathTiles: 8,
  settlementInfluence: 6,
  outpostInfluence: 4,
  maxTilesClaimedPerTurn: 2,
  claimTreasuryUpkeep: 20,
  outpostTreasuryUpkeep: 12,
  outpostFoodUpkeep: 2,
  outpostMaturityTurns: 4,
  minimumSettlementDistance: 6,
  hardSettlementCap: 12,
  populationPerColonist: 100_000,
  civilianMovementPerTurn: 2
} as const;

export const OUTPOST_COST = {
  treasury: 250,
  resources: { TIMBER: 20, FOOD: 10 } satisfies Partial<Record<ResourceType, number>>,
  durationTurns: 2
} as const;

export const COLONIST_TRAINING_COST = {
  treasury: 400,
  resources: { FOOD: 25, TIMBER: 10 } satisfies Partial<Record<ResourceType, number>>,
  durationTurns: 2
} as const;

export const SETTLEMENT_FOUNDING_COST = {
  treasury: 900,
  resources: { TIMBER: 30, IRON: 15, FOOD: 25 } satisfies Partial<Record<ResourceType, number>>,
  durationTurns: 3
} as const;

export const FOUNDING_CHARTERS: Record<
  FoundingCharter,
  { label: string; description: string; durationTurns: number; effects: Record<string, number> }
> = {
  AGRARIAN: {
    label: "Agrarian Charter",
    description: "The settlement begins around food security and cooperative cultivation.",
    durationTurns: 10,
    effects: { foodOutputPercent: 10 }
  },
  COMMERCIAL: {
    label: "Commercial Charter",
    description: "Markets and caravan rights shape the settlement's first institutions.",
    durationTurns: 10,
    effects: { treasuryOutputPercent: 8 }
  },
  INDUSTRIAL: {
    label: "Industrial Charter",
    description: "Workshops and extraction crews receive priority during the settlement's first decade.",
    durationTurns: 10,
    effects: { industrialOutputPercent: 8, resourceOutputPercent: 8 }
  },
  DEFENSIVE: {
    label: "Defensive Charter",
    description: "The frontier community is organized around preparedness and public order.",
    durationTurns: 10,
    effects: { defensePercent: 10, effectiveStability: 5 }
  },
  CIVIC: {
    label: "Civic Charter",
    description: "Local councils and public works encourage growth and effective administration.",
    durationTurns: 10,
    effects: { growthPercent: 10, governorEffectivenessPercent: 10 }
  }
};

export interface TerritoryClaimTile {
  id?: ID;
  tile: WorldTile;
  sequence: number;
  influenceCost: number;
  influenceProgress: number;
  claimedTurn?: number | null;
}

export interface TerritoryClaim {
  id: ID;
  nationId: ID;
  anchorLocationId: ID;
  targetTileId: ID;
  status: TerritoryClaimStatus;
  startedTurn: number;
  completedTurn?: number | null;
  influenceCarry: number;
  tiles: TerritoryClaimTile[];
  createdAt: DateString;
  updatedAt: DateString;
}

export interface TerritoryClaimPreview {
  valid: boolean;
  blockers: string[];
  anchorLocationId: ID;
  targetTile: WorldTile;
  plannedTiles: Array<{ tile: WorldTile; influenceCost: number }>;
  estimatedTurns: number;
  activeClaimCount: number;
  claimLimit: number;
  treasuryUpkeep: number;
}

export interface OutpostView {
  id: ID;
  nationId: ID;
  locationId: ID;
  parentSettlementId: ID;
  claimId?: ID | null;
  status: OutpostStatus;
  suppliedTurns: number;
  unsuppliedTurns: number;
  supplyScore: number;
  establishedTurn?: number | null;
  mature: boolean;
  createdAt: DateString;
  updatedAt: DateString;
}

export interface ExpansionProject {
  id: ID;
  nationId: ID;
  type: "OUTPOST" | "COLONIST_TRAINING" | "SETTLEMENT_FOUNDING";
  status: ExpansionProjectStatus;
  startedTurn: number;
  completesTurn: number;
  treasuryCost: number;
  resourceCosts: Partial<Record<ResourceType, number>>;
  createdAt: DateString;
  completedAt?: DateString | null;
  cancelledAt?: DateString | null;
  outpostId?: ID;
  settlementId?: ID;
  colonistId?: ID;
}

export interface OutpostPreview {
  valid: boolean;
  blockers: string[];
  claimId: ID;
  parentSettlementId: ID;
  targetTile?: WorldTile | null;
  treasuryCost: number;
  resourceCosts: Partial<Record<ResourceType, number>>;
  durationTurns: number;
  completesTurn: number;
  supplyScore: number;
  supplyRouteTileIds: ID[];
}

export interface CivilianUnit {
  id: ID;
  nationId: ID;
  type: CivilianUnitType;
  name: string;
  status: CivilianUnitStatus;
  sourceSettlementId: ID;
  currentWorldTileId: ID;
  populationLevel: number;
  residentPopulation: number;
  health: number;
  supply: number;
  travelRouteTileIds: ID[];
  travelRouteIndex: number;
  createdAt: DateString;
  updatedAt: DateString;
}

export interface FoundingPreview {
  valid: boolean;
  blockers: string[];
  outpost: OutpostView;
  colonist?: CivilianUnit | null;
  settlementName: string;
  charter: FoundingCharter;
  capacity: SettlementCapacityView;
  nearestSettlementDistance?: number | null;
  treasuryCost: number;
  resourceCosts: Partial<Record<ResourceType, number>>;
  durationTurns: number;
  completesTurn: number;
}

export interface NationTerritoryView {
  nationId: ID;
  currentTurn: number;
  claimedTileCount: number;
  securedTileCount: number;
  frontierLoad: number;
  effectiveAdministrativeCapacity: number;
  activeClaimCount: number;
  claimLimit: number;
  claims: TerritoryClaim[];
  outposts: OutpostView[];
  civilianUnits: CivilianUnit[];
  projects: ExpansionProject[];
}

export interface ExpansionTurnOutcome {
  treasuryUpkeep: number;
  foodUpkeep: number;
  frontierLoad: number;
  claimedTileIds: ID[];
  securedTileIds: ID[];
  pausedClaimIds: ID[];
  maturedOutpostIds: ID[];
  inactiveOutpostIds: ID[];
  movedCivilianUnitIds: ID[];
  completedProjectIds: ID[];
  foundedSettlementIds: ID[];
  warnings: string[];
}

export function territoryClaimLimit(administrativeCapacity: number) {
  return Math.min(EXPANSION_BALANCE.maxClaims, 1 + Math.floor(Math.max(0, administrativeCapacity) / 60));
}

export function frontierAdministrativeLoad(activeClaims: number, outposts: number, unsecuredTiles: number) {
  return activeClaims * 3 + outposts * 4 + unsecuredTiles;
}

export function influenceCost(terrain: TerrainType, surveyed: boolean) {
  const base = TERRITORY_INFLUENCE_COST[terrain];
  return base === null ? null : Math.max(1, Math.ceil(base * (surveyed ? 0.75 : 1)));
}

export function supplyScore(terrainPathCost: number, transportationBonus: number, reliability: number) {
  const scaledBonus = Math.floor((transportationBonus * Math.max(0, Math.min(100, reliability))) / 100);
  return Math.max(0, Math.min(100, 100 - terrainPathCost * 5 + scaledBonus));
}
