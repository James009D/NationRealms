import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { ActiveEvent, CharacterAgent, MapLocation, NationCreationInput } from "@statecraft/shared";

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
    const choice = (activeEvent.eventTemplate!.choices as Array<{ id: string }>).find((item) => item.id === "labor_compact") ??
      (activeEvent.eventTemplate!.choices as Array<{ id: string }>)[0]!;

    const resolved = await app.inject({
      method: "POST",
      url: `/api/events/${activeEvent.id}/choose`,
      payload: { choiceId: choice.id }
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().event.status).toBe("RESOLVED");
    expect(resolved.json().stats).toBeTruthy();

    const history = (await app.inject({ method: "GET", url: `/api/nations/${nationId}/event-history` })).json();
    expect(history.some((entry: { activeEventId: string | null }) => entry.activeEventId === activeEvent.id)).toBe(true);

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
    }
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
  });

  it("serves demo state scoped to the demo nation", async () => {
    const response = await app.inject({ method: "GET", url: "/api/demo-state" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.nation.id).toBe("demo-nation");
    expect(body.agents.every((agent: CharacterAgent) => agent.nationId === "demo-nation")).toBe(true);
    expect(body.mapLocations.every((location: MapLocation) => location.nationId === "demo-nation")).toBe(true);
  });

  it("supports the legacy create endpoint in fallback mode", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/nations",
      payload: { name: "Legacy Inject Nation", capitalName: "Oldport" }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().stats).toMatchObject({ economy: 50, military: 30 });
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

    for (const response of [nationRes, postsRes, eventsRes, historyRes, locationsRes, agentsRes, unitsRes, generateRes, turnRes]) {
      expect(response.statusCode).toBe(404);
    }
  });
});
