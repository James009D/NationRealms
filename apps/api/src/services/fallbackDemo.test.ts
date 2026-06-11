import { describe, expect, it } from "vitest";
import type { EventChoiceDefinition, NationCreationInput } from "@statecraft/shared";
import {
  advanceFallbackNationTurn,
  assignFallbackAgent,
  createFallbackLegacyNation,
  createFallbackNationFromInput,
  fallbackNationId,
  generateFallbackEventForNation,
  getFallbackDemoState,
  getFallbackNation,
  getFallbackNationProfile,
  moveFallbackMilitaryUnit,
  resolveFallbackEventChoice
} from "./fallbackDemo.js";
import { agentMatchesEffectTarget, applyStatEffects } from "./eventEngineService.js";

const creationInput: NationCreationInput = {
  name: "Testlandia",
  shortName: "Testland",
  demonym: "Testlander",
  motto: "Forward like water",
  capitalName: "Testhaven",
  cultureSummary: "A civic-minded test nation.",
  description: "A public overview for a newly founded test nation.",
  governmentType: "DEMOCRATIC_REPUBLIC",
  economyType: "MIXED_MARKET",
  foundingOrigin: "REVOLUTIONARY_REPUBLIC",
  ideology: {
    authorityLiberty: 35,
    collectivismIndividualism: 45,
    militarismPacifism: 55,
    traditionProgress: 60,
    ecologyIndustry: 40
  },
  cultureTraitIds: ["merchant_guilds", "environmental_stewardship"],
  flag: {
    primaryColor: "#225577",
    secondaryColor: "#f0c96d",
    accentColor: "#ffffff",
    emblemSymbol: "Star"
  },
  startingPackageId: "maritime_trader"
};

describe("fallback created-nation game loop", () => {
  const created = createFallbackNationFromInput(creationInput);
  const nationId = created.nation.id;

  it("creates a nation that owns its starter locations, agents, and units", () => {
    expect(nationId).not.toBe(fallbackNationId);
    expect(created.mapLocations.length).toBeGreaterThan(0);
    expect(created.agents.length).toBeGreaterThan(0);
    expect(created.militaryUnits.length).toBeGreaterThan(0);
    expect(created.mapLocations.every((location) => location.nationId === nationId)).toBe(true);
    expect(created.agents.every((agent) => agent.nationId === nationId)).toBe(true);
    expect(created.militaryUnits.every((unit) => unit.nationId === nationId)).toBe(true);
  });

  it("exposes the created nation through lookup and profile helpers", () => {
    const nation = getFallbackNation(nationId);
    expect(nation?.name).toBe("Testlandia");
    expect(nation?.stats?.nationId).toBe(nationId);

    const profile = getFallbackNationProfile(nationId);
    expect(profile?.nation.id).toBe(nationId);
    expect(profile?.agentsSummary.length).toBeGreaterThan(0);
    expect(profile?.militarySummary.length).toBeGreaterThan(0);
  });

  it("assigns an agent of a created nation to its own location", () => {
    const agent = created.agents[0]!;
    const location = created.mapLocations[0]!;

    const updated = assignFallbackAgent(agent.id, {
      assignment: "GOVERNING",
      assignedLocationId: location.id
    });

    expect(updated?.assignment).toBe("GOVERNING");
    expect(updated?.assignedLocationId).toBe(location.id);
  });

  it("rejects assigning an agent to another nation's location", () => {
    const agent = created.agents[0]!;
    const result = assignFallbackAgent(agent.id, {
      assignment: "GOVERNING",
      assignedLocationId: "demo-location-capital"
    });

    expect(result).toBeNull();
  });

  it("moves a created nation's military unit to its own location", () => {
    const unit = created.militaryUnits[0]!;
    const destination = created.mapLocations.find((location) => location.id !== unit.locationId)!;

    const moved = moveFallbackMilitaryUnit(unit.id, destination.id);

    expect(moved?.locationId).toBe(destination.id);
    expect(moved?.location?.id).toBe(destination.id);
  });

  it("rejects moving a unit to another nation's location", () => {
    const unit = created.militaryUnits[0]!;
    expect(moveFallbackMilitaryUnit(unit.id, "demo-location-port")).toBeNull();
  });

  it("generates an active event for the created nation", () => {
    const generated = generateFallbackEventForNation(nationId);

    expect(generated).not.toBeNull();
    expect(generated!.eligibleCount).toBeGreaterThan(0);
    expect(generated!.activeEvent?.nationId).toBe(nationId);
    expect(generated!.activeEvent?.status).toBe("ACTIVE");
  });

  it("resolves an event choice and applies stat effects, history, and posts", () => {
    const generated = generateFallbackEventForNation(nationId);
    const activeEvent = generated!.activeEvent!;
    const choice = activeEvent.eventTemplate!.choices[0] as EventChoiceDefinition;
    const statsBefore = getFallbackNation(nationId)!.stats!;

    const resolution = resolveFallbackEventChoice(activeEvent.id, choice.id);

    expect(resolution).not.toBeNull();
    expect(resolution!.event.status).toBe("RESOLVED");
    expect(resolution!.event.selectedChoiceId).toBe(choice.id);
    expect(resolution!.historyEntry?.nationId).toBe(nationId);

    const expectedStats = applyStatEffects(
      {
        economy: statsBefore.economy,
        stability: statsBefore.stability,
        liberty: statsBefore.liberty,
        authority: statsBefore.authority,
        military: statsBefore.military,
        technology: statsBefore.technology,
        environment: statsBefore.environment,
        publicTrust: statsBefore.publicTrust
      },
      choice.effects.statChanges
    );
    expect(resolution!.stats).toMatchObject(expectedStats);

    if (choice.effects.createNationPost) {
      expect(resolution!.createdPost?.nationId).toBe(nationId);
    }
  });

  it("cannot resolve the same event twice", () => {
    const generated = generateFallbackEventForNation(nationId);
    const activeEvent = generated!.activeEvent!;
    const choice = activeEvent.eventTemplate!.choices[0]!;

    expect(resolveFallbackEventChoice(activeEvent.id, choice.id)).not.toBeNull();
    expect(resolveFallbackEventChoice(activeEvent.id, choice.id)).toBeNull();
  });

  it("advances the social-simulation turn with deterministic calibration", () => {
    const before = getFallbackNation(nationId)!.currentTurn ?? 1;
    const advanced = advanceFallbackNationTurn(nationId);

    expect(advanced?.currentTurn).toBe(before + 1);
    expect(getFallbackNation(nationId)!.currentTurn).toBe(before + 1);
  });
});

describe("fallback demo state", () => {
  it("reflects turn advancement instead of returning a stale nation", () => {
    const before = getFallbackDemoState().nation.currentTurn ?? 1;
    advanceFallbackNationTurn(fallbackNationId);

    expect(getFallbackDemoState().nation.currentTurn).toBe(before + 1);
  });

  it("scopes every collection to the demo nation", () => {
    // The created-nation suite above has already added another nation.
    const state = getFallbackDemoState();

    expect(state.nation.id).toBe(fallbackNationId);
    expect(state.posts.every((post) => post.nationId === fallbackNationId)).toBe(true);
    expect(state.activeEvents.every((event) => event.nationId === fallbackNationId)).toBe(true);
    expect(state.mapLocations.every((location) => location.nationId === fallbackNationId)).toBe(true);
    expect(state.agents.every((agent) => agent.nationId === fallbackNationId)).toBe(true);
    expect(state.militaryUnits.every((unit) => unit.nationId === fallbackNationId)).toBe(true);
  });
});

describe("fallback legacy nation creation", () => {
  it("creates a bare nation with default stats, like the legacy Prisma route", () => {
    const created = createFallbackLegacyNation({
      name: "Legacy Land",
      motto: "Old but supported",
      governmentType: "REPUBLIC",
      economyType: "MIXED",
      cultureSummary: "A nation created through the legacy endpoint.",
      capitalName: "Old Town"
    });

    expect(created.stats).toMatchObject({ economy: 50, military: 30, technology: 35 });
    expect(getFallbackNation(created.id)?.name).toBe("Legacy Land");
    expect(getFallbackNationProfile(created.id)?.importantMapLocations).toHaveLength(0);
  });
});

describe("fallback follow-up event chaining", () => {
  // A dedicated nation keeps these tests deterministic: no other test (or the
  // demo nation's random turn-advance generation) can pre-activate the
  // follow-up template here.
  const chainNation = createFallbackNationFromInput({ ...creationInput, name: "Chainlandia" });
  const chainNationId = chainNation.nation.id;

  function generatePortStrike() {
    // selectWeightedEvent picks by cumulative weight window; sweeping the
    // random value in 1% steps deterministically lands in every window, and
    // port_workers_strike precedes dockside_reform_commission in template
    // order, so the sweep always reaches it first.
    for (let roll = 0; roll < 1; roll += 0.01) {
      const generated = generateFallbackEventForNation(chainNationId, () => roll);
      if (generated?.activeEvent?.eventTemplateId === "port_workers_strike") {
        return generated.activeEvent;
      }
    }
    throw new Error("could not deterministically generate port_workers_strike");
  }

  it("activates the authored follow-up when the chaining choice resolves", () => {
    const portStrike = generatePortStrike();
    const resolution = resolveFallbackEventChoice(portStrike.id, "labor_compact");

    expect(resolution).not.toBeNull();
    expect(resolution!.followUpEvents).toHaveLength(1);
    expect(resolution!.followUpEvents![0]).toMatchObject({
      eventTemplateId: "dockside_reform_commission",
      nationId: chainNationId,
      status: "ACTIVE"
    });
  });

  it("does not duplicate a follow-up that is already active", () => {
    // The previous test left dockside_reform_commission active.
    const portStrike = generatePortStrike();
    const resolution = resolveFallbackEventChoice(portStrike.id, "labor_compact");

    expect(resolution).not.toBeNull();
    expect(resolution!.followUpEvents).toHaveLength(0);
  });

  it("non-chaining choices produce no follow-ups", () => {
    const portStrike = generatePortStrike();
    const resolution = resolveFallbackEventChoice(portStrike.id, "emergency_orders");

    expect(resolution).not.toBeNull();
    expect(resolution!.followUpEvents).toHaveLength(0);
  });

  it("generateEventForNation skips templates already active via follow-up chains", () => {
    // dockside_reform_commission is still active from the first test.
    // isTemplateEligible should reject it, so generation picks something else.
    const generated = generateFallbackEventForNation(chainNationId);
    expect(generated).not.toBeNull();
    expect(generated!.activeEvent).not.toBeNull();
    expect(generated!.activeEvent!.eventTemplateId).not.toBe("dockside_reform_commission");
  });
});

describe("agentMatchesEffectTarget", () => {
  const locations = [
    { id: "loc-capital", type: "CAPITAL" as const },
    { id: "loc-port", type: "PORT" as const }
  ];

  it("matches any agent when no filters are set", () => {
    expect(agentMatchesEffectTarget({ role: "GENERAL", assignedLocationId: null }, { amount: 1 }, locations)).toBe(true);
  });

  it("filters by role", () => {
    const agent = { role: "GENERAL" as const, assignedLocationId: null };
    expect(agentMatchesEffectTarget(agent, { role: "GENERAL", amount: 1 }, locations)).toBe(true);
    expect(agentMatchesEffectTarget(agent, { role: "GOVERNOR", amount: 1 }, locations)).toBe(false);
  });

  it("filters by assigned location type", () => {
    const portAgent = { role: "TRADE_MINISTER" as const, assignedLocationId: "loc-port" };
    const unassigned = { role: "TRADE_MINISTER" as const, assignedLocationId: null };

    expect(agentMatchesEffectTarget(portAgent, { assignedLocationType: "PORT", amount: 1 }, locations)).toBe(true);
    expect(agentMatchesEffectTarget(portAgent, { assignedLocationType: "CAPITAL", amount: 1 }, locations)).toBe(false);
    expect(agentMatchesEffectTarget(unassigned, { assignedLocationType: "PORT", amount: 1 }, locations)).toBe(false);
  });

  it("requires both role and location type when both are set", () => {
    const agent = { role: "GENERAL" as const, assignedLocationId: "loc-capital" };

    expect(agentMatchesEffectTarget(agent, { role: "GENERAL", assignedLocationType: "CAPITAL", amount: 1 }, locations)).toBe(true);
    expect(agentMatchesEffectTarget(agent, { role: "GENERAL", assignedLocationType: "PORT", amount: 1 }, locations)).toBe(false);
  });
});
