import { describe, expect, it } from "vitest";
import type { EventTemplateDefinition } from "@statecraft/shared";
import { EVENT_TEMPLATES } from "../data/eventTemplates.js";
import {
  applyStatEffects,
  clampStats,
  isTemplateEligible,
  resolveFollowUpKeys,
  selectWeightedEvent,
  type NationEventContext
} from "./eventEngineService.js";
import {
  generateFallbackEventForNation,
  getFallbackEventHistory,
  getFallbackEvents,
  resolveFallbackEventChoice
} from "./fallbackDemo.js";

const baseContext: NationEventContext = {
  nation: {
    governmentType: "DEMOCRATIC_REPUBLIC",
    economyType: "MIXED_MARKET",
    foundingOrigin: "REVOLUTIONARY_REPUBLIC"
  },
  stats: {
    economy: 60,
    stability: 55,
    liberty: 60,
    authority: 45,
    military: 55,
    technology: 55,
    environment: 45,
    publicTrust: 55
  },
  ideology: {
    authorityLiberty: 44,
    collectivismIndividualism: 55,
    militarismPacifism: 55,
    traditionProgress: 60,
    ecologyIndustry: 55
  },
  cultureTraitIds: ["merchant_guilds", "ancient_nobility"],
  mapLocations: [{ type: "PORT" }, { type: "MINE" }, { type: "FARM" }, { type: "CAPITAL" }],
  agents: [{ role: "HEAD_OF_STATE" }, { role: "GOVERNOR" }, { role: "GENERAL" }],
  militaryUnits: [{ type: "INFANTRY" }],
  recentResolvedEvents: [],
  activeEventKeys: [],
  currentTurn: 3
};

function template(partial: Partial<EventTemplateDefinition>): EventTemplateDefinition {
  return {
    key: "test",
    title: "Test",
    description: "Test",
    category: "ECONOMY",
    tags: [],
    eligibility: {},
    choices: [],
    weight: 10,
    ...partial
  };
}

describe("event engine helpers", () => {
  it("filters eligibility by government type", () => {
    expect(isTemplateEligible(template({ eligibility: { governmentTypes: ["DEMOCRATIC_REPUBLIC"] } }), baseContext)).toBe(true);
    expect(isTemplateEligible(template({ eligibility: { governmentTypes: ["THEOCRACY"] } }), baseContext)).toBe(false);
  });

  it("filters eligibility by economy type", () => {
    expect(isTemplateEligible(template({ eligibility: { economyTypes: ["MIXED_MARKET"] } }), baseContext)).toBe(true);
    expect(isTemplateEligible(template({ eligibility: { economyTypes: ["AGRARIAN"] } }), baseContext)).toBe(false);
  });

  it("filters eligibility by min and max stats", () => {
    expect(isTemplateEligible(template({ eligibility: { minStats: { economy: 50 }, maxStats: { authority: 50 } } }), baseContext)).toBe(true);
    expect(isTemplateEligible(template({ eligibility: { minStats: { economy: 90 } } }), baseContext)).toBe(false);
  });

  it("filters eligibility by culture traits", () => {
    expect(isTemplateEligible(template({ eligibility: { requiredCultureTraits: ["merchant_guilds"] } }), baseContext)).toBe(true);
    expect(isTemplateEligible(template({ eligibility: { excludedCultureTraits: ["merchant_guilds"] } }), baseContext)).toBe(false);
  });

  it("weighted selection returns eligible templates only", () => {
    const selected = selectWeightedEvent(
      [
        template({ key: "bad", eligibility: { governmentTypes: ["THEOCRACY"] }, weight: 100 }),
        template({ key: "good", eligibility: { governmentTypes: ["DEMOCRATIC_REPUBLIC"] }, weight: 1 })
      ],
      baseContext,
      () => 0.5
    );

    expect(selected?.key).toBe("good");
  });

  it("applies and clamps stat changes", () => {
    expect(applyStatEffects(baseContext.stats, { economy: 60, stability: -80 })).toMatchObject({
      economy: 100,
      stability: 0
    });
    expect(clampStats({ ...baseContext.stats, publicTrust: 150 })).toMatchObject({ publicTrust: 100 });
    expect(clampStats({ ...baseContext.stats, economy: 777 })).toMatchObject({ economy: 100 });
  });

  it("fallback resolution creates history and marks active event resolved", () => {
    const generated = generateFallbackEventForNation("demo-nation");
    const activeEvent = generated?.activeEvent ?? getFallbackEvents("demo-nation")?.[0];
    const choice = activeEvent?.eventTemplate?.choices?.[0];

    expect(activeEvent).toBeTruthy();
    expect(choice).toBeTruthy();

    const result = resolveFallbackEventChoice(activeEvent!.id, choice!.id);

    expect(result?.historyEntry).toBeTruthy();
    expect(result?.event.status).toBe("RESOLVED");
    expect(getFallbackEventHistory("demo-nation")?.[0]?.activeEventId).toBe(activeEvent!.id);
  });

  it("event library includes the requested starter scale", () => {
    expect(EVENT_TEMPLATES.length).toBeGreaterThanOrEqual(20);
  });

  it("authored follow-up keys reference real templates", () => {
    const knownKeys = new Set(EVENT_TEMPLATES.map((item) => item.key));
    for (const item of EVENT_TEMPLATES) {
      const keys = [
        ...(item.followUpEventKeys ?? []),
        ...item.choices.flatMap((choice) => choice.effects.followUpEventKeys ?? [])
      ];
      for (const key of keys) {
        expect(knownKeys.has(key), `${item.key} references unknown follow-up ${key}`).toBe(true);
      }
    }
  });
});

describe("resolveFollowUpKeys", () => {
  const choice = (keys?: string[]) => ({
    id: "c",
    label: "C",
    description: "",
    effects: { followUpEventKeys: keys },
    resultSummary: ""
  });

  it("prefers choice-level keys over template-level keys", () => {
    expect(resolveFollowUpKeys(choice(["a"]), { followUpEventKeys: ["b"] })).toEqual(["a"]);
  });

  it("falls back to template-level keys when the choice has none", () => {
    expect(resolveFollowUpKeys(choice(), { followUpEventKeys: ["b"] })).toEqual(["b"]);
    expect(resolveFollowUpKeys(choice([]), { followUpEventKeys: ["b"] })).toEqual(["b"]);
  });

  it("returns an empty, deduplicated list otherwise", () => {
    expect(resolveFollowUpKeys(choice(), undefined)).toEqual([]);
    expect(resolveFollowUpKeys(choice(), { followUpEventKeys: null })).toEqual([]);
    expect(resolveFollowUpKeys(choice(["a", "a", "b"]), undefined)).toEqual(["a", "b"]);
  });
});
