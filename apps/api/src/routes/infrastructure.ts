import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireNationOwner } from "../auth/principal.js";
import { notFound } from "../errors.js";
import { emitRealtime } from "../realtime.js";
import {
  cancelInfrastructureProject,
  getNationInfrastructure,
  infrastructureProjectNationId,
  previewInfrastructure,
  startInfrastructureProject
} from "../services/infrastructureService.js";

const routeInput = z.object({
  fromLocationId: z.string().min(1),
  toLocationId: z.string().min(1),
  type: z.enum(["ROAD", "RAIL", "SEA_LANE"]),
  engineerAgentId: z.string().min(1).nullable().optional()
});

export async function registerInfrastructureRoutes(app: FastifyInstance) {
  app.get("/api/nations/:nationId/infrastructure", async (request) => {
    const { nationId } = z.object({ nationId: z.string().min(1) }).parse(request.params);
    await requireNationOwner(request, nationId);
    return getNationInfrastructure(nationId);
  });

  app.post("/api/nations/:nationId/infrastructure/preview", async (request) => {
    const { nationId } = z.object({ nationId: z.string().min(1) }).parse(request.params);
    await requireNationOwner(request, nationId);
    return previewInfrastructure(nationId, routeInput.parse(request.body));
  });

  app.post("/api/nations/:nationId/infrastructure-projects", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string().min(1) }).parse(request.params);
    await requireNationOwner(request, nationId);
    const project = await startInfrastructureProject(nationId, routeInput.parse(request.body));
    emitRealtime("infrastructure:project-started", { nationId, project });
    return reply.code(201).send(project);
  });

  app.delete("/api/infrastructure-projects/:projectId", async (request) => {
    const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
    const nationId = await infrastructureProjectNationId(projectId);
    if (!nationId) throw notFound("Infrastructure project not found");
    await requireNationOwner(request, nationId);
    const project = await cancelInfrastructureProject(projectId);
    emitRealtime("infrastructure:project-cancelled", { nationId, project });
    return project;
  });
}
