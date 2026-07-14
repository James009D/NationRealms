import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { csrfTokenForSession, hashSessionToken } from "../auth/principal.js";
import { getConfig } from "../config.js";
import { ApiError } from "../errors.js";
import { prisma } from "../prisma.js";

export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(4).max(200)
});
export const registerSchema = credentialsSchema.extend({ displayName: z.string().trim().min(2).max(60) });

function requireAccountMode() {
  const config = getConfig();
  if (config.DATA_MODE !== "postgres" || config.AUTH_MODE !== "session")
    throw new ApiError(503, "DATABASE_UNAVAILABLE", "Accounts require PostgreSQL session mode");
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getConfig().NODE_ENV === "production",
    path: "/",
    maxAge: getConfig().SESSION_TTL_DAYS * 86400
  };
}

async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + getConfig().SESSION_TTL_DAYS * 86400_000);
  await prisma.session.create({ data: { userId, tokenHash: hashSessionToken(rawToken), expiresAt } });
  return { rawToken, expiresAt };
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post(
    "/api/auth/register",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      requireAccountMode();
      const input = registerSchema.parse(request.body);
      const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (existing) throw new ApiError(409, "CONFLICT", "An account already exists for this email");
      const user = await prisma.user.create({
        data: { email: input.email, displayName: input.displayName, passwordHash: await hash(input.password) }
      });
      const session = await createSession(user.id);
      reply.setCookie(getConfig().SESSION_COOKIE_NAME, session.rawToken, cookieOptions());
      return reply.code(201).send({
        user: { id: user.id, email: user.email, displayName: user.displayName },
        csrfToken: csrfTokenForSession(session.rawToken),
        expiresAt: session.expiresAt.toISOString()
      });
    }
  );

  app.post("/api/auth/login", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    requireAccountMode();
    const input = credentialsSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user?.passwordHash || !(await verify(user.passwordHash, input.password))) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Invalid email or password");
    }
    const session = await createSession(user.id);
    reply.setCookie(getConfig().SESSION_COOKIE_NAME, session.rawToken, cookieOptions());
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      csrfToken: csrfTokenForSession(session.rawToken),
      expiresAt: session.expiresAt.toISOString()
    };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    if (request.rawSessionToken)
      await prisma.session.updateMany({
        where: { tokenHash: hashSessionToken(request.rawSessionToken), revokedAt: null },
        data: { revokedAt: new Date() }
      });
    reply.clearCookie(getConfig().SESSION_COOKIE_NAME, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/api/auth/session", async (request) => {
    const config = getConfig();
    return {
      principal: request.principal,
      csrfToken: request.rawSessionToken ? csrfTokenForSession(request.rawSessionToken) : null,
      dataMode: config.DATA_MODE,
      authMode: config.AUTH_MODE,
      accountsAvailable: config.DATA_MODE === "postgres" && config.AUTH_MODE === "session"
    };
  });
}
