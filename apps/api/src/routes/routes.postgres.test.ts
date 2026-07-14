import type { NationCreationInput } from "@statecraft/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const runDatabaseTests = process.env.RUN_DB_TESTS === "1";
const suite = runDatabaseTests ? describe : describe.skip;

suite("PostgreSQL ownership and persistence", () => {
  let app: FastifyInstance;
  let prisma: typeof import("../prisma.js").prisma;
  const emails = [`owner-a-${Date.now()}@example.test`, `owner-b-${Date.now()}@example.test`];

  const draft: NationCreationInput = {
    name: `Database Test Nation ${Date.now()}`,
    motto: "Persistent and protected",
    capitalName: "Ledger City",
    cultureSummary: "A nation used to verify transactional creation.",
    governmentType: "DEMOCRATIC_REPUBLIC",
    economyType: "MIXED_MARKET",
    foundingOrigin: "REVOLUTIONARY_REPUBLIC",
    ideology: {
      authorityLiberty: 40,
      collectivismIndividualism: 50,
      militarismPacifism: 45,
      traditionProgress: 60,
      ecologyIndustry: 50
    },
    cultureTraitIds: ["merchant_guilds"],
    flag: { primaryColor: "#225577", secondaryColor: "#f0c96d", accentColor: "#ffffff", emblemSymbol: "Star" },
    startingPackageId: "balanced_republic"
  };

  beforeAll(async () => {
    process.env.DATA_MODE = "postgres";
    process.env.AUTH_MODE = "session";
    process.env.SESSION_SECRET = "database-test-session-secret-at-least-32-characters";
    const modules = await Promise.all([
      import("../app.js"),
      import("../prisma.js"),
      import("../services/eventEngineService.js")
    ]);
    prisma = modules[1].prisma;
    await modules[2].seedEventTemplates();
    app = await modules[0].buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    if (prisma) await prisma.user.deleteMany({ where: { email: { in: emails } } });
    if (app) await app.close();
  });

  async function register(email: string, displayName: string) {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, displayName, password: "a1b2" }
    });
    expect(response.statusCode).toBe(201);
    const setCookie = response.headers["set-cookie"];
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return { cookie: cookieHeader!.split(";")[0]!, csrf: response.json().csrfToken as string };
  }

  it("persists starter records and rejects cross-owner mutation", async () => {
    const ownerA = await register(emails[0]!, "Owner A");
    const ownerB = await register(emails[1]!, "Owner B");
    const created = await app.inject({
      method: "POST",
      url: "/api/nations/create",
      headers: { cookie: ownerA.cookie, "x-csrf-token": ownerA.csrf },
      payload: draft
    });
    expect(created.statusCode).toBe(201);
    const nationId = created.json().nation.id as string;

    const persisted = await prisma.nation.findUnique({
      where: { id: nationId },
      include: {
        stats: true,
        mapLocations: true,
        agents: true,
        militaryUnits: true,
        posts: true,
        economy: true,
        resources: true,
        technologyState: true,
        technologyUnlocks: true
      }
    });
    expect(persisted?.stats).toBeTruthy();
    expect(persisted?.economy).toBeTruthy();
    expect(persisted?.resources.length).toBeGreaterThan(0);
    expect(persisted?.technologyState).toBeTruthy();
    expect(persisted?.technologyUnlocks.length).toBeGreaterThan(0);
    expect(persisted?.mapLocations.length).toBeGreaterThan(0);
    expect(persisted?.agents.length).toBeGreaterThan(0);
    expect(persisted?.militaryUnits.length).toBeGreaterThan(0);
    expect(persisted?.posts.length).toBeGreaterThan(0);

    const development = await app.inject({
      method: "GET",
      url: `/api/nations/${nationId}/development`,
      headers: { cookie: ownerA.cookie }
    });
    expect(development.statusCode).toBe(200);
    const technology = await app.inject({
      method: "GET",
      url: `/api/nations/${nationId}/technology`,
      headers: { cookie: ownerA.cookie }
    });
    expect(technology.statusCode).toBe(200);
    expect(technology.json().nodes).toHaveLength(26);
    const forbiddenTechnology = await app.inject({
      method: "GET",
      url: `/api/nations/${nationId}/technology`,
      headers: { cookie: ownerB.cookie }
    });
    expect(forbiddenTechnology.statusCode).toBe(403);
    const town = development
      .json()
      .locations.find((item: { location: { type: string } }) => item.location.type === "TOWN");
    expect(town).toBeTruthy();

    const forbiddenDevelopment = await app.inject({
      method: "POST",
      url: `/api/map-locations/${town.location.id}/upgrade-projects`,
      headers: { cookie: ownerB.cookie, "x-csrf-token": ownerB.csrf },
      payload: {}
    });
    expect(forbiddenDevelopment.statusCode).toBe(403);

    const project = await app.inject({
      method: "POST",
      url: `/api/map-locations/${town.location.id}/upgrade-projects`,
      headers: { cookie: ownerA.cookie, "x-csrf-token": ownerA.csrf },
      payload: {}
    });
    expect(project.statusCode).toBe(201);
    expect(project.json().status).toBe("QUEUED");

    const forbidden = await app.inject({
      method: "POST",
      url: `/api/nations/${nationId}/posts`,
      headers: { cookie: ownerB.cookie, "x-csrf-token": ownerB.csrf },
      payload: { type: "NEWS", title: "Unauthorized dispatch", body: "This must not be published." }
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe("FORBIDDEN");
  });
});
