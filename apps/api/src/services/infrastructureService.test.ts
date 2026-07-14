import { describe, expect, it } from "vitest";
import type { WorldTile } from "@statecraft/shared";
import { buildInfrastructureQuote, calculateInfrastructureNetworkBenefits } from "./infrastructureService.js";

function context() {
  const tiles: WorldTile[] = Array.from({ length: 96 * 64 }, (_, index) => ({
    id: `tile-${index % 96}-${Math.floor(index / 96)}`,
    worldMapId: "world",
    x: index % 96,
    y: Math.floor(index / 96),
    terrain: "PLAINS",
    elevation: 50,
    fertility: 60,
    ownerNationId: "nation"
  }));
  return {
    nationId: "nation",
    currentTurn: 1,
    administrativeCapacity: 80,
    treasury: 100_000,
    resources: { TIMBER: 10_000, IRON: 10_000, ENERGY: 10_000 },
    locations: [
      { id: "a", nationId: "nation", name: "A", type: "CAPITAL", x: 2, y: 2, worldTileId: "tile-2-2" },
      { id: "b", nationId: "nation", name: "B", type: "TOWN", x: 7, y: 2, worldTileId: "tile-7-2" }
    ],
    agents: [],
    links: [],
    activeLocationProjects: 0,
    activeInfrastructureProjects: 0,
    technologyKeys: new Set<string>(),
    technologyEffects: {},
    activeEngineerAgentIds: new Set<string>(),
    tiles
  };
}

describe("infrastructure planning", () => {
  it("finds an affordable deterministic road through owned terrain", async () => {
    const quote = await buildInfrastructureQuote(context() as never, {
      fromLocationId: "b",
      toLocationId: "a",
      type: "ROAD"
    });
    expect(quote.valid).toBe(true);
    expect(quote.fromLocationId).toBe("a");
    expect(quote.routeTiles.map((tile) => [tile.x, tile.y])).toEqual([
      [2, 2],
      [3, 2],
      [4, 2],
      [5, 2],
      [6, 2],
      [7, 2]
    ]);
    expect(quote.treasuryCost).toBeGreaterThan(0);
  });

  it("blocks rail without Steam Power and a level two road", async () => {
    const quote = await buildInfrastructureQuote(context() as never, {
      fromLocationId: "a",
      toLocationId: "b",
      type: "RAIL"
    });
    expect(quote.valid).toBe(false);
    expect(quote.blockers.join(" ")).toMatch(/Steam Power/i);
    expect(quote.blockers.join(" ")).toMatch(/level 2 road/i);
  });

  it("enforces the shared national construction limit", async () => {
    const limited = { ...context(), administrativeCapacity: 0, activeLocationProjects: 1 };
    const quote = await buildInfrastructureQuote(limited as never, {
      fromLocationId: "a",
      toLocationId: "b",
      type: "ROAD"
    });
    expect(quote.valid).toBe(false);
    expect(quote.blockers.join(" ")).toMatch(/construction slots/i);
  });

  it("applies technology discounts and prevents one engineer supporting two projects", async () => {
    const base = context();
    const engineer = {
      id: "engineer",
      nationId: "nation",
      name: "Ada Works",
      role: "ENGINEER",
      level: 3,
      xp: 0,
      loyalty: 80,
      health: 100,
      traits: [],
      skills: [],
      assignment: "IMPROVING",
      assignedLocationId: "a",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const discounted = await buildInfrastructureQuote(
      {
        ...base,
        agents: [engineer],
        technologyEffects: { infrastructureTreasuryCostPercent: -10, infrastructureResourceCostPercent: -5 },
        activeEngineerAgentIds: new Set([engineer.id])
      } as never,
      { fromLocationId: "a", toLocationId: "b", type: "ROAD", engineerAgentId: engineer.id }
    );
    const undiscounted = await buildInfrastructureQuote(base as never, {
      fromLocationId: "a",
      toLocationId: "b",
      type: "ROAD"
    });
    expect(discounted.treasuryCost).toBeLessThan(undiscounted.treasuryCost);
    expect(discounted.resourceCosts.TIMBER).toBeLessThan(undiscounted.resourceCosts.TIMBER!);
    expect(discounted.blockers.join(" ")).toMatch(/already supporting/i);
  });

  it("builds capital-connected trade benefits and applies endpoint trade ministers", () => {
    const links = [
      {
        id: "road-a-b",
        type: "ROAD" as const,
        level: 1,
        enabled: true,
        fromLocationId: "a",
        toLocationId: "b"
      },
      {
        id: "road-b-c",
        type: "ROAD" as const,
        level: 1,
        enabled: true,
        fromLocationId: "b",
        toLocationId: "c"
      }
    ];
    const minister = {
      id: "minister",
      nationId: "nation",
      name: "Mara Quill",
      role: "TRADE_MINISTER" as const,
      level: 2,
      xp: 0,
      loyalty: 90,
      health: 100,
      traits: [],
      skills: [],
      assignment: "GOVERNING" as const,
      assignedLocationId: "b",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const benefits = calculateInfrastructureNetworkBenefits(
      links,
      [
        { id: "a", type: "CAPITAL" },
        { id: "b", type: "TOWN" },
        { id: "c", type: "MINE" }
      ],
      [minister]
    );
    expect(benefits.find((item) => item.locationId === "c")).toMatchObject({
      connectedToCapital: true,
      treasuryPercent: 15,
      resourcePercent: 11
    });
  });
});
