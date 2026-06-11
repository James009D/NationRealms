import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { economyTypeValues, governmentTypeValues } from "../domainValues.js";
import { prisma } from "../prisma.js";
import { getOrCreateDemoUser } from "../services/demoUser.js";
import {
  createFallbackLegacyNation,
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

const createNationSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(2).max(80),
  motto: z.string().max(160).default(""),
  governmentType: z.enum(governmentTypeValues).default("REPUBLIC"),
  economyType: z.enum(economyTypeValues).default("MIXED"),
  cultureSummary: z.string().max(1200).default("A young nation still defining its civic identity."),
  capitalName: z.string().min(2).max(80).default("New Capital"),
  flagUrl: z.string().url().nullable().optional()
});

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
            take: 5,
            orderBy: {
              createdAt: "desc"
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
      if (isDatabaseUnavailable(error) && isFallbackNation(id)) {
        return getFallbackNation(id);
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
            take: 5,
            orderBy: {
              createdAt: "desc"
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
          }
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
        ideologySummary: serializedNation.ideology ? summarizeIdeology(serializedNation.ideology) : []
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
    const input = createNationSchema.parse(request.body);

    try {
      const user = input.userId ? { id: input.userId } : await getOrCreateDemoUser();

      const nation = await prisma.nation.create({
        data: {
          userId: user.id,
          name: input.name,
          motto: input.motto,
          governmentType: input.governmentType,
          economyType: input.economyType,
          cultureSummary: input.cultureSummary,
          capitalName: input.capitalName,
          flagUrl: input.flagUrl ?? null,
          stats: {
            create: {
              economy: 50,
              stability: 50,
              liberty: 50,
              authority: 50,
              military: 30,
              technology: 35,
              environment: 50,
              publicTrust: 50
            }
          }
        },
        include: {
          stats: true
        }
      });

      return reply.code(201).send({
        ...serializeNation(nation),
        stats: nation.stats ? serializeStats(nation.stats) : null
      });
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return reply.code(201).send(createFallbackLegacyNation(input, input.userId));
      }

      throw error;
    }
  });
}
