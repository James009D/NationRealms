import type { FastifyInstance } from "fastify";
import type { NationIdeology } from "@statecraft/shared";
import { z } from "zod";
import { prisma } from "../prisma.js";
import {
  getFallbackNation,
  getFallbackNationProfile,
  getFallbackNations,
  isDatabaseUnavailable,
  isFallbackNation
} from "../services/fallbackDemo.js";
import { summarizeIdeology } from "../services/nationCreationService.js";
import {
  serializeActiveEvent,
  serializeAgent,
  serializeLocation,
  serializeMilitaryUnit,
  serializeNation,
  serializePost,
  serializeStats
} from "../services/serializers.js";

export async function registerNationRoutes(app: FastifyInstance) {
  app.get("/api/nations", async () => {
    try {
      const nations = await prisma.nation.findMany({
        include: {
          stats: true
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return nations.map((nation) => ({
        ...serializeNation(nation),
        stats: nation.stats ? serializeStats(nation.stats) : null
      }));
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return getFallbackNations();
      }

      throw error;
    }
  });

  app.get("/api/nations/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    try {
      const nation = await prisma.nation.findUnique({
        where: {
          id
        },
        include: {
          stats: true,
          posts: {
            where: {
              visibility: "PUBLIC",
              deletedAt: null
            },
            take: 5,
            orderBy: {
              publishedAt: "desc"
            }
          },
          mapLocations: {
            orderBy: [{ y: "asc" }, { x: "asc" }]
          }
        }
      });

      if (!nation) {
        return reply.code(404).send({ message: "Nation not found" });
      }

      return {
        ...serializeNation(nation),
        stats: nation.stats ? serializeStats(nation.stats) : null,
        posts: nation.posts.map(serializePost)
      };
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        if (isFallbackNation(id)) {
          return getFallbackNation(id);
        }

        return reply.code(404).send({ message: "Nation not found" });
      }

      throw error;
    }
  });

  app.get("/api/nations/:id/profile", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    try {
      const nation = await prisma.nation.findUnique({
        where: {
          id
        },
        include: {
          stats: true,
          posts: {
            where: {
              visibility: "PUBLIC",
              deletedAt: null
            },
            take: 5,
            orderBy: {
              publishedAt: "desc"
            }
          },
          mapLocations: {
            take: 6,
            orderBy: [{ type: "asc" }, { name: "asc" }]
          },
          agents: {
            orderBy: {
              name: "asc"
            }
          },
          militaryUnits: {
            include: {
              location: true,
              commanderAgent: true
            },
            orderBy: {
              name: "asc"
            }
          },
          activeEvents: {
            where: {
              status: "ACTIVE"
            },
            include: {
              eventTemplate: true
            },
            orderBy: {
              createdAt: "desc"
            },
            take: 1
          },
          resolvedEvents: {
            orderBy: {
              createdAt: "desc"
            },
            take: 5
          },
          economy: true,
          resources: { orderBy: { type: "asc" } },
          economyLedger: { orderBy: { createdAt: "desc" }, take: 12 }
        }
      });

      if (!nation) {
        return reply.code(404).send({ message: "Nation not found" });
      }

      const serializedNation = serializeNation(nation);

      return {
        nation: serializedNation,
        stats: nation.stats ? serializeStats(nation.stats) : null,
        recentPosts: nation.posts.map(serializePost),
        importantMapLocations: nation.mapLocations.map(serializeLocation),
        agentsSummary: nation.agents.map(serializeAgent),
        militarySummary: nation.militaryUnits.map(serializeMilitaryUnit),
        activeEvents: nation.activeEvents.map(serializeActiveEvent),
        eventHistory: nation.resolvedEvents.map((entry) => ({
          ...entry,
          effects: entry.effectsJson,
          createdAt: entry.createdAt.toISOString()
        })),
        economy: nation.economy
          ? {
              economy: nation.economy,
              resources: nation.resources,
              recentLedger: nation.economyLedger
            }
          : null,
        ideologySummary: serializedNation.ideology
          ? summarizeIdeology(serializedNation.ideology as unknown as NationIdeology)
          : []
      };
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const profile = getFallbackNationProfile(id);
        if (profile) {
          return profile;
        }
      }

      throw error;
    }
  });

  app.post("/api/nations", async (request, reply) => {
    return reply.code(410).send({
      error: {
        code: "ENDPOINT_RETIRED",
        message: "Use POST /api/nations/create so all required starter records are created.",
        requestId: request.id
      }
    });
  });
}
