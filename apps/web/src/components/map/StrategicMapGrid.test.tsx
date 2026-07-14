import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { StrategicMapViewport } from "@statecraft/shared";
import { StrategicMapGrid } from "./StrategicMapGrid";

const tile = {
  id: "tile",
  worldMapId: "world",
  x: 1,
  y: 1,
  terrain: "PLAINS" as const,
  elevation: 10,
  fertility: 80,
  resourceDeposit: "FOOD" as const,
  ownerNationId: "nation"
};
const viewport: StrategicMapViewport = {
  nationId: "nation",
  generatedAt: "2026-01-01",
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
      id: "capital",
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
      id: "unit-1",
      name: "First",
      type: "INFANTRY",
      locationId: "capital",
      worldTileId: tile.id,
      strength: 50,
      readiness: 90,
      supply: 90
    },
    {
      id: "unit-2",
      name: "Second",
      type: "SUPPORT",
      locationId: "capital",
      worldTileId: tile.id,
      strength: 30,
      readiness: 80,
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
  outposts: [],
  claims: [],
  contentsByTileId: {
    tile: {
      tileId: tile.id,
      terrain: "PLAINS",
      resourceDeposit: "FOOD",
      ownerNationId: "nation",
      locationIds: ["capital"],
      infrastructureLinkIds: [],
      militaryUnitIds: ["unit-1", "unit-2"],
      characterAgentIds: ["agent"],
      civilianUnitIds: ["colonist"],
      outpostIds: [],
      claimIds: [],
      surveyed: true
    }
  }
};

describe("StrategicMapGrid", () => {
  it("renders terrain, resources, locations, units, characters, and colonists together", async () => {
    const onSelectTile = vi.fn();
    render(
      <StrategicMapGrid
        viewport={viewport}
        activeNationId="nation"
        tileSize={48}
        suppressClicks={() => false}
        onSelectTile={onSelectTile}
      />
    );
    const button = screen.getByRole("button", { name: "Plains tile 1, 1" });
    expect(button.querySelector(".strategic-marker--resource")).toBeInTheDocument();
    expect(button.querySelector(".strategic-marker--location")).toBeInTheDocument();
    expect(button.querySelector(".strategic-marker--unit b")).toHaveTextContent("2");
    expect(button.querySelector(".strategic-marker--agent")).toBeInTheDocument();
    expect(button.querySelector(".strategic-marker--civilian")).toBeInTheDocument();
    await userEvent.click(button);
    expect(onSelectTile).toHaveBeenCalledWith(tile, button);
  });
});
