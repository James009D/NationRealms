import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireActiveEventOwner, requireNationOwner } from "../auth/principal.js";
import { prisma } from "../prisma.js";
import { emitRealtime } from "../realtime.js";
import {
  advanceFallbackNationTurn,
  generateFallbackEventForNation,
  getFallbackEventHistory,
  getFallbackEventStatus,
  reconcileFallbackPopulation,
  getFallbackEvents,
  getFallbackEventTemplates,
  isDatabaseUnavailable,
  resolveFallbackEventChoice
} from "../services/fallbackDemo.js";
import { dbTemplateToDefinition, generateEventForNation, resolveEventChoice } from "../services/eventEngineService.js";
import { advanceNationTurn } from "../services/turnService.js";
import {
  applyMemorySettlementEventEffects,
  getNationSettlementSummary,
  processMemorySettlementTurn
} from "../services/settlementService.js";
import { serializeActiveEvent } from "../services/serializers.js";
import { processMemoryExpansionTurn } from "../services/expansionService.js";

const chooseEventSchema = z.object({
  choiceId: z.string().min(1)
});

export async function registerEventRoutes(app: FastifyInstance) {
  app.get("/api/nations/:nationId/events", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);

    try {
      const events = await prisma.activeEvent.findMany({
        where: {
          nationId,
          status: "ACTIVE"
        },
        include: {
          eventTemplate: true
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return events.map(serializeActiveEvent);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const fallbackEvents = getFallbackEvents(nationId);
        if (fallbackEvents) return fallbackEvents.filter((event) => event.status === "ACTIVE");
        return reply.code(404).send({ message: "Nation not found" });
      }

      throw error;
    }
  });

  app.get("/api/nations/:nationId/event-history", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);

    try {
      const history = await prisma.resolvedEvent.findMany({
        where: { nationId },
        orderBy: { createdAt: "desc" },
        take: 20
      });

      return history.map((entry) => ({
        ...entry,
        effects: entry.effectsJson,
        createdAt: entry.createdAt.toISOString()
      }));
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const fallbackHistory = getFallbackEventHistory(nationId);
        if (fallbackHistory) return fallbackHistory;
        return reply.code(404).send({ message: "Nation not found" });
      }

      throw error;
    }
  });

  app.post("/api/nations/:nationId/events/generate", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);
    await requireNationOwner(request, nationId);

    try {
      const generated = await generateEventForNation(nationId);
      if (generated.activeEvent) emitRealtime("event:generated", { nationId, activeEvent: generated.activeEvent });
      return generated;
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const generated = generateFallbackEventForNation(nationId);
        if (!generated) return reply.code(404).send({ message: "Nation not found" });
        if (generated.activeEvent) {
          emitRealtime("event:generated", { nationId, activeEvent: generated.activeEvent });
        }
        return generated;
      }

      if (
        error instanceof Error &&
        (error.message.includes("not found") || (error as Error & { code?: string }).code === "P2025")
      ) {
        return reply.code(404).send({ message: "Nation not found" });
      }

      throw error;
    }
  });

  app.post("/api/nations/:nationId/advance-turn", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);
    await requireNationOwner(request, nationId);

    try {
      const advanced = await advanceNationTurn(nationId);
      emitRealtime("nation:turn-advanced", { nationId, turn: advanced });
      if (advanced.technologyAgeBefore.id !== advanced.technologyAgeAfter.id)
        emitRealtime("technology:age-changed", {
          nationId,
          previousAge: advanced.technologyAgeBefore,
          currentAge: advanced.technologyAgeAfter
        });
      for (const project of advanced.completedUpgradeProjects)
        emitRealtime("location:upgrade-completed", { nationId, project });
      for (const project of advanced.completedInfrastructureProjects ?? [])
        emitRealtime("infrastructure:project-completed", { nationId, project });
      for (const linkId of advanced.disabledInfrastructureLinkIds ?? [])
        emitRealtime("infrastructure:link-disabled", { nationId, linkId });
      for (const outcome of advanced.settlementOutcomes ?? []) {
        if (outcome.populationLevelChange > 0)
          emitRealtime("settlement:population-grown", { nationId, settlementId: outcome.settlementId, outcome });
        if (outcome.populationLevelChange < 0)
          emitRealtime("settlement:population-lost", { nationId, settlementId: outcome.settlementId, outcome });
        if (outcome.projectCompleted)
          emitRealtime("settlement:project-completed", {
            nationId,
            settlementId: outcome.settlementId,
            project: outcome.projectCompleted
          });
        if (outcome.shortageStarted)
          emitRealtime("settlement:shortage-started", { nationId, settlementId: outcome.settlementId, outcome });
        if (outcome.shortageEnded)
          emitRealtime("settlement:shortage-ended", { nationId, settlementId: outcome.settlementId, outcome });
      }
      if (advanced.expansion?.claimedTileIds.length)
        emitRealtime("territory:tiles-claimed", { nationId, tileIds: advanced.expansion.claimedTileIds });
      for (const outpostId of advanced.expansion?.maturedOutpostIds ?? [])
        emitRealtime("outpost:established", { nationId, outpostId });
      for (const settlementId of advanced.expansion?.foundedSettlementIds ?? [])
        emitRealtime("settlement:founded", { nationId, settlementId });
      if (advanced.generation.activeEvent)
        emitRealtime("event:generated", { nationId, activeEvent: advanced.generation.activeEvent });
      return advanced;
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const advanced = advanceFallbackNationTurn(nationId);
        if (!advanced) return reply.code(404).send({ message: "Nation not found" });
        const populationBeforeTurn = advanced.economy.economy.population - advanced.populationDelta;
        advanced.settlementOutcomes = processMemorySettlementTurn(nationId, advanced.currentTurn);
        advanced.settlementSummary = await getNationSettlementSummary(nationId);
        advanced.expansion = await processMemoryExpansionTurn(nationId, advanced.currentTurn);
        advanced.populationDelta = advanced.settlementSummary.totalPopulation - populationBeforeTurn;
        advanced.economy = reconcileFallbackPopulation(nationId, advanced.settlementSummary.totalPopulation)!;
        emitRealtime("nation:turn-advanced", { nationId, turn: advanced });
        if (advanced.technologyAgeBefore.id !== advanced.technologyAgeAfter.id)
          emitRealtime("technology:age-changed", {
            nationId,
            previousAge: advanced.technologyAgeBefore,
            currentAge: advanced.technologyAgeAfter
          });
        if (advanced.generation?.activeEvent) {
          emitRealtime("event:generated", { nationId, activeEvent: advanced.generation.activeEvent });
        }
        for (const project of advanced.completedUpgradeProjects)
          emitRealtime("location:upgrade-completed", { nationId, project });
        for (const project of advanced.completedInfrastructureProjects ?? [])
          emitRealtime("infrastructure:project-completed", { nationId, project });
        for (const linkId of advanced.disabledInfrastructureLinkIds ?? [])
          emitRealtime("infrastructure:link-disabled", { nationId, linkId });
        for (const outcome of advanced.settlementOutcomes) {
          if (outcome.populationLevelChange > 0)
            emitRealtime("settlement:population-grown", { nationId, settlementId: outcome.settlementId, outcome });
          if (outcome.populationLevelChange < 0)
            emitRealtime("settlement:population-lost", { nationId, settlementId: outcome.settlementId, outcome });
          if (outcome.projectCompleted)
            emitRealtime("settlement:project-completed", {
              nationId,
              settlementId: outcome.settlementId,
              project: outcome.projectCompleted
            });
          if (outcome.shortageStarted)
            emitRealtime("settlement:shortage-started", { nationId, settlementId: outcome.settlementId, outcome });
          if (outcome.shortageEnded)
            emitRealtime("settlement:shortage-ended", { nationId, settlementId: outcome.settlementId, outcome });
        }
        if (advanced.expansion?.claimedTileIds.length)
          emitRealtime("territory:tiles-claimed", { nationId, tileIds: advanced.expansion.claimedTileIds });
        for (const outpostId of advanced.expansion?.maturedOutpostIds ?? [])
          emitRealtime("outpost:established", { nationId, outpostId });
        for (const settlementId of advanced.expansion?.foundedSettlementIds ?? [])
          emitRealtime("settlement:founded", { nationId, settlementId });
        return advanced;
      }

      if (
        error instanceof Error &&
        (error.message.includes("not found") || (error as Error & { code?: string }).code === "P2025")
      ) {
        return reply.code(404).send({ message: "Nation not found" });
      }

      throw error;
    }
  });

  app.post("/api/events/:activeEventId/choose", async (request, reply) => {
    const { activeEventId } = z.object({ activeEventId: z.string() }).parse(request.params);
    const input = chooseEventSchema.parse(request.body);
    await requireActiveEventOwner(request, activeEventId);

    try {
      const result = await resolveEventChoice(activeEventId, input.choiceId);
      const nationId = result.event.nationId;
      emitRealtime("event:choice-resolved", { nationId, activeEventId, result });
      if (result.technologyAgeBefore?.id !== result.technologyAgeAfter?.id)
        emitRealtime("technology:age-changed", {
          nationId,
          previousAge: result.technologyAgeBefore,
          currentAge: result.technologyAgeAfter
        });
      if (result.createdPost) emitRealtime("nation:post-created", { nationId, post: result.createdPost });
      for (const followUp of result.followUpEvents ?? [])
        emitRealtime("event:generated", { nationId, activeEvent: followUp });
      return result;
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const existingStatus = getFallbackEventStatus(activeEventId);
        if (existingStatus && existingStatus !== "ACTIVE")
          return reply.code(409).send({ message: "Event is already resolved or expired" });
        const result = resolveFallbackEventChoice(activeEventId, input.choiceId);
        if (!result) return reply.code(404).send({ message: "Active event or choice not found" });
        if (result.historyEntry) {
          applyMemorySettlementEventEffects(result.event.nationId, result.historyEntry.effects);
        }
        emitRealtime("event:choice-resolved", { nationId: result.event.nationId, activeEventId, result });
        if (result.technologyAgeBefore?.id !== result.technologyAgeAfter?.id)
          emitRealtime("technology:age-changed", {
            nationId: result.event.nationId,
            previousAge: result.technologyAgeBefore,
            currentAge: result.technologyAgeAfter
          });
        if (result.createdPost) {
          emitRealtime("nation:post-created", { nationId: result.createdPost.nationId, post: result.createdPost });
        }
        for (const followUp of result.followUpEvents ?? []) {
          emitRealtime("event:generated", { nationId: followUp.nationId, activeEvent: followUp });
        }
        return result;
      }

      if (error instanceof Error && error.message.includes("not found")) {
        return reply.code(404).send({ message: error.message });
      }

      throw error;
    }
  });

  // Development/debug route for inspecting authored event templates.
  app.get("/api/event-templates", async () => {
    try {
      const templates = await prisma.eventTemplate.findMany({
        orderBy: { key: "asc" }
      });

      return templates.map(dbTemplateToDefinition);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return getFallbackEventTemplates();
      throw error;
    }
  });
}
