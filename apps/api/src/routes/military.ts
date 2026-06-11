import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { emitRealtime } from "../realtime.js";
import { getFallbackMilitaryUnits, isDatabaseUnavailable, moveFallbackMilitaryUnit } from "../services/fallbackDemo.js";
import { serializeMilitaryUnit } from "../services/serializers.js";

const moveUnitSchema = z.object({
  locationId: z.string().min(1)
});

export async function registerMilitaryRoutes(app: FastifyInstance) {
  app.get("/api/nations/:nationId/military-units", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);
    try {
      const units = await prisma.militaryUnit.findMany({
        where: {
          nationId
        },
        include: {
          location: true,
          commanderAgent: true
        },
        orderBy: {
          name: "asc"
        }
      });

      return units.map(serializeMilitaryUnit);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const fallbackUnits = getFallbackMilitaryUnits(nationId);
        if (fallbackUnits) {
          return fallbackUnits;
        }

        return reply.code(404).send({ message: "Nation not found" });
      }

      throw error;
    }
  });

  app.post("/api/military-units/:unitId/move", async (request, reply) => {
    const { unitId } = z.object({ unitId: z.string() }).parse(request.params);
    const input = moveUnitSchema.parse(request.body);

    try {
      const unit = await prisma.militaryUnit.findUnique({
        where: {
          id: unitId
        }
      });

      if (!unit) {
        return reply.code(404).send({ message: "Military unit not found" });
      }

      const location = await prisma.mapLocation.findFirst({
        where: {
          id: input.locationId,
          nationId: unit.nationId
        },
        select: {
          id: true
        }
      });

      if (!location) {
        return reply.code(404).send({ message: "Target location not found" });
      }

      const updatedUnit = await prisma.militaryUnit.update({
        where: {
          id: unitId
        },
        data: {
          locationId: input.locationId
        },
        include: {
          location: true,
          commanderAgent: true
        }
      });

      const payload = serializeMilitaryUnit(updatedUnit);
      emitRealtime("military:unit-moved", {
        nationId: unit.nationId,
        unit: payload
      });

      return payload;
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const payload = moveFallbackMilitaryUnit(unitId, input.locationId);
        if (!payload) {
          return reply.code(404).send({ message: "Military unit or target location not found" });
        }

        emitRealtime("military:unit-moved", {
          nationId: payload.nationId,
          unit: payload
        });

        return payload;
      }

      throw error;
    }
  });
}
