import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nationPostTypeValues, postVisibilityValues } from "../domainValues.js";
import { prisma } from "../prisma.js";
import { emitRealtime } from "../realtime.js";
import { createFallbackPost, getFallbackPosts, isDatabaseUnavailable } from "../services/fallbackDemo.js";
import { serializePost } from "../services/serializers.js";

const createPostSchema = z.object({
  type: z.enum(nationPostTypeValues).default("NEWS"),
  title: z.string().min(2).max(140),
  body: z.string().min(1).max(6000),
  mediaUrl: z.string().url().nullable().optional(),
  visibility: z.enum(postVisibilityValues).default("PUBLIC")
});

export async function registerPostRoutes(app: FastifyInstance) {
  app.get("/api/nations/:nationId/posts", async (request, reply) => {
    const { nationId } = z.object({ nationId: z.string() }).parse(request.params);
    try {
      const posts = await prisma.nationPost.findMany({
        where: {
          nationId
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return posts.map(serializePost);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const fallbackPosts = getFallbackPosts(nationId);
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

      const post = await prisma.nationPost.create({
        data: {
          nationId,
          type: input.type,
          title: input.title,
          body: input.body,
          mediaUrl: input.mediaUrl ?? null,
          visibility: input.visibility
        }
      });

      const payload = serializePost(post);
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
}
