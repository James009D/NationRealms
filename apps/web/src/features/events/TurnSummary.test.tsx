import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TurnSummary } from "./TurnSummary";

describe("TurnSummary", () => {
  it("shows economy changes, resource use, and warnings", () => {
    render(
      <TurnSummary
        onDismiss={vi.fn()}
        result={{
          nationId: "nation",
          previousTurn: 1,
          currentTurn: 2,
          treasuryDelta: 40,
          populationDelta: -100,
          statChanges: { stability: -3 },
          warnings: ["Food reserves are low."],
          expiredEventIds: ["event"],
          resourceDeltas: [{ type: "FOOD", produced: 20, consumed: 30, net: -10, balance: 5 }],
          generation: { activeEvent: null, eligibleCount: 0, currentTurn: 2 },
          economy: {
            economy: {
              id: "e",
              nationId: "nation",
              treasury: 1040,
              population: 999900,
              industrialCapacity: 50,
              administrativeCapacity: 50,
              lastProcessedTurn: 2,
              createdAt: "2026-01-01",
              updatedAt: "2026-01-01"
            },
            resources: [],
            recentLedger: []
          },
          completedUpgradeProjects: [
            {
              id: "upgrade",
              nationId: "nation",
              locationId: "town",
              status: "COMPLETED",
              fromLevel: 2,
              targetLevel: 3,
              startedTurn: 1,
              completesTurn: 2,
              treasuryCost: 300,
              resourceCosts: { TIMBER: 20 },
              engineerAgentId: null,
              engineerName: null,
              costDiscountPercent: 0,
              durationReduction: 0,
              createdAt: "2026-01-01",
              completedAt: "2026-01-02",
              cancelledAt: null
            }
          ],
          agentContributions: [
            {
              agentId: "governor",
              agentName: "Governor Vale",
              role: "GOVERNOR",
              locationId: "town",
              description: "Governor Vale improved output at River Town.",
              treasuryBonus: 4
            }
          ],
          researchPointsGenerated: 9,
          researchPointBalance: 41,
          researchContributions: [{ sourceType: "BASE", label: "National technology base", amount: 8 }],
          technologyAgeBefore: {
            id: "RENAISSANCE",
            label: "Renaissance",
            minLevel: 52,
            maxLevel: 60,
            description: "Renaissance"
          },
          technologyAgeAfter: {
            id: "RENAISSANCE",
            label: "Renaissance",
            minLevel: 52,
            maxLevel: 60,
            description: "Renaissance"
          },
          suspendedTechnologyKeys: [],
          reactivatedTechnologyKeys: []
        }}
      />
    );
    expect(screen.getByText("National Turn Report")).toBeInTheDocument();
    expect(screen.getByText("Food reserves are low.")).toBeInTheDocument();
    expect(screen.getByText(/20 produced, 30 consumed/)).toBeInTheDocument();
    expect(screen.getByText("Completed Development")).toBeInTheDocument();
    expect(screen.getByText("Governor Vale improved output at River Town.")).toBeInTheDocument();
    expect(screen.getByText("+9 / 41 RP")).toBeInTheDocument();
  });
});
