import { describe, expect, it } from "vitest";
import { TECHNOLOGY_NODES } from "@statecraft/shared";
import {
  aggregateTechnologyEffects,
  calculateResearchGeneration,
  technologyActivationChanges
} from "./technologyService.js";

describe("technology research rules", () => {
  it("defines 26 unique nodes with valid acyclic prerequisites", () => {
    expect(TECHNOLOGY_NODES).toHaveLength(26);
    const nodes = new Map(TECHNOLOGY_NODES.map((node) => [node.key, node]));
    expect(nodes.size).toBe(26);
    for (const node of TECHNOLOGY_NODES) expect(node.prerequisiteKeys.every((key) => nodes.has(key))).toBe(true);

    const visiting = new Set<string>();
    const visited = new Set<string>();
    function visit(key: string) {
      if (visiting.has(key)) throw new Error(`Technology cycle at ${key}`);
      if (visited.has(key)) return;
      visiting.add(key);
      for (const prerequisite of nodes.get(key)!.prerequisiteKeys) visit(prerequisite);
      visiting.delete(key);
      visited.add(key);
    }
    for (const key of nodes.keys()) visit(key);
    expect(visited.size).toBe(26);
  });

  it("caps scientist and rare-earth contributions and halves output during shortages", () => {
    const agents = [1, 2, 3].map((level, index) => ({
      id: `scientist-${index}`,
      name: `Scientist ${index}`,
      role: "SCIENTIST_ADVISOR" as const,
      assignment: "IMPROVING",
      level: level + 3,
      assignedLocationId: `site-${index}`
    }));
    const locations = agents.map((agent, index) => ({
      id: agent.assignedLocationId,
      name: `Site ${index}`,
      type: "RESOURCE_SITE" as const,
      resourceType: "RARE_EARTH" as const,
      developmentLevel: 5
    }));
    const normal = calculateResearchGeneration({ technologyLevel: 55, agents, locations });
    expect(
      normal.contributions.filter((item) => item.sourceType === "SCIENTIST").reduce((s, i) => s + i.amount, 0)
    ).toBe(10);
    expect(
      normal.contributions.filter((item) => item.sourceType === "RARE_EARTH_SITE").reduce((s, i) => s + i.amount, 0)
    ).toBe(10);
    const shortage = calculateResearchGeneration({ technologyLevel: 55, agents, locations, energyShortage: true });
    expect(shortage.total).toBe(Math.floor(normal.total / 2));
  });

  it("caps persistent effects and detects suspended and reactivated unlocks", () => {
    const effects = aggregateTechnologyEffects([
      ...TECHNOLOGY_NODES.filter((node) => ["scientific_method", "computing"].includes(node.key)),
      { ...TECHNOLOGY_NODES.find((node) => node.key === "computing")!, key: "computing-copy" },
      { ...TECHNOLOGY_NODES.find((node) => node.key === "fusion_power")!, key: "fusion-copy" }
    ]);
    expect(effects.researchPercent).toBe(40);
    expect(effects.energyConsumptionPercent).toBe(-25);

    const unlocks = [{ nodeKey: "printing_press" }];
    expect(technologyActivationChanges(unlocks, 55, 50)).toEqual({
      suspended: ["printing_press"],
      reactivated: []
    });
    expect(technologyActivationChanges(unlocks, 50, 55)).toEqual({
      suspended: [],
      reactivated: ["printing_press"]
    });
  });
});
