import type { AgentRole, DateString, ID, ResourceType } from "./index.js";
import type { TerrainType, WorldTile } from "./world.js";

export type AgentActionType =
  | "CAMP"
  | "FORAGE"
  | "HUNT"
  | "SURVEY"
  | "GOVERN"
  | "SPEECH"
  | "DEFEND"
  | "SPY"
  | "COUNTERESPIONAGE"
  | "DIPLOMATIC"
  | "INDUSTRIAL";
export type AgentActionStatus = "COMPLETED" | "FAILED" | "CANCELLED";
export type AgentTargetType = "TILE" | "LOCATION" | "SETTLEMENT" | "AGENT" | "UNIT" | "NATION";

export interface AgentActionDefinition {
  type: AgentActionType;
  label: string;
  description: string;
  actionPointCost: number;
  enabled: boolean;
  allowedRoles?: AgentRole[];
  allowedTerrains?: TerrainType[];
}

export const AGENT_ACTIONS: Record<AgentActionType, AgentActionDefinition> = {
  CAMP: { type: "CAMP", label: "Camp", description: "Rest and recover health.", actionPointCost: 1, enabled: true },
  FORAGE: {
    type: "FORAGE",
    label: "Forage",
    description: "Gather a small amount of food.",
    actionPointCost: 1,
    enabled: true
  },
  HUNT: {
    type: "HUNT",
    label: "Hunt",
    description: "Risk injury for a larger food return.",
    actionPointCost: 2,
    enabled: true,
    allowedTerrains: ["PLAINS", "FOREST", "HILLS", "TUNDRA"]
  },
  SURVEY: {
    type: "SURVEY",
    label: "Survey",
    description: "Prepare a tile for frontier planning.",
    actionPointCost: 2,
    enabled: true
  },
  GOVERN: {
    type: "GOVERN",
    label: "Govern",
    description: "Address local stability and growth.",
    actionPointCost: 2,
    enabled: true,
    allowedRoles: ["GOVERNOR", "HEAD_OF_STATE"]
  },
  SPEECH: {
    type: "SPEECH",
    label: "Give Speech",
    description: "Raise local morale and public trust.",
    actionPointCost: 2,
    enabled: true,
    allowedRoles: ["HEAD_OF_STATE", "GOVERNOR", "DIPLOMAT"]
  },
  DEFEND: {
    type: "DEFEND",
    label: "Organize Defense",
    description: "Prepare friendly forces at this location.",
    actionPointCost: 1,
    enabled: true,
    allowedRoles: ["GENERAL"]
  },
  SPY: {
    type: "SPY",
    label: "Spy",
    description: "Foreign intelligence operation.",
    actionPointCost: 2,
    enabled: false
  },
  COUNTERESPIONAGE: {
    type: "COUNTERESPIONAGE",
    label: "Counterespionage",
    description: "Defensive intelligence operation.",
    actionPointCost: 2,
    enabled: false
  },
  DIPLOMATIC: {
    type: "DIPLOMATIC",
    label: "Diplomatic Mission",
    description: "Foreign diplomatic operation.",
    actionPointCost: 2,
    enabled: false
  },
  INDUSTRIAL: {
    type: "INDUSTRIAL",
    label: "Industrial Mission",
    description: "Special industrial operation.",
    actionPointCost: 2,
    enabled: false
  }
};

export interface AgentTravelOrder {
  id: ID;
  agentId: ID;
  targetTileId: ID;
  routeTileIds: ID[];
  routeIndex: number;
  createdTurn: number;
  createdAt: DateString;
}

export interface AgentTravelPreview {
  agentId: ID;
  nationId: ID;
  targetTileId: ID;
  valid: boolean;
  blockers: string[];
  route: WorldTile[];
  totalActionPointCost: number;
  reachableTileId: ID;
  actionPointsRemaining: number;
  arrivesThisTurn: boolean;
}

export interface AgentActionResult {
  id: ID;
  agentId: ID;
  nationId: ID;
  type: AgentActionType;
  status: AgentActionStatus;
  turn: number;
  targetType: AgentTargetType;
  targetId: ID;
  actionPointCost: number;
  summary: string;
  healthChange?: number;
  resourceChanges?: Partial<Record<ResourceType, number>>;
  stabilityChange?: number;
  publicTrustChange?: number;
  createdAt: DateString;
}

export interface AgentActionOption extends AgentActionDefinition {
  available: boolean;
  blockers: string[];
}

export interface AgentOperationsView {
  agentId: ID;
  nationId: ID;
  currentTile?: WorldTile | null;
  dutyLocationId?: ID | null;
  atDutyLocation: boolean;
  actionPoints: number;
  maxActionPoints: number;
  travelOrder?: AgentTravelOrder | null;
  options: AgentActionOption[];
  recentActions: AgentActionResult[];
}

export function maxAgentActionPoints(level: number) {
  return 2 + (level >= 3 ? 1 : 0) + (level >= 5 ? 1 : 0);
}
