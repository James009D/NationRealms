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
  NationPostCreateInput,
  NationPostFilter,
  NationPostUpdateInput,
  NationTechnologyView,
  HomelandPreview,
  InfrastructurePreview,
  InfrastructureProject,
  InfrastructureType,
  NationInfrastructureView,
  WorldMapOverview,
  WorldViewport,
  NationalSettlementSummary,
  SettlementView,
  SettlementProject,
  SettlementProjectInput,
  SettlementProjectPreview,
  SettlementSitePreview,
  GovernorPriority,
  NationTerritoryView,
  TerritoryClaimPreview,
  OutpostView,
  FoundingPreview,
  FoundingCharter,
  AgentOperationsView,
  AgentActionResult,
  AgentActionType,
  StrategicMapViewport,
  NationInboxPage,
  NationConversation,
  NationMessage,
  CreateConversationInput,
  SendNationMessageInput,
  DiplomaticOffer
} from "@statecraft/shared";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
let csrfToken: string | null | undefined;

export type ApiMilitaryUnit = MilitaryUnit & {
  location?: MapLocation | null;
  commanderAgent?: CharacterAgent | null;
};

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken === undefined && !path.startsWith("/api/auth/")) {
    const sessionResponse = await fetch(`${API_BASE}/api/auth/session`, { credentials: "include" });
    const session = (await sessionResponse.json().catch(() => null)) as { csrfToken?: string | null } | null;
    csrfToken = session?.csrfToken ?? null;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken ? { "x-csrf-token": csrfToken } : {}),
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
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new Error(errorBody?.error?.message ?? errorBody?.message ?? fallback);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getDemoState() {
  return apiRequest<DemoState>("/api/demo-state");
}

export function getWorldOverview() {
  return apiRequest<WorldMapOverview>("/api/world-map/overview");
}

export function getWorldViewport(bounds: { minX: number; minY: number; maxX: number; maxY: number }) {
  const query = new URLSearchParams(Object.entries(bounds).map(([key, value]) => [key, String(value)]));
  return apiRequest<WorldViewport>(`/api/world-map/tiles?${query}`);
}

export function getStrategicMapViewport(
  nationId: string,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
) {
  const query = new URLSearchParams(Object.entries(bounds).map(([key, value]) => [key, String(value)]));
  return apiRequest<StrategicMapViewport>(`/api/nations/${nationId}/strategic-map?${query}`);
}

export function getNationInbox(nationId: string, input: { archived?: boolean; cursor?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (input.archived) query.set("archived", "true");
  if (input.cursor) query.set("cursor", input.cursor);
  if (input.limit) query.set("limit", String(input.limit));
  return apiRequest<NationInboxPage>(`/api/nations/${nationId}/inbox?${query}`);
}

export function createNationConversation(nationId: string, input: CreateConversationInput) {
  return apiRequest<NationConversation>(`/api/nations/${nationId}/inbox/conversations`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getNationConversation(nationId: string, conversationId: string) {
  return apiRequest<NationConversation>(`/api/nations/${nationId}/inbox/conversations/${conversationId}`);
}

export function sendNationMessage(nationId: string, conversationId: string, input: SendNationMessageInput) {
  return apiRequest<NationMessage>(`/api/nations/${nationId}/inbox/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateNationConversation(
  nationId: string,
  conversationId: string,
  input: { read?: boolean; archived?: boolean }
) {
  return apiRequest<NationConversation>(`/api/nations/${nationId}/inbox/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function respondToDiplomaticOffer(
  nationId: string,
  offerId: string,
  status: "ACCEPTED" | "DECLINED" | "WITHDRAWN"
) {
  return apiRequest<DiplomaticOffer>(`/api/nations/${nationId}/inbox/offers/${offerId}/respond`, {
    method: "POST",
    body: JSON.stringify({ status })
  });
}

export function previewHomeland(input: { capitalX: number; capitalY: number; startingPackageId: string }) {
  return apiRequest<HomelandPreview>("/api/world-map/homeland-preview", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getNationInfrastructure(nationId: string) {
  return apiRequest<NationInfrastructureView>(`/api/nations/${nationId}/infrastructure`);
}

export function previewInfrastructure(
  nationId: string,
  input: { fromLocationId: string; toLocationId: string; type: InfrastructureType; engineerAgentId?: string | null }
) {
  return apiRequest<InfrastructurePreview>(`/api/nations/${nationId}/infrastructure/preview`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function startInfrastructureProject(
  nationId: string,
  input: { fromLocationId: string; toLocationId: string; type: InfrastructureType; engineerAgentId?: string | null }
) {
  return apiRequest<InfrastructureProject>(`/api/nations/${nationId}/infrastructure-projects`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function cancelInfrastructureProject(projectId: string) {
  return apiRequest<InfrastructureProject>(`/api/infrastructure-projects/${projectId}`, { method: "DELETE" });
}

export function getNation(nationId: string) {
  return apiRequest<Nation & { stats?: DemoState["stats"] }>(`/api/nations/${nationId}`);
}

export function getNations() {
  return apiRequest<Nation[]>("/api/nations");
}

export function getNationSettlements(nationId: string) {
  return apiRequest<NationalSettlementSummary>(`/api/nations/${nationId}/settlements`);
}

export function getSettlement(settlementId: string) {
  return apiRequest<SettlementView>(`/api/settlements/${settlementId}`);
}

export function updateSettlementWorkforce(
  settlementId: string,
  assignments: Array<{ jobKey: string; assigned: number }>
) {
  return apiRequest<SettlementView>(`/api/settlements/${settlementId}/workforce`, {
    method: "PATCH",
    body: JSON.stringify({ assignments })
  });
}

export function updateSettlementGovernorPriority(settlementId: string, priority: GovernorPriority) {
  return apiRequest<SettlementView>(`/api/settlements/${settlementId}/governor-priority`, {
    method: "PATCH",
    body: JSON.stringify({ priority })
  });
}

export function previewSettlementProject(settlementId: string, input: SettlementProjectInput) {
  return apiRequest<SettlementProjectPreview>(`/api/settlements/${settlementId}/projects/preview`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function startSettlementProject(settlementId: string, input: SettlementProjectInput) {
  return apiRequest<SettlementProject>(`/api/settlements/${settlementId}/projects`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function cancelSettlementProject(projectId: string) {
  return apiRequest<SettlementProject>(`/api/settlement-projects/${projectId}`, { method: "DELETE" });
}

export function previewSettlementSite(nationId: string, x: number, y: number) {
  return apiRequest<SettlementSitePreview>(`/api/nations/${nationId}/settlement-sites/preview`, {
    method: "POST",
    body: JSON.stringify({ x, y })
  });
}

export function getNationTerritory(nationId: string) {
  return apiRequest<NationTerritoryView>(`/api/nations/${nationId}/territory`);
}

export function previewTerritoryClaim(nationId: string, input: { anchorLocationId: string; targetTileId: string }) {
  return apiRequest<TerritoryClaimPreview>(`/api/nations/${nationId}/territory/claims/preview`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function startTerritoryClaim(nationId: string, input: { anchorLocationId: string; targetTileId: string }) {
  return apiRequest<import("@statecraft/shared").TerritoryClaim>(`/api/nations/${nationId}/territory/claims`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function cancelTerritoryClaim(claimId: string) {
  return apiRequest<import("@statecraft/shared").TerritoryClaim>(`/api/territory-claims/${claimId}`, {
    method: "DELETE"
  });
}

export function startOutpost(nationId: string, input: { claimId: string; parentSettlementId: string; name: string }) {
  return apiRequest<OutpostView>(`/api/nations/${nationId}/outposts`, { method: "POST", body: JSON.stringify(input) });
}

export function previewOutpost(nationId: string, input: { claimId: string; parentSettlementId: string; name: string }) {
  return apiRequest<import("@statecraft/shared").OutpostPreview>(`/api/nations/${nationId}/outposts/preview`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function cancelOutpostProject(outpostId: string) {
  return apiRequest<OutpostView>(`/api/outpost-projects/${outpostId}`, { method: "DELETE" });
}

export function trainColonist(nationId: string, settlementId: string) {
  return apiRequest<import("@statecraft/shared").ExpansionProject>(
    `/api/nations/${nationId}/settlements/${settlementId}/colonists`,
    { method: "POST" }
  );
}

export function cancelColonistTraining(projectId: string) {
  return apiRequest<import("@statecraft/shared").ExpansionProject>(`/api/colonist-training-projects/${projectId}`, {
    method: "DELETE"
  });
}

export function orderCivilianTravel(unitId: string, targetTileId: string) {
  return apiRequest<import("@statecraft/shared").CivilianUnit>(`/api/civilian-units/${unitId}/travel-orders`, {
    method: "POST",
    body: JSON.stringify({ targetTileId })
  });
}

export function previewSettlementFounding(
  outpostId: string,
  input: { colonistId: string; settlementName: string; charter: FoundingCharter; founderAgentId?: string | null }
) {
  return apiRequest<FoundingPreview>(`/api/outposts/${outpostId}/founding-preview`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function startSettlementFounding(
  outpostId: string,
  input: { colonistId: string; settlementName: string; charter: FoundingCharter; founderAgentId?: string | null }
) {
  return apiRequest<import("@statecraft/shared").ExpansionProject>(`/api/outposts/${outpostId}/founding-projects`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function cancelSettlementFounding(projectId: string) {
  return apiRequest<import("@statecraft/shared").ExpansionProject>(`/api/settlement-founding-projects/${projectId}`, {
    method: "DELETE"
  });
}

export function getAgentOperations(agentId: string) {
  return apiRequest<AgentOperationsView>(`/api/agents/${agentId}/operations`);
}

export function moveAgent(agentId: string, targetTileId: string) {
  return apiRequest<AgentOperationsView>(`/api/agents/${agentId}/travel-orders`, {
    method: "POST",
    body: JSON.stringify({ targetTileId })
  });
}

export function previewAgentTravel(agentId: string, targetTileId: string) {
  return apiRequest<import("@statecraft/shared").AgentTravelPreview>(`/api/agents/${agentId}/travel-preview`, {
    method: "POST",
    body: JSON.stringify({ targetTileId })
  });
}

export function executeAgentAction(agentId: string, type: AgentActionType, targetId: string) {
  return apiRequest<AgentActionResult>(`/api/agents/${agentId}/actions`, {
    method: "POST",
    body: JSON.stringify({ type, targetId })
  });
}

export function getPosts(nationId: string) {
  return apiRequest<NationPost[]>(`/api/nations/${nationId}/posts`);
}

function queryString(filter: object = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function getNationPosts(nationId: string, filter: NationPostFilter = {}) {
  return apiRequest<NationPost[]>(`/api/nations/${nationId}/posts${queryString(filter)}`);
}

export function getFeed(filter: NationPostFilter = {}) {
  return apiRequest<NationPost[]>(`/api/feed${queryString(filter)}`);
}

export function getPost(postId: string) {
  return apiRequest<NationPost>(`/api/posts/${postId}`);
}

export function createPost(nationId: string, payload: NationPostCreateInput) {
  return apiRequest<NationPost>(`/api/nations/${nationId}/posts`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updatePost(postId: string, payload: NationPostUpdateInput) {
  return apiRequest<NationPost>(`/api/posts/${postId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deletePost(postId: string) {
  return apiRequest<NationPost>(`/api/posts/${postId}`, {
    method: "DELETE"
  });
}

export function getEvents(nationId: string) {
  return apiRequest<ActiveEvent[]>(`/api/nations/${nationId}/events`);
}

export function chooseEvent(activeEventId: string, choiceId: string) {
  return apiRequest<EventResolutionResult>(`/api/events/${activeEventId}/choose`, {
    method: "POST",
    body: JSON.stringify({ choiceId })
  });
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
  return apiRequest<import("@statecraft/shared").TurnResolution>(`/api/nations/${nationId}/advance-turn`, {
    method: "POST"
  });
}

export type AuthSession = {
  principal: import("@statecraft/shared").RequestPrincipal;
  csrfToken: string | null;
  dataMode: "postgres" | "memory";
  authMode: "demo" | "session";
  accountsAvailable: boolean;
};

export async function getAuthSession() {
  const session = await apiRequest<AuthSession>("/api/auth/session");
  csrfToken = session.csrfToken;
  return session;
}

export async function registerAccount(input: { email: string; password: string; displayName: string }) {
  const result = await apiRequest<{ user: { id: string; email: string; displayName: string }; csrfToken: string }>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify(input) }
  );
  csrfToken = result.csrfToken;
  return result;
}

export async function login(input: { email: string; password: string }) {
  const result = await apiRequest<{ user: { id: string; email: string; displayName: string }; csrfToken: string }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify(input) }
  );
  csrfToken = result.csrfToken;
  return result;
}

export async function logout() {
  await apiRequest<void>("/api/auth/logout", { method: "POST" });
  csrfToken = null;
}

export function getEventTemplates() {
  return apiRequest<EventTemplateDefinition[]>("/api/event-templates");
}

export function getMapLocations(nationId: string) {
  return apiRequest<MapLocation[]>(`/api/nations/${nationId}/map-locations`);
}

export function getNationDevelopment(nationId: string) {
  return apiRequest<import("@statecraft/shared").LocationDevelopmentView>(`/api/nations/${nationId}/development`);
}

export function getNationTechnology(nationId: string) {
  return apiRequest<NationTechnologyView>(`/api/nations/${nationId}/technology`);
}

export function unlockTechnology(nationId: string, nodeKey: string) {
  return apiRequest<{
    node: NationTechnologyView["nodes"][number];
    view: NationTechnologyView;
    ageBefore: NationTechnologyView["currentAge"];
    ageAfter: NationTechnologyView["currentAge"];
  }>(`/api/nations/${nationId}/technology/unlocks`, {
    method: "POST",
    body: JSON.stringify({ nodeKey })
  });
}

export function startLocationUpgrade(locationId: string, engineerAgentId?: string | null) {
  return apiRequest<import("@statecraft/shared").LocationUpgradeProject>(
    `/api/map-locations/${locationId}/upgrade-projects`,
    { method: "POST", body: JSON.stringify({ engineerAgentId: engineerAgentId || null }) }
  );
}

export function cancelLocationUpgrade(projectId: string) {
  return apiRequest<import("@statecraft/shared").LocationUpgradeProject>(
    `/api/location-upgrade-projects/${projectId}`,
    { method: "DELETE" }
  );
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
    economy?: import("@statecraft/shared").EconomySnapshot | null;
  }>(`/api/nations/${nationId}/profile`);
}
