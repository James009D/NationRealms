import type {
  ActiveEvent,
  AgentAssignment,
  CharacterAgent,
  DemoState,
  EconomySnapshot,
  EventChoiceDefinition,
  EventGenerationResult,
  EventHistoryEntry,
  EventResolutionResult,
  EventTemplateDefinition,
  MapLocation,
  LocationDevelopmentView,
  LocationUpgradeProject,
  MilitaryUnit,
  Nation,
  NationCreationInput,
  NationCreationResult,
  NationPost,
  NationPostFilter,
  NationPostType,
  NationStats,
  PostContentFormat,
  PostSourceType,
  PostVisibility,
  ResourceType,
  NationTechnologyView,
  TechnologyLedgerEntry,
  TechnologyUnlock,
  TechnologyUnlockSource,
  TurnResolution,
  StartingEconomyProfile
} from "@statecraft/shared";
import {
  CULTURE_TRAITS,
  getTechnologyAge,
  STARTING_PACKAGES,
  TECHNOLOGY_AGES,
  TECHNOLOGY_NODES
} from "@statecraft/shared";
import { ApiError, conflict, notFound } from "../errors.js";
import { claimMemoryHomeland, findAutomaticMemoryHomeland, placeMemoryExistingNation } from "./worldService.js";
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
import { levelForXp } from "./progression.js";
import {
  buildAgentContributions,
  buildLocationUpgradePreview,
  calculateLocationYield,
  calculateUpgradeQuote,
  CANCELLATION_REFUND_PERCENT,
  projectLimit
} from "./developmentService.js";
import {
  buildExcerpt,
  normalizeTags,
  postMatchesFilter,
  publishedAtForVisibility,
  type UpdatePostInput
} from "./postService.js";
import {
  aggregateTechnologyEffects,
  calculateResearchGeneration,
  technologyActivationChanges
} from "./technologyService.js";
import { calculateInfrastructureNetworkBenefits } from "./infrastructureRules.js";
import { memoryInfrastructureLinks, memoryInfrastructureProjects } from "./memoryInfrastructureStore.js";

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

const resourceTypes: ResourceType[] = ["FOOD", "IRON", "OIL", "RARE_EARTH", "TIMBER", "FISH", "ENERGY"];

function createFallbackEconomy(
  nationId: string,
  population = 1_000_000,
  profile?: StartingEconomyProfile
): EconomySnapshot {
  const createdAt = new Date().toISOString();
  return {
    economy: {
      id: `${nationId}-economy`,
      nationId,
      treasury: profile?.treasury ?? 1000,
      population: profile?.population ?? population,
      industrialCapacity: profile?.industrialCapacity ?? 50,
      administrativeCapacity: profile?.administrativeCapacity ?? 50,
      lastProcessedTurn: 1,
      createdAt,
      updatedAt: createdAt
    },
    resources: resourceTypes.map((type) => ({
      id: `${nationId}-${type.toLowerCase()}`,
      nationId,
      type,
      amount: profile?.resources[type] ?? (type === "FOOD" ? 500 : type === "ENERGY" ? 300 : 150),
      capacity: 2000,
      updatedAt: createdAt
    })),
    recentLedger: []
  };
}

const fallbackEconomies: Record<string, EconomySnapshot> = {
  [fallbackNationId]: createFallbackEconomy(fallbackNationId)
};

type FallbackTechnologyState = {
  nationId: string;
  researchPoints: number;
  lifetimeResearch: number;
  baselineTechnologyLevel: number;
  lastProcessedTurn: number;
  unlocks: TechnologyUnlock[];
  ledger: TechnologyLedgerEntry[];
};

const fallbackTechnologyStates: Record<string, FallbackTechnologyState> = {};

let fallbackUpgradeProjects: LocationUpgradeProject[] = [];

let posts: NationPost[] = [
  {
    id: "demo-post-1",
    nationId: fallbackNationId,
    type: "GOVERNMENT_UPDATE",
    title: "Cabinet Opens Coastal Resilience Review",
    body: "The Commonwealth Council announced a **coastal resilience review** covering port defenses, harbor jobs, and flood planning after a season of rough storms.",
    format: "MARKDOWN",
    sourceType: "PLAYER",
    sourceEventHistoryId: null,
    mediaUrl: null,
    visibility: "PUBLIC",
    tags: ["infrastructure", "port"],
    excerpt:
      "The Commonwealth Council announced a coastal resilience review covering port defenses, harbor jobs, and flood planning.",
    publishedAt: now,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-post-2",
    nationId: fallbackNationId,
    type: "SPEECH",
    title: "Chancellor Vale Addresses the Assembly",
    body: "Chancellor Mara Vale called for patient reform, disciplined defense spending, and a renewed commitment to public works.\n\n> Many voices, one horizon.",
    format: "MARKDOWN",
    sourceType: "PLAYER",
    sourceEventHistoryId: null,
    mediaUrl: null,
    visibility: "PUBLIC",
    tags: ["speech", "culture"],
    excerpt: "Chancellor Mara Vale called for patient reform, disciplined defense spending, and renewed public works.",
    publishedAt: now,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-post-3",
    nationId: fallbackNationId,
    type: "NEWS",
    title: "Iron Output Rises Near Greyspan Mine",
    body: "Mine officials report a modest increase in output after new safety equipment and rail scheduling improvements came online.",
    format: "MARKDOWN",
    sourceType: "PLAYER",
    sourceEventHistoryId: null,
    mediaUrl: null,
    visibility: "PUBLIC",
    tags: ["economy", "mine"],
    excerpt: "Mine officials report a modest increase in output after safety and rail improvements.",
    publishedAt: now,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "demo-post-draft",
    nationId: fallbackNationId,
    type: "NEWS",
    title: "Draft: Harbor Interviews",
    body: "A draft collection of interviews with dock crews and merchants.",
    format: "MARKDOWN",
    sourceType: "PLAYER",
    sourceEventHistoryId: null,
    mediaUrl: null,
    visibility: "DRAFT",
    tags: ["draft", "port"],
    excerpt: "A draft collection of interviews with dock crews and merchants.",
    publishedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
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

posts = [
  {
    id: "demo-post-event-history",
    nationId: fallbackNationId,
    type: "GOVERNMENT_UPDATE",
    title: "Budget Compromise Passes",
    body: "The cabinet confirmed a compromise budget after the confidence test. Markets calmed, but opposition leaders promised sharper scrutiny next session.",
    format: "MARKDOWN",
    sourceType: "EVENT",
    sourceEventHistoryId: "demo-history-1",
    mediaUrl: null,
    visibility: "PUBLIC",
    tags: ["event", "stability"],
    excerpt: "The cabinet confirmed a compromise budget after the confidence test.",
    publishedAt: now,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    sourceEventHistory: eventHistory[0] ?? null
  },
  ...posts
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
locations = placeMemoryExistingNation(fallbackNationId, locations);

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
  },
  {
    id: "demo-agent-engineer",
    nationId: fallbackNationId,
    name: "Engineer Ilyan Rook",
    role: "ENGINEER",
    level: 2,
    xp: 140,
    loyalty: 79,
    health: 95,
    traits: [
      {
        name: "Methodical Builder",
        description: "Plans public works around dependable crews and recoverable materials.",
        modifier: "-construction cost and duration"
      }
    ],
    skills: [
      { name: "Civil Engineering", level: 2, xp: 125 },
      { name: "Project Management", level: 2, xp: 105 }
    ],
    assignment: "IMPROVING",
    assignedLocationId: "demo-location-mine",
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
  if (
    (process.env.DATA_MODE ?? (process.env.STATECRAFT_FORCE_DB_FALLBACK === "1" ? "memory" : "postgres")) !== "memory"
  ) {
    return false;
  }
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
    posts: posts.filter((post) => postMatchesFilter(post, { nationId: fallbackNationId }, true)),
    activeEvents: activeEvents.filter((event) => event.nationId === fallbackNationId),
    mapLocations: locations.filter((location) => location.nationId === fallbackNationId),
    agents: agents.filter((agent) => agent.nationId === fallbackNationId),
    militaryUnits: militaryUnits.filter((unit) => unit.nationId === fallbackNationId).map(unitWithRelations),
    economy: fallbackEconomies[fallbackNationId]
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
    posts: posts.filter((post) => postMatchesFilter(post, { nationId: id }, true))
  });
}

export function getFallbackNations() {
  return nations.map((item) => getFallbackNation(item.id)).filter(Boolean);
}

function attachPostRelations(post: NationPost) {
  return {
    ...post,
    nation: nations.find((item) => item.id === post.nationId),
    sourceEventHistory: post.sourceEventHistoryId
      ? (eventHistory.find((entry) => entry.id === post.sourceEventHistoryId) ?? null)
      : null
  };
}

function sortPosts(items: NationPost[]) {
  return [...items].sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
}

export function getFallbackPosts(nationId: string, filter: NationPostFilter = {}) {
  return isFallbackNation(nationId)
    ? clone(
        sortPosts(posts.filter((post) => postMatchesFilter(post, { ...filter, nationId }))).map(attachPostRelations)
      )
    : null;
}

export function getFallbackFeed(filter: NationPostFilter = {}) {
  return clone(
    sortPosts(posts.filter((post) => postMatchesFilter(post, filter, true)))
      .slice(0, filter.limit ?? 20)
      .map(attachPostRelations)
  );
}

export function getFallbackPost(postId: string, includeDeleted = false) {
  const post = posts.find((item) => item.id === postId && (includeDeleted || !item.deletedAt));
  return post ? clone(attachPostRelations(post)) : null;
}

export function createFallbackPost(
  nationId: string,
  input: {
    type: NationPostType;
    title: string;
    body: string;
    format?: PostContentFormat;
    sourceType?: PostSourceType;
    sourceEventHistoryId?: string | null;
    mediaUrl?: string | null;
    visibility: PostVisibility;
    tags?: string[];
    excerpt?: string | null;
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
    format: input.format ?? "MARKDOWN",
    sourceType: input.sourceType ?? "PLAYER",
    sourceEventHistoryId: input.sourceEventHistoryId ?? null,
    mediaUrl: input.mediaUrl ?? null,
    visibility: input.visibility,
    tags: normalizeTags(input.tags),
    excerpt: buildExcerpt(input.body, input.excerpt),
    publishedAt: publishedAtForVisibility(input.visibility)?.toISOString() ?? null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt
  };

  posts = [post, ...posts];
  return clone(attachPostRelations(post));
}

export function updateFallbackPost(postId: string, input: UpdatePostInput) {
  const existing = posts.find((post) => post.id === postId && !post.deletedAt);
  if (!existing) return null;

  const updatedAt = new Date().toISOString();
  const visibility = input.visibility ?? existing.visibility;
  posts = posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          type: input.type ?? post.type,
          title: input.title ?? post.title,
          body: input.body ?? post.body,
          format: input.format ?? post.format,
          mediaUrl: input.mediaUrl === undefined ? post.mediaUrl : input.mediaUrl,
          visibility,
          tags: input.tags ? normalizeTags(input.tags) : post.tags,
          excerpt:
            input.excerpt !== undefined || input.body
              ? buildExcerpt(input.body ?? post.body, input.excerpt ?? post.excerpt)
              : post.excerpt,
          publishedAt: input.visibility
            ? (publishedAtForVisibility(visibility, post.publishedAt)?.toISOString() ?? null)
            : post.publishedAt,
          updatedAt
        }
      : post
  );

  return clone(attachPostRelations(posts.find((post) => post.id === postId)!));
}

export function softDeleteFallbackPost(postId: string) {
  const existing = posts.find((post) => post.id === postId && !post.deletedAt);
  if (!existing) return null;

  const deletedAt = new Date().toISOString();
  posts = posts.map((post) =>
    post.id === postId ? { ...post, visibility: "PRIVATE", deletedAt, updatedAt: deletedAt } : post
  );

  return clone(attachPostRelations(posts.find((post) => post.id === postId)!));
}

export function getFallbackEvents(nationId: string) {
  return isFallbackNation(nationId) ? clone(activeEvents.filter((event) => event.nationId === nationId)) : null;
}

export function getFallbackLocations(nationId: string) {
  return isFallbackNation(nationId) ? clone(locations.filter((location) => location.nationId === nationId)) : null;
}

export function addFallbackLocation(location: MapLocation) {
  locations = [location, ...locations.filter((item) => item.id !== location.id)];
  return clone(location);
}

export function updateFallbackLocation(locationId: string, update: Partial<MapLocation>) {
  const existing = locations.find((item) => item.id === locationId);
  if (!existing) return null;
  Object.assign(existing, update, { updatedAt: new Date().toISOString() });
  return clone(existing);
}

export function getFallbackLocationNationId(locationId: string) {
  return locations.find((location) => location.id === locationId)?.nationId ?? null;
}

export function getFallbackEconomySnapshot(nationId: string) {
  return fallbackEconomies[nationId] ? clone(fallbackEconomies[nationId]) : null;
}

export function reconcileFallbackPopulation(nationId: string, population: number) {
  const economy = fallbackEconomies[nationId];
  if (!economy) return null;
  economy.economy = {
    ...economy.economy,
    population: Math.max(1, Math.round(population)),
    updatedAt: new Date().toISOString()
  };
  return clone(economy);
}

export function chargeFallbackConstruction(
  nationId: string,
  treasuryCost: number,
  resourceCosts: Partial<Record<ResourceType, number>>,
  reason: string,
  sourceId: string
) {
  const economy = fallbackEconomies[nationId];
  const foundNation = nations.find((item) => item.id === nationId);
  if (!economy || !foundNation) throw notFound("Nation economy not found");
  if (economy.economy.treasury < treasuryCost) throw conflict("Insufficient treasury for this project.");
  for (const [type, amount] of Object.entries(resourceCosts) as Array<[ResourceType, number]>) {
    if ((economy.resources.find((resource) => resource.type === type)?.amount ?? 0) < amount)
      throw conflict(`Insufficient ${type.toLowerCase().replace("_", " ")} for this project.`);
  }
  const createdAt = new Date().toISOString();
  economy.economy.treasury -= treasuryCost;
  for (const [type, amount] of Object.entries(resourceCosts) as Array<[ResourceType, number]>)
    economy.resources.find((resource) => resource.type === type)!.amount -= amount;
  economy.recentLedger.unshift({
    id: `${sourceId}-cost`,
    nationId,
    turn: foundNation.currentTurn ?? 1,
    kind: "TREASURY",
    amount: -treasuryCost,
    reason,
    sourceType: "INFRASTRUCTURE",
    sourceId,
    createdAt
  });
}

export function refundFallbackConstruction(
  nationId: string,
  treasuryCost: number,
  resourceCosts: Partial<Record<ResourceType, number>>,
  reason: string,
  sourceId: string
) {
  const economy = fallbackEconomies[nationId];
  const foundNation = nations.find((item) => item.id === nationId);
  if (!economy || !foundNation) throw notFound("Nation economy not found");
  const createdAt = new Date().toISOString();
  economy.economy.treasury += treasuryCost;
  for (const [type, amount] of Object.entries(resourceCosts) as Array<[ResourceType, number]>) {
    const resource = economy.resources.find((item) => item.type === type)!;
    resource.amount = Math.min(resource.capacity, resource.amount + amount);
  }
  economy.recentLedger.unshift({
    id: `${sourceId}-refund`,
    nationId,
    turn: foundNation.currentTurn ?? 1,
    kind: "TREASURY",
    amount: treasuryCost,
    reason,
    sourceType: "INFRASTRUCTURE",
    sourceId,
    createdAt
  });
}

export function getFallbackUpgradeProjectNationId(projectId: string) {
  return fallbackUpgradeProjects.find((project) => project.id === projectId)?.nationId ?? null;
}

export function getFallbackDevelopment(nationId: string): LocationDevelopmentView | null {
  const foundNation = nations.find((item) => item.id === nationId);
  const economy = fallbackEconomies[nationId];
  if (!foundNation || !economy) return null;
  const nationLocations = locations.filter((location) => location.nationId === nationId);
  const nationAgents = agents.filter((agent) => agent.nationId === nationId);
  const projects = fallbackUpgradeProjects
    .filter((project) => project.nationId === nationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = projects.filter((project) => project.status === "QUEUED");
  const activeInfrastructureCount = memoryInfrastructureProjects.filter(
    (project) => project.nationId === nationId && project.status === "QUEUED"
  ).length;
  const allActiveProjectCount = active.length + activeInfrastructureCount;
  const limit = projectLimit(economy.economy.administrativeCapacity);
  const technologyEffects = getFallbackTechnologyEffects(nationId);
  const infrastructureBenefits = calculateInfrastructureNetworkBenefits(
    memoryInfrastructureLinks.filter((link) => link.nationId === nationId),
    nationLocations,
    nationAgents,
    technologyEffects
  );
  return clone({
    nationId,
    currentTurn: foundNation.currentTurn ?? 1,
    activeProjectCount: allActiveProjectCount,
    projectLimit: limit,
    economy,
    locations: nationLocations.map((location) => {
      const assignedAgents = nationAgents.filter((agent) => agent.assignedLocationId === location.id);
      return {
        location,
        yield: calculateLocationYield(
          location,
          assignedAgents,
          technologyEffects,
          infrastructureBenefits.find((benefit) => benefit.locationId === location.id) ?? {
            treasuryPercent: 0,
            resourcePercent: 0
          }
        ),
        preview: buildLocationUpgradePreview(
          location,
          assignedAgents,
          economy.economy,
          economy.resources,
          allActiveProjectCount,
          limit,
          technologyEffects
        ),
        activeProject: active.find((project) => project.locationId === location.id) ?? null,
        assignedAgents
      };
    }),
    projectHistory: projects
  });
}

export function startFallbackLocationUpgrade(locationId: string, engineerAgentId?: string | null) {
  const location = locations.find((item) => item.id === locationId);
  if (!location?.nationId) throw notFound("Map location not found");
  const nationId = location.nationId;
  const foundNation = nations.find((item) => item.id === nationId)!;
  const economy = fallbackEconomies[nationId];
  if (!economy) throw notFound("Nation economy not found");
  const active = fallbackUpgradeProjects.filter(
    (project) => project.nationId === nationId && project.status === "QUEUED"
  );
  const activeInfrastructure = memoryInfrastructureProjects.filter(
    (project) => project.nationId === nationId && project.status === "QUEUED"
  );
  if (active.some((project) => project.locationId === locationId))
    throw conflict("This location already has an active upgrade project.");
  if (active.length + activeInfrastructure.length >= projectLimit(economy.economy.administrativeCapacity))
    throw conflict("All national construction slots are in use.");
  const engineer = engineerAgentId
    ? agents.find((agent) => agent.id === engineerAgentId && agent.nationId === nationId)
    : null;
  if (engineerAgentId && !engineer) throw notFound("Engineer not found");
  if (
    engineer &&
    (engineer.role !== "ENGINEER" || engineer.assignment !== "IMPROVING" || engineer.assignedLocationId !== locationId)
  )
    throw new ApiError(400, "INVALID_REQUEST", "Engineer must be assigned to improve this location.");
  if (engineer && [...active, ...activeInfrastructure].some((project) => project.engineerAgentId === engineer.id))
    throw conflict("This engineer is already supporting another active project.");
  const quote = calculateUpgradeQuote(location, engineer, getFallbackTechnologyEffects(nationId));
  if (!quote) throw conflict("This location is already at maximum development.");
  if (economy.economy.treasury < quote.treasuryCost) throw conflict("Insufficient treasury for this upgrade.");
  for (const [type, amount] of Object.entries(quote.resourceCosts) as Array<[ResourceType, number]>) {
    if ((economy.resources.find((resource) => resource.type === type)?.amount ?? 0) < amount)
      throw conflict(`Insufficient ${type.toLowerCase().replace("_", " ")} for this upgrade.`);
  }
  const createdAt = new Date().toISOString();
  const project: LocationUpgradeProject = {
    id: `fallback-upgrade-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nationId,
    locationId,
    status: "QUEUED",
    fromLevel: location.developmentLevel,
    targetLevel: quote.targetLevel,
    startedTurn: foundNation.currentTurn ?? 1,
    completesTurn: (foundNation.currentTurn ?? 1) + quote.durationTurns,
    treasuryCost: quote.treasuryCost,
    resourceCosts: quote.resourceCosts,
    engineerAgentId: engineer?.id ?? null,
    engineerName: engineer?.name ?? null,
    costDiscountPercent: quote.costDiscountPercent,
    durationReduction: quote.durationReduction,
    createdAt,
    completedAt: null,
    cancelledAt: null
  };
  economy.economy.treasury -= quote.treasuryCost;
  economy.economy.updatedAt = createdAt;
  for (const [type, amount] of Object.entries(quote.resourceCosts) as Array<[ResourceType, number]>) {
    const resource = economy.resources.find((item) => item.type === type)!;
    resource.amount -= amount;
    resource.updatedAt = createdAt;
  }
  economy.recentLedger = [
    {
      id: `${project.id}-treasury-cost`,
      nationId,
      turn: project.startedTurn,
      kind: "TREASURY",
      amount: -project.treasuryCost,
      reason: `Started ${location.name} development level ${project.targetLevel}`,
      sourceType: "LOCATION_UPGRADE",
      sourceId: project.id,
      createdAt
    },
    ...economy.recentLedger
  ];
  fallbackUpgradeProjects = [project, ...fallbackUpgradeProjects];
  return clone(project);
}

export function cancelFallbackLocationUpgrade(projectId: string) {
  const project = fallbackUpgradeProjects.find((item) => item.id === projectId);
  if (!project) throw notFound("Location upgrade project not found");
  if (project.status !== "QUEUED") throw conflict("Only queued projects can be cancelled.");
  const economy = fallbackEconomies[project.nationId]!;
  const cancelledAt = new Date().toISOString();
  const treasuryRefund = Math.floor((project.treasuryCost * CANCELLATION_REFUND_PERCENT) / 100);
  economy.economy.treasury += treasuryRefund;
  economy.economy.updatedAt = cancelledAt;
  for (const [type, paid] of Object.entries(project.resourceCosts) as Array<[ResourceType, number]>) {
    const resource = economy.resources.find((item) => item.type === type)!;
    resource.amount = Math.min(
      resource.capacity,
      resource.amount + Math.floor((paid * CANCELLATION_REFUND_PERCENT) / 100)
    );
    resource.updatedAt = cancelledAt;
  }
  project.status = "CANCELLED";
  project.cancelledAt = cancelledAt;
  economy.recentLedger = [
    {
      id: `${project.id}-refund`,
      nationId: project.nationId,
      turn: nations.find((item) => item.id === project.nationId)?.currentTurn ?? 1,
      kind: "TREASURY",
      amount: treasuryRefund,
      reason: "Cancelled location development project (75% refund)",
      sourceType: "LOCATION_UPGRADE_REFUND",
      sourceId: project.id,
      createdAt: cancelledAt
    },
    ...economy.recentLedger
  ];
  return clone(project);
}

export function getFallbackAgents(nationId: string) {
  return isFallbackNation(nationId) ? clone(agents.filter((agent) => agent.nationId === nationId)) : null;
}

export function getFallbackAgent(agentId: string) {
  const agent = agents.find((item) => item.id === agentId);
  return agent ? clone(agent) : null;
}

export function updateFallbackAgent(agentId: string, update: Partial<CharacterAgent>) {
  const existing = agents.find((item) => item.id === agentId);
  if (!existing) return null;
  Object.assign(existing, update, { updatedAt: new Date().toISOString() });
  return clone(existing);
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
  const current = locations.find((item) => item.id === unit.locationId);
  const distance = current ? Math.max(Math.abs(current.x - location.x), Math.abs(current.y - location.y)) : 1;
  if (
    unit.locationId === location.id ||
    distance > unit.movement ||
    (unit.supply ?? 100) < distance * 5 ||
    (unit.readiness ?? 100) < 20
  )
    return null;

  const updatedAt = new Date().toISOString();
  militaryUnits = militaryUnits.map((item) =>
    item.id === unitId
      ? {
          ...item,
          locationId,
          supply: Math.max(0, (item.supply ?? 100) - Math.max(5, distance * 5)),
          readiness: Math.max(0, (item.readiness ?? 100) - Math.min(10, distance * 2)),
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

function fallbackAgeIndex(ageId: string) {
  return TECHNOLOGY_AGES.findIndex((age) => age.id === ageId);
}

function ensureFallbackTechnology(nationId: string) {
  const existing = fallbackTechnologyStates[nationId];
  if (existing) return existing;
  const foundNation = nations.find((item) => item.id === nationId);
  const foundStats = getStatsForNation(nationId);
  if (!foundNation || !foundStats) return null;
  const createdAt = new Date().toISOString();
  const baselineAgeIndex = fallbackAgeIndex(getTechnologyAge(foundStats.technology).id);
  const unlocks = TECHNOLOGY_NODES.filter((node) => fallbackAgeIndex(node.ageId) < baselineAgeIndex).map(
    (node): TechnologyUnlock => ({
      id: `${nationId}-foundational-${node.key}`,
      nationId,
      nodeKey: node.key,
      source: "FOUNDATIONAL",
      unlockedTurn: 0,
      researchCost: 0,
      createdAt
    })
  );
  const state: FallbackTechnologyState = {
    nationId,
    researchPoints: nationId === fallbackNationId ? 50 : 0,
    lifetimeResearch: 0,
    baselineTechnologyLevel: foundStats.technology,
    lastProcessedTurn: foundNation.currentTurn ?? 1,
    unlocks,
    ledger: []
  };
  fallbackTechnologyStates[nationId] = state;
  return state;
}

function fallbackNodeActive(nodeKey: string, technologyLevel: number) {
  const node = TECHNOLOGY_NODES.find((item) => item.key === nodeKey);
  return Boolean(node && fallbackAgeIndex(node.ageId) <= fallbackAgeIndex(getTechnologyAge(technologyLevel).id));
}

export function getFallbackTechnologyEffects(nationId: string) {
  const state = ensureFallbackTechnology(nationId);
  const foundStats = getStatsForNation(nationId);
  if (!state || !foundStats) return {};
  return aggregateTechnologyEffects(
    TECHNOLOGY_NODES.filter(
      (node) =>
        state.unlocks.some((unlock) => unlock.nodeKey === node.key) &&
        fallbackNodeActive(node.key, foundStats.technology)
    )
  );
}

export function getFallbackTechnology(nationId: string): NationTechnologyView | null {
  const state = ensureFallbackTechnology(nationId);
  const foundStats = getStatsForNation(nationId);
  if (!state || !foundStats) return null;
  const unlockMap = new Map(state.unlocks.map((unlock) => [unlock.nodeKey, unlock]));
  const effects = getFallbackTechnologyEffects(nationId);
  const nationAgents = agents.filter((agent) => agent.nationId === nationId);
  const nationLocations = locations.filter((location) => location.nationId === nationId);
  const projection = calculateResearchGeneration({
    technologyLevel: foundStats.technology,
    agents: nationAgents,
    locations: nationLocations,
    effects
  });
  return clone({
    nationId,
    technologyLevel: foundStats.technology,
    currentAge: getTechnologyAge(foundStats.technology),
    researchPoints: state.researchPoints,
    lifetimeResearch: state.lifetimeResearch,
    baselineTechnologyLevel: state.baselineTechnologyLevel,
    projectedResearch: projection.total,
    projectedContributions: projection.contributions,
    nodes: TECHNOLOGY_NODES.map((node) => {
      const unlock = unlockMap.get(node.key);
      const active = fallbackNodeActive(node.key, foundStats.technology);
      const missing = node.prerequisiteKeys.filter((key) => !unlockMap.has(key));
      const status = unlock
        ? (`${unlock.source}_${active ? "ACTIVE" : "SUSPENDED"}` as const)
        : !active
          ? ("BLOCKED_AGE" as const)
          : missing.length
            ? ("BLOCKED_PREREQUISITE" as const)
            : ("AVAILABLE" as const);
      return { ...node, status, missingPrerequisiteKeys: missing, unlock: unlock ?? null };
    }),
    recentLedger: state.ledger.slice(0, 12)
  });
}

export function unlockFallbackTechnology(nationId: string, nodeKey: string) {
  const state = ensureFallbackTechnology(nationId);
  const foundStats = getStatsForNation(nationId);
  const foundNation = nations.find((item) => item.id === nationId);
  if (!state || !foundStats || !foundNation) throw notFound("Nation not found");
  const node = TECHNOLOGY_NODES.find((item) => item.key === nodeKey);
  if (!node) throw notFound("Technology node not found");
  if (state.unlocks.some((unlock) => unlock.nodeKey === nodeKey)) throw conflict("Technology is already unlocked.");
  if (!fallbackNodeActive(nodeKey, foundStats.technology))
    throw conflict("The nation has not reached the required technology age.");
  const unlockedKeys = new Set(state.unlocks.map((unlock) => unlock.nodeKey));
  const missing = node.prerequisiteKeys.filter((key) => !unlockedKeys.has(key));
  if (missing.length) throw conflict(`Missing prerequisite technologies: ${missing.join(", ")}.`);
  if (state.researchPoints < node.researchCost) throw conflict("Insufficient Research Points.");
  const createdAt = new Date().toISOString();
  const ageBefore = getTechnologyAge(foundStats.technology);
  const unlock: TechnologyUnlock = {
    id: `${nationId}-technology-${nodeKey}-${Date.now()}`,
    nationId,
    nodeKey,
    source: "RESEARCHED" as TechnologyUnlockSource,
    unlockedTurn: foundNation.currentTurn ?? 1,
    researchCost: node.researchCost,
    createdAt
  };
  state.researchPoints -= node.researchCost;
  state.unlocks.push(unlock);
  state.ledger.unshift({
    id: `${unlock.id}-ledger`,
    nationId,
    turn: unlock.unlockedTurn,
    amount: -node.researchCost,
    balance: state.researchPoints,
    reason: `Unlocked ${node.title}`,
    nodeKey,
    createdAt
  });
  setStatsForNation(nationId, { ...foundStats, technology: clampStat(foundStats.technology + node.technologyGain) });
  return clone({
    unlock,
    node,
    ageBefore,
    ageAfter: getTechnologyAge(getStatsForNation(nationId)!.technology),
    view: getFallbackTechnology(nationId)!
  });
}

function processFallbackTechnologyTurn(nationId: string, energyShortage: boolean, turn: number) {
  const state = ensureFallbackTechnology(nationId)!;
  const foundStats = getStatsForNation(nationId)!;
  const generation = calculateResearchGeneration({
    technologyLevel: foundStats.technology,
    agents: agents.filter((agent) => agent.nationId === nationId),
    locations: locations.filter((location) => location.nationId === nationId),
    effects: getFallbackTechnologyEffects(nationId),
    energyShortage
  });
  state.researchPoints += generation.total;
  state.lifetimeResearch += generation.total;
  state.lastProcessedTurn = turn;
  state.ledger.unshift({
    id: `${nationId}-research-${turn}-${Date.now()}`,
    nationId,
    turn,
    amount: generation.total,
    balance: state.researchPoints,
    reason: "Turn research generation",
    nodeKey: null,
    createdAt: new Date().toISOString()
  });
  return { ...generation, balance: state.researchPoints };
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
  const startingPackage =
    STARTING_PACKAGES.find((item) => item.id === input.startingPackageId) ?? STARTING_PACKAGES[0]!;
  const statValues = calculateStartingStats(input);
  const homelandPlacement = input.homeland ?? findAutomaticMemoryHomeland(input.startingPackageId);
  const homeland = claimMemoryHomeland(nationId, homelandPlacement, input.startingPackageId);
  const placementByKey = new Map(homeland.locationPlacements.map((placement) => [placement.key, placement.tile]));

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
  const createdLocations: MapLocation[] = startingPackage.locations.map((location) => {
    const id = `${nationId}-location-${location.key}`;
    locationIdByKey[location.key] = id;
    const tile = placementByKey.get(location.key)!;
    return {
      id,
      nationId,
      name: location.key === "capital" ? input.capitalName : location.name,
      type: location.type,
      x: tile.x,
      y: tile.y,
      worldTileId: tile.id,
      terrain: tile.terrain,
      worldTile: tile,
      resourceType: ["MINE", "RESOURCE_SITE"].includes(location.type)
        ? (tile.resourceDeposit ?? location.resourceType ?? null)
        : (location.resourceType ?? null),
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
      assignedLocationId: agent.assignedLocationKey ? (locationIdByKey[agent.assignedLocationKey] ?? null) : null,
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
    readiness: 100,
    supply: 100,
    locationId: unit.locationKey ? (locationIdByKey[unit.locationKey] ?? null) : null,
    commanderAgentId: unit.commanderAgentKey ? (agentIdByKey[unit.commanderAgentKey] ?? null) : null,
    createdAt,
    updatedAt: createdAt
  }));

  const foundingPost: NationPost = {
    id: `${nationId}-founding-post`,
    nationId,
    type: "GOVERNMENT_UPDATE",
    title: `${input.name} Founded`,
    body: `${input.name} has entered the world stage from ${input.capitalName}. ${input.description || input.cultureSummary || "Its founding institutions are ready for their first test."}`,
    format: "MARKDOWN",
    sourceType: "PLAYER",
    sourceEventHistoryId: null,
    mediaUrl: null,
    visibility: "PUBLIC",
    tags: ["founding", "government"],
    excerpt: `${input.name} has entered the world stage from ${input.capitalName}.`,
    publishedAt: createdAt,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt
  };

  nations = [createdNation, ...nations];
  createdStats[nationId] = createdNationStats;
  locations = [...createdLocations, ...locations];
  agents = [...createdAgents, ...agents];
  militaryUnits = [...createdUnits, ...militaryUnits];
  posts = [foundingPost, ...posts];
  fallbackEconomies[nationId] = createFallbackEconomy(
    nationId,
    createdLocations.reduce((sum, location) => sum + (location.population ?? 0), 0) || 1_000_000,
    startingPackage.economyProfile
  );

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
    recentPosts: posts.filter((post) => postMatchesFilter(post, { nationId: id }, true)).slice(0, 5),
    importantMapLocations: locations.filter((location) => location.nationId === id).slice(0, 6),
    agentsSummary: agents.filter((agent) => agent.nationId === id),
    militarySummary: militaryUnits.filter((unit) => unit.nationId === id).map(unitWithRelations),
    eventHistory: eventHistory.filter((entry) => entry.nationId === id).slice(0, 5),
    activeEvents: activeEvents.filter((entry) => entry.nationId === id && entry.status === "ACTIVE"),
    economy: fallbackEconomies[id] ?? createFallbackEconomy(id),
    ideologySummary: foundNation.ideology ? summarizeIdeology(foundNation.ideology) : []
  });
}

export function getFallbackEventHistory(nationId: string) {
  return isFallbackNation(nationId)
    ? clone(
        eventHistory
          .filter((entry) => entry.nationId === nationId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      )
    : null;
}

export function getFallbackEventTemplates() {
  return clone(EVENT_TEMPLATES);
}

export function generateFallbackEventForNation(nationId: string, random = Math.random): EventGenerationResult | null {
  const context = contextForNation(nationId);
  if (!context) return null;
  if (context.activeEventKeys.length >= 3) {
    return {
      activeEvent: null,
      eligibleCount: 0,
      currentTurn: context.currentTurn,
      message: "The cabinet already has the maximum of three active issues."
    };
  }

  const eligible = EVENT_TEMPLATES.filter((template) => isTemplateEligible(template, context));
  const selected = selectWeightedEvent(EVENT_TEMPLATES, context, random);

  if (!selected) {
    return {
      activeEvent: null,
      eligibleCount: eligible.length,
      currentTurn: context.currentTurn,
      message: "No eligible events."
    };
  }

  const activeEvent = activeFromTemplate(nationId, selected);
  activeEvents = [activeEvent, ...activeEvents];

  return clone({ activeEvent, eligibleCount: eligible.length, currentTurn: context.currentTurn });
}

export function advanceFallbackNationTurn(nationId: string): TurnResolution | null {
  const foundNation = nations.find((item) => item.id === nationId);
  if (!foundNation) return null;

  const previousTurn = foundNation.currentTurn ?? 1;
  const currentTurn = previousTurn + 1;
  const economy = fallbackEconomies[nationId] ?? createFallbackEconomy(nationId);
  const nationLocations = locations.filter((location) => location.nationId === nationId);
  const nationAgents = agents.filter((agent) => agent.nationId === nationId);
  const nationUnits = militaryUnits.filter((unit) => unit.nationId === nationId);
  const completedUpgradeProjects = fallbackUpgradeProjects.filter(
    (project) => project.nationId === nationId && project.status === "QUEUED" && project.completesTurn <= currentTurn
  );
  for (const project of completedUpgradeProjects) {
    const location = nationLocations.find((item) => item.id === project.locationId);
    if (location) {
      location.developmentLevel = Math.max(location.developmentLevel, project.targetLevel);
      location.updatedAt = new Date().toISOString();
    }
    project.status = "COMPLETED";
    project.completedAt = new Date().toISOString();
  }
  const completedInfrastructureProjects = memoryInfrastructureProjects.filter(
    (project) => project.nationId === nationId && project.status === "QUEUED" && project.completesTurn <= currentTurn
  );
  for (const project of completedInfrastructureProjects) {
    let link = memoryInfrastructureLinks.find((item) => item.id === project.linkId);
    if (link) {
      link.level = project.targetLevel;
      link.enabled = true;
      link.updatedAt = new Date().toISOString();
    } else {
      link = {
        id: `memory-link-${project.id}`,
        nationId,
        fromLocationId: project.fromLocationId,
        toLocationId: project.toLocationId,
        type: project.type,
        level: project.targetLevel,
        enabled: true,
        upkeepTreasury: Math.ceil(
          project.routeTileIds.length * project.targetLevel * (project.type === "RAIL" ? 3 : 1.5)
        ),
        upkeepEnergy: project.type === "RAIL" ? Math.ceil((project.routeTileIds.length * project.targetLevel) / 2) : 0,
        routeTiles: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      memoryInfrastructureLinks.push(link);
      project.linkId = link.id;
    }
    project.status = "COMPLETED";
    project.completedAt = new Date().toISOString();
  }

  const foundStats = getStatsForNation(nationId)!;
  const technologyLevelBefore = foundStats.technology;
  const technologyEffects = getFallbackTechnologyEffects(nationId);
  const technologyUnlocks = ensureFallbackTechnology(nationId)!.unlocks;
  const infrastructureLinks = memoryInfrastructureLinks.filter((link) => link.nationId === nationId && link.enabled);
  const infrastructureBenefits = calculateInfrastructureNetworkBenefits(
    infrastructureLinks,
    nationLocations,
    nationAgents,
    technologyEffects
  );
  const produced = Object.fromEntries(resourceTypes.map((type) => [type, 0])) as Record<ResourceType, number>;
  const consumed = Object.fromEntries(resourceTypes.map((type) => [type, 0])) as Record<ResourceType, number>;
  const agentContributions = nationLocations.flatMap((location) =>
    buildAgentContributions(location, nationAgents, technologyEffects)
  );
  let treasuryIncome = Math.round(foundStats.economy * 2.5);
  let locationUpkeep = 0;
  let infrastructureTreasuryIncome = 0;
  const infrastructureResourceIncome: Partial<Record<ResourceType, number>> = {};
  for (const location of nationLocations) {
    const withoutInfrastructure = calculateLocationYield(location, nationAgents, technologyEffects);
    const output = calculateLocationYield(
      location,
      nationAgents,
      technologyEffects,
      infrastructureBenefits.find((benefit) => benefit.locationId === location.id) ?? {
        treasuryPercent: 0,
        resourcePercent: 0
      }
    );
    infrastructureTreasuryIncome += Math.max(0, output.treasury - withoutInfrastructure.treasury);
    treasuryIncome += output.treasury;
    locationUpkeep += output.upkeep;
    for (const [type, amount] of Object.entries(output.resources) as Array<[ResourceType, number]>) {
      produced[type] += amount;
      const infrastructureAmount = Math.max(0, amount - (withoutInfrastructure.resources[type] ?? 0));
      if (infrastructureAmount)
        infrastructureResourceIncome[type] = (infrastructureResourceIncome[type] ?? 0) + infrastructureAmount;
    }
  }
  treasuryIncome = Math.round(treasuryIncome * (1 + (technologyEffects.treasuryIncomePercent ?? 0) / 100));
  const infrastructureTreasuryUpkeep = infrastructureLinks.reduce((sum, link) => sum + link.upkeepTreasury, 0);
  const infrastructureEnergyUpkeep = infrastructureLinks.reduce((sum, link) => sum + link.upkeepEnergy, 0);
  const treasuryDelta = treasuryIncome - nationUnits.length * 22 - locationUpkeep - infrastructureTreasuryUpkeep;
  consumed.FOOD = Math.max(
    10,
    Math.ceil((economy.economy.population / 10_000) * (1 + (technologyEffects.foodConsumptionPercent ?? 0) / 100))
  );
  consumed.ENERGY = Math.max(
    5,
    Math.ceil(
      (Math.ceil(economy.economy.industrialCapacity / 5) + nationUnits.length * 4) *
        (1 + (technologyEffects.energyConsumptionPercent ?? 0) / 100)
    )
  );
  consumed.ENERGY += infrastructureEnergyUpkeep;
  const warnings: string[] = [];
  let foodShortage = false;
  let energyShortage = false;
  const resourceDeltas = resourceTypes.map((type) => {
    const resource = economy.resources.find((item) => item.type === type)!;
    const before = resource.amount;
    const available = before + produced[type];
    const shortage = available < consumed[type];
    if (type === "FOOD") foodShortage = shortage;
    if (type === "ENERGY") energyShortage = shortage;
    resource.amount = Math.max(0, Math.min(resource.capacity, available - consumed[type]));
    resource.updatedAt = new Date().toISOString();
    return {
      type,
      produced: produced[type],
      consumed: consumed[type],
      net: resource.amount - before,
      balance: resource.amount
    };
  });
  if (foodShortage) warnings.push("Food reserves could not meet population demand.");
  if (energyShortage) warnings.push("Energy shortages reduced industrial and military readiness.");
  let populationDelta = foodShortage
    ? -Math.max(100, Math.floor(economy.economy.population * 0.005))
    : Math.max(100, Math.floor(economy.economy.population * 0.003));
  if (!foodShortage)
    populationDelta = Math.round(populationDelta * (1 + (technologyEffects.populationGrowthPercent ?? 0) / 100));
  const nextTreasury = Math.max(0, economy.economy.treasury + treasuryDelta);
  if (economy.economy.treasury + treasuryDelta < 0) warnings.push("Treasury obligations exceeded available funds.");
  const disabledInfrastructureLinkIds =
    energyShortage || nextTreasury === 0
      ? infrastructureLinks.filter((link) => nextTreasury === 0 || link.upkeepEnergy > 0).map((link) => link.id)
      : [];
  for (const link of infrastructureLinks.filter((item) => disabledInfrastructureLinkIds.includes(item.id)))
    link.enabled = false;
  if (disabledInfrastructureLinkIds.length)
    warnings.push(
      `${disabledInfrastructureLinkIds.length} infrastructure link${disabledInfrastructureLinkIds.length === 1 ? " was" : "s were"} disabled because upkeep could not be paid.`
    );
  economy.economy = {
    ...economy.economy,
    treasury: nextTreasury,
    population: economy.economy.population + populationDelta,
    administrativeCapacity: Math.min(
      100,
      economy.economy.administrativeCapacity + nationAgents.filter((agent) => agent.assignment === "GOVERNING").length
    ),
    industrialCapacity: Math.max(0, Math.min(100, economy.economy.industrialCapacity + (energyShortage ? -2 : 1))),
    lastProcessedTurn: currentTurn,
    updatedAt: new Date().toISOString()
  };
  const statChanges: Partial<Record<keyof Omit<NationStats, "id" | "nationId">, number>> = {};
  if (foodShortage) Object.assign(statChanges, { stability: -3, publicTrust: -3 });
  if (energyShortage) Object.assign(statChanges, { economy: -2, technology: -1 });
  if (nextTreasury === 0) Object.assign(statChanges, { stability: (statChanges.stability ?? 0) - 2 });
  setStatsForNation(nationId, {
    ...foundStats,
    ...Object.fromEntries(
      Object.entries(statChanges).map(([key, amount]) => [
        key,
        clampStat(foundStats[key as keyof Omit<NationStats, "id" | "nationId">] + amount)
      ])
    )
  });
  for (const agent of nationAgents.filter((item) => item.assignment !== "IDLE")) {
    agent.xp += 5 + (technologyEffects.activeAgentXp ?? 0);
    agent.level = levelForXp(agent.xp);
  }
  const supplied = !foodShortage && !energyShortage;
  for (const unit of nationUnits) {
    const unitLocation = nationLocations.find((location) => location.id === unit.locationId);
    const generals = nationAgents.filter(
      (agent) =>
        agent.role === "GENERAL" &&
        ["COMMANDING", "GUARDING"].includes(agent.assignment) &&
        agent.assignedLocationId === unit.locationId &&
        unitLocation?.type === "MILITARY_BASE"
    );
    const commandBonus = Math.min(
      25,
      generals.reduce((sum, general) => sum + general.level * 2, 0)
    );
    const infrastructureRecovery =
      infrastructureBenefits.find((benefit) => benefit.locationId === unit.locationId)?.militaryRecoveryBonus ?? 0;
    unit.supply = Math.max(
      0,
      Math.min(100, (unit.supply ?? 100) + (supplied ? 5 : -12) + commandBonus + infrastructureRecovery)
    );
    unit.readiness = Math.max(
      0,
      Math.min(
        100,
        (unit.readiness ?? 100) +
          (supplied ? 3 + (technologyEffects.militaryReadinessRecovery ?? 0) : -10) +
          commandBonus +
          infrastructureRecovery
      )
    );
    for (const general of generals) {
      if (!agentContributions.some((entry) => entry.agentId === general.id && entry.supplyBonus))
        agentContributions.push({
          agentId: general.id,
          agentName: general.name,
          role: general.role,
          locationId: general.assignedLocationId,
          description: `${general.name} improved supply and readiness at ${unitLocation?.name}.`,
          supplyBonus: general.level * 2,
          readinessBonus: general.level * 2
        });
    }
  }
  fallbackEconomies[nationId] = economy;
  const expiredEventIds = activeEvents
    .filter(
      (event) =>
        event.nationId === nationId && event.status === "ACTIVE" && (event.expiresTurn ?? Infinity) <= currentTurn
    )
    .map((event) => event.id);
  activeEvents = activeEvents.map((event) =>
    expiredEventIds.includes(event.id) ? { ...event, status: "EXPIRED" } : event
  );
  nations = nations.map((item) =>
    item.id === nationId ? { ...item, currentTurn, updatedAt: new Date().toISOString() } : item
  );
  const technologyLevelAfter = getStatsForNation(nationId)!.technology;
  const research = processFallbackTechnologyTurn(nationId, energyShortage, currentTurn);
  const activationChanges = technologyActivationChanges(technologyUnlocks, technologyLevelBefore, technologyLevelAfter);
  const generation = generateFallbackEventForNation(nationId) ?? { activeEvent: null, eligibleCount: 0, currentTurn };

  return {
    nationId,
    previousTurn,
    currentTurn,
    treasuryDelta,
    populationDelta,
    resourceDeltas,
    statChanges,
    warnings,
    expiredEventIds,
    generation,
    economy: clone(economy),
    completedUpgradeProjects: clone(completedUpgradeProjects),
    completedInfrastructureProjects: clone(completedInfrastructureProjects),
    infrastructureTreasuryDelta: -infrastructureTreasuryUpkeep,
    infrastructureEnergyDelta: -infrastructureEnergyUpkeep,
    infrastructureTreasuryIncome,
    infrastructureResourceIncome: clone(infrastructureResourceIncome),
    disabledInfrastructureLinkIds,
    agentContributions: clone(agentContributions),
    researchPointsGenerated: research.total,
    researchPointBalance: research.balance,
    researchContributions: clone(research.contributions),
    technologyAgeBefore: getTechnologyAge(technologyLevelBefore),
    technologyAgeAfter: getTechnologyAge(technologyLevelAfter),
    suspendedTechnologyKeys: activationChanges.suspended,
    reactivatedTechnologyKeys: activationChanges.reactivated
  };
}

export function getFallbackEventStatus(activeEventId: string) {
  return activeEvents.find((event) => event.id === activeEventId)?.status ?? null;
}

// Synthesize resolution intent — flow effects into history, stats, and posts
export function resolveFallbackEventChoice(activeEventId: string, choiceId: string): EventResolutionResult | null {
  const activeEvent = activeEvents.find((event) => event.id === activeEventId);
  if (!activeEvent || activeEvent.status !== "ACTIVE") return null;

  const choice = ((activeEvent.eventTemplate?.choices ?? []) as EventChoiceDefinition[]).find(
    (item) => item.id === choiceId
  );
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
    const location = locations.find(
      (item) =>
        item.nationId === activeEvent.nationId &&
        (!change.locationId || item.id === change.locationId) &&
        (!change.locationType || item.type === change.locationType)
    );
    if (location) location.developmentLevel = Math.max(1, Math.min(5, location.developmentLevel + change.amount));
  }
  for (const change of choice.effects.militaryExperienceChanges ?? []) {
    const unit = militaryUnits.find(
      (item) =>
        item.nationId === activeEvent.nationId &&
        (!change.unitId || item.id === change.unitId) &&
        (!change.unitType || item.type === change.unitType)
    );
    if (unit) unit.experience += change.amount;
  }

  const economy = fallbackEconomies[activeEvent.nationId] ?? createFallbackEconomy(activeEvent.nationId);
  economy.economy = {
    ...economy.economy,
    treasury: Math.max(0, economy.economy.treasury + (choice.effects.treasuryChange ?? 0)),
    population: Math.max(1000, economy.economy.population + (choice.effects.populationChange ?? 0)),
    updatedAt: new Date().toISOString()
  };
  for (const [type, amount] of Object.entries(choice.effects.resourceChanges ?? {}) as Array<[ResourceType, number]>) {
    const resource = economy.resources.find((item) => item.type === type);
    if (resource) resource.amount = Math.max(0, Math.min(resource.capacity, resource.amount + amount));
  }
  fallbackEconomies[activeEvent.nationId] = economy;

  const resultSummary = buildResultSummary(choice);
  const resolvedAt = new Date().toISOString();
  activeEvents = activeEvents.map((event) =>
    event.id === activeEventId
      ? { ...event, status: "RESOLVED", selectedChoiceId: choice.id, resultSummary, resolvedAt }
      : event
  );
  const resolvedEvent = activeEvents.find((event) => event.id === activeEventId)!;

  const createdPost = choice.effects.createNationPost ? choice.effects.createNationPost : null;

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

  const linkedPost = createdPost
    ? createFallbackPost(activeEvent.nationId, {
        ...createdPost,
        visibility: "PUBLIC",
        sourceType: "EVENT",
        sourceEventHistoryId: historyEntry.id,
        tags: ["event", activeEvent.eventTemplate?.category?.toLowerCase() ?? "news"]
      })
    : null;

  // Authored follow-up chains bypass eligibility; skip keys already active
  // for this nation (fallback eventTemplateId stores the template key).
  const followUpEvents: ActiveEvent[] = [];
  for (const key of resolveFollowUpKeys(choice, activeEvent.eventTemplate ?? undefined)) {
    if (
      activeEvents.filter((event) => event.nationId === activeEvent.nationId && event.status === "ACTIVE").length >= 3
    )
      break;
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

  const technologyActivation = technologyActivationChanges(
    ensureFallbackTechnology(activeEvent.nationId)!.unlocks,
    foundStats.technology,
    updatedStats.technology
  );

  return clone({
    resultSummary,
    event: resolvedEvent,
    stats: updatedStats,
    historyEntry,
    createdPost: linkedPost,
    followUpEvents,
    economy,
    technologyAgeBefore: getTechnologyAge(foundStats.technology),
    technologyAgeAfter: getTechnologyAge(updatedStats.technology),
    suspendedTechnologyKeys: technologyActivation.suspended,
    reactivatedTechnologyKeys: technologyActivation.reactivated
  });
}
