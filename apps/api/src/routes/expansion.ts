import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAgentOwner, requireNationOwner } from "../auth/principal.js";
import { notFound } from "../errors.js";
import { emitRealtime } from "../realtime.js";
import {
  cancelColonistTraining,
  cancelOutpostProject,
  cancelSettlementFounding,
  cancelTerritoryClaim,
  expansionEntityNationId,
  getNationTerritory,
  orderCivilianTravel,
  resettleCivilianUnit,
  previewOutpost,
  previewSettlementFounding,
  previewTerritoryClaim,
  startColonistTraining,
  startOutpost,
  startSettlementFounding,
  startTerritoryClaim
} from "../services/expansionService.js";
import {
  executeAgentAction,
  getAgentOperations,
  moveAgent,
  previewAgentTravel
} from "../services/agentActionService.js";

const nationParams = z.object({ nationId: z.string().min(1) });
const claimInput = z.object({ anchorLocationId: z.string().min(1), targetTileId: z.string().min(1) });
const outpostInput = z.object({
  claimId: z.string().min(1),
  parentSettlementId: z.string().min(1),
  name: z.string().trim().min(2).max(60).default("Frontier Outpost")
});
const foundingInput = z.object({
  colonistId: z.string().min(1),
  settlementName: z.string().trim().min(1).max(60),
  charter: z.enum(["AGRARIAN", "COMMERCIAL", "INDUSTRIAL", "DEFENSIVE", "CIVIC"]),
  founderAgentId: z.string().min(1).nullable().optional()
});

async function requireExpansionOwner(
  request: Parameters<typeof requireNationOwner>[0],
  kind: Parameters<typeof expansionEntityNationId>[0],
  id: string
) {
  const nationId = await expansionEntityNationId(kind, id);
  if (!nationId) throw notFound("Expansion entity not found");
  await requireNationOwner(request, nationId);
  return nationId;
}

export async function registerExpansionRoutes(app: FastifyInstance) {
  app.get("/api/nations/:nationId/territory", async (request) => {
    const { nationId } = nationParams.parse(request.params);
    await requireNationOwner(request, nationId);
    return getNationTerritory(nationId);
  });
  app.post("/api/nations/:nationId/territory/claims/preview", async (request) => {
    const { nationId } = nationParams.parse(request.params);
    await requireNationOwner(request, nationId);
    const input = claimInput.parse(request.body);
    return previewTerritoryClaim(nationId, input.anchorLocationId, input.targetTileId);
  });
  app.post("/api/nations/:nationId/territory/claims", async (request, reply) => {
    const { nationId } = nationParams.parse(request.params);
    await requireNationOwner(request, nationId);
    const input = claimInput.parse(request.body);
    const claim = await startTerritoryClaim(nationId, input.anchorLocationId, input.targetTileId);
    emitRealtime("territory:claim-started", { nationId, claimId: claim.id, claim });
    return reply.code(201).send(claim);
  });
  app.delete("/api/territory-claims/:claimId", async (request) => {
    const { claimId } = z.object({ claimId: z.string().min(1) }).parse(request.params);
    const nationId = await requireExpansionOwner(request, "claim", claimId);
    const claim = await cancelTerritoryClaim(claimId);
    emitRealtime("territory:claim-cancelled", { nationId, claimId });
    return claim;
  });
  app.post("/api/nations/:nationId/outposts/preview", async (request) => {
    const { nationId } = nationParams.parse(request.params);
    await requireNationOwner(request, nationId);
    const input = outpostInput.parse(request.body);
    return previewOutpost(nationId, input.claimId, input.parentSettlementId);
  });
  app.post("/api/nations/:nationId/outposts", async (request, reply) => {
    const { nationId } = nationParams.parse(request.params);
    await requireNationOwner(request, nationId);
    const input = outpostInput.parse(request.body);
    const outpost = await startOutpost(nationId, input.claimId, input.parentSettlementId, input.name);
    emitRealtime("outpost:project-started", { nationId, outpostId: outpost.id, outpost });
    return reply.code(201).send(outpost);
  });
  app.delete("/api/outpost-projects/:outpostId", async (request) => {
    const { outpostId } = z.object({ outpostId: z.string() }).parse(request.params);
    const nationId = await requireExpansionOwner(request, "outpost", outpostId);
    const outpost = await cancelOutpostProject(outpostId);
    emitRealtime("outpost:supply-changed", { nationId, outpostId, outpost });
    return outpost;
  });
  app.post("/api/nations/:nationId/settlements/:settlementId/colonists", async (request, reply) => {
    const { nationId, settlementId } = z
      .object({ nationId: z.string(), settlementId: z.string() })
      .parse(request.params);
    await requireNationOwner(request, nationId);
    return reply.code(201).send(await startColonistTraining(nationId, settlementId));
  });
  app.delete("/api/colonist-training-projects/:projectId", async (request) => {
    const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
    await requireExpansionOwner(request, "training", projectId);
    return cancelColonistTraining(projectId);
  });
  app.post("/api/civilian-units/:unitId/travel-orders", async (request) => {
    const { unitId } = z.object({ unitId: z.string() }).parse(request.params);
    const nationId = await requireExpansionOwner(request, "civilian", unitId);
    const { targetTileId } = z.object({ targetTileId: z.string().min(1) }).parse(request.body);
    const unit = await orderCivilianTravel(nationId, unitId, targetTileId);
    emitRealtime("civilian:unit-moved", { nationId, unitId, unit });
    return unit;
  });
  app.post("/api/civilian-units/:unitId/resettle", async (request) => {
    const { unitId } = z.object({ unitId: z.string() }).parse(request.params);
    const nationId = await requireExpansionOwner(request, "civilian", unitId);
    const { settlementId } = z.object({ settlementId: z.string() }).parse(request.body);
    return resettleCivilianUnit(nationId, unitId, settlementId);
  });
  app.post("/api/outposts/:outpostId/founding-preview", async (request) => {
    const { outpostId } = z.object({ outpostId: z.string() }).parse(request.params);
    const nationId = await requireExpansionOwner(request, "outpost", outpostId);
    const input = foundingInput.parse(request.body);
    return previewSettlementFounding(nationId, outpostId, input.colonistId, input.settlementName, input.charter);
  });
  app.post("/api/outposts/:outpostId/founding-projects", async (request, reply) => {
    const { outpostId } = z.object({ outpostId: z.string() }).parse(request.params);
    const nationId = await requireExpansionOwner(request, "outpost", outpostId);
    const input = foundingInput.parse(request.body);
    const project = await startSettlementFounding(
      nationId,
      outpostId,
      input.colonistId,
      input.settlementName,
      input.charter,
      input.founderAgentId
    );
    emitRealtime("settlement:founding-started", { nationId, projectId: project.id, project });
    return reply.code(201).send(project);
  });
  app.delete("/api/settlement-founding-projects/:projectId", async (request) => {
    const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
    await requireExpansionOwner(request, "founding", projectId);
    return cancelSettlementFounding(projectId);
  });
  app.get("/api/agents/:agentId/operations", async (request) => {
    const { agentId } = z.object({ agentId: z.string() }).parse(request.params);
    await requireAgentOwner(request, agentId);
    return getAgentOperations(agentId);
  });
  app.post("/api/agents/:agentId/travel-orders", async (request) => {
    const { agentId } = z.object({ agentId: z.string() }).parse(request.params);
    await requireAgentOwner(request, agentId);
    const { targetTileId } = z.object({ targetTileId: z.string() }).parse(request.body);
    const operations = await moveAgent(agentId, targetTileId);
    emitRealtime("agent:moved", { nationId: operations.nationId, agentId, operations });
    return operations;
  });
  app.post("/api/agents/:agentId/travel-preview", async (request) => {
    const { agentId } = z.object({ agentId: z.string() }).parse(request.params);
    await requireAgentOwner(request, agentId);
    const { targetTileId } = z.object({ targetTileId: z.string() }).parse(request.body);
    return previewAgentTravel(agentId, targetTileId);
  });
  app.post("/api/agents/:agentId/actions", async (request) => {
    const { agentId } = z.object({ agentId: z.string() }).parse(request.params);
    await requireAgentOwner(request, agentId);
    const input = z
      .object({
        type: z.enum([
          "CAMP",
          "FORAGE",
          "HUNT",
          "SURVEY",
          "GOVERN",
          "SPEECH",
          "DEFEND",
          "SPY",
          "COUNTERESPIONAGE",
          "DIPLOMATIC",
          "INDUSTRIAL"
        ]),
        targetId: z.string().min(1)
      })
      .parse(request.body);
    const result = await executeAgentAction(agentId, input.type, input.targetId);
    emitRealtime("agent:action-completed", { nationId: result.nationId, agentId, result });
    return result;
  });
}
