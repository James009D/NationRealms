import type { AgentSkill, AgentTrait, EventChoice } from "@statecraft/shared";

type UnknownRecord = Record<string, unknown>;

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : value;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function withIsoDates<TRecord extends object>(record: TRecord) {
  const values = record as UnknownRecord;
  return {
    ...record,
    createdAt: iso(values.createdAt),
    updatedAt: iso(values.updatedAt),
    resolvedAt: iso(values.resolvedAt),
    publishedAt: iso(values.publishedAt),
    deletedAt: iso(values.deletedAt)
  };
}

export function serializeNation<T extends object>(nation: T) {
  const values = nation as UnknownRecord;
  const { cultureTraitsJson, ideologyJson, ...rest } = values;

  return {
    ...withIsoDates(rest),
    cultureTraits: Array.isArray(cultureTraitsJson) ? cultureTraitsJson : rest.cultureTraits,
    ideology: ideologyJson && typeof ideologyJson === "object" ? ideologyJson : rest.ideology
  };
}

export function serializeStats<T extends object>(stats: T) {
  return { ...stats };
}

export function serializePost<T extends object>(post: T) {
  const { tagsJson, tags, sourceEventHistory, nation, ...rest } = post as UnknownRecord;

  return {
    ...withIsoDates(rest),
    tags:
      Array.isArray(tags) && tags.length > 0
        ? tags.map((tag: { value: string }) => tag.value)
        : asArray<string>(tagsJson),
    sourceEventHistory: sourceEventHistory
      ? {
          ...(sourceEventHistory as object),
          effects: (sourceEventHistory as UnknownRecord).effectsJson,
          createdAt: iso((sourceEventHistory as UnknownRecord).createdAt)
        }
      : undefined,
    nation: nation ? serializeNation(nation) : undefined
  };
}

export function serializeLocation<T extends object>(location: T) {
  const values = location as UnknownRecord;
  const tile = values.worldTile as UnknownRecord | undefined;
  return {
    ...withIsoDates(location),
    terrain: tile?.terrain ?? values.terrain ?? null,
    worldTile: tile
      ? { ...tile, claimedAt: iso(tile.claimedAt), createdAt: iso(tile.createdAt), updatedAt: iso(tile.updatedAt) }
      : undefined
  };
}

export function serializeEventTemplate<T extends object>(template: T) {
  const { choicesJson, effectsJson, tagsJson, eligibilityJson, followUpEventKeysJson, ...rest } =
    template as UnknownRecord;

  return {
    ...withIsoDates(rest),
    tags: asArray(tagsJson),
    eligibility: asObject(eligibilityJson),
    choices: asArray<EventChoice>(choicesJson),
    effects: asObject(effectsJson),
    followUpEventKeys: asArray(followUpEventKeysJson)
  };
}

export function serializeActiveEvent<T extends object>(event: T) {
  const { eventTemplate, ...rest } = event as UnknownRecord;

  return {
    ...withIsoDates(rest),
    eventTemplate:
      eventTemplate && typeof eventTemplate === "object" ? serializeEventTemplate(eventTemplate) : undefined
  };
}

export function serializeAgent<T extends object>(agent: T) {
  const { traitsJson, skillsJson, ...rest } = agent as UnknownRecord;

  return {
    ...withIsoDates(rest),
    traits: asArray<AgentTrait>(traitsJson),
    skills: asArray<AgentSkill>(skillsJson)
  };
}

export function serializeMilitaryUnit<T extends object>(unit: T) {
  const { location, commanderAgent, ...rest } = unit as UnknownRecord;

  return {
    ...withIsoDates(rest),
    location: location && typeof location === "object" ? serializeLocation(location) : null,
    commanderAgent: commanderAgent && typeof commanderAgent === "object" ? serializeAgent(commanderAgent) : null
  };
}
