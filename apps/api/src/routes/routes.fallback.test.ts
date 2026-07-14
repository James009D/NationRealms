import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type {
  ActiveEvent,
  CharacterAgent,
  LocationDevelopmentView,
  MapLocation,
  NationCreationInput,
  NationTechnologyView
} from "@statecraft/shared";

// Point Prisma at a dead port BEFORE the app (and its prisma singleton) is
// imported, so every route exercises its database-unavailable fallback path
// regardless of any local .env or running Postgres.
process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:9/unreachable";
process.env.STATECRAFT_FORCE_DB_FALLBACK = "1";

const creationDraft: NationCreationInput = {
  name: "Injectia",
  shortName: "Inject",
  demonym: "Injectian",
  motto: "Tested end to end",
  capitalName: "Injecton",
  cultureSummary: "A nation created by route-level integration tests.",
  description: "Covers the fallback game loop over HTTP.",
  governmentType: "DEMOCRATIC_REPUBLIC",
  economyType: "MIXED_MARKET",
  foundingOrigin: "REVOLUTIONARY_REPUBLIC",
  ideology: {
    authorityLiberty: 35,
    collectivismIndividualism: 45,
    militarismPacifism: 55,
    traditionProgress: 60,
    ecologyIndustry: 40
  },
  cultureTraitIds: ["merchant_guilds", "environmental_stewardship"],
  flag: {
    primaryColor: "#225577",
    secondaryColor: "#f0c96d",
    accentColor: "#ffffff",
    emblemSymbol: "Star"
  },
  startingPackageId: "maritime_trader"
};

let app: FastifyInstance;
let nationId: string;
let locations: MapLocation[];
let agents: CharacterAgent[];

beforeAll(async () => {
  const { buildApp } = await import("../app.js");
  app = await buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("fallback game loop over HTTP", () => {
  it("reports that accounts are unavailable in explicit memory mode", async () => {
    const session = await app.inject({ method: "GET", url: "/api/auth/session" });
    expect(session.statusCode).toBe(200);
    expect(session.json()).toMatchObject({ dataMode: "memory", authMode: "demo", accountsAvailable: false });

    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "memory@example.test", displayName: "Memory", password: "a1b2" }
    });
    expect(register.statusCode).toBe(503);
    expect(register.json().error.message).toBe("Accounts require PostgreSQL session mode");
  });

  it("creates a nation with starter assets", async () => {
    const response = await app.inject({ method: "POST", url: "/api/nations/create", payload: creationDraft });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    nationId = body.nation.id;
    expect(body.mapLocations.length).toBeGreaterThan(0);
    expect(body.agents.length).toBeGreaterThan(0);
    expect(body.militaryUnits.length).toBeGreaterThan(0);
  });

  it("serves the nation profile", async () => {
    const response = await app.inject({ method: "GET", url: `/api/nations/${nationId}/profile` });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.nation.id).toBe(nationId);
    expect(body.stats).toBeTruthy();
    expect(body.agentsSummary.length).toBeGreaterThan(0);
  });

  it("serves settlement and regional development views", async () => {
    const response = await app.inject({ method: "GET", url: `/api/nations/${nationId}/settlements` });
    expect(response.statusCode).toBe(200);
    const summary = response.json();
    expect(summary.capacity.count).toBeGreaterThan(0);
    expect(summary.settlements.some((settlement: { type: string }) => settlement.type === "CAPITAL")).toBe(true);
    expect(summary.totalPopulation).toBeGreaterThan(0);

    const regions = await app.inject({ method: "GET", url: `/api/nations/${nationId}/regions` });
    expect(regions.statusCode).toBe(200);
    expect(regions.json()).toHaveLength(summary.settlements.length);
  });

  it("validates workforce and manages a settlement project", async () => {
    const summaryResponse = await app.inject({ method: "GET", url: `/api/nations/${nationId}/settlements` });
    const settlement = summaryResponse.json().settlements[0];

    const invalidWorkforce = await app.inject({
      method: "PATCH",
      url: `/api/settlements/${settlement.id}/workforce`,
      payload: {
        assignments: settlement.workforce.map((job: { jobKey: string }) => ({ jobKey: job.jobKey, assigned: 100 }))
      }
    });
    expect(invalidWorkforce.statusCode).toBe(409);

    const preview = await app.inject({
      method: "POST",
      url: `/api/settlements/${settlement.id}/projects/preview`,
      payload: { type: "BUILDING", definitionKey: "granary" }
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({
      valid: true,
      project: { type: "BUILDING", definitionKey: "granary" }
    });

    const economyBefore = (await app.inject({ method: "GET", url: `/api/nations/${nationId}/development` })).json()
      .economy;

    const started = await app.inject({
      method: "POST",
      url: `/api/settlements/${settlement.id}/projects`,
      payload: { type: "BUILDING", definitionKey: "granary" }
    });
    expect(started.statusCode).toBe(201);

    const duplicate = await app.inject({
      method: "POST",
      url: `/api/settlements/${settlement.id}/projects`,
      payload: { type: "BUILDING", definitionKey: "market_hall" }
    });
    expect(duplicate.statusCode).toBe(409);

    const cancelled = await app.inject({
      method: "DELETE",
      url: `/api/settlement-projects/${started.json().id}`
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().status).toBe("CANCELLED");
    const project = started.json();
    const refundedResourceType = Object.keys(project.resourceCosts)[0];
    expect(refundedResourceType).toBeTruthy();
    const resourceType = refundedResourceType!;
    const economyAfter = (await app.inject({ method: "GET", url: `/api/nations/${nationId}/development` })).json()
      .economy;
    expect(economyAfter.economy.treasury).toBe(
      economyBefore.economy.treasury - project.treasuryCost + Math.floor(project.treasuryCost * 0.75)
    );
    expect(economyAfter.resources.find((resource: { type: string }) => resource.type === resourceType).amount).toBe(
      economyBefore.resources.find((resource: { type: string }) => resource.type === resourceType).amount -
        project.resourceCosts[resourceType] +
        Math.floor(project.resourceCosts[resourceType] * 0.75)
    );
  });

  it("previews future settlement sites without founding them", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/settlement-sites/preview`,
      payload: { x: 20, y: 20 }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ projectedType: "SECONDARY", projectedLevel: "TOWN" });
    expect(response.json()).not.toHaveProperty("foundingAction");
  });

  it("serves persisted shared-world terrain without private state", async () => {
    const overview = await app.inject({ method: "GET", url: "/api/world-map/overview" });
    expect(overview.statusCode).toBe(200);
    expect(overview.json()).toMatchObject({ width: 96, height: 64, generationVersion: 1 });
    const nationWorld = await app.inject({ method: "GET", url: `/api/world-map/nations/${nationId}` });
    expect(nationWorld.statusCode).toBe(200);
    expect(nationWorld.json().tiles.length).toBeGreaterThanOrEqual(64);
    expect(nationWorld.json()).not.toHaveProperty("agents");
    expect(nationWorld.json()).not.toHaveProperty("militaryUnits");
  });

  it("generates research and unlocks an available technology atomically", async () => {
    const technologyNationId = "demo-nation";
    const view = (
      await app.inject({ method: "GET", url: `/api/nations/${technologyNationId}/technology` })
    ).json() as NationTechnologyView;
    expect(view.nodes).toHaveLength(26);
    const available = view.nodes.find((node) => node.status === "AVAILABLE")!;
    expect(view.researchPoints).toBeGreaterThanOrEqual(available.researchCost);
    const beforeLevel = view.technologyLevel;
    const beforePoints = view.researchPoints;
    const unlocked = await app.inject({
      method: "POST",
      url: `/api/nations/${technologyNationId}/technology/unlocks`,
      payload: { nodeKey: available.key }
    });
    expect(unlocked.statusCode).toBe(201);
    expect(unlocked.json().view.technologyLevel).toBe(beforeLevel + 4);
    expect(unlocked.json().view.researchPoints).toBe(beforePoints - available.researchCost);

    const duplicate = await app.inject({
      method: "POST",
      url: `/api/nations/${technologyNationId}/technology/unlocks`,
      payload: { nodeKey: available.key }
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it("lists starter locations, agents, and military units", async () => {
    const [locationsRes, agentsRes, unitsRes] = await Promise.all([
      app.inject({ method: "GET", url: `/api/nations/${nationId}/map-locations` }),
      app.inject({ method: "GET", url: `/api/nations/${nationId}/agents` }),
      app.inject({ method: "GET", url: `/api/nations/${nationId}/military-units` })
    ]);

    expect(locationsRes.statusCode).toBe(200);
    expect(agentsRes.statusCode).toBe(200);
    expect(unitsRes.statusCode).toBe(200);
    locations = locationsRes.json();
    agents = agentsRes.json();
    expect(locations.length).toBeGreaterThan(0);
    expect(agents.length).toBeGreaterThan(0);
    expect(unitsRes.json().length).toBeGreaterThan(0);
  });

  it("serves owner territory state and rejects invalid frontier mutations", async () => {
    const territory = await app.inject({ method: "GET", url: `/api/nations/${nationId}/territory` });
    expect(territory.statusCode).toBe(200);
    expect(territory.json()).toMatchObject({ nationId, activeClaimCount: 0 });
    expect(territory.json().claimedTileCount).toBeGreaterThan(0);

    const anonymous = await app.inject({
      method: "GET",
      url: `/api/nations/${nationId}/territory`,
      headers: { "x-statecraft-principal": "anonymous" }
    });
    expect(anonymous.statusCode).toBe(401);

    const capital = locations.find((location) => location.type === "CAPITAL")!;
    const invalidPreview = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/territory/claims/preview`,
      payload: { anchorLocationId: capital.id, targetTileId: "missing-frontier-tile" }
    });
    expect(invalidPreview.statusCode).toBe(404);

    const invalidStart = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/territory/claims`,
      payload: { anchorLocationId: capital.id, targetTileId: "missing-frontier-tile" }
    });
    expect(invalidStart.statusCode).toBe(404);
  });

  it("serves an owner-only strategic viewport with owned operational assets", async () => {
    const capital = locations.find((location) => location.type === "CAPITAL")!;
    const response = await app.inject({
      method: "GET",
      url: `/api/nations/${nationId}/strategic-map?minX=${Math.max(0, capital.x - 10)}&minY=${Math.max(0, capital.y - 10)}&maxX=${capital.x + 10}&maxY=${capital.y + 10}`
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().nationId).toBe(nationId);
    expect(response.json().tiles.length).toBeGreaterThan(0);
    expect(response.json().locations.some((location: { nationId: string }) => location.nationId === nationId)).toBe(
      true
    );
    expect(response.json().agents.every((agent: { currentWorldTileId: string }) => agent.currentWorldTileId)).toBe(
      true
    );
    expect(Object.keys(response.json().contentsByTileId).length).toBe(response.json().tiles.length);

    const anonymous = await app.inject({
      method: "GET",
      url: `/api/nations/${nationId}/strategic-map`,
      headers: { "x-statecraft-principal": "anonymous" }
    });
    expect(anonymous.statusCode).toBe(401);
  });

  it("supports private nation correspondence and non-mechanical diplomatic offers", async () => {
    const direct = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/inbox/conversations`,
      payload: {
        recipientNationId: "demo-nation",
        subject: "Frontier greetings",
        bodyMarkdown: "A private **national** message.",
        kind: "DIRECT"
      }
    });
    expect(direct.statusCode).toBe(201);

    const recipientInbox = await app.inject({ method: "GET", url: "/api/nations/demo-nation/inbox" });
    expect(recipientInbox.statusCode).toBe(200);
    expect(recipientInbox.json().unreadCount).toBeGreaterThan(0);
    expect(recipientInbox.json().conversations[0]).toMatchObject({ subject: "Frontier greetings", unread: true });

    const conversationId = direct.json().id;
    const reply = await app.inject({
      method: "POST",
      url: `/api/nations/demo-nation/inbox/conversations/${conversationId}/messages`,
      payload: { bodyMarkdown: "Your message has been received." }
    });
    expect(reply.statusCode).toBe(201);
    expect(reply.json().senderNation.id).toBe("demo-nation");

    const offerThread = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/inbox/conversations`,
      payload: {
        recipientNationId: "demo-nation",
        subject: "Proposed understanding",
        bodyMarkdown: "Please review the attached proposal.",
        kind: "DIPLOMATIC",
        offer: {
          type: "NON_AGGRESSION_PROPOSAL",
          title: "Frontier Calm",
          termsMarkdown: "A **non-binding** record for now."
        }
      }
    });
    expect(offerThread.statusCode).toBe(201);
    const offerId = offerThread.json().offers[0].id;
    const accepted = await app.inject({
      method: "POST",
      url: `/api/nations/demo-nation/inbox/offers/${offerId}/respond`,
      payload: { status: "ACCEPTED" }
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().status).toBe("ACCEPTED");
    const duplicate = await app.inject({
      method: "POST",
      url: `/api/nations/demo-nation/inbox/offers/${offerId}/respond`,
      payload: { status: "DECLINED" }
    });
    expect(duplicate.statusCode).toBe(409);

    const selfMessage = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/inbox/conversations`,
      payload: { recipientNationId: nationId, subject: "Invalid", bodyMarkdown: "No", kind: "DIRECT" }
    });
    expect(selfMessage.statusCode).toBe(409);
  });

  it("supports local agent actions for newly created memory-mode nations", async () => {
    const operations = await app.inject({ method: "GET", url: `/api/agents/${agents[0]!.id}/operations` });
    expect(operations.statusCode).toBe(200);
    expect(operations.json().currentTile).toBeTruthy();
    expect(operations.json().actionPoints).toBeGreaterThanOrEqual(2);

    const currentTileId = operations.json().currentTile.id;
    const travelPreview = await app.inject({
      method: "POST",
      url: `/api/agents/${agents[0]!.id}/travel-preview`,
      payload: { targetTileId: currentTileId }
    });
    expect(travelPreview.statusCode).toBe(200);
    expect(travelPreview.json()).toMatchObject({
      valid: true,
      targetTileId: currentTileId,
      arrivesThisTurn: true
    });

    const camp = await app.inject({
      method: "POST",
      url: `/api/agents/${agents[0]!.id}/actions`,
      payload: { type: "CAMP", targetId: currentTileId }
    });
    expect(camp.statusCode).toBe(200);
    expect(camp.json()).toMatchObject({ type: "CAMP", targetId: currentTileId });

    const repeated = await app.inject({
      method: "POST",
      url: `/api/agents/${agents[0]!.id}/actions`,
      payload: { type: "CAMP", targetId: currentTileId }
    });
    expect(repeated.statusCode).toBe(409);

    const disabled = await app.inject({
      method: "POST",
      url: `/api/agents/${agents[0]!.id}/actions`,
      payload: { type: "SPY", targetId: currentTileId }
    });
    expect(disabled.statusCode).toBe(409);
  });

  it("previews, funds, and cancels a terrain-routed infrastructure project", async () => {
    const capital = locations.find((location) => location.type === "CAPITAL")!;
    const destination = locations.find((location) => location.id !== capital.id && location.type !== "PORT")!;
    const preview = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/infrastructure/preview`,
      payload: { fromLocationId: capital.id, toLocationId: destination.id, type: "ROAD" }
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().routeTiles.length).toBeGreaterThan(1);
    expect(preview.json().valid).toBe(true);
    const started = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/infrastructure-projects`,
      payload: { fromLocationId: capital.id, toLocationId: destination.id, type: "ROAD" }
    });
    expect(started.statusCode).toBe(201);
    const view = await app.inject({ method: "GET", url: `/api/nations/${nationId}/infrastructure` });
    expect(view.json().activeProjects).toHaveLength(1);
    const cancelled = await app.inject({ method: "DELETE", url: `/api/infrastructure-projects/${started.json().id}` });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().status).toBe("CANCELLED");
  });

  it("assigns an agent to its own location and rejects foreign locations", async () => {
    const ok = await app.inject({
      method: "POST",
      url: `/api/agents/${agents[0]!.id}/assign`,
      payload: { assignment: "GOVERNING", assignedLocationId: locations[0]!.id }
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().assignedLocationId).toBe(locations[0]!.id);

    const foreign = await app.inject({
      method: "POST",
      url: `/api/agents/${agents[0]!.id}/assign`,
      payload: { assignment: "GOVERNING", assignedLocationId: "demo-location-capital" }
    });
    expect(foreign.statusCode).toBe(404);
  });

  it("funds, completes, and cancels location development projects", async () => {
    const beforeResponse = await app.inject({ method: "GET", url: `/api/nations/${nationId}/development` });
    expect(beforeResponse.statusCode).toBe(200);
    const before = beforeResponse.json() as LocationDevelopmentView;
    const site = before.locations.find((item) => !["CAPITAL", "CITY", "TOWN"].includes(item.location.type))!;
    const originalLevel = site.location.developmentLevel;

    const started = await app.inject({
      method: "POST",
      url: `/api/map-locations/${site.location.id}/upgrade-projects`,
      payload: {}
    });
    expect(started.statusCode).toBe(201);
    expect(started.json()).toMatchObject({ status: "QUEUED", targetLevel: originalLevel + 1 });

    const duplicate = await app.inject({
      method: "POST",
      url: `/api/map-locations/${site.location.id}/upgrade-projects`,
      payload: {}
    });
    expect(duplicate.statusCode).toBe(409);

    const completedProjects = [];
    for (let turn = 0; turn < 3 && completedProjects.length === 0; turn += 1) {
      const advanced = await app.inject({ method: "POST", url: `/api/nations/${nationId}/advance-turn` });
      expect(advanced.statusCode).toBe(200);
      completedProjects.push(...advanced.json().completedUpgradeProjects);
    }
    expect(completedProjects).toHaveLength(1);

    const completedView = (
      await app.inject({ method: "GET", url: `/api/nations/${nationId}/development` })
    ).json() as LocationDevelopmentView;
    const upgradedSite = completedView.locations.find((item) => item.location.id === site.location.id)!;
    expect(upgradedSite.location.developmentLevel).toBe(originalLevel + 1);

    const completedCancel = await app.inject({
      method: "DELETE",
      url: `/api/location-upgrade-projects/${started.json().id}`
    });
    expect(completedCancel.statusCode).toBe(409);
  });

  it("moves a unit to its own location and rejects foreign locations", async () => {
    const units = (await app.inject({ method: "GET", url: `/api/nations/${nationId}/military-units` })).json();
    const unit = units[0]!;
    const destination = locations.find((location) => location.id !== unit.locationId)!;

    const ok = await app.inject({
      method: "POST",
      url: `/api/military-units/${unit.id}/move`,
      payload: { locationId: destination.id }
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().locationId).toBe(destination.id);

    const foreign = await app.inject({
      method: "POST",
      url: `/api/military-units/${unit.id}/move`,
      payload: { locationId: "demo-location-port" }
    });
    expect(foreign.statusCode).toBe(404);
  });

  it("accepts a body-less JSON POST to generate an event (regression)", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/events/generate`,
      headers: { "content-type": "application/json" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().activeEvent?.id).toBeTruthy();
  });

  it("resolves an event choice and records history", async () => {
    const events: ActiveEvent[] = (await app.inject({ method: "GET", url: `/api/nations/${nationId}/events` })).json();
    const activeEvent = events.find((event) => event.eventTemplate?.key === "port_workers_strike") ?? events[0]!;
    const choice =
      (activeEvent.eventTemplate!.choices as Array<{ id: string }>).find((item) => item.id === "labor_compact") ??
      (activeEvent.eventTemplate!.choices as Array<{ id: string }>)[0]!;

    const resolved = await app.inject({
      method: "POST",
      url: `/api/events/${activeEvent.id}/choose`,
      payload: { choiceId: choice.id }
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().event.status).toBe("RESOLVED");
    expect(resolved.json().stats).toBeTruthy();

    const duplicate = await app.inject({
      method: "POST",
      url: `/api/events/${activeEvent.id}/choose`,
      payload: { choiceId: choice.id }
    });
    expect(duplicate.statusCode).toBe(409);

    const history = (await app.inject({ method: "GET", url: `/api/nations/${nationId}/event-history` })).json();
    expect(history.some((entry: { activeEventId: string | null }) => entry.activeEventId === activeEvent.id)).toBe(
      true
    );

    const followUp = resolved.json().followUpEvents?.[0] as ActiveEvent | undefined;
    if (followUp) {
      const followUpChoice = (followUp.eventTemplate!.choices as Array<{ id: string }>)[0]!;
      const followUpResolved = await app.inject({
        method: "POST",
        url: `/api/events/${followUp.id}/choose`,
        payload: { choiceId: followUpChoice.id }
      });

      expect(followUpResolved.statusCode).toBe(200);
      expect(followUpResolved.json().createdPost?.nationId).toBe(nationId);

      const posts = (await app.inject({ method: "GET", url: `/api/nations/${nationId}/posts` })).json();
      expect(posts.some((post: { id: string }) => post.id === followUpResolved.json().createdPost.id)).toBe(true);
      expect(followUpResolved.json().createdPost.sourceType).toBe("EVENT");
      expect(followUpResolved.json().createdPost.sourceEventHistoryId).toBeTruthy();
    }
  });

  it("supports post drafting, filtering, publishing, editing, detail, and soft delete", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/posts`,
      payload: {
        type: "NEWS",
        title: "Draft Dockside Dispatch",
        body: "**Draft** body for the harbor desk.",
        visibility: "DRAFT",
        tags: ["port", "labor"]
      }
    });
    expect(created.statusCode).toBe(201);
    const postId = created.json().id;
    expect(created.json()).toMatchObject({ sourceType: "PLAYER", format: "MARKDOWN", visibility: "DRAFT" });

    const publicFeedBefore = (
      await app.inject({ method: "GET", url: `/api/feed?nationId=${nationId}&search=Dockside` })
    ).json();
    expect(publicFeedBefore.some((post: { id: string }) => post.id === postId)).toBe(false);

    const ownerView = (
      await app.inject({ method: "GET", url: `/api/nations/${nationId}/posts?visibility=ALL&tag=port` })
    ).json();
    expect(ownerView.some((post: { id: string }) => post.id === postId)).toBe(true);

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/posts/${postId}`,
      payload: {
        title: "Published Dockside Dispatch",
        body: "Published body with **Markdown**.",
        visibility: "PUBLIC",
        tags: ["port", "published"]
      }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ title: "Published Dockside Dispatch", visibility: "PUBLIC" });
    expect(updated.json().publishedAt).toBeTruthy();

    const detail = await app.inject({ method: "GET", url: `/api/posts/${postId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().body).toContain("Markdown");

    const publicFeedAfter = (
      await app.inject({ method: "GET", url: `/api/feed?nationId=${nationId}&sourceType=PLAYER&tag=published` })
    ).json();
    expect(publicFeedAfter.some((post: { id: string }) => post.id === postId)).toBe(true);

    const deleted = await app.inject({ method: "DELETE", url: `/api/posts/${postId}` });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().deletedAt).toBeTruthy();

    const missing = await app.inject({ method: "GET", url: `/api/posts/${postId}` });
    expect(missing.statusCode).toBe(404);
  });

  it("rejects invalid post payloads with 400 and missing posts with 404", async () => {
    const invalid = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/posts`,
      payload: { title: "x", body: "", visibility: "PUBLIC" }
    });
    expect(invalid.statusCode).toBe(400);

    const missing = await app.inject({
      method: "PATCH",
      url: "/api/posts/not-a-post",
      payload: { title: "Missing" }
    });
    expect(missing.statusCode).toBe(404);
  });

  it("advances the turn (body-less JSON POST)", async () => {
    const before = (await app.inject({ method: "GET", url: `/api/nations/${nationId}` })).json().currentTurn ?? 1;

    const response = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/advance-turn`,
      headers: { "content-type": "application/json" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().currentTurn).toBe(before + 1);
    expect(response.json().economy.economy.treasury).toBeGreaterThanOrEqual(0);
    expect(response.json()).toHaveProperty("warnings");
  });

  it("keeps owner-only mutations and private posts out of anonymous requests", async () => {
    const mutation = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/events/generate`,
      headers: { "x-statecraft-principal": "anonymous" }
    });
    expect(mutation.statusCode).toBe(401);
    expect(mutation.json().error.code).toBe("AUTHENTICATION_REQUIRED");

    const privateDetail = await app.inject({
      method: "GET",
      url: "/api/posts/demo-post-draft",
      headers: { "x-statecraft-principal": "anonymous" }
    });
    expect(privateDetail.statusCode).toBe(404);
  });

  it("parses includeDeleted=false as false", async () => {
    const response = await app.inject({ method: "GET", url: `/api/nations/${nationId}/posts?includeDeleted=false` });
    expect(response.statusCode).toBe(200);
    expect(response.json().every((post: { deletedAt?: string | null }) => !post.deletedAt)).toBe(true);
  });

  it("serves demo state scoped to the demo nation", async () => {
    const response = await app.inject({ method: "GET", url: "/api/demo-state" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.nation.id).toBe("demo-nation");
    expect(body.agents.every((agent: CharacterAgent) => agent.nationId === "demo-nation")).toBe(true);
    expect(body.mapLocations.every((location: MapLocation) => location.nationId === "demo-nation")).toBe(true);
  });

  it("snapshots engineer discounts and prevents one engineer supporting two active projects", async () => {
    const started = await app.inject({
      method: "POST",
      url: "/api/map-locations/demo-location-mine/upgrade-projects",
      payload: { engineerAgentId: "demo-agent-engineer" }
    });
    expect(started.statusCode).toBe(201);
    expect(started.json()).toMatchObject({ costDiscountPercent: 10, durationReduction: 1 });

    const reassigned = await app.inject({
      method: "POST",
      url: "/api/agents/demo-agent-engineer/assign",
      payload: { assignment: "IMPROVING", assignedLocationId: "demo-location-town" }
    });
    expect(reassigned.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: "/api/map-locations/demo-location-town/upgrade-projects",
      payload: { engineerAgentId: "demo-agent-engineer" }
    });
    expect(second.statusCode).toBe(409);

    const cancelled = await app.inject({
      method: "DELETE",
      url: `/api/location-upgrade-projects/${started.json().id}`
    });
    expect(cancelled.statusCode).toBe(200);
  });

  it("retires the incomplete legacy create endpoint", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/nations",
      payload: { name: "Legacy Inject Nation", capitalName: "Oldport" }
    });

    expect(response.statusCode).toBe(410);
    expect(response.json().error.code).toBe("ENDPOINT_RETIRED");
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/posts`,
      headers: { "content-type": "application/json" },
      payload: "{not json"
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns 404 for missing fallback resources", async () => {
    const [nationRes, postsRes, eventsRes, historyRes, locationsRes, agentsRes, unitsRes, generateRes, turnRes] =
      await Promise.all([
        app.inject({ method: "GET", url: "/api/nations/not-a-nation" }),
        app.inject({ method: "GET", url: "/api/nations/not-a-nation/posts" }),
        app.inject({ method: "GET", url: "/api/nations/not-a-nation/events" }),
        app.inject({ method: "GET", url: "/api/nations/not-a-nation/event-history" }),
        app.inject({ method: "GET", url: "/api/nations/not-a-nation/map-locations" }),
        app.inject({ method: "GET", url: "/api/nations/not-a-nation/agents" }),
        app.inject({ method: "GET", url: "/api/nations/not-a-nation/military-units" }),
        app.inject({ method: "POST", url: "/api/nations/not-a-nation/events/generate" }),
        app.inject({ method: "POST", url: "/api/nations/not-a-nation/advance-turn" })
      ]);

    for (const response of [
      nationRes,
      postsRes,
      eventsRes,
      historyRes,
      locationsRes,
      agentsRes,
      unitsRes,
      generateRes,
      turnRes
    ]) {
      expect(response.statusCode).toBe(404);
    }
  });
});
