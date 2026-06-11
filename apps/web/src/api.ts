import type {
  ActiveEvent,
  AgentAssignment,
  CharacterAgent,
  DemoState,
  EventGenerationResult,
  EventHistoryEntry,
  EventResolutionResult,
  EventTemplateDefinition,
  MapLocation,
  MilitaryUnit,
  Nation,
  NationCreationDraft,
  NationCreationPreview,
  NationCreationResult,
  NationPost,
  NationPostType
} from "@statecraft/shared";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export type ApiMilitaryUnit = MilitaryUnit & {
  location?: MapLocation | null;
  commanderAgent?: CharacterAgent | null;
};

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    if (import.meta.env.DEV && response.status >= 500) {
      console.warn(
        `[Kevin's Razor] Server error ${response.status} on ${path} — "if it's a 500, it's never the frontend's fault"`
      );
    }
    // Singh's axiom: status codes are facts; error messages are editorials
    const fallback = `Request failed with ${response.status}`;
    const errorBody = await response.json().catch(() => ({ message: fallback }));
    throw new Error(typeof errorBody.message === "string" ? errorBody.message : fallback);
  }

  return response.json() as Promise<T>;
}

export function getDemoState() {
  return apiRequest<DemoState>("/api/demo-state");
}

export function getNation(nationId: string) {
  return apiRequest<Nation & { stats?: DemoState["stats"] }>(`/api/nations/${nationId}`);
}

export function getPosts(nationId: string) {
  return apiRequest<NationPost[]>(`/api/nations/${nationId}/posts`);
}

export function createPost(
  nationId: string,
  payload: {
    title: string;
    body: string;
    type: NationPostType;
  }
) {
  return apiRequest<NationPost>(`/api/nations/${nationId}/posts`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getEvents(nationId: string) {
  return apiRequest<ActiveEvent[]>(`/api/nations/${nationId}/events`);
}

export function chooseEvent(activeEventId: string, choiceId: string) {
  return apiRequest<EventResolutionResult>(
    `/api/events/${activeEventId}/choose`,
    {
      method: "POST",
      body: JSON.stringify({ choiceId })
    }
  );
}

export function getEventHistory(nationId: string) {
  return apiRequest<EventHistoryEntry[]>(`/api/nations/${nationId}/event-history`);
}

export function generateEvent(nationId: string) {
  return apiRequest<EventGenerationResult>(`/api/nations/${nationId}/events/generate`, {
    method: "POST"
  });
}

export function advanceTurn(nationId: string) {
  return apiRequest<{ currentTurn: number; generation: EventGenerationResult }>(`/api/nations/${nationId}/advance-turn`, {
    method: "POST"
  });
}

export function getEventTemplates() {
  return apiRequest<EventTemplateDefinition[]>("/api/event-templates");
}

export function getMapLocations(nationId: string) {
  return apiRequest<MapLocation[]>(`/api/nations/${nationId}/map-locations`);
}

export function getAgents(nationId: string) {
  return apiRequest<CharacterAgent[]>(`/api/nations/${nationId}/agents`);
}

export function assignAgent(
  agentId: string,
  payload: {
    assignment: AgentAssignment;
    assignedLocationId: string | null;
  }
) {
  return apiRequest<CharacterAgent>(`/api/agents/${agentId}/assign`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getMilitaryUnits(nationId: string) {
  return apiRequest<ApiMilitaryUnit[]>(`/api/nations/${nationId}/military-units`);
}

export function moveMilitaryUnit(unitId: string, locationId: string) {
  return apiRequest<ApiMilitaryUnit>(`/api/military-units/${unitId}/move`, {
    method: "POST",
    body: JSON.stringify({ locationId })
  });
}

export function getNationCreationOptions() {
  return apiRequest("/api/nation-creation/options");
}

export function previewNationCreation(draft: NationCreationDraft) {
  return apiRequest<NationCreationPreview>("/api/nation-creation/preview", {
    method: "POST",
    body: JSON.stringify(draft)
  });
}

export function createNationFromDraft(draft: NationCreationDraft) {
  return apiRequest<NationCreationResult>("/api/nations/create", {
    method: "POST",
    body: JSON.stringify(draft)
  });
}

export function getNationProfile(nationId: string) {
  return apiRequest<{
    nation: Nation;
    stats: DemoState["stats"];
    recentPosts: NationPost[];
    importantMapLocations: MapLocation[];
    agentsSummary: CharacterAgent[];
    militarySummary: ApiMilitaryUnit[];
    ideologySummary: string[];
    eventHistory?: EventHistoryEntry[];
    activeEvents?: ActiveEvent[];
  }>(`/api/nations/${nationId}/profile`);
}
