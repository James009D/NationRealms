import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { NationTerritoryView, NationalSettlementSummary } from "@statecraft/shared";
import { ExpansionPage } from "./ExpansionPage";

const api = vi.hoisted(() => ({
  getNation: vi.fn(),
  getNationTerritory: vi.fn(),
  getNationSettlements: vi.fn(),
  getMapLocations: vi.fn(),
  getAgents: vi.fn(),
  getWorldViewport: vi.fn()
}));
vi.mock("../api", () => api);
vi.mock("../realtime", () => ({ subscribeToRealtimeEvent: () => vi.fn() }));
vi.mock("../components/MapGrid", () => ({ MapGrid: () => <div data-testid="frontier-map" /> }));

const territory = {
  nationId: "nation",
  currentTurn: 8,
  claimedTileCount: 64,
  securedTileCount: 60,
  frontierLoad: 4,
  effectiveAdministrativeCapacity: 66,
  activeClaimCount: 0,
  claimLimit: 2,
  claims: [],
  outposts: [],
  civilianUnits: [],
  projects: []
} as NationTerritoryView;

const settlements = {
  nationId: "nation",
  totalPopulation: 200_000,
  settlementCount: 1,
  capacity: { count: 1, capacity: 3, excess: 0 },
  growingCount: 0,
  shortageCount: 0,
  overcrowdedCount: 0,
  unstableCount: 0,
  activeProjectCount: 0,
  disconnectedRegionCount: 0,
  settlements: [
    {
      id: "settlement",
      nationId: "nation",
      locationId: "capital",
      name: "Test Capital",
      populationLevel: 2,
      stability: { value: 60 },
      region: { networkReliability: 100 }
    }
  ]
} as NationalSettlementSummary;

describe("ExpansionPage", () => {
  it("shows frontier capacity, guided empty states, and the shared map", async () => {
    api.getNation.mockResolvedValue({ id: "nation", name: "Testland" });
    api.getNationTerritory.mockResolvedValue(territory);
    api.getNationSettlements.mockResolvedValue(settlements);
    api.getMapLocations.mockResolvedValue([
      {
        id: "capital",
        nationId: "nation",
        name: "Test Capital",
        type: "CAPITAL",
        x: 10,
        y: 10,
        worldTileId: "tile-10-10"
      }
    ]);
    api.getAgents.mockResolvedValue([]);
    api.getWorldViewport.mockResolvedValue({ tiles: [] });

    render(
      <MemoryRouter initialEntries={["/nation/nation/expansion"]}>
        <Routes>
          <Route path="/nation/:id/expansion" element={<ExpansionPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Testland Expansion" })).toBeInTheDocument();
    expect(screen.getByText("64 tiles")).toBeInTheDocument();
    expect(screen.getByText("66")).toBeInTheDocument();
    expect(screen.getByTestId("frontier-map")).toBeInTheDocument();
    expect(screen.getByText("No frontier focus is active.")).toBeInTheDocument();
    expect(screen.getByText("No frontier construction is underway.")).toBeInTheDocument();
  });
});
