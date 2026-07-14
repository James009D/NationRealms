import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EconomySnapshot, NationStats } from "@statecraft/shared";
import { EventNationSnapshot } from "./EventNationSnapshot";

const stats: NationStats = {
  id: "stats",
  nationId: "nation",
  economy: 61,
  stability: 55,
  liberty: 48,
  authority: 52,
  military: 59,
  technology: 64,
  environment: 46,
  publicTrust: 57
};

const economy: EconomySnapshot = {
  economy: {
    id: "economy",
    nationId: "nation",
    treasury: 1250,
    population: 540000,
    industrialCapacity: 50,
    administrativeCapacity: 50,
    lastProcessedTurn: 3,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01"
  },
  resources: [
    { id: "fish", nationId: "nation", type: "FISH", amount: 80, capacity: 500, updatedAt: "2026-01-01" },
    { id: "iron", nationId: "nation", type: "IRON", amount: 0, capacity: 500, updatedAt: "2026-01-01" },
    { id: "energy", nationId: "nation", type: "ENERGY", amount: 90, capacity: 500, updatedAt: "2026-01-01" },
    { id: "timber", nationId: "nation", type: "TIMBER", amount: 20, capacity: 500, updatedAt: "2026-01-01" },
    { id: "food", nationId: "nation", type: "FOOD", amount: 180, capacity: 500, updatedAt: "2026-01-01" }
  ],
  recentLedger: []
};

describe("EventNationSnapshot", () => {
  it("shows compact decision context from authoritative nation state", () => {
    render(<EventNationSnapshot stats={stats} economy={economy} />);

    expect(screen.getByText("National Indicators")).toBeInTheDocument();
    expect(screen.getByText("Public Trust")).toBeInTheDocument();
    expect(screen.getByText("Nation Economy")).toBeInTheDocument();
    expect(screen.getByText("1,250 credits")).toBeInTheDocument();
    expect(screen.getByText("540,000")).toBeInTheDocument();
    expect(screen.getByText("Tech Level")).toBeInTheDocument();
    expect(screen.getByText("Technology Age")).toBeInTheDocument();
    expect(screen.getByText("Industrial")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Food: 180/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Iron:/)).not.toBeInTheDocument();
    expect(
      screen.getAllByTestId("resource-tile").map((tile) => tile.getAttribute("aria-label")?.split(":")[0])
    ).toEqual(["Food", "Timber", "Energy", "Fish"]);
  });
});
