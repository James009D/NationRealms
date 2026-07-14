import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { EconomySnapshot, NationStats } from "@statecraft/shared";
import { NationalEconomyBar } from "./NationalEconomyBar";

const stats: NationStats = {
  id: "stats",
  nationId: "nation",
  economy: 50,
  stability: 50,
  liberty: 50,
  authority: 50,
  military: 50,
  technology: 64,
  environment: 50,
  publicTrust: 50
};

const economy: EconomySnapshot = {
  economy: {
    id: "economy",
    nationId: "nation",
    treasury: 1500,
    population: 420000,
    industrialCapacity: 50,
    administrativeCapacity: 50,
    lastProcessedTurn: 2,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01"
  },
  resources: [
    { id: "iron", nationId: "nation", type: "IRON", amount: 0, capacity: 500, updatedAt: "2026-01-01" },
    { id: "timber", nationId: "nation", type: "TIMBER", amount: 40, capacity: 500, updatedAt: "2026-01-01" },
    { id: "food", nationId: "nation", type: "FOOD", amount: 300, capacity: 800, updatedAt: "2026-01-01" }
  ],
  recentLedger: [
    {
      id: "food-in",
      nationId: "nation",
      turn: 2,
      kind: "RESOURCE",
      resourceType: "FOOD",
      amount: 30,
      reason: "Farm output",
      createdAt: "2026-01-01"
    },
    {
      id: "food-out",
      nationId: "nation",
      turn: 2,
      kind: "RESOURCE",
      resourceType: "FOOD",
      amount: -12,
      reason: "Population consumption",
      createdAt: "2026-01-01"
    }
  ]
};

describe("NationalEconomyBar", () => {
  it("hides empty resources and exposes authoritative ledger details", async () => {
    const user = userEvent.setup();
    render(<NationalEconomyBar economy={economy} stats={stats} />);

    expect(screen.getByText("Industrial age")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Iron:/)).not.toBeInTheDocument();
    const food = screen.getByLabelText(/^Food: 300/);
    expect(food).toBeInTheDocument();

    await user.click(food);
    expect(screen.getByText("Farm output · Population consumption")).toBeInTheDocument();
    expect(screen.getByText("+30")).toBeInTheDocument();
    expect(screen.getByText("-12")).toBeInTheDocument();
    expect(screen.getAllByText("+18")).toHaveLength(2);
  });
});
