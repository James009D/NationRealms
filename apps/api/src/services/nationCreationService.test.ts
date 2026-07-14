import { describe, expect, it } from "vitest";
import type { NationCreationInput } from "@statecraft/shared";
import {
  buildNationCreationPreview,
  calculateStartingStats,
  clampStats,
  validateNationCreationInput
} from "./nationCreationService.js";

const validInput: NationCreationInput = {
  name: "Testlandia",
  shortName: "Testland",
  demonym: "Testlander",
  motto: "Forward with care",
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

describe("nation creation service", () => {
  it("accepts valid creation input", () => {
    expect(validateNationCreationInput(validInput).isValid).toBe(true);
  });

  it("rejects an invalid nation name", () => {
    const result = validateNationCreationInput({ ...validInput, name: "No" });
    expect(result.isValid).toBe(false);
    expect(result.messages).toContain("Nation name must be 3 to 60 characters.");
  });

  it("rejects too many culture traits", () => {
    const result = validateNationCreationInput({
      ...validInput,
      cultureTraitIds: [
        "merchant_guilds",
        "environmental_stewardship",
        "martial_tradition",
        "labor_solidarity",
        "naval_heritage"
      ]
    });

    expect(result.isValid).toBe(false);
    expect(result.messages).toContain("Select no more than 4 culture traits.");
  });

  it("rejects invalid colors", () => {
    const result = validateNationCreationInput({
      ...validInput,
      flag: {
        ...validInput.flag,
        primaryColor: "blue"
      }
    });

    expect(result.isValid).toBe(false);
    expect(result.messages).toContain("Flag colors must be valid hex colors.");
  });

  it("clamps starting stats between 0 and 100", () => {
    expect(
      clampStats({
        economy: -20,
        stability: 120,
        liberty: 50,
        authority: 50,
        military: 50,
        technology: 50,
        environment: 50,
        publicTrust: 50
      })
    ).toMatchObject({
      economy: 0,
      stability: 100
    });
  });

  it("applies culture trait modifiers to stats", () => {
    const withTrait = calculateStartingStats({
      ...validInput,
      cultureTraitIds: ["merchant_guilds"],
      startingPackageId: "balanced_republic"
    });
    const withoutTrait = calculateStartingStats({
      ...validInput,
      cultureTraitIds: [],
      startingPackageId: "balanced_republic"
    });

    expect(withTrait.economy).toBeGreaterThan(withoutTrait.economy);
    expect(withTrait.publicTrust).toBeGreaterThan(withoutTrait.publicTrust);
  });

  it("generates package preview assets", () => {
    const preview = buildNationCreationPreview(validInput);

    expect(preview.startingPackage?.id).toBe("maritime_trader");
    expect(preview.locations.some((location) => location.type === "PORT")).toBe(true);
    expect(preview.agents.some((agent) => agent.role === "TRADE_MINISTER")).toBe(true);
    expect(preview.militaryUnits.some((unit) => unit.type === "NAVAL")).toBe(true);
  });
});
