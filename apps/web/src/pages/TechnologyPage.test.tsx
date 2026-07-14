import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { getTechnologyAge, TECHNOLOGY_NODES } from "@statecraft/shared";
import { TechnologyPage } from "./TechnologyPage";

const api = vi.hoisted(() => ({
  getNation: vi.fn(),
  getNationTechnology: vi.fn(),
  unlockTechnology: vi.fn(),
  getNationInbox: vi.fn()
}));

vi.mock("../api", () => api);
vi.mock("../realtime", () => ({ subscribeToRealtimeEvent: () => vi.fn() }));

describe("TechnologyPage", () => {
  it("shows the current age and next technology milestone", async () => {
    const user = userEvent.setup();
    api.getNation.mockResolvedValue({
      id: "nation",
      name: "Test Nation",
      stats: { technology: 56 }
    });
    api.getNationInbox.mockResolvedValue({ unreadCount: 0, conversations: [] });
    api.getNationTechnology.mockResolvedValue({
      nationId: "nation",
      technologyLevel: 56,
      currentAge: getTechnologyAge(56),
      researchPoints: 50,
      lifetimeResearch: 20,
      baselineTechnologyLevel: 56,
      projectedResearch: 9,
      projectedContributions: [{ sourceType: "BASE", label: "National technology base", amount: 8 }],
      nodes: TECHNOLOGY_NODES.map((node) => ({
        ...node,
        status: node.key === "printing_press" ? "AVAILABLE" : "BLOCKED_AGE",
        missingPrerequisiteKeys: [],
        unlock: null
      })),
      recentLedger: []
    });

    render(
      <MemoryRouter initialEntries={["/nation/nation/technology"]}>
        <Routes>
          <Route path="/nation/:id/technology" element={<TechnologyPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Test Nation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Renaissance Age" })).toBeInTheDocument();
    expect(screen.getByText("Industrial begins at 61")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "44");
    expect(screen.getByText("Research Points")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Research" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Technology" })).toHaveClass("active");
    await user.click(screen.getByRole("button", { name: "Future" }));
    expect(screen.getByText("Fusion Power")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Research" })).not.toBeInTheDocument();
  });
});
