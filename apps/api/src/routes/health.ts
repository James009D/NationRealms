import type { FastifyInstance } from "fastify";
import { getConfig } from "../config.js";
import { prisma } from "../prisma.js";

export async function registerHealthRoutes(app: FastifyInstance) {
  const live = async () => ({
    ok: true,
    service: "statecraft-api",
    timestamp: new Date().toISOString()
  });

  app.get("/health", live);
  app.get("/health/live", live);
  app.get("/health/ready", async (_request, reply) => {
    const config = getConfig();
    if (config.DATA_MODE === "memory") {
      return { ok: true, persistence: "memory", ephemeral: true, timestamp: new Date().toISOString() };
    }
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, persistence: "postgres", ephemeral: false, timestamp: new Date().toISOString() };
    } catch {
      return reply.code(503).send({
        error: { code: "DATABASE_UNAVAILABLE", message: "PostgreSQL is not ready", requestId: reply.request.id }
      });
    }
  });
}
