import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { emitRealtime } from "../realtime.js";
import {
  advanceFallbackNationTurn,
  generateFallbackEventForNation,
  getFallbackEventHistory,
  getFallbackEvents,
  getFallbackEventTemplates,
  isDatabaseUnavailable,
  resolveFallbackEventChoice
} from "../services/fallbackDemo.js";
import {
  advanceNationTurn,
  dbTemplateToDefinition,
  generateEventForNation,
  resolveEventChoice
} from "../services/eventEngineService.js";
import { serializeActiveEvent } from "../services/serializers.js";

const chooseEventSchema = z.object({
  choiceId: z.string().min(1)
});

export async function registerEventRoutes(app: FastifyInstance) {
  app.get("/api/nations/:nationId/events", async (request) => {
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
      }

      throw error;
    }
  });

  app.get("/api/nations/:nationId/event-history", async (request) => {
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
      }

      throw error;
    }
  });

  app.post("/api/nations/:nationId/events/generate", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);

    try {
      return await generateEventForNation(nationId);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const generated = generateFallbackEventForNation(nationId);
        if (!generated) return reply.code(404).send({ message: "Nation not found" });
        if (generated.activeEvent) {
          emitRealtime("event:generated", { nationId, activeEvent: generated.activeEvent });
        }
        return generated;
      }

      throw error;
    }
  });

  app.post("/api/nations/:nationId/advance-turn", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);

    try {
      return await advanceNationTurn(nationId);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const advanced = advanceFallbackNationTurn(nationId);
        if (!advanced) return reply.code(404).send({ message: "Nation not found" });
        if (advanced.generation?.activeEvent) {
          emitRealtime("event:generated", { nationId, activeEvent: advanced.generation.activeEvent });
        }
        return advanced;
      }

      throw error;
    }
  });

  app.post("/api/events/:activeEventId/choose", async (request, reply) => {
    const { activeEventId } = z.object({ activeEventId: z.string() }).parse(request.params);
    const input = chooseEventSchema.parse(request.body);

    try {
      return await resolveEventChoice(activeEventId, input.choiceId);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const result = resolveFallbackEventChoice(activeEventId, input.choiceId);
        if (!result) return reply.code(404).send({ message: "Active event or choice not found" });
        emitRealtime("event:choice-resolved", { activeEventId, result });
        for (const followUp of result.followUpEvents ?? []) {
          emitRealtime("event:generated", { nationId: followUp.nationId, activeEvent: followUp });
        }
        return result;
      }

      if (error instanceof Error && error.message.includes("not found")) {
        return reply.code(404).send({ message: error.message });
      }

      if (error instanceof Error && error.message.includes("already")) {
        return reply.code(400).send({ message: error.message });
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
