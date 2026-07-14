import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { canReadPost, requireNationOwner, requirePostOwner } from "../auth/principal.js";
import { ApiError } from "../errors.js";
import { prisma } from "../prisma.js";
import { emitRealtime } from "../realtime.js";
import {
  createFallbackPost,
  getFallbackFeed,
  getFallbackPost,
  getFallbackPosts,
  isDatabaseUnavailable,
  softDeleteFallbackPost,
  updateFallbackPost
} from "../services/fallbackDemo.js";
import {
  createPostForNation,
  createPostSchema,
  getPostById,
  listNationPosts,
  listPublicFeed,
  postFilterSchema,
  softDeletePost,
  updatePost,
  updatePostSchema
} from "../services/postService.js";

export async function registerPostRoutes(app: FastifyInstance) {
  app.get("/api/feed", async (request) => {
    const filter = postFilterSchema.parse(request.query);

    try {
      return await listPublicFeed(filter);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return getFallbackFeed(filter);
      }

      throw error;
    }
  });

  app.get("/api/posts/:postId", async (request, reply) => {
    const { postId } = z.object({ postId: z.string() }).parse(request.params);

    try {
      const post = await getPostById(postId);
      if (!post || !(await canReadPost(request, post))) throw new ApiError(404, "NOT_FOUND", "Post not found");
      return post;
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const post = getFallbackPost(postId);
        if (!post) return reply.code(404).send({ message: "Post not found" });
        if (!(await canReadPost(request, post))) throw new ApiError(404, "NOT_FOUND", "Post not found");
        return post;
      }

      throw error;
    }
  });

  app.get("/api/nations/:nationId/posts", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);
    const filter = postFilterSchema.parse(request.query);
    const ownerView = request.principal.kind !== "anonymous";
    if (!ownerView && (filter.includeDeleted || (filter.visibility && filter.visibility !== "PUBLIC"))) {
      throw new ApiError(403, "FORBIDDEN", "Owner access is required for private nation posts");
    }
    const effectiveFilter = ownerView ? filter : { ...filter, visibility: "PUBLIC" as const, includeDeleted: false };

    try {
      const nation = await prisma.nation.findUnique({ where: { id: nationId }, select: { id: true } });
      if (!nation) return reply.code(404).send({ message: "Nation not found" });

      return await listNationPosts(nationId, effectiveFilter);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const fallbackPosts = getFallbackPosts(nationId, effectiveFilter);
        if (fallbackPosts) {
          return fallbackPosts;
        }

        return reply.code(404).send({ message: "Nation not found" });
      }

      throw error;
    }
  });

  app.post("/api/nations/:nationId/posts", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);
    const input = createPostSchema.parse(request.body);
    await requireNationOwner(request, nationId);

    try {
      const nation = await prisma.nation.findUnique({
        where: {
          id: nationId
        },
        select: {
          id: true
        }
      });

      if (!nation) {
        return reply.code(404).send({ message: "Nation not found" });
      }

      const payload = await createPostForNation(nationId, input);
      emitRealtime("nation:post-created", {
        nationId,
        post: payload
      });

      return reply.code(201).send(payload);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const payload = createFallbackPost(nationId, input);
        if (!payload) {
          return reply.code(404).send({ message: "Nation not found" });
        }

        emitRealtime("nation:post-created", {
          nationId,
          post: payload
        });

        return reply.code(201).send(payload);
      }

      throw error;
    }
  });

  app.patch("/api/posts/:postId", async (request, reply) => {
    const { postId } = z.object({ postId: z.string() }).parse(request.params);
    const input = updatePostSchema.parse(request.body);
    await requirePostOwner(request, postId);

    try {
      const payload = await updatePost(postId, input);
      if (!payload) return reply.code(404).send({ message: "Post not found" });

      emitRealtime("nation:post-updated", {
        nationId: payload.nationId,
        post: payload
      });

      return payload;
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const payload = updateFallbackPost(postId, input);
        if (!payload) return reply.code(404).send({ message: "Post not found" });

        emitRealtime("nation:post-updated", {
          nationId: payload.nationId,
          post: payload
        });

        return payload;
      }

      throw error;
    }
  });

  app.delete("/api/posts/:postId", async (request, reply) => {
    const { postId } = z.object({ postId: z.string() }).parse(request.params);
    await requirePostOwner(request, postId);

    try {
      const payload = await softDeletePost(postId);
      if (!payload) return reply.code(404).send({ message: "Post not found" });

      emitRealtime("nation:post-deleted", {
        nationId: payload.nationId,
        postId,
        post: payload
      });

      return payload;
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const payload = softDeleteFallbackPost(postId);
        if (!payload) return reply.code(404).send({ message: "Post not found" });

        emitRealtime("nation:post-deleted", {
          nationId: payload.nationId,
          postId,
          post: payload
        });

        return payload;
      }

      throw error;
    }
  });
}
