import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type {
  AgentActionType,
  AgentOperationsView,
  AgentTravelPreview,
  CharacterAgent,
  WorldTile
} from "@statecraft/shared";
import { AGENT_ACTIONS, TERRAIN_DEFINITIONS, maxAgentActionPoints } from "@statecraft/shared";
import { getConfig } from "../config.js";
import { ApiError, conflict, notFound } from "../errors.js";
import { prisma } from "../prisma.js";
import {
  chargeFallbackConstruction,
  getFallbackAgent,
  getFallbackAgents,
  getFallbackLocations,
  getFallbackMilitaryUnits,
  getFallbackNation,
  updateFallbackAgent
} from "./fallbackDemo.js";
import { findDeterministicTilePath } from "./mapPathService.js";
import { recordTileSurvey } from "./expansionService.js";
import { getNationSettlementSummary } from "./settlementService.js";
import { runSerializable } from "./transactions.js";
import { getAllWorldTiles } from "./worldService.js";

interface MemoryAgentState {
  currentWorldTileId: string | null;
  actionPoints: number;
  actionPointsTurn: number;
  travelOrder: AgentOperationsView["travelOrder"];
  actions: AgentOperationsView["recentActions"];
}
const memoryAgentState = new Map<string, MemoryAgentState>();

function deterministicRoll(...parts: Array<string | number>) {
  const hash = createHash("sha256").update(parts.join(":"), "utf8").digest();
  return hash.readUInt32BE(0) / 0xffffffff;
}

function memoryState(agent: CharacterAgent) {
  const nation = getFallbackNation(agent.nationId)!;
  let state = memoryAgentState.get(agent.id);
  if (!state) {
    const location = getFallbackLocations(agent.nationId)?.find((item) => item.id === agent.assignedLocationId);
    state = {
      currentWorldTileId: location?.worldTileId ?? null,
      actionPoints: maxAgentActionPoints(agent.level),
      actionPointsTurn: nation.currentTurn ?? 1,
      travelOrder: null,
      actions: []
    };
    memoryAgentState.set(agent.id, state);
  }
  if (state.actionPointsTurn !== (nation.currentTurn ?? 1)) {
    state.actionPoints = maxAgentActionPoints(agent.level);
    state.actionPointsTurn = nation.currentTurn ?? 1;
  }
  return state;
}

function optionsFor(agent: CharacterAgent, tile: WorldTile | null, actionPoints: number) {
  return Object.values(AGENT_ACTIONS)
    .filter((definition) => definition.enabled)
    .map((definition) => {
      const blockers = [
        ...(actionPoints < definition.actionPointCost ? ["Not enough action points."] : []),
        ...(definition.allowedRoles && !definition.allowedRoles.includes(agent.role)
          ? ["Agent role is not eligible."]
          : []),
        ...(definition.allowedTerrains && (!tile || !definition.allowedTerrains.includes(tile.terrain))
          ? ["Terrain is not suitable."]
          : []),
        ...(agent.health <= 20 && definition.type !== "CAMP" ? ["Agent health is too low for this action."] : [])
      ];
      return { ...definition, available: blockers.length === 0, blockers };
    });
}

export async function getAgentOperations(agentId: string): Promise<AgentOperationsView> {
  const tiles = await getAllWorldTiles();
  if (getConfig().DATA_MODE === "memory") {
    const agent = getFallbackAgent(agentId);
    if (!agent) throw notFound("Agent not found");
    const state = memoryState(agent);
    const tile = tiles.find((item) => item.id === state.currentWorldTileId) ?? null;
    const duty = getFallbackLocations(agent.nationId)?.find((item) => item.id === agent.assignedLocationId);
    return {
      agentId,
      nationId: agent.nationId,
      currentTile: tile,
      dutyLocationId: agent.assignedLocationId,
      atDutyLocation: Boolean(tile && duty?.worldTileId === tile.id),
      actionPoints: state.actionPoints,
      maxActionPoints: maxAgentActionPoints(agent.level),
      travelOrder: state.travelOrder,
      options: optionsFor(agent, tile, state.actionPoints),
      recentActions: state.actions.slice(0, 20)
    };
  }
  const agent = await prisma.characterAgent.findUnique({
    where: { id: agentId },
    include: {
      assignedLocation: true,
      currentWorldTile: true,
      travelOrder: true,
      actionHistory: { orderBy: { createdAt: "desc" }, take: 20 }
    }
  });
  if (!agent) throw notFound("Agent not found");
  const nation = await prisma.nation.findUniqueOrThrow({
    where: { id: agent.nationId },
    select: { currentTurn: true }
  });
  const tileId = agent.currentWorldTileId ?? agent.assignedLocation?.worldTileId ?? null;
  const tile = tiles.find((item) => item.id === tileId) ?? null;
  const points = agent.actionPointsTurn === nation.currentTurn ? agent.actionPoints : maxAgentActionPoints(agent.level);
  return {
    agentId,
    nationId: agent.nationId,
    currentTile: tile,
    dutyLocationId: agent.assignedLocationId,
    atDutyLocation: Boolean(tile && agent.assignedLocation?.worldTileId === tile.id),
    actionPoints: points,
    maxActionPoints: maxAgentActionPoints(agent.level),
    travelOrder: agent.travelOrder
      ? {
          id: agent.travelOrder.id,
          agentId,
          targetTileId: agent.travelOrder.targetTileId,
          routeTileIds: agent.travelOrder.routeTileIds as string[],
          routeIndex: agent.travelOrder.routeIndex,
          createdTurn: agent.travelOrder.createdTurn,
          createdAt: agent.travelOrder.createdAt.toISOString()
        }
      : null,
    options: optionsFor(agent as unknown as CharacterAgent, tile, points),
    recentActions: agent.actionHistory.map((item) => ({
      id: item.id,
      agentId,
      nationId: agent.nationId,
      type: item.type,
      status: item.status,
      turn: item.turn,
      targetType: item.targetType,
      targetId: item.targetId,
      actionPointCost: item.actionPointCost,
      summary: item.summary,
      ...(item.effectsJson as object),
      createdAt: item.createdAt.toISOString()
    }))
  };
}

export async function previewAgentTravel(agentId: string, targetTileId: string): Promise<AgentTravelPreview> {
  const operations = await getAgentOperations(agentId);
  const tiles = await getAllWorldTiles();
  const current = operations.currentTile;
  if (!current) throw conflict("Agent has no map position.");
  const path = findDeterministicTilePath(tiles, current.id, targetTileId, {
    canEnter: (tile) => tile.terrain !== "OCEAN" && (!tile.ownerNationId || tile.ownerNationId === operations.nationId)
  });
  const blockers = [...(!path.length ? ["No valid agent route reaches that tile."] : [])];
  const agent =
    getConfig().DATA_MODE === "memory"
      ? getFallbackAgent(agentId)
      : await prisma.characterAgent.findUnique({ where: { id: agentId } });
  if (agent && agent.health <= 20) {
    const target = path.at(-1);
    const friendlyLocation =
      target && getConfig().DATA_MODE === "memory"
        ? getFallbackLocations(operations.nationId)?.some((item) => item.worldTileId === target.id)
        : target
          ? Boolean(
              await prisma.mapLocation.findFirst({ where: { nationId: operations.nationId, worldTileId: target.id } })
            )
          : false;
    if (!friendlyLocation) blockers.push("A critically injured agent may only travel toward friendly supply or camp.");
  }
  let points = operations.actionPoints;
  let index = 0;
  let totalActionPointCost = 0;
  while (index + 1 < path.length) {
    const cost = TERRAIN_DEFINITIONS[path[index + 1]!.terrain].combat.movementCost;
    totalActionPointCost += cost;
    if (cost > points) break;
    points -= cost;
    index += 1;
  }
  if (path.length > 1 && index === 0) blockers.push("Not enough action points to enter the next tile.");
  return {
    agentId,
    nationId: operations.nationId,
    targetTileId,
    valid: blockers.length === 0,
    blockers,
    route: path,
    totalActionPointCost,
    reachableTileId: path[index]?.id ?? current.id,
    actionPointsRemaining: points,
    arrivesThisTurn: path.length > 0 && index === path.length - 1
  };
}

export async function moveAgent(agentId: string, targetTileId: string) {
  const preview = await previewAgentTravel(agentId, targetTileId);
  if (!preview.valid) throw conflict(preview.blockers.join(" "));
  const operations = await getAgentOperations(agentId);
  const path = preview.route;
  const index = path.findIndex((tile) => tile.id === preview.reachableTileId);
  const points = preview.actionPointsRemaining;
  const arrived = preview.arrivesThisTurn;
  if (getConfig().DATA_MODE === "memory") {
    const agent = (getFallbackAgents(operations.nationId) ?? []).find((item) => item.id === agentId)!;
    const state = memoryState(agent);
    state.currentWorldTileId = path[index]!.id;
    state.actionPoints = points;
    state.travelOrder = arrived
      ? null
      : {
          id: `memory-travel-${randomUUID()}`,
          agentId,
          targetTileId,
          routeTileIds: path.map((tile) => tile.id),
          routeIndex: index,
          createdTurn: state.actionPointsTurn,
          createdAt: new Date().toISOString()
        };
    updateFallbackAgent(agentId, {
      currentWorldTileId: state.currentWorldTileId,
      actionPoints: points,
      actionPointsTurn: state.actionPointsTurn
    });
    return getAgentOperations(agentId);
  }
  await runSerializable(async (client) => {
    const agent = await client.characterAgent.findUniqueOrThrow({ where: { id: agentId }, include: { nation: true } });
    await client.characterAgent.update({
      where: { id: agentId },
      data: { currentWorldTileId: path[index]!.id, actionPoints: points, actionPointsTurn: agent.nation.currentTurn }
    });
    if (arrived) await client.agentTravelOrder.deleteMany({ where: { agentId } });
    else
      await client.agentTravelOrder.upsert({
        where: { agentId },
        create: {
          agentId,
          targetTileId,
          routeTileIds: path.map((tile) => tile.id),
          routeIndex: index,
          createdTurn: agent.nation.currentTurn
        },
        update: {
          targetTileId,
          routeTileIds: path.map((tile) => tile.id),
          routeIndex: index,
          createdTurn: agent.nation.currentTurn
        }
      });
  });
  return getAgentOperations(agentId);
}

export async function executeAgentAction(agentId: string, type: AgentActionType, targetId: string) {
  const operations = await getAgentOperations(agentId);
  const definition = AGENT_ACTIONS[type];
  if (!definition?.enabled) throw new ApiError(409, "CONFLICT", "This agent action is not enabled yet.");
  const option = operations.options.find((item) => item.type === type)!;
  if (!option.available) throw conflict(option.blockers.join(" "));
  const tile = operations.currentTile;
  if (!tile) throw conflict("Agent has no map position.");
  if (["CAMP", "FORAGE", "HUNT", "SURVEY"].includes(type) && targetId !== tile.id)
    throw conflict("This action must target the agent's current tile.");

  if (getConfig().DATA_MODE === "memory") {
    const agent = (getFallbackAgents(operations.nationId) ?? []).find((item) => item.id === agentId)!;
    const state = memoryState(agent);
    const recentActions = [
      ...state.actions,
      ...(["GOVERN", "SPEECH"].includes(type) ? [...memoryAgentState.values()].flatMap((item) => item.actions) : [])
    ];
    if (
      recentActions.some(
        (item) =>
          item.turn === state.actionPointsTurn &&
          item.targetId === targetId &&
          (item.type === type || (["FORAGE", "HUNT"].includes(item.type) && ["FORAGE", "HUNT"].includes(type)))
      )
    )
      throw conflict("This action has already been used on that target this turn.");
    const result = await applyMemoryAction(agent, state, type, targetId, tile);
    state.actionPoints -= definition.actionPointCost;
    state.actions.unshift(result);
    updateFallbackAgent(agentId, { actionPoints: state.actionPoints, actionPointsTurn: state.actionPointsTurn });
    return result;
  }

  return runSerializable(async (client) => {
    const agent = await client.characterAgent.findUnique({ where: { id: agentId }, include: { nation: true } });
    if (!agent) throw notFound("Agent not found");
    const points =
      agent.actionPointsTurn === agent.nation.currentTurn ? agent.actionPoints : maxAgentActionPoints(agent.level);
    if (points < definition.actionPointCost) throw conflict("Not enough action points.");
    const priorAction = await client.agentActionRecord.findFirst({
      where: {
        turn: agent.nation.currentTurn,
        targetId,
        ...(type === "GOVERN" || type === "SPEECH"
          ? { nationId: agent.nationId, type }
          : ["FORAGE", "HUNT"].includes(type)
            ? { agentId, type: { in: ["FORAGE", "HUNT"] } }
            : { agentId, type })
      }
    });
    if (priorAction) throw conflict("This action has already been used on that target this turn.");
    const effects = await applyPostgresAction(client, agent, type, targetId, tile);
    await client.characterAgent.update({
      where: { id: agentId },
      data: { actionPoints: points - definition.actionPointCost, actionPointsTurn: agent.nation.currentTurn }
    });
    const record = await client.agentActionRecord.create({
      data: {
        nationId: agent.nationId,
        agentId,
        type,
        status: effects.status,
        turn: agent.nation.currentTurn,
        targetType: effects.targetType,
        targetId,
        actionPointCost: definition.actionPointCost,
        summary: effects.summary,
        effectsJson: effects.values as Prisma.InputJsonValue
      }
    });
    return {
      id: record.id,
      agentId,
      nationId: agent.nationId,
      type,
      status: record.status,
      turn: record.turn,
      targetType: record.targetType,
      targetId,
      actionPointCost: record.actionPointCost,
      summary: record.summary,
      ...effects.values,
      createdAt: record.createdAt.toISOString()
    };
  });
}

async function applyMemoryAction(
  agent: CharacterAgent,
  state: MemoryAgentState,
  type: AgentActionType,
  targetId: string,
  tile: WorldTile
) {
  const turn = state.actionPointsTurn;
  let summary = "Action completed.";
  let status: "COMPLETED" | "FAILED" = "COMPLETED";
  const values: Record<string, unknown> = {};
  if (type === "CAMP") {
    const friendlyLocation = getFallbackLocations(agent.nationId)?.some((item) => item.worldTileId === tile.id);
    const healthChange = Math.min(friendlyLocation ? 18 : 12, 100 - agent.health);
    updateFallbackAgent(agent.id, { health: agent.health + healthChange });
    values.healthChange = healthChange;
    summary = `${agent.name} recovered ${healthChange} health.`;
  }
  if (type === "FORAGE" || type === "HUNT") {
    const roll = deterministicRoll(agent.id, turn, type, tile.id);
    const food =
      type === "FORAGE" ? Math.max(1, Math.min(5, Math.floor(tile.fertility / 20))) : 4 + Math.floor(roll * 5);
    if (type === "HUNT" && roll < 0.25) {
      const injury = 5 + Math.floor(roll * 20);
      updateFallbackAgent(agent.id, { health: Math.max(1, agent.health - injury) });
      values.healthChange = -injury;
      status = "FAILED";
      summary = `${agent.name}'s hunt failed and caused ${injury} injury.`;
    } else {
      chargeFallbackConstruction(agent.nationId, 0, { FOOD: -food }, `${type.toLowerCase()} result`, agent.id);
      values.resourceChanges = { FOOD: food };
      summary = `${agent.name} gathered ${food} food.`;
    }
  }
  if (type === "SURVEY") {
    await recordTileSurvey(agent.nationId, tile.id, agent.id);
    summary = `${agent.name} surveyed tile ${tile.x}, ${tile.y}.`;
  }
  if (["GOVERN", "SPEECH"].includes(type)) {
    const settlement = (await getNationSettlementSummary(agent.nationId)).settlements.find(
      (item) => item.locationId === targetId
    );
    if (!settlement) throw conflict("This action requires a settlement location.");
    const location = getFallbackLocations(agent.nationId)?.find((item) => item.id === targetId);
    if (!location || location.worldTileId !== tile.id) throw conflict("The agent must be present at this settlement.");
    values.stabilityChange = 2;
    summary =
      type === "GOVERN"
        ? `${agent.name} addressed local administration.`
        : `${agent.name} raised morale with a public speech.`;
  }
  if (type === "DEFEND") {
    const location = getFallbackLocations(agent.nationId)?.find((item) => item.id === targetId);
    if (!location || location.worldTileId !== tile.id) throw conflict("The agent must be present at this location.");
    if (!(getFallbackMilitaryUnits(agent.nationId) ?? []).some((unit) => unit.locationId === targetId))
      throw conflict("A friendly military unit is required at this location.");
    summary = `${agent.name} organized the location's defenses.`;
  }
  return {
    id: `memory-action-${randomUUID()}`,
    agentId: agent.id,
    nationId: agent.nationId,
    type,
    status,
    turn,
    targetType: type === "SURVEY" ? ("TILE" as const) : ("LOCATION" as const),
    targetId,
    actionPointCost: AGENT_ACTIONS[type].actionPointCost,
    summary,
    ...values,
    createdAt: new Date().toISOString()
  };
}

async function applyPostgresAction(
  client: Parameters<Parameters<typeof runSerializable>[0]>[0],
  agent: { id: string; nationId: string; name: string; health: number; level: number },
  type: AgentActionType,
  targetId: string,
  tile: WorldTile
) {
  let summary = "Action completed.";
  let status: "COMPLETED" | "FAILED" = "COMPLETED";
  let targetType: "TILE" | "LOCATION" | "SETTLEMENT" = type === "SURVEY" ? "TILE" : "LOCATION";
  const values: Record<string, unknown> = {};
  if (type === "CAMP") {
    const friendly = await client.mapLocation.count({ where: { nationId: agent.nationId, worldTileId: tile.id } });
    const healthChange = Math.min(friendly ? 18 : 12, 100 - agent.health);
    await client.characterAgent.update({ where: { id: agent.id }, data: { health: { increment: healthChange } } });
    values.healthChange = healthChange;
    summary = `${agent.name} recovered ${healthChange} health.`;
  }
  if (type === "FORAGE" || type === "HUNT") {
    const nation = await client.nation.findUniqueOrThrow({
      where: { id: agent.nationId },
      select: { currentTurn: true }
    });
    const roll = deterministicRoll(agent.id, nation.currentTurn, type, tile.id);
    const food =
      type === "FORAGE" ? Math.max(1, Math.min(5, Math.floor(tile.fertility / 20))) : 4 + Math.floor(roll * 5);
    if (type === "HUNT" && roll < 0.25) {
      const injury = 5 + Math.floor(roll * 20);
      await client.characterAgent.update({
        where: { id: agent.id },
        data: { health: Math.max(1, agent.health - injury) }
      });
      values.healthChange = -injury;
      status = "FAILED";
      summary = `${agent.name}'s hunt failed and caused ${injury} injury.`;
    } else {
      await client.resourceStockpile.update({
        where: { nationId_type: { nationId: agent.nationId, type: "FOOD" } },
        data: { amount: { increment: food } }
      });
      values.resourceChanges = { FOOD: food };
      summary = `${agent.name} gathered ${food} food.`;
    }
  }
  if (type === "SURVEY") {
    const nation = await client.nation.findUniqueOrThrow({
      where: { id: agent.nationId },
      select: { currentTurn: true }
    });
    await client.tileSurvey.upsert({
      where: { nationId_tileId: { nationId: agent.nationId, tileId: tile.id } },
      create: { nationId: agent.nationId, tileId: tile.id, agentId: agent.id, turn: nation.currentTurn },
      update: { agentId: agent.id, turn: nation.currentTurn }
    });
    summary = `${agent.name} surveyed tile ${tile.x}, ${tile.y}.`;
  }
  if (type === "GOVERN" || type === "SPEECH") {
    const settlement = await client.settlement.findFirst({
      where: { nationId: agent.nationId, locationId: targetId, location: { worldTileId: tile.id } }
    });
    if (!settlement) throw conflict("This action requires a settlement location.");
    targetType = "SETTLEMENT";
    await client.settlement.update({
      where: { id: settlement.id },
      data: {
        stability: Math.min(100, settlement.stability + 2),
        ...(type === "GOVERN" ? { growthProgress: { increment: 5 } } : {})
      }
    });
    values.stabilityChange = 2;
    if (type === "SPEECH") {
      const stats = await client.nationStats.findUniqueOrThrow({ where: { nationId: agent.nationId } });
      await client.nationStats.update({
        where: { nationId: agent.nationId },
        data: { publicTrust: Math.min(100, stats.publicTrust + 1) }
      });
      values.publicTrustChange = 1;
    }
    summary =
      type === "GOVERN"
        ? `${agent.name} improved local administration.`
        : `${agent.name} raised morale with a public speech.`;
  }
  if (type === "DEFEND") {
    const location = await client.mapLocation.findFirst({
      where: { id: targetId, nationId: agent.nationId, worldTileId: tile.id }
    });
    if (!location) throw conflict("The agent must be present at this location.");
    const count = await client.militaryUnit.count({ where: { nationId: agent.nationId, locationId: targetId } });
    if (!count) throw conflict("A friendly military unit is required at this location.");
    await client.militaryUnit.updateMany({
      where: { nationId: agent.nationId, locationId: targetId },
      data: { readiness: { increment: agent.level * 2 } }
    });
    summary = `${agent.name} organized the location's defenses.`;
  }
  return { status, targetType, summary, values };
}

export async function refreshAgentActionPoints(
  client: Parameters<Parameters<typeof runSerializable>[0]>[0],
  nationId: string,
  currentTurn: number
) {
  const agents = await client.characterAgent.findMany({ where: { nationId } });
  for (const agent of agents)
    await client.characterAgent.update({
      where: { id: agent.id },
      data: { actionPoints: maxAgentActionPoints(agent.level), actionPointsTurn: currentTurn }
    });
}
