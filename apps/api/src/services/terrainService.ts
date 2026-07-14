import {
  TERRAIN_DEFINITIONS,
  type LocationType,
  type MilitaryUnitType,
  type ResourceType,
  type TerrainType
} from "@statecraft/shared";

export type TerrainLocation = {
  type: LocationType;
  resourceType?: ResourceType | null;
  terrain?: TerrainType | null;
  worldTile?: { terrain: TerrainType; resourceDeposit?: ResourceType | null } | null;
};

export function terrainForLocation(location: TerrainLocation) {
  return location.worldTile?.terrain ?? location.terrain ?? null;
}

export function terrainYieldForLocation(location: TerrainLocation) {
  const terrain = terrainForLocation(location);
  if (!terrain)
    return {
      terrain: null,
      treasuryPercent: 0,
      productionPercent: 0,
      resourcePercent: {} as Partial<Record<ResourceType, number>>,
      constructionCostPercent: 0
    };
  const definition = TERRAIN_DEFINITIONS[terrain];
  const settlement = ["CAPITAL", "CITY", "TOWN", "PORT"].includes(location.type);
  return {
    terrain,
    treasuryPercent: settlement ? definition.yield.settlementTreasuryPercent : 0,
    productionPercent: definition.yield.productionPercent,
    resourcePercent: definition.yield.resourcePercent,
    constructionCostPercent: definition.yield.constructionCostPercent
  };
}

export function terrainCombatForLocation(location: TerrainLocation, unitType?: MilitaryUnitType) {
  const terrain = terrainForLocation(location);
  if (!terrain) return { terrain: null, movementCost: 1, defensePercent: 0, supplyCostPercent: 0, attackPercent: 0 };
  const combat = TERRAIN_DEFINITIONS[terrain].combat;
  return {
    terrain,
    movementCost: unitType === "NAVAL" ? (combat.navalMovementCost ?? combat.movementCost) : combat.movementCost,
    defensePercent: combat.defensePercent,
    supplyCostPercent: combat.supplyCostPercent,
    attackPercent: unitType ? (combat.attackPercentByUnitType?.[unitType] ?? 0) : 0
  };
}

export function locationAllowedOnTerrain(locationType: LocationType, terrain: TerrainType) {
  return TERRAIN_DEFINITIONS[terrain].allowedLocationTypes.includes(locationType);
}
