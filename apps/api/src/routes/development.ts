import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireNationOwner } from "../auth/principal.js";
import { conflict, notFound } from "../errors.js";
import { prisma } from "../prisma.js";
import { emitRealtime } from "../realtime.js";
import { cancelLocationUpgrade, getNationDevelopment, startLocationUpgrade } from "../services/developmentService.js";
import { memoryActiveSettlementProjectCount } from "../services/settlementService.js";
import {
  cancelFallbackLocationUpgrade,
  getFallbackDevelopment,
  getFallbackLocationNationId,
  getFallbackLocations,
  getFallbackUpgradeProjectNationId,
  isDatabaseUnavailable,
  startFallbackLocationUpgrade
} from "../services/fallbackDemo.js";

const startSchema = z.object({ engineerAgentId: z.string().nullable().optional() });

export async function registerDevelopmentRoutes(app: FastifyInstance) {
  app.get("/api/nations/:nationId/development", async (request) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);
    await requireNationOwner(request, nationId);
    try {
      return await getNationDevelopment(nationId);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const view = getFallbackDevelopment(nationId);
        if (!view) throw notFound("Nation not found");
        view.activeProjectCount += memoryActiveSettlementProjectCount(nationId);
        return view;
      }
      throw error;
    }
  });

  app.post("/api/map-locations/:locationId/upgrade-projects", async (request, reply) => {
    const { locationId } = z.object({ locationId: z.string() }).parse(request.params);
    const input = startSchema.parse(request.body ?? {});
    let nationId: string | null;
    try {
      nationId =
        (await prisma.mapLocation.findUnique({ where: { id: locationId }, select: { nationId: true } }))?.nationId ??
        null;
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;
      nationId = getFallbackLocationNationId(locationId);
    }
    if (!nationId) throw notFound("Map location not found");
    await requireNationOwner(request, nationId);
    const fallbackLocation = getFallbackLocations(nationId)?.find((item) => item.id === locationId);
    if (fallbackLocation && ["CAPITAL", "CITY", "TOWN"].includes(fallbackLocation.type))
      throw conflict("Full settlements are developed through settlement projects.");

    let project;
    try {
      project = await startLocationUpgrade(locationId, input.engineerAgentId);
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;
      project = startFallbackLocationUpgrade(locationId, input.engineerAgentId);
    }
    emitRealtime("location:upgrade-started", { nationId, project });
    return reply.code(201).send(project);
  });

  app.delete("/api/location-upgrade-projects/:projectId", async (request) => {
    const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
    let nationId: string | null;
    try {
      nationId =
        (await prisma.locationUpgradeProject.findUnique({ where: { id: projectId }, select: { nationId: true } }))
          ?.nationId ?? null;
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;
      nationId = getFallbackUpgradeProjectNationId(projectId);
    }
    if (!nationId) throw notFound("Location upgrade project not found");
    await requireNationOwner(request, nationId);

    let project;
    try {
      project = await cancelLocationUpgrade(projectId);
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;
      project = cancelFallbackLocationUpgrade(projectId);
    }
    emitRealtime("location:upgrade-cancelled", { nationId, project });
    return project;
  });
}
