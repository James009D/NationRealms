import type { RequestPrincipal } from "@statecraft/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getConfig } from "../config.js";
import { ApiError, forbidden, notFound } from "../errors.js";
import { prisma } from "../prisma.js";
import { getFallbackPost, isFallbackNation } from "../services/fallbackDemo.js";

declare module "fastify" {
  interface FastifyRequest {
    principal: RequestPrincipal;
    rawSessionToken?: string;
  }
}

export async function registerPrincipal(app: FastifyInstance) {
  app.decorateRequest("principal");
  app.addHook("onRequest", async (request) => {
    const config = getConfig();
    const forceAnonymous = request.headers["x-statecraft-principal"] === "anonymous";
    if (config.AUTH_MODE === "demo" && !forceAnonymous) {
      request.principal = { kind: "demo-user", userId: "demo-user", displayName: "Demo Strategist" };
      return;
    }

    request.principal = { kind: "anonymous" };
    const token = request.cookies?.[config.SESSION_COOKIE_NAME];
    if (!token || config.DATA_MODE !== "postgres") return;
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true }
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return;
    request.rawSessionToken = token;
    request.principal = { kind: "authenticated-user", userId: session.userId, displayName: session.user.displayName };
  });

  app.addHook("preHandler", async (request) => {
    const method = request.method.toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;
    if (request.url.startsWith("/api/auth/login") || request.url.startsWith("/api/auth/register")) return;
    if (getConfig().AUTH_MODE !== "session" || request.principal.kind !== "authenticated-user") return;
    const supplied = request.headers["x-csrf-token"];
    const expected = request.rawSessionToken ? csrfTokenForSession(request.rawSessionToken) : "";
    if (typeof supplied !== "string" || !safeEqual(supplied, expected)) {
      throw new ApiError(403, "FORBIDDEN", "A valid CSRF token is required");
    }
  });
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function csrfTokenForSession(token: string) {
  return createHmac("sha256", getConfig().SESSION_SECRET).update(token).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requirePrincipal(request: FastifyRequest): RequestPrincipal & { userId: string } {
  if (!request.principal.userId) {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }
  return request.principal as RequestPrincipal & { userId: string };
}

export async function requireNationOwner(request: FastifyRequest, nationId: string) {
  const principal = requirePrincipal(request);
  if (getConfig().DATA_MODE === "memory") {
    if (!isFallbackNation(nationId)) throw notFound("Nation not found");
    if (principal.kind !== "demo-user") throw forbidden();
    return { id: nationId, userId: principal.userId };
  }
  const nation = await prisma.nation.findUnique({ where: { id: nationId }, select: { id: true, userId: true } });
  if (!nation) throw notFound("Nation not found");
  if (principal.kind !== "demo-user" && nation.userId !== principal.userId) throw forbidden();
  return nation;
}

export async function requirePostOwner(request: FastifyRequest, postId: string) {
  const principal = requirePrincipal(request);
  if (getConfig().DATA_MODE === "memory") {
    const post = getFallbackPost(postId, true);
    if (!post) throw notFound("Post not found");
    if (principal.kind !== "demo-user") throw forbidden();
    return { id: post.id, nationId: post.nationId };
  }
  const post = await prisma.nationPost.findUnique({
    where: { id: postId },
    select: { id: true, nationId: true, nation: { select: { userId: true } } }
  });
  if (!post) throw notFound("Post not found");
  if (principal.kind !== "demo-user" && post.nation.userId !== principal.userId) throw forbidden();
  return post;
}

export async function requireAgentOwner(request: FastifyRequest, agentId: string) {
  const principal = requirePrincipal(request);
  if (getConfig().DATA_MODE === "memory") {
    if (principal.kind !== "demo-user") throw forbidden();
    return;
  }
  const agent = await prisma.characterAgent.findUnique({
    where: { id: agentId },
    select: { nation: { select: { userId: true } } }
  });
  if (!agent) throw notFound("Agent not found");
  if (principal.kind !== "demo-user" && agent.nation.userId !== principal.userId) throw forbidden();
}

export async function requireMilitaryUnitOwner(request: FastifyRequest, unitId: string) {
  const principal = requirePrincipal(request);
  if (getConfig().DATA_MODE === "memory") {
    if (principal.kind !== "demo-user") throw forbidden();
    return;
  }
  const unit = await prisma.militaryUnit.findUnique({
    where: { id: unitId },
    select: { nation: { select: { userId: true } } }
  });
  if (!unit) throw notFound("Military unit not found");
  if (principal.kind !== "demo-user" && unit.nation.userId !== principal.userId) throw forbidden();
}

export async function requireActiveEventOwner(request: FastifyRequest, activeEventId: string) {
  const principal = requirePrincipal(request);
  if (getConfig().DATA_MODE === "memory") {
    if (principal.kind !== "demo-user") throw forbidden();
    return;
  }
  const event = await prisma.activeEvent.findUnique({
    where: { id: activeEventId },
    select: { nation: { select: { userId: true } } }
  });
  if (!event) throw notFound("Active event not found");
  if (principal.kind !== "demo-user" && event.nation.userId !== principal.userId) throw forbidden();
}

export async function canReadPost(
  request: FastifyRequest,
  post: { id: string; nationId: string; visibility: string; deletedAt?: unknown }
) {
  if (post.visibility === "PUBLIC" && !post.deletedAt) return true;
  try {
    await requirePostOwner(request, post.id);
    return true;
  } catch {
    return false;
  }
}
