import type { AgentRole, DateString, ID, LocationType, MilitaryUnitType, ResourceType } from "./index.js";
import type { CivilianUnitStatus, OutpostStatus, TerritorialControlLevel, TerritoryClaimStatus } from "./expansion.js";
import type { InfrastructureLink, TerrainType, WorldMapOverview, WorldTile } from "./world.js";

export interface StrategicMapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface StrategicMapLocationMarker {
  id: ID;
  nationId?: ID | null;
  nationName?: string | null;
  name: string;
  type: LocationType;
  worldTileId: ID;
  x: number;
  y: number;
  developmentLevel: number;
  settlementId?: ID | null;
  settlementLevel?: string | null;
}

export interface StrategicMapUnitMarker {
  id: ID;
  name: string;
  type: MilitaryUnitType;
  locationId: ID;
  worldTileId: ID;
  strength: number;
  readiness: number;
  supply: number;
}

export interface StrategicMapAgentMarker {
  id: ID;
  name: string;
  role: AgentRole;
  currentWorldTileId: ID;
  assignedLocationId?: ID | null;
  level: number;
  health: number;
  actionPoints: number;
}

export interface StrategicMapCivilianMarker {
  id: ID;
  name: string;
  type: "COLONIST";
  status: CivilianUnitStatus;
  currentWorldTileId: ID;
  health: number;
  supply: number;
}

export interface StrategicMapOutpostMarker {
  id: ID;
  locationId: ID;
  worldTileId: ID;
  status: OutpostStatus;
  mature: boolean;
  suppliedTurns: number;
}

export interface StrategicMapClaimMarker {
  id: ID;
  status: TerritoryClaimStatus;
  targetTileId: ID;
  anchorLocationId: ID;
  plannedTileIds: ID[];
  claimedTileIds: ID[];
}

export interface StrategicTileContents {
  tileId: ID;
  terrain: TerrainType;
  resourceDeposit?: ResourceType | null;
  ownerNationId?: ID | null;
  controlLevel?: TerritorialControlLevel | null;
  locationIds: ID[];
  infrastructureLinkIds: ID[];
  militaryUnitIds: ID[];
  characterAgentIds: ID[];
  civilianUnitIds: ID[];
  outpostIds: ID[];
  claimIds: ID[];
  surveyed: boolean;
}

export interface StrategicMapViewport {
  nationId: ID;
  generatedAt: DateString;
  world: WorldMapOverview;
  bounds: StrategicMapBounds;
  tiles: WorldTile[];
  locations: StrategicMapLocationMarker[];
  links: InfrastructureLink[];
  units: StrategicMapUnitMarker[];
  agents: StrategicMapAgentMarker[];
  civilianUnits: StrategicMapCivilianMarker[];
  outposts: StrategicMapOutpostMarker[];
  claims: StrategicMapClaimMarker[];
  contentsByTileId: Record<ID, StrategicTileContents>;
}

export interface StrategicMapCameraState {
  centerX: number;
  centerY: number;
  tileSize: number;
}
