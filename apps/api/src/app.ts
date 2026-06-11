import cors from "@fastify/cors";
import Fastify from "fastify";
import { Server as SocketIOServer } from "socket.io";
import { ZodError } from "zod";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerDemoRoutes } from "./routes/demo.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMapRoutes } from "./routes/map.js";
import { registerMilitaryRoutes } from "./routes/military.js";
import { registerNationCreationRoutes } from "./routes/nationCreation.js";
import { registerNationRoutes } from "./routes/nations.js";
import { registerPostRoutes } from "./routes/posts.js";
import { setRealtimeServer } from "./realtime.js";

function isAllowedOrigin(origin: string | undefined, configuredOrigins: string[]) {
  if (!origin) {
    return true;
  }

  const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  return configuredOrigins.includes(origin) || isLocalDevOrigin;
}

export async function buildApp(options: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: options.logger ?? true
  });

  // Browser clients send Content-Type: application/json on body-less POSTs
  // (e.g. generate event, advance turn). Fastify's default parser rejects an
  // empty JSON body, so accept it as "no body" instead.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    if (typeof body !== "string" || body.trim() === "") {
      done(null, undefined);
      return;
    }

    try {
      done(null, JSON.parse(body));
    } catch (cause) {
      const error = new Error("Invalid JSON body") as Error & { statusCode: number };
      error.statusCode = 400;
      done(error, undefined);
    }
  });

  const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : [];

  await app.register(cors, {
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin, configuredOrigins));
    }
  });

  const io = new SocketIOServer(app.server, {
    cors: {
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin ?? undefined, configuredOrigins));
      }
    }
  });

  setRealtimeServer(io);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      reply.code(400).send({
        message: "Invalid request payload",
        issues: error.issues
      });
      return;
    }

    if (error.message.includes("Can't reach database server")) {
      reply.code(503).send({
        message:
          "Database is unavailable. Start PostgreSQL, confirm DATABASE_URL, then run npm run db:push and npm run prisma:seed."
      });
      return;
    }

    // Preserve framework client errors (bad JSON, payload too large, ...)
    // instead of collapsing them into 500s.
    if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      reply.code(error.statusCode).send({ message: error.message });
      return;
    }

    request.log.error(error);
    reply.code(500).send({
      message: "Internal server error"
    });
  });

  io.on("connection", (socket) => {
    socket.emit("connected", {
      service: "statecraft-api",
      connectedAt: new Date().toISOString()
    });
  });

  await registerHealthRoutes(app);
  await registerDemoRoutes(app);
  await registerNationCreationRoutes(app);
  await registerNationRoutes(app);
  await registerPostRoutes(app);
  await registerEventRoutes(app);
  await registerMapRoutes(app);
  await registerAgentRoutes(app);
  await registerMilitaryRoutes(app);

  return app;
}
