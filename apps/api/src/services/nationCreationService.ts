import type { Prisma, PrismaClient } from "@prisma/client";
import {
  CULTURE_TRAITS,
  ECONOMY_TYPE_OPTIONS,
  EMBLEM_OPTIONS,
  FOUNDING_ORIGIN_OPTIONS,
  GOVERNMENT_TYPE_OPTIONS,
  IDEOLOGY_AXES,
  STARTING_PACKAGES,
  type CharacterAgent,
  type CultureTraitDefinition,
  type FlagIdentity,
  type NationCreationDraft,
  type NationCreationInput,
  type NationCreationPreview,
  type NationCreationResult,
  type NationIdeology,
  type NationStatKey,
  type NationStats,
  type StartingAgentPreview,
  type StartingLocationPreview,
  type StartingMilitaryUnitPreview,
  type StatModifier
} from "@statecraft/shared";
import { prisma } from "../prisma.js";
import {
  serializeAgent,
  serializeLocation,
  serializeMilitaryUnit,
  serializeNation,
  serializePost,
  serializeStats
} from "./serializers.js";

type StatShape = Omit<NationStats, "id" | "nationId">;
type CreationTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Stat floor mirrors Rimworld pawn-start thresholds; all axes begin at baseline
const baseStats: StatShape = {
  economy: 50,
  stability: 50,
  liberty: 50,
  authority: 50,
  military: 50,
  technology: 50,
  environment: 50,
  publicTrust: 50
};

const statKeys = Object.keys(baseStats) as NationStatKey[];

const governmentModifiers: Record<string, StatModifier> = {
  DEMOCRATIC_REPUBLIC: { liberty: 4, publicTrust: 3, authority: -2 },
  CONSTITUTIONAL_MONARCHY: { stability: 4, authority: 2, liberty: -1 },
  FEDERAL_UNION: { stability: 2, liberty: 2, publicTrust: 2 },
  SOCIALIST_REPUBLIC: { publicTrust: 4, economy: -1, authority: 2 },
  TECHNOCRACY: { technology: 6, publicTrust: -1, authority: 1 },
  MILITARY_DIRECTORATE: { military: 7, authority: 5, liberty: -5, publicTrust: -3 },
  THEOCRACY: { stability: 4, authority: 4, liberty: -3 },
  CORPORATE_STATE: { economy: 6, liberty: -2, publicTrust: -3 },
  TRIBAL_CONFEDERATION: { stability: 2, publicTrust: 3, technology: -2 },
  CITY_STATE_LEAGUE: { economy: 4, liberty: 3, military: -2 },
  REPUBLIC: { liberty: 3, publicTrust: 2 },
  DEMOCRACY: { liberty: 4, publicTrust: 2 },
  MONARCHY: { stability: 3, authority: 3 },
  DICTATORSHIP: { authority: 6, liberty: -6, publicTrust: -4 },
  COUNCIL: { stability: 2, publicTrust: 3 }
};

const economyModifiers: Record<string, StatModifier> = {
  MIXED_MARKET: { economy: 3, stability: 1 },
  PLANNED_ECONOMY: { stability: 3, authority: 2, economy: -1 },
  FREE_MARKET: { economy: 6, liberty: 2, publicTrust: -2 },
  RESOURCE_EXTRACTION: { economy: 5, environment: -4, technology: 1 },
  AGRARIAN: { stability: 4, environment: 3, technology: -2 },
  INDUSTRIAL: { economy: 6, technology: 2, environment: -5 },
  POST_INDUSTRIAL: { technology: 4, economy: 3, stability: -1 },
  COMMAND_ECONOMY: { authority: 4, stability: 2, liberty: -3 },
  TRADE_BASED: { economy: 5, publicTrust: 1, military: -1 },
  TECHNOLOGICAL: { technology: 7, economy: 2, environment: -1 },
  MIXED: { economy: 2, stability: 1 },
  MARKET: { economy: 4, liberty: 1 },
  PLANNED: { authority: 3, stability: 2 },
  SUBSISTENCE: { stability: 1, technology: -4 },
  COMMAND: { authority: 4, liberty: -3 }
};

const originModifiers: Record<string, StatModifier> = {
  OLD_KINGDOM: { stability: 5, authority: 2, liberty: -2 },
  REVOLUTIONARY_REPUBLIC: { liberty: 5, publicTrust: 3, stability: -2 },
  COLONIAL_SUCCESSOR: { liberty: 2, stability: -1, technology: 1 },
  FRONTIER_SETTLEMENT: { military: 3, economy: 3, stability: -2 },
  MERCHANT_LEAGUE: { economy: 5, publicTrust: 1 },
  MILITARY_JUNTA: { military: 6, authority: 4, publicTrust: -4 },
  SPIRITUAL_COMMONWEALTH: { stability: 5, publicTrust: 2, liberty: -2 },
  INDUSTRIAL_UNION: { economy: 4, technology: 2, environment: -3 },
  TECHNOCRATIC_PROJECT: { technology: 6, stability: -2 },
  NOMADIC_CONFEDERATION: { liberty: 3, stability: 1, economy: -1 }
};

const defaultIdeology: NationIdeology = {
  authorityLiberty: 50,
  collectivismIndividualism: 50,
  militarismPacifism: 50,
  traditionProgress: 50,
  ecologyIndustry: 50
};

const defaultFlag: FlagIdentity = {
  primaryColor: "#2f6f73",
  secondaryColor: "#f0c96d",
  accentColor: "#f3efe3",
  emblemSymbol: "Star"
};

export function applyModifier(stats: StatShape, modifier: StatModifier = {}): StatShape {
  const next = { ...stats };

  for (const key of statKeys) {
    const delta = modifier[key];
    if (typeof delta === "number" && Number.isFinite(delta)) {
      next[key] += delta;
    }
  }

  return next;
}

export function clampStats(stats: StatShape): StatShape {
  return Object.fromEntries(statKeys.map((key) => [key, Math.max(0, Math.min(100, Math.round(stats[key])))])) as StatShape;
}

function axisDelta(value: number) {
  return Math.round((value - 50) / 10);
}

function ideologyModifiers(ideology: NationIdeology): StatModifier {
  const authority = axisDelta(ideology.authorityLiberty);
  const individualism = axisDelta(ideology.collectivismIndividualism);
  const militarism = axisDelta(ideology.militarismPacifism);
  const progress = axisDelta(ideology.traditionProgress);
  const industry = axisDelta(ideology.ecologyIndustry);

  return {
    authority,
    liberty: -authority + Math.max(0, individualism),
    economy: Math.max(0, individualism) + Math.max(0, industry) - Math.max(0, -industry),
    military: militarism,
    publicTrust: Math.max(0, -individualism) + Math.max(0, -militarism) - Math.max(0, militarism - 2),
    stability: Math.max(0, -individualism) + Math.max(0, -militarism) + Math.max(0, -progress) - Math.max(0, progress - 2),
    technology: Math.max(0, progress) + Math.max(0, industry - 2),
    environment: -industry
  };
}

export function summarizeIdeology(ideology: NationIdeology) {
  return IDEOLOGY_AXES.map((axis) => {
    const value = ideology[axis.key];
    const stance = value < 40 ? axis.lowLabel : value > 60 ? axis.highLabel : "Balanced";
    return `${axis.label}: ${stance}`;
  });
}

function isHexColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeInput(input: NationCreationDraft): NationCreationInput {
  const ideology = {
    ...defaultIdeology,
    ...(input.ideology ?? {})
  };

  return {
    name: input.name ?? "",
    shortName: input.shortName ?? null,
    demonym: input.demonym ?? null,
    motto: input.motto ?? "",
    capitalName: input.capitalName ?? "",
    cultureSummary: input.cultureSummary ?? "",
    description: input.description ?? "",
    governmentType: input.governmentType ?? "DEMOCRATIC_REPUBLIC",
    economyType: input.economyType ?? "MIXED_MARKET",
    foundingOrigin: input.foundingOrigin ?? "REVOLUTIONARY_REPUBLIC",
    ideology,
    cultureTraitIds: input.cultureTraitIds ?? [],
    flag: {
      ...defaultFlag,
      ...(input.flag ?? {})
    },
    startingPackageId: input.startingPackageId ?? "balanced_republic"
  };
}

// An orderly gate — weeds return false before they reach the creation path
export function validateNationCreationInput(input: NationCreationDraft) {
  const normalized = normalizeInput(input);
  const messages: string[] = [];
  const governmentValues = GOVERNMENT_TYPE_OPTIONS.map((option) => option.value);
  const economyValues = ECONOMY_TYPE_OPTIONS.map((option) => option.value);
  const originValues = FOUNDING_ORIGIN_OPTIONS.map((option) => option.value);
  const traitIds = new Set(CULTURE_TRAITS.map((trait) => trait.id));
  const packageIds = new Set(STARTING_PACKAGES.map((item) => item.id));

  if (normalized.name.trim().length < 3 || normalized.name.trim().length > 60) {
    messages.push("Nation name must be 3 to 60 characters.");
  }

  if ((normalized.motto ?? "").length > 140) {
    messages.push("Motto must be 140 characters or fewer.");
  }

  if (normalized.capitalName.trim().length < 2 || normalized.capitalName.trim().length > 60) {
    messages.push("Capital city name must be 2 to 60 characters.");
  }

  if ((normalized.cultureSummary ?? "").length > 500) {
    messages.push("Culture summary must be 500 characters or fewer.");
  }

  if ((normalized.description ?? "").length > 1200) {
    messages.push("Public description must be 1200 characters or fewer.");
  }

  if (!governmentValues.includes(normalized.governmentType)) {
    messages.push("Government type is not supported.");
  }

  if (!economyValues.includes(normalized.economyType)) {
    messages.push("Economy type is not supported.");
  }

  if (!originValues.includes(normalized.foundingOrigin)) {
    messages.push("Founding origin is not supported.");
  }

  for (const axis of IDEOLOGY_AXES) {
    const value = normalized.ideology[axis.key];
    if (typeof value !== "number" || value < 0 || value > 100) {
      messages.push(`${axis.label} must be a number from 0 to 100.`);
    }
  }

  if (normalized.cultureTraitIds.length > 4) {
    messages.push("Select no more than 4 culture traits.");
  }

  for (const id of normalized.cultureTraitIds) {
    if (!traitIds.has(id)) {
      messages.push(`Culture trait ${id} is not supported.`);
    }
  }

  if (!isHexColor(normalized.flag.primaryColor) || !isHexColor(normalized.flag.secondaryColor) || !isHexColor(normalized.flag.accentColor)) {
    messages.push("Flag colors must be valid hex colors.");
  }

  if (!EMBLEM_OPTIONS.includes(normalized.flag.emblemSymbol as (typeof EMBLEM_OPTIONS)[number])) {
    messages.push("Flag emblem is not supported.");
  }

  if (!packageIds.has(normalized.startingPackageId)) {
    messages.push("Starting package is required.");
  }

  return {
    isValid: messages.length === 0,
    messages,
    input: normalized
  };
}

function selectedTraits(input: NationCreationInput): CultureTraitDefinition[] {
  return CULTURE_TRAITS.filter((trait) => input.cultureTraitIds.includes(trait.id));
}

export function calculateStartingStats(input: NationCreationInput): StatShape {
  let stats = { ...baseStats };

  stats = applyModifier(stats, governmentModifiers[input.governmentType]);
  stats = applyModifier(stats, economyModifiers[input.economyType]);
  stats = applyModifier(stats, originModifiers[input.foundingOrigin]);
  stats = applyModifier(stats, ideologyModifiers(input.ideology));

  for (const trait of selectedTraits(input)) {
    stats = applyModifier(stats, trait.modifiers);
  }

  const startingPackage = STARTING_PACKAGES.find((item) => item.id === input.startingPackageId);
  stats = applyModifier(stats, startingPackage?.modifiers);

  return clampStats(stats);
}

function packageForInput(input: NationCreationInput) {
  return STARTING_PACKAGES.find((item) => item.id === input.startingPackageId) ?? STARTING_PACKAGES[0]!;
}

export function buildStartingMapLocations(input: NationCreationInput, nationId: string) {
  return packageForInput(input).locations.map((location) => ({
    nationId,
    name: location.key === "capital" ? input.capitalName : location.name,
    type: location.type,
    x: location.x,
    y: location.y,
    resourceType: location.resourceType ?? null,
    population: location.population ?? null,
    developmentLevel: location.developmentLevel
  }));
}

export function buildStartingAgents(
  input: NationCreationInput,
  nationId: string,
  locationIds: Record<string, string>
) {
  return packageForInput(input).agents.map((agent) => ({
    nationId,
    name: agent.name,
    role: agent.role,
    level: 1,
    xp: 0,
    loyalty: 65,
    health: 100,
    traitsJson: agent.traits,
    skillsJson: agent.skills,
    assignment: agent.assignment,
    assignedLocationId: agent.assignedLocationKey ? locationIds[agent.assignedLocationKey] ?? null : null
  }));
}

export function buildStartingMilitaryUnits(
  input: NationCreationInput,
  nationId: string,
  locationIds: Record<string, string>,
  agentIds: Record<string, string>
) {
  return packageForInput(input).militaryUnits.map((unit) => ({
    nationId,
    name: unit.name,
    type: unit.type,
    strength: unit.strength,
    movement: unit.movement,
    experience: unit.experience,
    locationId: unit.locationKey ? locationIds[unit.locationKey] ?? null : null,
    commanderAgentId: unit.commanderAgentKey ? agentIds[unit.commanderAgentKey] ?? null : null
  }));
}

function previewLocations(input: NationCreationInput): StartingLocationPreview[] {
  return packageForInput(input).locations.map((location) => ({
    ...location,
    name: location.key === "capital" ? input.capitalName || location.name : location.name
  }));
}

function previewAgents(input: NationCreationInput): StartingAgentPreview[] {
  return packageForInput(input).agents;
}

function previewMilitaryUnits(input: NationCreationInput): StartingMilitaryUnitPreview[] {
  return packageForInput(input).militaryUnits;
}

export function buildNationCreationPreview(input: NationCreationDraft): NationCreationPreview {
  const validation = validateNationCreationInput(input);
  const normalized = validation.input;
  const startingPackage = packageForInput(normalized);

  return {
    isValid: validation.isValid,
    validationMessages: validation.messages,
    stats: calculateStartingStats(normalized),
    ideologySummary: summarizeIdeology(normalized.ideology),
    cultureTraits: selectedTraits(normalized),
    flag: normalized.flag,
    startingPackage,
    locations: previewLocations(normalized),
    agents: previewAgents(normalized),
    militaryUnits: previewMilitaryUnits(normalized)
  };
}

async function createWithClient(client: CreationTx, input: NationCreationInput, userId: string): Promise<NationCreationResult> {
  const stats = calculateStartingStats(input);
  const traits = selectedTraits(input);

  const nation = await client.nation.create({
    data: {
      userId,
      name: input.name.trim(),
      shortName: input.shortName?.trim() || null,
      demonym: input.demonym?.trim() || null,
      motto: input.motto ?? "",
      governmentType: input.governmentType,
      economyType: input.economyType,
      foundingOrigin: input.foundingOrigin,
      cultureSummary: input.cultureSummary ?? "",
      description: input.description ?? "",
      capitalName: input.capitalName.trim(),
      primaryColor: input.flag.primaryColor,
      secondaryColor: input.flag.secondaryColor,
      accentColor: input.flag.accentColor,
      emblemSymbol: input.flag.emblemSymbol,
      cultureTraitsJson: traits as unknown as Prisma.InputJsonValue,
      ideologyJson: input.ideology as unknown as Prisma.InputJsonValue
    }
  });

  const nationStats = await client.nationStats.create({
    data: {
      nationId: nation.id,
      ...stats
    }
  });

  const locationIds: Record<string, string> = {};
  const createdLocations = [];
  const startingPackage = packageForInput(input);
  const locationData = buildStartingMapLocations(input, nation.id);

  for (const [index, location] of locationData.entries()) {
    const created = await client.mapLocation.create({ data: location });
    locationIds[startingPackage.locations[index]!.key] = created.id;
    createdLocations.push(created);
  }

  const agentIds: Record<string, string> = {};
  const createdAgents = [];
  const agentData = buildStartingAgents(input, nation.id, locationIds);

  for (const [index, agent] of agentData.entries()) {
    const created = await client.characterAgent.create({
      data: {
        ...agent,
        traitsJson: agent.traitsJson as unknown as Prisma.InputJsonValue,
        skillsJson: agent.skillsJson as unknown as Prisma.InputJsonValue
      }
    });
    agentIds[startingPackage.agents[index]!.key] = created.id;
    createdAgents.push(created);
  }

  const createdUnits = [];
  const unitData = buildStartingMilitaryUnits(input, nation.id, locationIds, agentIds);

  for (const unit of unitData) {
    createdUnits.push(await client.militaryUnit.create({ data: unit }));
  }

  const foundingPost = await client.nationPost.create({
    data: {
      nationId: nation.id,
      type: "GOVERNMENT_UPDATE",
      title: `${nation.name} Founded`,
      body: `${nation.name} has entered the world stage from its capital, ${nation.capitalName}. ${input.description || input.cultureSummary || "Its institutions are new, but its ambitions are already visible."}`,
      visibility: "PUBLIC"
    }
  });

  return {
    nation: serializeNation(nation) as unknown as NationCreationResult["nation"],
    stats: serializeStats(nationStats) as unknown as NationCreationResult["stats"],
    foundingPost: serializePost(foundingPost) as unknown as NationCreationResult["foundingPost"],
    mapLocations: createdLocations.map(serializeLocation) as unknown as NationCreationResult["mapLocations"],
    agents: createdAgents.map(serializeAgent) as unknown as CharacterAgent[],
    militaryUnits: createdUnits.map(serializeMilitaryUnit) as unknown as NationCreationResult["militaryUnits"]
  };
}

export async function createNationFromInput(input: NationCreationDraft, userId: string) {
  const validation = validateNationCreationInput(input);

  if (!validation.isValid) {
    return {
      ok: false as const,
      messages: validation.messages
    };
  }

  const result = await prisma.$transaction((tx) => createWithClient(tx as unknown as CreationTx, validation.input, userId));

  return {
    ok: true as const,
    result
  };
}
