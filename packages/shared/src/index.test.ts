import { describe, expect, it } from "vitest";
import { getNextTechnologyAge, getTechnologyAge, type EventChoice, type NationStatKey } from "./index";

const statKeys: NationStatKey[] = [
  "economy",
  "stability",
  "liberty",
  "authority",
  "military",
  "technology",
  "environment",
  "publicTrust"
];

describe("shared domain types", () => {
  it("keeps event effects constrained to known nation stat keys", () => {
    const choice: EventChoice = {
      id: "invest",
      label: "Invest in public works",
      description: "Fund infrastructure and public services.",
      effects: {
        economy: 3,
        publicTrust: 4
      }
    };

    expect(Object.keys(choice.effects ?? {}).every((key) => statKeys.includes(key as NationStatKey))).toBe(true);
  });

  it("maps technology scores to stable age boundaries", () => {
    expect(getTechnologyAge(-5).id).toBe("STONE");
    expect(getTechnologyAge(56).id).toBe("RENAISSANCE");
    expect(getTechnologyAge(100).id).toBe("FUTURE");
    expect(getNextTechnologyAge("RENAISSANCE")?.id).toBe("INDUSTRIAL");
    expect(getNextTechnologyAge("FUTURE")).toBeNull();
  });
});
