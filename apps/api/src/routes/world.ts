import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { STARTING_PACKAGES } from "@statecraft/shared";
import { getConfig } from "../config.js";
import { prisma } from "../prisma.js";
import { getFallbackLocations, getFallbackNations } from "../services/fallbackDemo.js";
import {
  getAllWorldTiles,
  getWorldOverview,
  getWorldViewport,
  previewHomeland,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "../services/worldService.js";

const viewportSchema = z.object({
  minX: z.coerce.number().int().min(0).default(0),
  minY: z.coerce.number().int().min(0).default(0),
  maxX: z.coerce.number().int().min(0).default(39),
  maxY: z.coerce.number().int().min(0).default(39)
});

export async function registerWorldRoutes(app: FastifyInstance) {
  app.get("/api/world-map/overview", async () => getWorldOverview());

  app.get("/api/world-map/tiles", async (request) => {
    const bounds = viewportSchema.parse(request.query);
    const viewport = await getWorldViewport(bounds);
    if (getConfig().DATA_MODE !== "memory") return viewport;
    const locations = getFallbackNations()
      .flatMap((nation) => (nation ? (getFallbackLocations(nation.id) ?? []) : []))
      .filter(
        (location) =>
          location.x >= viewport.bounds.minX &&
          location.x <= viewport.bounds.maxX &&
          location.y >= viewport.bounds.minY &&
          location.y <= viewport.bounds.maxY
      )
      .map(({ id, nationId, name, type, x, y }) => ({ id, nationId, name, type, x, y }));
    return { ...viewport, locations };
  });

  app.get("/api/world-map/nations/:nationId", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string().min(1) }).parse(request.params);
    if (getConfig().DATA_MODE === "memory") {
      const locations = getFallbackLocations(nationId);
      if (!locations) return reply.code(404).send({ message: "Nation not found" });
      const owned = (await getAllWorldTiles()).filter((tile) => tile.ownerNationId === nationId);
      return { nationId, tiles: owned, locations, links: [] };
    }
    const nation = await prisma.nation.findUnique({
      where: { id: nationId },
      include: {
        worldTiles: { orderBy: [{ y: "asc" }, { x: "asc" }] },
        mapLocations: { include: { worldTile: true } },
        infrastructureLinks: {
          where: { enabled: true },
          include: { tiles: { include: { tile: true }, orderBy: { sequence: "asc" } } }
        }
      }
    });
    if (!nation) return reply.code(404).send({ message: "Nation not found" });
    return { nationId, tiles: nation.worldTiles, locations: nation.mapLocations, links: nation.infrastructureLinks };
  });

  app.post("/api/world-map/homeland-preview", async (request) => {
    const input = z
      .object({
        capitalX: z
          .number()
          .int()
          .min(0)
          .max(WORLD_WIDTH - 1),
        capitalY: z
          .number()
          .int()
          .min(0)
          .max(WORLD_HEIGHT - 1),
        startingPackageId: z
          .string()
          .refine((id) => STARTING_PACKAGES.some((item) => item.id === id), "Unknown starting package")
      })
      .parse(request.body);
    return previewHomeland(input.capitalX, input.capitalY, input.startingPackageId);
  });
}
