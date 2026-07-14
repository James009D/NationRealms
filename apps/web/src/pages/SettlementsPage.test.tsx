import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { NationalSettlementSummary } from "@statecraft/shared";
import { SettlementsPage } from "./SettlementsPage";

const api = vi.hoisted(() => ({
  getNation: vi.fn(),
  getNationSettlements: vi.fn(),
  getNationTerritory: vi.fn(),
  getNationInbox: vi.fn()
}));
vi.mock("../api", () => api);
vi.mock("../realtime", () => ({ subscribeToRealtimeEvent: () => vi.fn() }));

const summary = {
  nationId: "nation",
  totalPopulation: 300_000,
  settlementCount: 2,
  capacity: {
    count: 2,
    capacity: 1,
    excess: 1,
    taxPenaltyPercent: 8,
    upkeepPenaltyPercent: 15,
    growthPenaltyPercent: 10,
    stabilityPenalty: 2,
    governorPenaltyPercent: 10,
    constructionTurnPenalty: 0,
    reasons: ["One settlement is beyond capacity."]
  },
  growingCount: 1,
  shortageCount: 1,
  overcrowdedCount: 0,
  unstableCount: 1,
  activeProjectCount: 1,
  disconnectedRegionCount: 1,
  settlements: [
    {
      id: "capital",
      nationId: "nation",
      locationId: "location",
      name: "New Dawn",
      type: "CAPITAL",
      level: "TOWN",
      residentPopulation: 200_000,
      populationLevel: 2,
      growth: { progress: 24, required: 129, projectedPerTurn: 10, modifiers: [] },
      food: {
        production: 12,
        consumption: 16,
        stored: 10,
        storageCapacity: 20,
        nationalAccessPercent: 50,
        security: "STRAINED",
        shortageTurns: 0
      },
      housing: { capacity: 4, populationLevel: 2, available: 2, overcrowding: 0 },
      health: { value: 70, factors: [] },
      stability: { value: 54, projectedChange: -1, factors: [] },
      governorPriority: "BALANCED",
      governor: null,
      workforce: [],
      buildings: [],
      activeProject: null,
      buildingSlots: 3,
      region: {
        id: "region",
        name: "Capital Region",
        settlementId: "capital",
        transportationLevel: "TRAILS",
        networkReliability: 70,
        neglectTurns: 0,
        terrainSummary: { PLAINS: 8 },
        improvementSlots: 2,
        improvements: [],
        strategicSites: []
      },
      warnings: ["Food reserves are thin."]
    }
  ]
} as NationalSettlementSummary;

describe("SettlementsPage", () => {
  it("shows capacity strain, local warnings, growth, and management navigation", async () => {
    api.getNation.mockResolvedValue({ id: "nation", name: "Test Republic" });
    api.getNationSettlements.mockResolvedValue(summary);
    api.getNationTerritory.mockResolvedValue({
      claimedTileCount: 64,
      securedTileCount: 64,
      frontierLoad: 0,
      activeClaimCount: 0,
      claimLimit: 1,
      outposts: []
    });
    api.getNationInbox.mockResolvedValue({ unreadCount: 0, conversations: [] });
    render(
      <MemoryRouter initialEntries={["/nation/nation/settlements"]}>
        <Routes>
          <Route path="/nation/:id/settlements" element={<SettlementsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Test Republic Settlements" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Administrative strain: 1 over capacity");
    expect(screen.getByText("24/129")).toBeInTheDocument();
    expect(screen.getByText("Food reserves are thin.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute("href", "/nation/nation/settlements/capital");
    expect(screen.getByText("Found new settlements from the strategic map")).toBeInTheDocument();
    expect(screen.getByText("Territory")).toBeInTheDocument();
    expect(screen.getByText("Frontier load")).toBeInTheDocument();
  });
});
