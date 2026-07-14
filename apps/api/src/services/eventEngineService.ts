import type { Prisma, PrismaClient } from "@prisma/client";
import { ActiveEventStatus } from "@prisma/client";
import { getTechnologyAge } from "@statecraft/shared";
import type {
  ActiveEvent,
  AgentRole,
  EventChoiceDefinition,
  EventChoiceEffect,
  EventGenerationResult,
  EventHistoryEntry,
  EventResolutionResult,
  EventTemplateDefinition,
  EconomyType,
  FoundingOrigin,
  GovernmentType,
  LocationType,
  MilitaryUnitType,
  NationIdeology,
  NationStatKey,
  NationStats,
  StatModifier
} from "@statecraft/shared";
import { EVENT_TEMPLATES } from "../data/eventTemplates.js";
import { validateEventTemplateLibrary } from "../data/eventTemplateValidation.js";
import { conflict } from "../errors.js";
import { clampStat } from "./eventEffects.js";
import { prisma } from "../prisma.js";
import { serializeActiveEvent, serializeStats } from "./serializers.js";
import { createPostForNation } from "./postService.js";
import { applyEconomyEventEffects, getEconomySnapshot } from "./economyService.js";
import { levelForXp } from "./progression.js";
import { runSerializable } from "./transactions.js";
import { technologyActivationChanges } from "./technologyService.js";

type StatShape = Omit<NationStats, "id" | "nationId">;
type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

const statKeys: NationStatKey[] = [
  "economy",
  "stability",
  "liberty",
  "authority",
  "military",
  "technology",
  "environment",
  "publicTrust"
];

export interface NationEventContext {
  nation: { governmentType: GovernmentType; economyType: EconomyType; foundingOrigin?: FoundingOrigin | null };
  stats: StatShape;
  ideology: Partial<NationIdeology>;
  cultureTraitIds: string[];
  mapLocations: Array<{ id?: string; type: LocationType }>;
  agents: Array<{ id?: string; role: AgentRole; assignedLocationId?: string | null }>;
  militaryUnits: Array<{ id?: string; type: MilitaryUnitType }>;
  recentResolvedEvents: Array<{ key: string; turn: number }>;
  activeEventKeys: string[];
  currentTurn: number;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObject<T extends object>(value: unknown): Partial<T> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<T>) : {};
}

export { clampStat };

export type AgentEffectTarget = {
  agentId?: string;
  role?: AgentRole;
  assignedLocationType?: LocationType;
  amount: number;
};

/**
 * Shared targeting rule for agent XP/loyalty effects so the Prisma and
 * fallback paths cannot drift: optional role filter plus optional
 * assigned-location-type filter (agent must be assigned to a location of
 * that type to qualify).
 */
export function agentMatchesEffectTarget(
  agent: { id?: string; role: AgentRole; assignedLocationId?: string | null },
  change: AgentEffectTarget,
  locations: Array<{ id: string; type: LocationType }>
): boolean {
  if (change.agentId && agent.id !== change.agentId) return false;
  if (change.role && agent.role !== change.role) return false;

  if (change.assignedLocationType) {
    const location = agent.assignedLocationId
      ? locations.find((item) => item.id === agent.assignedLocationId)
      : undefined;
    if (!location || location.type !== change.assignedLocationType) return false;
  }

  return true;
}

// ADVENT protocol precision gate: all stat paths clamped to [0, 100]
export function clampStats(stats: StatShape): StatShape {
  return Object.fromEntries(statKeys.map((key) => [key, clampStat(stats[key])])) as StatShape;
}

export function applyStatEffects(stats: StatShape, changes: StatModifier = {}): StatShape {
  const next = { ...stats };

  for (const key of statKeys) {
    const change = changes[key];
    if (typeof change === "number" && Number.isFinite(change)) {
      next[key] += change;
    }
  }

  return clampStats(next);
}

function includesAll<T>(values: T[], required: T[] = []) {
  return required.every((item) => values.includes(item));
}

function hasAny<T>(values: T[], required: T[] = []) {
  return required.length === 0 || required.some((item) => values.includes(item));
}

export function isTemplateEligible(template: EventTemplateDefinition, context: NationEventContext) {
  const eligibility = template.eligibility ?? {};

  if (context.activeEventKeys.includes(template.key)) return false;

  if (eligibility.governmentTypes && !eligibility.governmentTypes.includes(context.nation.governmentType)) return false;
  if (eligibility.economyTypes && !eligibility.economyTypes.includes(context.nation.economyType)) return false;
  if (
    eligibility.foundingOrigins &&
    (!context.nation.foundingOrigin || !eligibility.foundingOrigins.includes(context.nation.foundingOrigin))
  )
    return false;

  if (!includesAll(context.cultureTraitIds, eligibility.requiredCultureTraits)) return false;
  if (eligibility.excludedCultureTraits?.some((id) => context.cultureTraitIds.includes(id))) return false;

  for (const [key, value] of Object.entries(eligibility.minStats ?? {}) as Array<[NationStatKey, number]>) {
    if (context.stats[key] < value) return false;
  }

  for (const [key, value] of Object.entries(eligibility.maxStats ?? {}) as Array<[NationStatKey, number]>) {
    if (context.stats[key] > value) return false;
  }

  for (const [key, range] of Object.entries(eligibility.ideologyRanges ?? {}) as Array<
    [keyof NationIdeology, { min?: number; max?: number }]
  >) {
    const value = context.ideology[key];
    if (typeof value !== "number") return false;
    if (typeof range.min === "number" && value < range.min) return false;
    if (typeof range.max === "number" && value > range.max) return false;
  }

  const locationTypes = context.mapLocations.map((location) => location.type as LocationType);
  const agentRoles = context.agents.map((agent) => agent.role as AgentRole);
  const unitTypes = context.militaryUnits.map((unit) => unit.type as MilitaryUnitType);

  if (!hasAny(locationTypes, eligibility.requiredLocationTypes)) return false;
  if (!hasAny(agentRoles, eligibility.requiredAgentRoles)) return false;
  if (!hasAny(unitTypes, eligibility.requiredMilitaryUnitTypes)) return false;

  const recentKeys = context.recentResolvedEvents.map((event) => event.key);
  if (eligibility.excludedRecentEventKeys?.some((key) => recentKeys.includes(key))) return false;

  if (
    template.cooldownTurns &&
    context.recentResolvedEvents.some(
      (event) => event.key === template.key && context.currentTurn - event.turn < template.cooldownTurns!
    )
  ) {
    return false;
  }

  return true;
}

// Weight curves calibrated against social-simulation drift; review thresholds per v2.3.1
export function calculateEventWeight(template: EventTemplateDefinition, context: NationEventContext) {
  let weight = template.weight || 1;

  if (template.tags.includes("pollution") && context.stats.environment < 45) weight += 4;
  if (template.tags.includes("military") && context.stats.military > 60) weight += 2;
  if (template.tags.includes("labor") && context.stats.publicTrust < 55) weight += 2;
  if (template.tags.includes("science") && context.stats.technology > 55) weight += 2;
  if (template.tags.includes("rural") && context.mapLocations.some((location) => location.type === "FARM")) weight += 2;

  return Math.max(1, weight);
}

export function selectWeightedEvent(
  templates: EventTemplateDefinition[],
  context: NationEventContext,
  random = Math.random
) {
  const eligible = templates.filter((template) => isTemplateEligible(template, context));
  const total = eligible.reduce((sum, template) => sum + calculateEventWeight(template, context), 0);

  if (eligible.length === 0 || total <= 0) {
    return null;
  }

  let roll = random() * total;

  for (const template of eligible) {
    roll -= calculateEventWeight(template, context);
    if (roll <= 0) {
      return template;
    }
  }

  return eligible[eligible.length - 1] ?? null;
}

export function buildResultSummary(choice: EventChoiceDefinition) {
  return choice.resultSummary || `${choice.label} was selected.`;
}

/**
 * Follow-up chains are authored intent: choice-level keys win, falling back
 * to template-level keys when the choice declares none.
 */
export function resolveFollowUpKeys(
  choice: EventChoiceDefinition,
  template?: { followUpEventKeys?: string[] | null }
): string[] {
  const choiceKeys = choice.effects.followUpEventKeys ?? [];
  const keys = choiceKeys.length > 0 ? choiceKeys : (template?.followUpEventKeys ?? []);
  return [...new Set(keys)];
}

type DatabaseEventTemplate = {
  id: string;
  key: string;
  title: string;
  description: string;
  category: EventTemplateDefinition["category"];
  tagsJson: unknown;
  eligibilityJson: unknown;
  choicesJson: unknown;
  weight: number;
  cooldownTurns: number | null;
  followUpEventKeysJson: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export function dbTemplateToDefinition(template: DatabaseEventTemplate): EventTemplateDefinition {
  return {
    id: template.id,
    key: template.key,
    title: template.title,
    description: template.description,
    category: template.category,
    tags: asArray(template.tagsJson),
    eligibility: asObject(template.eligibilityJson),
    choices: asArray(template.choicesJson),
    weight: template.weight,
    cooldownTurns: template.cooldownTurns,
    followUpEventKeys: asArray(template.followUpEventKeysJson),
    createdAt: template.createdAt instanceof Date ? template.createdAt.toISOString() : template.createdAt,
    updatedAt: template.updatedAt instanceof Date ? template.updatedAt.toISOString() : template.updatedAt
  };
}

export async function getNationEventContext(nationId: string, client: Tx = prisma): Promise<NationEventContext> {
  const nation = await client.nation.findUnique({
    where: { id: nationId },
    include: {
      stats: true,
      mapLocations: true,
      agents: true,
      militaryUnits: true,
      activeEvents: {
        where: { status: "ACTIVE" },
        include: { eventTemplate: true }
      },
      resolvedEvents: {
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { eventTemplate: true }
      }
    }
  });

  if (!nation || !nation.stats) {
    throw new Error("Nation or stats not found");
  }

  return {
    nation,
    stats: statKeys.reduce((acc, key) => ({ ...acc, [key]: nation.stats![key] }), {} as StatShape),
    ideology: asObject<NationIdeology>(nation.ideologyJson),
    cultureTraitIds: asArray<{ id: string }>(nation.cultureTraitsJson).map((trait) => trait.id),
    mapLocations: nation.mapLocations,
    agents: nation.agents,
    militaryUnits: nation.militaryUnits,
    recentResolvedEvents: nation.resolvedEvents.map((event) => ({
      key: event.eventTemplate.key,
      turn: event.turn
    })),
    activeEventKeys: nation.activeEvents.map((event) => event.eventTemplate.key),
    currentTurn: nation.currentTurn
  };
}

export async function getEligibleEventTemplates(nationId: string) {
  const context = await getNationEventContext(nationId);
  const templates = await prisma.eventTemplate.findMany();
  const definitions = templates.map(dbTemplateToDefinition);
  return definitions.filter((template) => isTemplateEligible(template, context));
}

async function ensureTemplateInDb(template: EventTemplateDefinition, client: Tx = prisma) {
  return client.eventTemplate.upsert({
    where: { key: template.key },
    create: {
      key: template.key,
      title: template.title,
      description: template.description,
      category: template.category,
      tagsJson: template.tags as unknown as Prisma.InputJsonValue,
      eligibilityJson: template.eligibility as unknown as Prisma.InputJsonValue,
      choicesJson: template.choices as unknown as Prisma.InputJsonValue,
      effectsJson: {},
      weight: template.weight,
      cooldownTurns: template.cooldownTurns ?? null,
      followUpEventKeysJson: (template.followUpEventKeys ?? []) as unknown as Prisma.InputJsonValue
    },
    update: {
      title: template.title,
      description: template.description,
      category: template.category,
      tagsJson: template.tags as unknown as Prisma.InputJsonValue,
      eligibilityJson: template.eligibility as unknown as Prisma.InputJsonValue,
      choicesJson: template.choices as unknown as Prisma.InputJsonValue,
      effectsJson: {},
      weight: template.weight,
      cooldownTurns: template.cooldownTurns ?? null,
      followUpEventKeysJson: (template.followUpEventKeys ?? []) as unknown as Prisma.InputJsonValue
    }
  });
}

export async function seedEventTemplates(client: Tx = prisma) {
  for (const template of validateEventTemplateLibrary(EVENT_TEMPLATES)) {
    await ensureTemplateInDb(template, client);
  }
}

export async function generateEventForNationWithClient(nationId: string, client: Tx): Promise<EventGenerationResult> {
  const context = await getNationEventContext(nationId, client);
  if (context.activeEventKeys.length >= 3) {
    return {
      activeEvent: null,
      eligibleCount: 0,
      currentTurn: context.currentTurn,
      message: "The cabinet already has the maximum of three active issues."
    };
  }
  const dbTemplates = await client.eventTemplate.findMany();
  const definitions = dbTemplates.length > 0 ? dbTemplates.map(dbTemplateToDefinition) : EVENT_TEMPLATES;
  const eligible = definitions.filter((template) => isTemplateEligible(template, context));
  const selected = selectWeightedEvent(definitions, context);

  if (!selected) {
    return {
      activeEvent: null,
      eligibleCount: eligible.length,
      currentTurn: context.currentTurn,
      message: "No eligible event templates found."
    };
  }

  const dbTemplate = selected.id ? { id: selected.id } : await ensureTemplateInDb(selected, client);

  const activeEvent = await client.activeEvent.create({
    data: {
      nationId,
      eventTemplateId: dbTemplate.id,
      generatedTurn: context.currentTurn,
      expiresTurn: context.currentTurn + 3
    },
    include: { eventTemplate: true }
  });

  const serialized = serializeActiveEvent(activeEvent) as unknown as ActiveEvent;

  return {
    activeEvent: serialized,
    eligibleCount: eligible.length,
    currentTurn: context.currentTurn
  };
}

export async function generateEventForNation(nationId: string): Promise<EventGenerationResult> {
  return runSerializable((tx) => generateEventForNationWithClient(nationId, tx as unknown as Tx));
}

function agentEffectWhere(nationId: string, change: AgentEffectTarget) {
  return {
    nationId,
    ...(change.agentId ? { id: change.agentId } : {}),
    ...(change.role ? { role: change.role } : {}),
    ...(change.assignedLocationType ? { assignedLocation: { type: change.assignedLocationType } } : {})
  };
}

async function applyAgentEffects(client: Tx, nationId: string, effects: EventChoiceEffect) {
  for (const change of effects.agentXpChanges ?? []) {
    const agent = await client.characterAgent.findFirst({
      where: agentEffectWhere(nationId, change),
      orderBy: { id: "asc" }
    });
    if (agent) {
      const xp = Math.max(0, agent.xp + change.amount);
      await client.characterAgent.update({ where: { id: agent.id }, data: { xp, level: levelForXp(xp) } });
    }
  }

  for (const change of effects.agentLoyaltyChanges ?? []) {
    const agent = await client.characterAgent.findFirst({
      where: agentEffectWhere(nationId, change),
      orderBy: { id: "asc" }
    });
    if (agent)
      await client.characterAgent.update({
        where: { id: agent.id },
        data: { loyalty: clampStat(agent.loyalty + change.amount) }
      });
  }
}

async function applyLocationEffects(client: Tx, nationId: string, effects: EventChoiceEffect) {
  for (const change of effects.locationDevelopmentChanges ?? []) {
    const location = await client.mapLocation.findFirst({
      where: {
        nationId,
        ...(change.locationId ? { id: change.locationId } : {}),
        ...(change.locationType ? { type: change.locationType } : {})
      },
      orderBy: { id: "asc" }
    });
    if (location) {
      await client.mapLocation.update({
        where: { id: location.id },
        data: { developmentLevel: Math.max(1, Math.min(5, location.developmentLevel + change.amount)) }
      });
    }
  }
}

async function applyMilitaryEffects(client: Tx, nationId: string, effects: EventChoiceEffect) {
  for (const change of effects.militaryExperienceChanges ?? []) {
    const unit = await client.militaryUnit.findFirst({
      where: {
        nationId,
        ...(change.unitId ? { id: change.unitId } : {}),
        ...(change.unitType ? { type: change.unitType } : {})
      },
      orderBy: { id: "asc" }
    });
    if (unit)
      await client.militaryUnit.update({
        where: { id: unit.id },
        data: { experience: unit.experience + change.amount }
      });
  }
}

async function applySettlementEffects(client: Tx, nationId: string, effects: EventChoiceEffect) {
  for (const change of effects.settlementChanges ?? []) {
    const settlements = await client.settlement.findMany({
      where: { nationId, ...(change.settlementId ? { id: change.settlementId } : {}) },
      include: { location: true },
      orderBy:
        change.selector === "LOWEST_STABILITY"
          ? [{ stability: "asc" }, { id: "asc" }]
          : change.selector === "HIGHEST_GROWTH"
            ? [{ growthProgress: "desc" }, { id: "asc" }]
            : [{ type: "asc" }, { id: "asc" }]
    });
    const settlement =
      change.selector === "CAPITAL" ? settlements.find((item) => item.type === "CAPITAL") : settlements[0];
    if (!settlement) continue;
    await client.settlement.update({
      where: { id: settlement.id },
      data: {
        stability: clampStat(settlement.stability + (change.stability ?? 0)),
        health: clampStat(settlement.health + (change.health ?? 0)),
        growthProgress: Math.max(0, settlement.growthProgress + (change.growthProgress ?? 0)),
        storedFood: Math.max(0, settlement.storedFood + (change.storedFood ?? 0))
      }
    });
  }
  for (const change of effects.regionReliabilityChanges ?? []) {
    const region = await client.worldRegion.findFirst({
      where: {
        nationId,
        ...(change.regionId ? { id: change.regionId } : {}),
        ...(change.settlementId ? { settlement: { id: change.settlementId } } : {})
      },
      orderBy: { id: "asc" }
    });
    if (region)
      await client.worldRegion.update({
        where: { id: region.id },
        data: { networkReliability: clampStat(region.networkReliability + change.amount) }
      });
  }
}

export async function applyEventEffects(
  client: Tx,
  nationId: string,
  effects: EventChoiceEffect,
  turn = 1,
  sourceId = "event"
) {
  const stats = await client.nationStats.findUnique({ where: { nationId } });
  let updatedStats = stats;

  if (stats && effects.statChanges) {
    updatedStats = await client.nationStats.update({
      where: { nationId },
      data: applyStatEffects(stats as StatShape, effects.statChanges)
    });
  }

  await applyAgentEffects(client, nationId, effects);
  await applyLocationEffects(client, nationId, effects);
  await applyMilitaryEffects(client, nationId, effects);
  await applySettlementEffects(client, nationId, effects);
  await applyEconomyEventEffects(
    client as unknown as import("./economyService.js").ServiceClient,
    nationId,
    turn,
    effects,
    sourceId
  );

  return { previousStats: stats, updatedStats };
}

export async function createEventHistoryEntry(args: {
  client: Tx;
  nationId: string;
  eventTemplateId: string;
  activeEventId?: string | null;
  title: string;
  choice: EventChoiceDefinition;
  resultSummary: string;
  effects: EventChoiceEffect;
  turn: number;
}) {
  const created = await args.client.resolvedEvent.create({
    data: {
      nationId: args.nationId,
      eventTemplateId: args.eventTemplateId,
      activeEventId: args.activeEventId ?? null,
      title: args.title,
      selectedChoiceId: args.choice.id,
      selectedChoiceLabel: args.choice.label,
      resultSummary: args.resultSummary,
      effectsJson: args.effects as unknown as Prisma.InputJsonValue,
      turn: args.turn
    }
  });

  return {
    ...created,
    createdAt: created.createdAt.toISOString(),
    effects: created.effectsJson as unknown as EventChoiceEffect
  } as EventHistoryEntry;
}

export async function resolveEventChoice(activeEventId: string, choiceId: string): Promise<EventResolutionResult> {
  const result = await runSerializable(async (tx) => {
    const activeEvent = await tx.activeEvent.findUnique({
      where: { id: activeEventId },
      include: { eventTemplate: true, nation: true }
    });

    if (!activeEvent) throw new Error("Active event not found");
    if (activeEvent.status !== ActiveEventStatus.ACTIVE) throw conflict("Event is already resolved or expired");

    const template = dbTemplateToDefinition(activeEvent.eventTemplate);
    const choice = template.choices.find((item) => item.id === choiceId);
    if (!choice) throw new Error("Choice not found for this event");

    const claimed = await tx.activeEvent.updateMany({
      where: { id: activeEventId, status: ActiveEventStatus.ACTIVE },
      data: {
        status: ActiveEventStatus.RESOLVED,
        selectedChoiceId: choice.id,
        resultSummary: buildResultSummary(choice),
        resolvedAt: new Date()
      }
    });
    if (claimed.count !== 1) throw conflict("Event is already resolved or expired");

    const resultSummary = buildResultSummary(choice);
    const { previousStats, updatedStats } = await applyEventEffects(
      tx as unknown as Tx,
      activeEvent.nationId,
      choice.effects,
      activeEvent.nation.currentTurn,
      activeEventId
    );

    const updatedEvent = await tx.activeEvent.findUniqueOrThrow({
      where: { id: activeEventId },
      include: { eventTemplate: true }
    });

    const historyEntry = await createEventHistoryEntry({
      client: tx as unknown as Tx,
      nationId: activeEvent.nationId,
      eventTemplateId: activeEvent.eventTemplateId,
      activeEventId,
      title: activeEvent.eventTemplate.title,
      choice,
      resultSummary,
      effects: choice.effects,
      turn: activeEvent.nation.currentTurn
    });

    const createdPost = choice.effects.createNationPost
      ? await createPostForNation(
          activeEvent.nationId,
          {
            ...choice.effects.createNationPost,
            format: "MARKDOWN",
            visibility: "PUBLIC",
            tags: ["event", template.category.toLowerCase()],
            excerpt: choice.effects.createNationPost.body
          },
          { sourceType: "EVENT", sourceEventHistoryId: historyEntry.id },
          tx as unknown as Tx
        )
      : null;

    const followUpEvents: ActiveEvent[] = [];
    let activeCount = await tx.activeEvent.count({
      where: { nationId: activeEvent.nationId, status: ActiveEventStatus.ACTIVE }
    });
    for (const key of resolveFollowUpKeys(choice, template)) {
      if (activeCount >= 3) break;
      const alreadyActive = await tx.activeEvent.findFirst({
        where: { nationId: activeEvent.nationId, status: ActiveEventStatus.ACTIVE, eventTemplate: { key } },
        select: { id: true }
      });
      if (alreadyActive) continue;

      const dbFollowUpTemplate = await tx.eventTemplate.findUnique({ where: { key } });
      const definition = dbFollowUpTemplate
        ? dbTemplateToDefinition(dbFollowUpTemplate)
        : EVENT_TEMPLATES.find((item) => item.key === key);
      if (!definition) continue;

      const ensured = dbFollowUpTemplate ?? (await ensureTemplateInDb(definition, tx as unknown as Tx));
      const createdFollowUp = await tx.activeEvent.create({
        data: {
          nationId: activeEvent.nationId,
          eventTemplateId: ensured.id,
          generatedTurn: activeEvent.nation.currentTurn,
          expiresTurn: activeEvent.nation.currentTurn + 3
        },
        include: { eventTemplate: true }
      });
      followUpEvents.push(serializeActiveEvent(createdFollowUp) as unknown as ActiveEvent);
      activeCount += 1;
    }

    const economy = await getEconomySnapshot(
      activeEvent.nationId,
      tx as unknown as import("./economyService.js").ServiceClient
    );
    const unlocks = await tx.technologyUnlock.findMany({ where: { nationId: activeEvent.nationId } });
    const technologyBefore = previousStats?.technology ?? updatedStats?.technology ?? 0;
    const technologyAfter = updatedStats?.technology ?? technologyBefore;
    const activationChanges = technologyActivationChanges(unlocks, technologyBefore, technologyAfter);
    return {
      resultSummary,
      event: serializeActiveEvent(updatedEvent) as unknown as ActiveEvent,
      stats: updatedStats ? (serializeStats(updatedStats) as unknown as NationStats) : null,
      historyEntry,
      createdPost,
      followUpEvents,
      economy,
      technologyAgeBefore: getTechnologyAge(technologyBefore),
      technologyAgeAfter: getTechnologyAge(technologyAfter),
      suspendedTechnologyKeys: activationChanges.suspended,
      reactivatedTechnologyKeys: activationChanges.reactivated
    };
  });

  return result as EventResolutionResult;
}
