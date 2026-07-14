import type { EventTemplateDefinition } from "@statecraft/shared";
import { z } from "zod";
import { eventCategoryValues } from "../domainValues.js";

const effectSchema = z.object({
  statChanges: z.record(z.number()).optional(),
  treasuryChange: z.number().int().optional(),
  populationChange: z.number().int().optional(),
  resourceChanges: z.record(z.number().int()).optional(),
  agentXpChanges: z
    .array(
      z.object({
        agentId: z.string().optional(),
        role: z.string().optional(),
        assignedLocationType: z.string().optional(),
        amount: z.number().int()
      })
    )
    .optional(),
  agentLoyaltyChanges: z
    .array(
      z.object({
        agentId: z.string().optional(),
        role: z.string().optional(),
        assignedLocationType: z.string().optional(),
        amount: z.number().int()
      })
    )
    .optional(),
  locationDevelopmentChanges: z
    .array(
      z.object({ locationId: z.string().optional(), locationType: z.string().optional(), amount: z.number().int() })
    )
    .optional(),
  militaryExperienceChanges: z
    .array(z.object({ unitId: z.string().optional(), unitType: z.string().optional(), amount: z.number().int() }))
    .optional(),
  settlementChanges: z
    .array(
      z.object({
        settlementId: z.string().optional(),
        selector: z.enum(["CAPITAL", "LOWEST_STABILITY", "HIGHEST_GROWTH"]).optional(),
        stability: z.number().int().optional(),
        health: z.number().int().optional(),
        growthProgress: z.number().int().optional(),
        storedFood: z.number().int().optional()
      })
    )
    .optional(),
  regionReliabilityChanges: z
    .array(
      z.object({
        regionId: z.string().optional(),
        settlementId: z.string().optional(),
        amount: z.number().int()
      })
    )
    .optional(),
  createNationPost: z.object({ type: z.string(), title: z.string().min(2), body: z.string().min(1) }).optional(),
  followUpEventKeys: z.array(z.string()).optional()
});

const templateSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.enum(eventCategoryValues),
  tags: z.array(z.string()).min(1),
  eligibility: z.record(z.unknown()),
  choices: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(2),
        description: z.string().min(2),
        effects: effectSchema,
        resultSummary: z.string().min(3)
      })
    )
    .min(2)
    .max(4),
  weight: z.number().int().nonnegative(),
  cooldownTurns: z.number().int().positive().nullable().optional(),
  followUpEventKeys: z.array(z.string()).nullable().optional()
});

export function validateEventTemplateLibrary(templates: EventTemplateDefinition[]) {
  const parsed = z.array(templateSchema).parse(templates);
  const keys = new Set<string>();
  for (const template of parsed) {
    if (keys.has(template.key)) throw new Error(`Duplicate event template key: ${template.key}`);
    keys.add(template.key);
  }
  for (const template of parsed) {
    for (const followUp of [
      ...(template.followUpEventKeys ?? []),
      ...template.choices.flatMap((choice) => choice.effects.followUpEventKeys ?? [])
    ]) {
      if (!keys.has(followUp)) throw new Error(`Unknown follow-up event key ${followUp} in ${template.key}`);
    }
  }
  return templates;
}
