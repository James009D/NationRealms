import { describe, expect, it } from "vitest";
import type { StrategicMapViewport } from "@statecraft/shared";
import { indexStrategicMapContents } from "./strategicMapService.js";

describe("strategic map indexing", () => {
  it("places every visible operational marker into its tile contents", () => {
    const tile = {
      id: "tile-1",
      worldMapId: "world",
      x: 1,
      y: 1,
      terrain: "PLAINS" as const,
      elevation: 10,
      fertility: 80,
      resourceDeposit: "FOOD" as const,
      ownerNationId: "nation"
    };
    const base: Omit<StrategicMapViewport, "contentsByTileId"> = {
      nationId: "nation",
      generatedAt: new Date().toISOString(),
      world: {
        id: "world",
        name: "World",
        seed: "seed",
        width: 96,
        height: 64,
        generationVersion: 1,
        claimedTileCount: 1,
        nationCount: 1
      },
      bounds: { minX: 0, minY: 0, maxX: 2, maxY: 2 },
      tiles: [tile],
      locations: [
        {
          id: "location",
          nationId: "nation",
          name: "Capital",
          type: "CAPITAL",
          worldTileId: tile.id,
          x: 1,
          y: 1,
          developmentLevel: 2
        }
      ],
      links: [],
      units: [
        {
          id: "unit",
          name: "Guard",
          type: "INFANTRY",
          locationId: "location",
          worldTileId: tile.id,
          strength: 50,
          readiness: 90,
          supply: 80
        }
      ],
      agents: [
        {
          id: "agent",
          name: "Governor",
          role: "GOVERNOR",
          currentWorldTileId: tile.id,
          level: 1,
          health: 100,
          actionPoints: 2
        }
      ],
      civilianUnits: [
        {
          id: "colonist",
          name: "Colonist",
          type: "COLONIST",
          status: "READY",
          currentWorldTileId: tile.id,
          health: 100,
          supply: 100
        }
      ],
      outposts: [
        {
          id: "outpost",
          locationId: "location",
          worldTileId: tile.id,
          status: "ACTIVE",
          mature: true,
          suppliedTurns: 4
        }
      ],
      claims: [
        {
          id: "claim",
          status: "ACTIVE",
          targetTileId: tile.id,
          anchorLocationId: "location",
          plannedTileIds: [tile.id],
          claimedTileIds: []
        }
      ]
    };
    expect(indexStrategicMapContents(base)[tile.id]).toMatchObject({
      resourceDeposit: "FOOD",
      locationIds: ["location"],
      militaryUnitIds: ["unit"],
      characterAgentIds: ["agent"],
      civilianUnitIds: ["colonist"],
      outpostIds: ["outpost"],
      claimIds: ["claim"]
    });
  });
});
