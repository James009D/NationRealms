import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireMilitaryUnitOwner } from "../auth/principal.js";
import { ApiError } from "../errors.js";
import { prisma } from "../prisma.js";
import { emitRealtime } from "../realtime.js";
import { getFallbackMilitaryUnits, isDatabaseUnavailable, moveFallbackMilitaryUnit } from "../services/fallbackDemo.js";
import { serializeMilitaryUnit } from "../services/serializers.js";
import { movementInfrastructureDiscount } from "../services/infrastructureService.js";
import { terrainCombatForLocation } from "../services/terrainService.js";

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
          location: { include: { worldTile: true } },
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
    await requireMilitaryUnitOwner(request, unitId);

    try {
      const unit = await prisma.militaryUnit.findUnique({
        where: {
          id: unitId
        },
        include: { location: { include: { worldTile: true } } }
      });

      if (!unit) {
        return reply.code(404).send({ message: "Military unit not found" });
      }

      const location = await prisma.mapLocation.findFirst({
        where: {
          id: input.locationId,
          nationId: unit.nationId
        },
        include: { worldTile: true }
      });

      if (!location) {
        return reply.code(404).send({ message: "Target location not found" });
      }
      if (unit.locationId === location.id)
        throw new ApiError(400, "INVALID_REQUEST", "Unit is already at that location");
      const distance = unit.location
        ? Math.max(Math.abs(unit.location.x - location.x), Math.abs(unit.location.y - location.y))
        : 1;
      const links = await prisma.infrastructureLink.findMany({
        where: { nationId: unit.nationId, enabled: true },
        include: { tiles: { include: { tile: true } } }
      });
      const sharedLinks = links.map((link) => ({
        ...link,
        type: link.type,
        routeTiles: link.tiles.map((item) => ({ ...item.tile, claimedAt: item.tile.claimedAt?.toISOString() ?? null })),
        createdAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString()
      }));
      const infrastructureDiscount = unit.locationId
        ? movementInfrastructureDiscount(sharedLinks, unit.locationId, location.id)
        : 0;
      const terrain = terrainCombatForLocation(
        {
          type: location.type,
          resourceType: location.resourceType,
          worldTile: location.worldTile
            ? { terrain: location.worldTile.terrain, resourceDeposit: location.worldTile.resourceDeposit }
            : null
        },
        unit.type
      );
      const movementCost = Math.max(
        1,
        Math.ceil((distance + Math.max(0, terrain.movementCost - 1)) * (1 - infrastructureDiscount / 100))
      );
      if (movementCost > unit.movement)
        throw new ApiError(
          400,
          "INVALID_REQUEST",
          `Movement costs ${movementCost}; this unit can move ${unit.movement}`
        );
      const supplyCost = Math.max(
        3,
        Math.ceil(distance * 5 * (1 + terrain.supplyCostPercent / 100) * (1 - infrastructureDiscount / 100))
      );
      if (unit.supply < supplyCost || unit.readiness < 20)
        throw new ApiError(409, "CONFLICT", "Unit lacks the supply or readiness required to move");

      const updatedUnit = await prisma.militaryUnit.update({
        where: {
          id: unitId
        },
        data: {
          locationId: input.locationId,
          supply: { decrement: supplyCost },
          readiness: { decrement: Math.min(10, movementCost * 2) }
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

      return {
        ...payload,
        lastMove: {
          distance,
          movementCost,
          supplyCost,
          infrastructureDiscountPercent: infrastructureDiscount,
          terrain: terrain.terrain,
          defensePercent: terrain.defensePercent,
          attackPercent: terrain.attackPercent
        }
      };
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
