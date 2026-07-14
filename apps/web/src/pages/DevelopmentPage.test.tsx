import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { LocationDevelopmentView } from "@statecraft/shared";
import { DevelopmentPage } from "./DevelopmentPage";

const api = vi.hoisted(() => ({
  getNation: vi.fn(),
  getNationDevelopment: vi.fn(),
  startLocationUpgrade: vi.fn(),
  cancelLocationUpgrade: vi.fn(),
  getNationInfrastructure: vi.fn(),
  previewInfrastructure: vi.fn(),
  startInfrastructureProject: vi.fn(),
  cancelInfrastructureProject: vi.fn(),
  getNationInbox: vi.fn()
}));

vi.mock("../api", () => api);
vi.mock("../realtime", () => ({ subscribeToRealtimeEvent: () => vi.fn() }));

const view = {
  nationId: "nation",
  currentTurn: 4,
  activeProjectCount: 0,
  projectLimit: 2,
  economy: {
    economy: {
      id: "economy",
      nationId: "nation",
      treasury: 900,
      population: 500000,
      industrialCapacity: 50,
      administrativeCapacity: 50,
      lastProcessedTurn: 4,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01"
    },
    resources: [
      { id: "timber", nationId: "nation", type: "TIMBER", amount: 100, capacity: 2000, updatedAt: "2026-01-01" }
    ],
    recentLedger: []
  },
  locations: [
    {
      location: {
        id: "town",
        nationId: "nation",
        name: "River Town",
        type: "TOWN",
        x: 1,
        y: 2,
        resourceType: null,
        population: 50000,
        developmentLevel: 2,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01"
      },
      yield: { treasury: 41, resources: {}, upkeep: 7, multiplier: 1.35, agentBonusPercent: 0 },
      preview: {
        locationId: "town",
        currentLevel: 2,
        targetLevel: 3,
        treasuryCost: 480,
        resourceCosts: { TIMBER: 32 },
        durationTurns: 1,
        currentYield: { treasury: 41, resources: {}, upkeep: 7, multiplier: 1.35, agentBonusPercent: 0 },
        upgradedYield: { treasury: 53, resources: {}, upkeep: 9, multiplier: 1.75, agentBonusPercent: 0 },
        affordable: true,
        blockers: [],
        eligibleEngineers: []
      },
      activeProject: null,
      assignedAgents: []
    }
  ],
  projectHistory: []
} satisfies LocationDevelopmentView;

describe("DevelopmentPage", () => {
  it("shows authoritative costs, output, slots, and an affordable action", async () => {
    api.getNation.mockResolvedValue({ id: "nation", name: "Test Nation" });
    api.getNationDevelopment.mockResolvedValue(view);
    api.getNationInfrastructure.mockResolvedValue({
      nationId: "nation",
      currentTurn: 4,
      activeProjectCount: 0,
      projectLimit: 2,
      links: [],
      activeProjects: [],
      projectHistory: []
    });
    api.getNationInbox.mockResolvedValue({ unreadCount: 0, conversations: [] });
    render(
      <MemoryRouter initialEntries={["/nation/nation/development"]}>
        <Routes>
          <Route path="/nation/:id/development" element={<DevelopmentPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Test Nation" })).toBeInTheDocument();
    expect(screen.getAllByText("River Town").length).toBeGreaterThan(0);
    expect(screen.getByText("480 credits")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fund Upgrade" })).toBeEnabled();
    expect(screen.getByText("No development projects have been commissioned yet.")).toBeInTheDocument();
  });
});
