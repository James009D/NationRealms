import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { Server as SocketIOServer } from "socket.io";
import { ZodError } from "zod";
import { hashSessionToken, registerPrincipal } from "./auth/principal.js";
import { getConfig } from "./config.js";
import { ApiError, sendApiError } from "./errors.js";
import { prisma } from "./prisma.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerDemoRoutes } from "./routes/demo.js";
import { registerDevelopmentRoutes } from "./routes/development.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerExpansionRoutes } from "./routes/expansion.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerInfrastructureRoutes } from "./routes/infrastructure.js";
import { registerMapRoutes } from "./routes/map.js";
import { registerMilitaryRoutes } from "./routes/military.js";
import { registerNationCreationRoutes } from "./routes/nationCreation.js";
import { registerNationRoutes } from "./routes/nations.js";
import { registerPostRoutes } from "./routes/posts.js";
import { registerTechnologyRoutes } from "./routes/technology.js";
import { registerSettlementRoutes } from "./routes/settlements.js";
import { registerWorldRoutes } from "./routes/world.js";
import { registerInboxRoutes } from "./routes/inbox.js";
import { setRealtimeServer } from "./realtime.js";

function isAllowedOrigin(origin: string | undefined, configuredOrigins: string[], allowLocalDev: boolean) {
  if (!origin) {
    return true;
  }

  const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  return configuredOrigins.includes(origin) || (allowLocalDev && isLocalDevOrigin);
}

export async function buildApp(options: { logger?: boolean } = {}) {
  const config = getConfig();
  const requestStartedAt = new WeakMap<object, number>();
  const metrics = { requests: 0, errors: 0, slowRequests: 0, startedAt: new Date().toISOString() };
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            redact: [
              "req.headers.authorization",
              "req.headers.cookie",
              "res.headers.set-cookie",
              "password",
              "passwordHash",
              "tokenHash"
            ]
          },
    requestIdHeader: "x-request-id",
    bodyLimit: 1024 * 1024
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
    } catch {
      const error = new Error("Invalid JSON body") as Error & { statusCode: number };
      error.statusCode = 400;
      done(error, undefined);
    }
  });

  const configuredOrigins = config.CORS_ORIGIN.split(",").map((origin) => origin.trim());
  const allowLocalDev = config.NODE_ENV !== "production";

  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: config.RATE_LIMIT_MAX, timeWindow: "1 minute" });

  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin, configuredOrigins, allowLocalDev));
    }
  });

  const io = new SocketIOServer(app.server, {
    cors: {
      credentials: true,
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin ?? undefined, configuredOrigins, allowLocalDev));
      }
    }
  });

  setRealtimeServer(io);

  io.use(async (socket, next) => {
    if (config.AUTH_MODE === "demo") {
      socket.data.principalKind = "demo-user";
      next();
      return;
    }
    const cookieHeader = socket.handshake.headers.cookie ?? "";
    const rawToken = cookieHeader
      .split(";")
      .map((part) => part.trim().split("="))
      .find(([name]) => name === config.SESSION_COOKIE_NAME)?.[1];
    if (rawToken && config.DATA_MODE === "postgres") {
      const session = await prisma.session.findUnique({
        where: { tokenHash: hashSessionToken(decodeURIComponent(rawToken)) }
      });
      if (session && !session.revokedAt && session.expiresAt > new Date()) socket.data.userId = session.userId;
    }
    next();
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      sendApiError(reply, error.statusCode, error.code, error.message, error.issues);
      return;
    }

    if (error instanceof ZodError) {
      sendApiError(reply, 400, "INVALID_REQUEST", "Invalid request payload", error.issues);
      return;
    }

    if (error instanceof Error && error.message.includes("Can't reach database server")) {
      sendApiError(
        reply,
        503,
        "DATABASE_UNAVAILABLE",
        "Database is unavailable. Start PostgreSQL and verify DATABASE_URL."
      );
      return;
    }

    // Preserve framework client errors (bad JSON, payload too large, ...)
    // instead of collapsing them into 500s.
    const clientError = error as { statusCode?: unknown; message?: unknown };
    if (typeof clientError.statusCode === "number" && clientError.statusCode >= 400 && clientError.statusCode < 500) {
      sendApiError(
        reply,
        clientError.statusCode,
        "INVALID_REQUEST",
        typeof clientError.message === "string" ? clientError.message : "Invalid request"
      );
      return;
    }

    request.log.error(error);
    sendApiError(reply, 500, "INTERNAL_ERROR", "Internal server error");
  });

  app.addHook("onRequest", async (request) => {
    requestStartedAt.set(request, Date.now());
    metrics.requests += 1;
  });
  app.addHook("onResponse", async (request, reply) => {
    if (reply.statusCode >= 500) metrics.errors += 1;
    const duration = Date.now() - (requestStartedAt.get(request) ?? Date.now());
    if (duration >= config.SLOW_REQUEST_MS) {
      metrics.slowRequests += 1;
      request.log.warn({ duration, method: request.method, url: request.url }, "Slow request");
    }
  });
  app.get("/health/metrics", async () => ({ ...metrics, uptimeSeconds: Math.floor(process.uptime()) }));

  app.addHook("preSerialization", async (request, reply, payload) => {
    if (reply.statusCode < 400 || !payload || typeof payload !== "object" || "error" in payload) return payload;
    const legacy = payload as { message?: unknown; issues?: unknown; validationMessages?: unknown };
    if (typeof legacy.message !== "string") return payload;
    return {
      error: {
        code: reply.statusCode === 404 ? "NOT_FOUND" : reply.statusCode === 409 ? "CONFLICT" : "INVALID_REQUEST",
        message: legacy.message,
        issues: legacy.issues ?? legacy.validationMessages,
        requestId: request.id
      }
    };
  });

  io.on("connection", (socket) => {
    socket.join("public:feed");
    if (typeof socket.data.userId === "string") socket.join(`user:${socket.data.userId}`);
    socket.emit("connected", {
      service: "statecraft-api",
      connectedAt: new Date().toISOString()
    });
    socket.on("nation:subscribe", async (nationId: unknown) => {
      if (typeof nationId !== "string" || nationId.length > 100) return;
      if (socket.data.principalKind === "demo-user") {
        socket.join(`nation:${nationId}`);
        return;
      }
      if (typeof socket.data.userId !== "string") return;
      const nation = await prisma.nation.findFirst({
        where: { id: nationId, userId: socket.data.userId },
        select: { id: true }
      });
      if (nation) socket.join(`nation:${nationId}`);
    });
    socket.on("nation:unsubscribe", (nationId: unknown) => {
      if (typeof nationId === "string") socket.leave(`nation:${nationId}`);
    });
  });

  await registerPrincipal(app);

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerDemoRoutes(app);
  await registerDevelopmentRoutes(app);
  await registerInfrastructureRoutes(app);
  await registerTechnologyRoutes(app);
  await registerSettlementRoutes(app);
  await registerExpansionRoutes(app);
  await registerInboxRoutes(app);
  await registerWorldRoutes(app);
  await registerNationCreationRoutes(app);
  await registerNationRoutes(app);
  await registerPostRoutes(app);
  await registerEventRoutes(app);
  await registerMapRoutes(app);
  await registerAgentRoutes(app);
  await registerMilitaryRoutes(app);

  return app;
}
