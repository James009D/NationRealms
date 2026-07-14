import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireNationOwner } from "../auth/principal.js";
import { notFound } from "../errors.js";
import { emitRealtime } from "../realtime.js";
import { getFallbackTechnology, isDatabaseUnavailable, unlockFallbackTechnology } from "../services/fallbackDemo.js";
import { getNationTechnology, unlockTechnology } from "../services/technologyService.js";

const unlockSchema = z.object({ nodeKey: z.string().min(1).max(100) });

export async function registerTechnologyRoutes(app: FastifyInstance) {
  app.get("/api/nations/:nationId/technology", async (request) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);
    await requireNationOwner(request, nationId);
    try {
      return await getNationTechnology(nationId);
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;
      const view = getFallbackTechnology(nationId);
      if (!view) throw notFound("Nation not found");
      return view;
    }
  });

  app.post("/api/nations/:nationId/technology/unlocks", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);
    const { nodeKey } = unlockSchema.parse(request.body);
    await requireNationOwner(request, nationId);
    let result;
    try {
      result = await unlockTechnology(nationId, nodeKey);
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;
      result = unlockFallbackTechnology(nationId, nodeKey);
    }
    emitRealtime("technology:unlocked", { nationId, nodeKey, result });
    if (result.ageBefore.id !== result.ageAfter.id)
      emitRealtime("technology:age-changed", {
        nationId,
        previousAge: result.ageBefore,
        currentAge: result.ageAfter
      });
    return reply.code(201).send(result);
  });
}
