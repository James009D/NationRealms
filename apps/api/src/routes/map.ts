import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { getFallbackLocations, isDatabaseUnavailable } from "../services/fallbackDemo.js";
import { serializeLocation } from "../services/serializers.js";
import { requireNationOwner } from "../auth/principal.js";
import { getStrategicMapViewport } from "../services/strategicMapService.js";

export async function registerMapRoutes(app: FastifyInstance) {
  app.get("/api/nations/:nationId/strategic-map", async (request) => {
    const { nationId } = z.object({ nationId: z.string().min(1) }).parse(request.params);
    await requireNationOwner(request, nationId);
    const bounds = z
      .object({
        minX: z.coerce.number().int().min(0).default(0),
        minY: z.coerce.number().int().min(0).default(0),
        maxX: z.coerce.number().int().min(0).default(39),
        maxY: z.coerce.number().int().min(0).default(39)
      })
      .parse(request.query);
    return getStrategicMapViewport(nationId, bounds);
  });
  app.get("/api/nations/:nationId/map-locations", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);
    try {
      const locations = await prisma.mapLocation.findMany({
        where: {
          nationId
        },
        orderBy: [{ y: "asc" }, { x: "asc" }],
        include: { worldTile: true }
      });

      return locations.map(serializeLocation);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const fallbackLocations = getFallbackLocations(nationId);
        if (fallbackLocations) {
          return fallbackLocations;
        }

        return reply.code(404).send({ message: "Nation not found" });
      }

      throw error;
    }
  });
}
