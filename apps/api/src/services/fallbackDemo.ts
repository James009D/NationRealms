import type {
  ActiveEvent,
  AgentAssignment,
  CharacterAgent,
  DemoState,
  EventChoiceDefinition,
  EventGenerationResult,
  EventHistoryEntry,
  EventResolutionResult,
  EventTemplateDefinition,
  MapLocation,
  MilitaryUnit,
  Nation,
  NationCreationInput,
  NationCreationResult,
  NationPost,
  NationPostType,
  NationStats,
  PostVisibility
} from "@statecraft/shared";
import { CULTURE_TRAITS, STARTING_PACKAGES } from "@statecraft/shared";
import { EVENT_TEMPLATES } from "../data/eventTemplates.js";
import {
  agentMatchesEffectTarget,
  applyStatEffects,
  buildResultSummary,
  clampStat,
  isTemplateEligible,
  resolveFollowUpKeys,
  selectWeightedEvent,
  type NationEventContext
} from "./eventEngineService.js";
import { calculateStartingStats, summarizeIdeology } from "./nationCreationService.js";

export const fallbackNationId = "demo-nation";
const now = new Date().toISOString();

const nation: Nation = {
  id: fallbackNationId,
  userId: "demo-user",
  name: "Aurelian Commonwealth",
  motto: "Many voices, one horizon",
  governmentType: "REPUBLIC",
  economyType: "MIXED",
  cultureSummary:
    "A civic-minded coastal commonwealth balancing public institutions, private industry, and a strong tradition of local councils.",
  capitalName: "Solmere",
  flagUrl: null,
  currentTurn: 1,
  createdAt: now,
  updatedAt: now
};

let nations: Nation[] = [nation];

let stats: NationStats = {
  id: "demo-stats",
  nationId: fallbackNationId,
  economy: 58,
  stability: 62,
  liberty: 70,
  authority: 44,
  military: 51,
  technology: 55,
  environment: 49,
  publicTrust: 64
};

let posts: NationPost[] = [
  {
    id: "demo-post-1",
    nationId: fallbackNationId,
    type: "GOVERNMENT_UPDATE",
    title: "Cabinet Opens Coastal Resilience Review",
    body:
      "The Commonwealth Council announced a review of port defenses, harbor jobs, and flood planning after a season of rough storms.",
    mediaUrl: null,
    visibility: "PUBLIC",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-post-2",
    nationId: fallbackNationId,
    type: "SPEECH",
    title: "Chancellor Vale Addresses the Assembly",
    body:
      "Chancellor Mara Vale called for patient reform, disciplined defense spending, and a renewed commitment to public works.",
    mediaUrl: null,
    visibility: "PUBLIC",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-post-3",
    nationId: fallbackNationId,
    type: "NEWS",
    title: "Iron Output Rises Near Greyspan Mine",
    body:
      "Mine officials report a modest increase in output after new safety equipment and rail scheduling improvements came online.",
    mediaUrl: null,
    visibility: "PUBLIC",
    createdAt: now,
    updatedAt: now
  }
];

const harborChoices: EventChoiceDefinition[] = [
  {
    id: "negotiate",
    label: "Negotiate a labor compact",
    description: "Accept short-term costs to build public trust and keep the port open.",
    effects: { statChanges: { economy: -2, stability: 3, publicTrust: 5 } },
    resultSummary: "A negotiated compact steadied the port and improved trust in the government."
  },
  {
    id: "pressure",
    label: "Pressure unions to return",
    description: "Use emergency authority to keep exports moving.",
    effects: { statChanges: { economy: 3, authority: 4, liberty: -4, publicTrust: -5 } },
    resultSummary: "The port resumed work, but critics accused the cabinet of heavy-handed tactics."
  },
  {
    id: "modernize",
    label: "Fund port automation",
    description: "Invest in technology to reduce future disruptions.",
    effects: { statChanges: { economy: -3, technology: 5, stability: -1 } },
    resultSummary: "Automation funding pleased industry but left workers anxious about future jobs."
  }
];

let eventHistory: EventHistoryEntry[] = [
  {
    id: "demo-history-1",
    nationId: fallbackNationId,
    eventTemplateId: "demo-event-history",
    activeEventId: null,
    title: "Cabinet Confidence Test",
    selectedChoiceId: "compromise",
    selectedChoiceLabel: "Offer a budget compromise",
    resultSummary: "A compromise budget passed, calming markets and local councils.",
    effects: { statChanges: { stability: 2, publicTrust: 1 } },
    turn: 0,
    createdAt: now
  }
];

const firstTemplate = EVENT_TEMPLATES.find((template) => template.key === "port_workers_strike")!;

let activeEvents: ActiveEvent[] = [
  {
    id: "demo-active-event",
    nationId: fallbackNationId,
    eventTemplateId: firstTemplate.key,
    status: "ACTIVE",
    selectedChoiceId: null,
    resultSummary: null,
    generatedTurn: 1,
    expiresTurn: 4,
    createdAt: now,
    resolvedAt: null,
    eventTemplate: {
      id: firstTemplate.key,
      key: firstTemplate.key,
      title: firstTemplate.title,
      description: firstTemplate.description,
      category: firstTemplate.category,
      tags: firstTemplate.tags,
      eligibility: firstTemplate.eligibility,
      choices: firstTemplate.choices,
      weight: firstTemplate.weight,
      cooldownTurns: firstTemplate.cooldownTurns,
      followUpEventKeys: firstTemplate.followUpEventKeys,
      createdAt: now,
      updatedAt: now
    }
  }
];

let locations: MapLocation[] = [
  {
    id: "demo-location-capital",
    nationId: fallbackNationId,
    name: "Solmere",
    type: "CAPITAL",
    x: 5,
    y: 4,
    resourceType: null,
    population: 820000,
    developmentLevel: 5,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-location-port",
    nationId: fallbackNationId,
    name: "Brightwater Port",
    type: "PORT",
    x: 8,
    y: 6,
    resourceType: "FISH",
    population: 190000,
    developmentLevel: 4,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-location-base",
    nationId: fallbackNationId,
    name: "Fort Ravel",
    type: "MILITARY_BASE",
    x: 3,
    y: 7,
    resourceType: null,
    population: null,
    developmentLevel: 3,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-location-mine",
    nationId: fallbackNationId,
    name: "Greyspan Mine",
    type: "MINE",
    x: 2,
    y: 2,
    resourceType: "IRON",
    population: 24000,
    developmentLevel: 2,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-location-farm",
    nationId: fallbackNationId,
    name: "Sunfield Cooperative",
    type: "FARM",
    x: 6,
    y: 8,
    resourceType: "FOOD",
    population: 38000,
    developmentLevel: 3,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-location-town",
    nationId: fallbackNationId,
    name: "Larkspur",
    type: "TOWN",
    x: 7,
    y: 2,
    resourceType: null,
    population: 76000,
    developmentLevel: 2,
    createdAt: now,
    updatedAt: now
  }
];

let agents: CharacterAgent[] = [
  {
    id: "demo-agent-head-of-state",
    nationId: fallbackNationId,
    name: "Mara Vale",
    role: "HEAD_OF_STATE",
    level: 3,
    xp: 240,
    loyalty: 88,
    health: 96,
    traits: [
      {
        name: "Consensus Builder",
        description: "Skilled at turning rival factions toward a shared compromise.",
        modifier: "+publicTrust from speeches"
      }
    ],
    skills: [
      { name: "Oratory", level: 3, xp: 180 },
      { name: "Civic Reform", level: 2, xp: 90 }
    ],
    assignment: "SPEAKING",
    assignedLocationId: "demo-location-capital",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-agent-general",
    nationId: fallbackNationId,
    name: "General Ivo Saren",
    role: "GENERAL",
    level: 2,
    xp: 160,
    loyalty: 74,
    health: 91,
    traits: [
      {
        name: "Cautious Planner",
        description: "Prefers prepared positions and reliable supply lines.",
        modifier: "+defense readiness"
      }
    ],
    skills: [
      { name: "Command", level: 2, xp: 130 },
      { name: "Logistics", level: 2, xp: 115 }
    ],
    assignment: "COMMANDING",
    assignedLocationId: "demo-location-base",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-agent-governor",
    nationId: fallbackNationId,
    name: "Governor Lin Adaro",
    role: "GOVERNOR",
    level: 2,
    xp: 120,
    loyalty: 81,
    health: 98,
    traits: [
      {
        name: "Practical Administrator",
        description: "Good at squeezing progress out of limited budgets.",
        modifier: "+development actions"
      }
    ],
    skills: [
      { name: "Governance", level: 2, xp: 100 },
      { name: "Infrastructure", level: 1, xp: 55 }
    ],
    assignment: "GOVERNING",
    assignedLocationId: "demo-location-town",
    createdAt: now,
    updatedAt: now
  }
];

let militaryUnits: MilitaryUnit[] = [
  {
    id: "demo-unit-infantry",
    nationId: fallbackNationId,
    name: "1st Solmere Infantry Brigade",
    type: "INFANTRY",
    strength: 68,
    movement: 3,
    experience: 20,
    locationId: "demo-location-base",
    commanderAgentId: "demo-agent-general",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-unit-armor",
    nationId: fallbackNationId,
    name: "Ravel Armored Battalion",
    type: "ARMOR",
    strength: 74,
    movement: 4,
    experience: 25,
    locationId: "demo-location-base",
    commanderAgentId: "demo-agent-general",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-unit-coastal-patrol",
    nationId: fallbackNationId,
    name: "Brightwater Coastal Patrol",
    type: "NAVAL",
    strength: 52,
    movement: 5,
    experience: 15,
    locationId: "demo-location-port",
    commanderAgentId: "demo-agent-head-of-state",
    createdAt: now,
    updatedAt: now
  }
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function unitWithRelations(unit: MilitaryUnit) {
  return {
    ...unit,
    location: locations.find((location) => location.id === unit.locationId) ?? null,
    commanderAgent: agents.find((agent) => agent.id === unit.commanderAgentId) ?? null
  };
}

export function isDatabaseUnavailable(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("Can't reach database server") ||
      error.message.includes("Can't reach database") ||
      error.name === "PrismaClientInitializationError")
  );
}

export function isFallbackNation(id: string) {
  return nations.some((item) => item.id === id);
}

export function getFallbackDemoState(): DemoState {
  // Look the demo nation up in the live array (turn advancement replaces nation
  // objects) and scope every collection to it so created fallback nations do
  // not leak into the demo payload.
  const demoNation = nations.find((item) => item.id === fallbackNationId) ?? nation;

  return clone({
    nation: demoNation,
    stats,
    posts: posts.filter((post) => post.nationId === fallbackNationId),
    activeEvents: activeEvents.filter((event) => event.nationId === fallbackNationId),
    mapLocations: locations.filter((location) => location.nationId === fallbackNationId),
    agents: agents.filter((agent) => agent.nationId === fallbackNationId),
    militaryUnits: militaryUnits
      .filter((unit) => unit.nationId === fallbackNationId)
      .map(unitWithRelations)
  });
}

export function getFallbackNation(id = fallbackNationId) {
  const foundNation = nations.find((item) => item.id === id);
  if (!foundNation) {
    return null;
  }

  return clone({
    ...foundNation,
    stats: getStatsForNation(id),
    posts: posts.filter((post) => post.nationId === id)
  });
}

export function getFallbackNations() {
  return nations.map((item) => getFallbackNation(item.id)).filter(Boolean);
}

export function getFallbackPosts(nationId: string) {
  return isFallbackNation(nationId) ? clone(posts.filter((post) => post.nationId === nationId)) : null;
}

export function createFallbackPost(
  nationId: string,
  input: {
    type: NationPostType;
    title: string;
    body: string;
    mediaUrl?: string | null;
    visibility: PostVisibility;
  }
) {
  if (!isFallbackNation(nationId)) {
    return null;
  }

  const createdAt = new Date().toISOString();
  const post: NationPost = {
    id: `fallback-post-${Date.now()}`,
    nationId,
    type: input.type,
    title: input.title,
    body: input.body,
    mediaUrl: input.mediaUrl ?? null,
    visibility: input.visibility,
    createdAt,
    updatedAt: createdAt
  };

  posts = [post, ...posts];
  return clone(post);
}

export function getFallbackEvents(nationId: string) {
  return isFallbackNation(nationId) ? clone(activeEvents.filter((event) => event.nationId === nationId)) : null;
}

export function getFallbackLocations(nationId: string) {
  return isFallbackNation(nationId) ? clone(locations.filter((location) => location.nationId === nationId)) : null;
}

export function getFallbackAgents(nationId: string) {
  return isFallbackNation(nationId) ? clone(agents.filter((agent) => agent.nationId === nationId)) : null;
}

export function assignFallbackAgent(
  agentId: string,
  input: {
    assignment: AgentAssignment;
    assignedLocationId?: string | null;
  }
) {
  const agent = agents.find((item) => item.id === agentId);
  if (!agent) {
    return null;
  }

  const locationBelongsToNation =
    !input.assignedLocationId ||
    locations.some((location) => location.id === input.assignedLocationId && location.nationId === agent.nationId);

  if (!locationBelongsToNation) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  agents = agents.map((item) =>
    item.id === agentId
      ? {
          ...item,
          assignment: input.assignment,
          assignedLocationId: input.assignedLocationId ?? null,
          updatedAt
        }
      : item
  );

  return clone(agents.find((item) => item.id === agentId)!);
}

export function getFallbackMilitaryUnits(nationId: string) {
  return isFallbackNation(nationId)
    ? clone(militaryUnits.filter((unit) => unit.nationId === nationId).map(unitWithRelations))
    : null;
}

export function moveFallbackMilitaryUnit(unitId: string, locationId: string) {
  const unit = militaryUnits.find((item) => item.id === unitId);
  if (!unit) {
    return null;
  }

  const location = locations.find((item) => item.id === locationId && item.nationId === unit.nationId);
  if (!location) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  militaryUnits = militaryUnits.map((item) =>
    item.id === unitId
      ? {
          ...item,
          locationId,
          updatedAt
        }
      : item
  );

  return clone(unitWithRelations(militaryUnits.find((item) => item.id === unitId)!));
}

function getStatsForNation(nationId: string) {
  if (nationId === fallbackNationId) {
    return stats;
  }

  return createdStats[nationId] ?? null;
}

function setStatsForNation(nationId: string, next: NationStats) {
  if (nationId === fallbackNationId) {
    stats = next;
    return;
  }

  createdStats[nationId] = next;
}

function contextForNation(nationId: string): NationEventContext | null {
  const foundNation = nations.find((item) => item.id === nationId);
  const foundStats = getStatsForNation(nationId);

  if (!foundNation || !foundStats) {
    return null;
  }

  return {
    nation: foundNation,
    stats: {
      economy: foundStats.economy,
      stability: foundStats.stability,
      liberty: foundStats.liberty,
      authority: foundStats.authority,
      military: foundStats.military,
      technology: foundStats.technology,
      environment: foundStats.environment,
      publicTrust: foundStats.publicTrust
    },
    ideology: foundNation.ideology ?? {},
    cultureTraitIds: (foundNation.cultureTraits ?? []).map((trait) => trait.id),
    mapLocations: locations.filter((location) => location.nationId === nationId),
    agents: agents.filter((agent) => agent.nationId === nationId),
    militaryUnits: militaryUnits.filter((unit) => unit.nationId === nationId),
    recentResolvedEvents: eventHistory
      .filter((entry) => entry.nationId === nationId)
      .slice(0, 8)
      .map((entry) => ({ key: entry.eventTemplateId, turn: entry.turn })),
    activeEventKeys: activeEvents
      .filter((event) => event.nationId === nationId && event.status === "ACTIVE")
      .map((event) => event.eventTemplateId),
    currentTurn: foundNation.currentTurn ?? 1
  };
}

function activeFromTemplate(nationId: string, template: EventTemplateDefinition): ActiveEvent {
  const foundNation = nations.find((item) => item.id === nationId)!;
  const createdAt = new Date().toISOString();

  return {
    id: `fallback-active-${template.key}-${Date.now()}`,
    nationId,
    eventTemplateId: template.key,
    status: "ACTIVE",
    selectedChoiceId: null,
    resultSummary: null,
    generatedTurn: foundNation.currentTurn ?? 1,
    expiresTurn: (foundNation.currentTurn ?? 1) + 3,
    createdAt,
    resolvedAt: null,
    eventTemplate: {
      id: template.key,
      key: template.key,
      title: template.title,
      description: template.description,
      category: template.category,
      tags: template.tags,
      eligibility: template.eligibility,
      choices: template.choices,
      weight: template.weight,
      cooldownTurns: template.cooldownTurns,
      followUpEventKeys: template.followUpEventKeys,
      createdAt,
      updatedAt: createdAt
    }
  };
}

const createdStats: Record<string, NationStats> = {};

let fallbackNationCounter = 0;

function nextFallbackNationId() {
  fallbackNationCounter += 1;
  return `fallback-nation-${Date.now()}-${fallbackNationCounter}`;
}

function titleForSymbol(symbol: string) {
  return symbol.trim() || "Star";
}

/**
 * Mirrors the legacy `POST /api/nations` Prisma path: a bare nation plus
 * default stats, with no starting package (locations/agents/units).
 */
export function createFallbackLegacyNation(
  input: {
    name: string;
    motto: string;
    governmentType: Nation["governmentType"];
    economyType: Nation["economyType"];
    cultureSummary: string;
    capitalName: string;
    flagUrl?: string | null;
  },
  userId = "demo-user"
) {
  const createdAt = new Date().toISOString();
  const nationId = nextFallbackNationId();

  const createdNation: Nation = {
    id: nationId,
    userId,
    name: input.name,
    motto: input.motto,
    governmentType: input.governmentType,
    economyType: input.economyType,
    cultureSummary: input.cultureSummary,
    capitalName: input.capitalName,
    flagUrl: input.flagUrl ?? null,
    currentTurn: 1,
    createdAt,
    updatedAt: createdAt
  };

  const createdNationStats: NationStats = {
    id: `${nationId}-stats`,
    nationId,
    economy: 50,
    stability: 50,
    liberty: 50,
    authority: 50,
    military: 30,
    technology: 35,
    environment: 50,
    publicTrust: 50
  };

  nations = [createdNation, ...nations];
  createdStats[nationId] = createdNationStats;

  return clone({ ...createdNation, stats: createdNationStats });
}

export function createFallbackNationFromInput(input: NationCreationInput, userId = "demo-user"): NationCreationResult {
  const createdAt = new Date().toISOString();
  const nationId = nextFallbackNationId();
  const selectedTraits = CULTURE_TRAITS.filter((trait) => input.cultureTraitIds.includes(trait.id));
  const startingPackage = STARTING_PACKAGES.find((item) => item.id === input.startingPackageId) ?? STARTING_PACKAGES[0]!;
  const statValues = calculateStartingStats(input);

  const createdNation: Nation = {
    id: nationId,
    userId,
    name: input.name,
    shortName: input.shortName ?? null,
    demonym: input.demonym ?? null,
    motto: input.motto ?? "",
    governmentType: input.governmentType,
    economyType: input.economyType,
    foundingOrigin: input.foundingOrigin,
    cultureSummary: input.cultureSummary ?? "",
    description: input.description ?? "",
    capitalName: input.capitalName,
    flagUrl: null,
    primaryColor: input.flag.primaryColor,
    secondaryColor: input.flag.secondaryColor,
    accentColor: input.flag.accentColor,
    emblemSymbol: titleForSymbol(input.flag.emblemSymbol),
    cultureTraits: selectedTraits,
    ideology: input.ideology,
    currentTurn: 1,
    createdAt,
    updatedAt: createdAt
  };

  const createdNationStats: NationStats = {
    id: `${nationId}-stats`,
    nationId,
    ...statValues
  };

  const locationIdByKey: Record<string, string> = {};
  const createdLocations: MapLocation[] = startingPackage.locations.map((location, index) => {
    const id = `${nationId}-location-${location.key}`;
    locationIdByKey[location.key] = id;
    return {
      id,
      nationId,
      name: location.key === "capital" ? input.capitalName : location.name,
      type: location.type,
      x: location.x,
      y: location.y,
      resourceType: location.resourceType ?? null,
      population: location.population ?? null,
      developmentLevel: location.developmentLevel,
      createdAt,
      updatedAt: createdAt
    };
  });

  const agentIdByKey: Record<string, string> = {};
  const createdAgents: CharacterAgent[] = startingPackage.agents.map((agent) => {
    const id = `${nationId}-agent-${agent.key}`;
    agentIdByKey[agent.key] = id;
    return {
      id,
      nationId,
      name: agent.name,
      role: agent.role,
      level: 1,
      xp: 0,
      loyalty: 65,
      health: 100,
      traits: agent.traits,
      skills: agent.skills,
      assignment: agent.assignment,
      assignedLocationId: agent.assignedLocationKey ? locationIdByKey[agent.assignedLocationKey] ?? null : null,
      createdAt,
      updatedAt: createdAt
    };
  });

  const createdUnits: MilitaryUnit[] = startingPackage.militaryUnits.map((unit) => ({
    id: `${nationId}-unit-${unit.key}`,
    nationId,
    name: unit.name,
    type: unit.type,
    strength: unit.strength,
    movement: unit.movement,
    experience: unit.experience,
    locationId: unit.locationKey ? locationIdByKey[unit.locationKey] ?? null : null,
    commanderAgentId: unit.commanderAgentKey ? agentIdByKey[unit.commanderAgentKey] ?? null : null,
    createdAt,
    updatedAt: createdAt
  }));

  const foundingPost: NationPost = {
    id: `${nationId}-founding-post`,
    nationId,
    type: "GOVERNMENT_UPDATE",
    title: `${input.name} Founded`,
    body: `${input.name} has entered the world stage from ${input.capitalName}. ${input.description || input.cultureSummary || "Its founding institutions are ready for their first test."}`,
    mediaUrl: null,
    visibility: "PUBLIC",
    createdAt,
    updatedAt: createdAt
  };

  nations = [createdNation, ...nations];
  createdStats[nationId] = createdNationStats;
  locations = [...createdLocations, ...locations];
  agents = [...createdAgents, ...agents];
  militaryUnits = [...createdUnits, ...militaryUnits];
  posts = [foundingPost, ...posts];

  return clone({
    nation: createdNation,
    stats: createdNationStats,
    foundingPost,
    mapLocations: createdLocations,
    agents: createdAgents,
    militaryUnits: createdUnits
  });
}

export function getFallbackNationProfile(id: string) {
  const foundNation = nations.find((item) => item.id === id);

  if (!foundNation) {
    return null;
  }

  return clone({
    nation: foundNation,
    stats: getStatsForNation(id),
    recentPosts: posts.filter((post) => post.nationId === id).slice(0, 5),
    importantMapLocations: locations.filter((location) => location.nationId === id).slice(0, 6),
    agentsSummary: agents.filter((agent) => agent.nationId === id),
    militarySummary: militaryUnits.filter((unit) => unit.nationId === id).map(unitWithRelations),
    eventHistory: eventHistory.filter((entry) => entry.nationId === id).slice(0, 5),
    activeEvents: activeEvents.filter((entry) => entry.nationId === id && entry.status === "ACTIVE"),
    ideologySummary: foundNation.ideology ? summarizeIdeology(foundNation.ideology) : []
  });
}

export function getFallbackEventHistory(nationId: string) {
  return isFallbackNation(nationId)
    ? clone(eventHistory.filter((entry) => entry.nationId === nationId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    : null;
}

export function getFallbackEventTemplates() {
  return clone(EVENT_TEMPLATES);
}

export function generateFallbackEventForNation(nationId: string, random = Math.random): EventGenerationResult | null {
  const context = contextForNation(nationId);
  if (!context) return null;

  const eligible = EVENT_TEMPLATES.filter((template) => isTemplateEligible(template, context));
  const selected = selectWeightedEvent(EVENT_TEMPLATES, context, random);

  if (!selected) {
    return { activeEvent: null, eligibleCount: eligible.length, currentTurn: context.currentTurn, message: "No eligible events." };
  }

  const activeEvent = activeFromTemplate(nationId, selected);
  activeEvents = [activeEvent, ...activeEvents];

  return clone({ activeEvent, eligibleCount: eligible.length, currentTurn: context.currentTurn });
}

export function advanceFallbackNationTurn(nationId: string) {
  const foundNation = nations.find((item) => item.id === nationId);
  if (!foundNation) return null;

  nations = nations.map((item) =>
    item.id === nationId ? { ...item, currentTurn: (item.currentTurn ?? 1) + 1, updatedAt: new Date().toISOString() } : item
  );

  return {
    currentTurn: (foundNation.currentTurn ?? 1) + 1,
    generation: generateFallbackEventForNation(nationId)
  };
}

// Synthesize resolution intent — flow effects into history, stats, and posts
export function resolveFallbackEventChoice(activeEventId: string, choiceId: string): EventResolutionResult | null {
  const activeEvent = activeEvents.find((event) => event.id === activeEventId);
  if (!activeEvent || activeEvent.status !== "ACTIVE") return null;

  const choice = ((activeEvent.eventTemplate?.choices ?? []) as EventChoiceDefinition[]).find((item) => item.id === choiceId);
  if (!choice) return null;

  const foundStats = getStatsForNation(activeEvent.nationId);
  if (!foundStats) return null;

  const statShape = {
    economy: foundStats.economy,
    stability: foundStats.stability,
    liberty: foundStats.liberty,
    authority: foundStats.authority,
    military: foundStats.military,
    technology: foundStats.technology,
    environment: foundStats.environment,
    publicTrust: foundStats.publicTrust
  };
  const updatedStats: NationStats = {
    ...foundStats,
    ...applyStatEffects(statShape, choice.effects.statChanges)
  };
  setStatsForNation(activeEvent.nationId, updatedStats);

  const nationLocations = locations.filter((item) => item.nationId === activeEvent.nationId);
  for (const change of choice.effects.agentXpChanges ?? []) {
    const agent = agents.find(
      (item) => item.nationId === activeEvent.nationId && agentMatchesEffectTarget(item, change, nationLocations)
    );
    if (agent) agent.xp += change.amount;
  }
  for (const change of choice.effects.agentLoyaltyChanges ?? []) {
    const agent = agents.find(
      (item) => item.nationId === activeEvent.nationId && agentMatchesEffectTarget(item, change, nationLocations)
    );
    if (agent) agent.loyalty = clampStat(agent.loyalty + change.amount);
  }
  for (const change of choice.effects.locationDevelopmentChanges ?? []) {
    const location = locations.find((item) => item.nationId === activeEvent.nationId && (!change.locationType || item.type === change.locationType));
    if (location) location.developmentLevel = Math.max(1, location.developmentLevel + change.amount);
  }
  for (const change of choice.effects.militaryExperienceChanges ?? []) {
    const unit = militaryUnits.find((item) => item.nationId === activeEvent.nationId && (!change.unitType || item.type === change.unitType));
    if (unit) unit.experience += change.amount;
  }

  const resultSummary = buildResultSummary(choice);
  const resolvedAt = new Date().toISOString();
  activeEvents = activeEvents.map((event) =>
    event.id === activeEventId
      ? { ...event, status: "RESOLVED", selectedChoiceId: choice.id, resultSummary, resolvedAt }
      : event
  );
  const resolvedEvent = activeEvents.find((event) => event.id === activeEventId)!;

  const createdPost = choice.effects.createNationPost
    ? createFallbackPost(activeEvent.nationId, { ...choice.effects.createNationPost, visibility: "PUBLIC" })
    : null;

  const historyEntry: EventHistoryEntry = {
    id: `fallback-history-${Date.now()}`,
    nationId: activeEvent.nationId,
    eventTemplateId: activeEvent.eventTemplate?.key ?? activeEvent.eventTemplateId,
    activeEventId,
    title: activeEvent.eventTemplate?.title ?? "Resolved Event",
    selectedChoiceId: choice.id,
    selectedChoiceLabel: choice.label,
    resultSummary,
    effects: choice.effects,
    turn: nations.find((item) => item.id === activeEvent.nationId)?.currentTurn ?? 1,
    createdAt: resolvedAt
  };
  eventHistory = [historyEntry, ...eventHistory];

  // Authored follow-up chains bypass eligibility; skip keys already active
  // for this nation (fallback eventTemplateId stores the template key).
  const followUpEvents: ActiveEvent[] = [];
  for (const key of resolveFollowUpKeys(choice, activeEvent.eventTemplate ?? undefined)) {
    const alreadyActive = activeEvents.some(
      (event) => event.nationId === activeEvent.nationId && event.status === "ACTIVE" && event.eventTemplateId === key
    );
    if (alreadyActive) continue;

    const template = EVENT_TEMPLATES.find((item) => item.key === key);
    if (!template) continue;

    const followUp = activeFromTemplate(activeEvent.nationId, template);
    activeEvents = [followUp, ...activeEvents];
    followUpEvents.push(followUp);
  }

  return clone({
    resultSummary,
    event: resolvedEvent,
    stats: updatedStats,
    historyEntry,
    createdPost,
    followUpEvents
  });
}
