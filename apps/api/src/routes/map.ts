import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { getFallbackLocations, isDatabaseUnavailable } from "../services/fallbackDemo.js";
import { serializeLocation } from "../services/serializers.js";

export async function registerMapRoutes(app: FastifyInstance) {
  app.get("/api/nations/:nationId/map-locations", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);
    try {
      const locations = await prisma.mapLocation.findMany({
        where: {
          nationId
        },
        orderBy: [{ y: "asc" }, { x: "asc" }]
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
