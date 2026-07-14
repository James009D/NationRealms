import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { GovernorPriority, SettlementProjectType } from "@statecraft/shared";
import { requireNationOwner } from "../auth/principal.js";
import { notFound } from "../errors.js";
import { emitRealtime } from "../realtime.js";
import {
  cancelSettlementProject,
  getNationSettlementSummary,
  getSettlementView,
  previewSettlementProject,
  previewSettlementSite,
  settlementNationId,
  settlementProjectNationId,
  startSettlementProject,
  updateGovernorPriority,
  updateSettlementWorkforce
} from "../services/settlementService.js";

const settlementParams = z.object({ settlementId: z.string().min(1) });
const nationParams = z.object({ nationId: z.string().min(1) });
const workforceSchema = z.object({
  assignments: z
    .array(z.object({ jobKey: z.string().min(1).max(120), assigned: z.number().int().min(0).max(100) }))
    .max(80)
});
const prioritySchema = z.object({
  priority: z.enum([
    "GROWTH",
    "PRODUCTION",
    "FOOD_SECURITY",
    "COMMERCE",
    "RESEARCH",
    "MILITARY",
    "STABILITY",
    "BALANCED"
  ])
});
const projectSchema = z.object({
  type: z.enum([
    "BUILDING",
    "SETTLEMENT_UPGRADE",
    "REGIONAL_IMPROVEMENT",
    "SPECIALIZATION_CHANGE",
    "NETWORK_RESTORATION"
  ]),
  definitionKey: z.string().min(1).max(120),
  specializationSlot: z.enum(["PRIMARY", "SECONDARY"]).optional()
});
const siteSchema = z.object({ x: z.number().int().min(0).max(95), y: z.number().int().min(0).max(63) });

async function requireSettlementOwner(request: FastifyRequest, settlementId: string) {
  const nationId = await settlementNationId(settlementId);
  if (!nationId) throw notFound("Settlement not found");
  await requireNationOwner(request, nationId);
  return nationId;
}

export async function registerSettlementRoutes(app: FastifyInstance) {
  app.get("/api/nations/:nationId/settlements", async (request) => {
    const { nationId } = nationParams.parse(request.params);
    await requireNationOwner(request, nationId);
    return getNationSettlementSummary(nationId);
  });

  app.get("/api/nations/:nationId/regions", async (request) => {
    const { nationId } = nationParams.parse(request.params);
    await requireNationOwner(request, nationId);
    const summary = await getNationSettlementSummary(nationId);
    return summary.settlements.map((settlement) => settlement.region);
  });

  app.get("/api/settlements/:settlementId", async (request) => {
    const { settlementId } = settlementParams.parse(request.params);
    await requireSettlementOwner(request, settlementId);
    return getSettlementView(settlementId);
  });

  app.patch("/api/settlements/:settlementId/workforce", async (request) => {
    const { settlementId } = settlementParams.parse(request.params);
    const input = workforceSchema.parse(request.body);
    const nationId = await requireSettlementOwner(request, settlementId);
    const settlement = await updateSettlementWorkforce(settlementId, input.assignments);
    emitRealtime("settlement:updated", { nationId, settlementId, settlement });
    return settlement;
  });

  app.patch("/api/settlements/:settlementId/governor-priority", async (request) => {
    const { settlementId } = settlementParams.parse(request.params);
    const { priority } = prioritySchema.parse(request.body);
    const nationId = await requireSettlementOwner(request, settlementId);
    const settlement = await updateGovernorPriority(settlementId, priority as GovernorPriority);
    emitRealtime("settlement:updated", { nationId, settlementId, settlement });
    return settlement;
  });

  app.post("/api/settlements/:settlementId/projects/preview", async (request) => {
    const { settlementId } = settlementParams.parse(request.params);
    await requireSettlementOwner(request, settlementId);
    const input = projectSchema.parse(request.body);
    return previewSettlementProject(settlementId, { ...input, type: input.type as SettlementProjectType });
  });

  app.post("/api/settlements/:settlementId/projects", async (request, reply) => {
    const { settlementId } = settlementParams.parse(request.params);
    const nationId = await requireSettlementOwner(request, settlementId);
    const input = projectSchema.parse(request.body);
    const project = await startSettlementProject(settlementId, { ...input, type: input.type as SettlementProjectType });
    emitRealtime("settlement:updated", { nationId, settlementId, project });
    return reply.code(201).send(project);
  });

  app.delete("/api/settlement-projects/:projectId", async (request) => {
    const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
    const nationId = await settlementProjectNationId(projectId);
    if (!nationId) throw notFound("Settlement project not found");
    await requireNationOwner(request, nationId);
    const project = await cancelSettlementProject(projectId);
    emitRealtime("settlement:updated", { nationId: project.nationId, settlementId: project.settlementId, project });
    return project;
  });

  app.post("/api/nations/:nationId/settlement-sites/preview", async (request) => {
    const { nationId } = nationParams.parse(request.params);
    await requireNationOwner(request, nationId);
    const input = siteSchema.parse(request.body);
    return previewSettlementSite(nationId, input.x, input.y);
  });
}
