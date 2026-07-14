import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAgentOwner } from "../auth/principal.js";
import { agentAssignmentValues } from "../domainValues.js";
import { prisma } from "../prisma.js";
import { emitRealtime } from "../realtime.js";
import { assignFallbackAgent, getFallbackAgents, isDatabaseUnavailable } from "../services/fallbackDemo.js";
import { serializeAgent } from "../services/serializers.js";
import { syncMemoryGovernorAssignment } from "../services/settlementService.js";

const assignAgentSchema = z.object({
  assignment: z.enum(agentAssignmentValues),
  assignedLocationId: z.string().nullable().optional()
});

export async function registerAgentRoutes(app: FastifyInstance) {
  app.get("/api/nations/:nationId/agents", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);
    try {
      const agents = await prisma.characterAgent.findMany({
        where: {
          nationId
        },
        orderBy: {
          name: "asc"
        }
      });

      return agents.map(serializeAgent);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const fallbackAgents = getFallbackAgents(nationId);
        if (fallbackAgents) {
          return fallbackAgents;
        }

        return reply.code(404).send({ message: "Nation not found" });
      }

      throw error;
    }
  });

  app.post("/api/agents/:agentId/assign", async (request, reply) => {
    const { agentId } = z.object({ agentId: z.string() }).parse(request.params);
    const input = assignAgentSchema.parse(request.body);
    await requireAgentOwner(request, agentId);

    try {
      const agent = await prisma.characterAgent.findUnique({
        where: {
          id: agentId
        }
      });

      if (!agent) {
        return reply.code(404).send({ message: "Agent not found" });
      }

      if (input.assignedLocationId) {
        const location = await prisma.mapLocation.findFirst({
          where: {
            id: input.assignedLocationId,
            nationId: agent.nationId
          },
          select: {
            id: true
          }
        });

        if (!location) {
          return reply.code(404).send({ message: "Assigned location not found" });
        }
      }

      const updatedAgent = await prisma.$transaction(async (tx) => {
        const updated = await tx.characterAgent.update({
          where: { id: agentId },
          data: {
            assignment: input.assignment,
            assignedLocationId: input.assignedLocationId ?? null
          }
        });
        await tx.settlement.updateMany({
          where: { governorAgentId: agentId },
          data: { governorAgentId: null }
        });
        if (agent.role === "GOVERNOR" && input.assignment === "GOVERNING" && input.assignedLocationId) {
          await tx.settlement.updateMany({
            where: { nationId: agent.nationId, locationId: input.assignedLocationId },
            data: { governorAgentId: agentId }
          });
        }
        return updated;
      });

      const payload = serializeAgent(updatedAgent);
      emitRealtime("agent:assigned", {
        nationId: agent.nationId,
        agent: payload
      });

      return payload;
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const payload = assignFallbackAgent(agentId, input);
        if (!payload) {
          return reply.code(404).send({ message: "Agent or assigned location not found" });
        }

        syncMemoryGovernorAssignment(payload);

        emitRealtime("agent:assigned", {
          nationId: payload.nationId,
          agent: payload
        });

        return payload;
      }

      throw error;
    }
  });
}
