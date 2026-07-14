import type { Prisma, PrismaClient } from "@prisma/client";
import type { NationPost, NationPostFilter, PostSourceType, PostVisibility } from "@statecraft/shared";
import { z } from "zod";
import {
  nationPostTypeValues,
  postContentFormatValues,
  postSourceTypeValues,
  postVisibilityValues
} from "../domainValues.js";
import { prisma } from "../prisma.js";
import { serializePost } from "./serializers.js";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

const tagSchema = z.array(z.string().trim().min(1).max(32)).max(8).default([]);

export const postFilterSchema = z.object({
  nationId: z.string().optional(),
  type: z.enum(nationPostTypeValues).optional(),
  sourceType: z.enum(postSourceTypeValues).optional(),
  visibility: z.union([z.enum(postVisibilityValues), z.literal("ALL")]).optional(),
  includeDeleted: z.preprocess(
    (value) => (value === "true" || value === true ? true : value === "false" || value === false ? false : value),
    z.boolean().optional()
  ),
  search: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(32).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z
    .string()
    .max(240)
    .refine((value) => decodeFeedCursor(value) !== null, "Invalid feed cursor")
    .optional()
});

export const createPostSchema = z.object({
  type: z.enum(nationPostTypeValues).default("NEWS"),
  title: z.string().trim().min(2).max(140),
  body: z.string().trim().min(1).max(12000),
  format: z.enum(postContentFormatValues).default("MARKDOWN"),
  mediaUrl: z.string().url().nullable().optional(),
  visibility: z.enum(postVisibilityValues).default("PUBLIC"),
  tags: tagSchema,
  excerpt: z.string().trim().max(280).nullable().optional()
});

export const updatePostSchema = createPostSchema.partial().extend({
  title: z.string().trim().min(2).max(140).optional(),
  body: z.string().trim().min(1).max(12000).optional(),
  tags: tagSchema.optional()
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type PostFilterInput = z.infer<typeof postFilterSchema>;

export function normalizeTags(tags: string[] = []) {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
}

export function buildExcerpt(body: string, provided?: string | null) {
  if (provided?.trim()) return provided.trim();

  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return plain.length > 220 ? `${plain.slice(0, 217)}...` : plain;
}

export function publishedAtForVisibility(visibility: PostVisibility, existing?: string | Date | null) {
  if (visibility !== "PUBLIC") return null;
  if (existing) return existing instanceof Date ? existing : new Date(existing);
  return new Date();
}

export function postMatchesFilter(post: NationPost, filter: NationPostFilter, publicOnly = false) {
  if (filter.nationId && post.nationId !== filter.nationId) return false;
  if (filter.type && post.type !== filter.type) return false;
  if (filter.sourceType && post.sourceType !== filter.sourceType) return false;
  if (filter.visibility && filter.visibility !== "ALL" && post.visibility !== filter.visibility) return false;
  if (!filter.includeDeleted && post.deletedAt) return false;
  if (publicOnly && (post.visibility !== "PUBLIC" || post.deletedAt)) return false;
  if (filter.tag && !post.tags.map((tag) => tag.toLowerCase()).includes(filter.tag.toLowerCase())) return false;
  if (filter.search) {
    const haystack = `${post.title} ${post.body} ${post.excerpt ?? ""}`.toLowerCase();
    if (!haystack.includes(filter.search.toLowerCase())) return false;
  }

  return true;
}

function postWhere(filter: PostFilterInput, publicOnly: boolean): Prisma.NationPostWhereInput {
  const cursor = filter.cursor ? decodeFeedCursor(filter.cursor) : null;
  const conditions: Prisma.NationPostWhereInput[] = [];
  if (filter.search) {
    conditions.push({
      OR: [
        { title: { contains: filter.search, mode: "insensitive" } },
        { body: { contains: filter.search, mode: "insensitive" } },
        { excerpt: { contains: filter.search, mode: "insensitive" } }
      ]
    });
  }
  if (cursor) {
    conditions.push({
      OR: [{ publishedAt: { lt: cursor.publishedAt } }, { publishedAt: cursor.publishedAt, id: { lt: cursor.id } }]
    });
  }
  const where: Prisma.NationPostWhereInput = {
    ...(filter.nationId ? { nationId: filter.nationId } : {}),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.sourceType ? { sourceType: filter.sourceType } : {}),
    ...(conditions.length ? { AND: conditions } : {}),
    ...(filter.tag ? { tags: { some: { value: filter.tag.toLowerCase() } } } : {})
  };

  if (publicOnly) {
    return { ...where, visibility: "PUBLIC", deletedAt: null, publishedAt: { not: null } };
  }

  if (!filter.includeDeleted) where.deletedAt = null;
  if (filter.visibility && filter.visibility !== "ALL") where.visibility = filter.visibility;

  return where;
}

const postInclude = {
  nation: true,
  sourceEventHistory: true,
  tags: { orderBy: { value: "asc" as const } }
} satisfies Prisma.NationPostInclude;

export function encodeFeedCursor(post: { id: string; publishedAt?: string | Date | null }) {
  const publishedAt = post.publishedAt instanceof Date ? post.publishedAt.toISOString() : post.publishedAt;
  return Buffer.from(JSON.stringify({ id: post.id, publishedAt }), "utf8").toString("base64url");
}

export function decodeFeedCursor(cursor: string): { id: string; publishedAt: Date } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      id?: unknown;
      publishedAt?: unknown;
    };
    if (typeof parsed.id !== "string" || typeof parsed.publishedAt !== "string") return null;
    const publishedAt = new Date(parsed.publishedAt);
    return Number.isNaN(publishedAt.valueOf()) ? null : { id: parsed.id, publishedAt };
  } catch {
    return null;
  }
}

export async function listPublicFeed(filter: PostFilterInput, client: Tx = prisma) {
  const posts = await client.nationPost.findMany({
    where: postWhere(filter, true),
    include: postInclude,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: filter.limit
  });

  return posts
    .map((post) => serializePost(post) as unknown as NationPost)
    .filter((post) => postMatchesFilter(post, filter, true));
}

export async function listNationPosts(nationId: string, filter: PostFilterInput, client: Tx = prisma) {
  const posts = await client.nationPost.findMany({
    where: postWhere({ ...filter, nationId }, false),
    include: postInclude,
    orderBy: [{ createdAt: "desc" }],
    take: filter.limit
  });

  return posts
    .map((post) => serializePost(post) as unknown as NationPost)
    .filter((post) => postMatchesFilter(post, { ...filter, nationId }));
}

export async function getPostById(postId: string, client: Tx = prisma) {
  const post = await client.nationPost.findUnique({
    where: { id: postId },
    include: postInclude
  });

  return post ? (serializePost(post) as unknown as NationPost) : null;
}

export async function createPostForNation(
  nationId: string,
  input: CreatePostInput,
  options: { sourceType?: PostSourceType; sourceEventHistoryId?: string | null } = {},
  client: Tx = prisma
) {
  const created = await client.nationPost.create({
    data: {
      nationId,
      type: input.type,
      title: input.title,
      body: input.body,
      format: input.format,
      sourceType: options.sourceType ?? "PLAYER",
      sourceEventHistoryId: options.sourceEventHistoryId ?? null,
      mediaUrl: input.mediaUrl ?? null,
      visibility: input.visibility,
      tagsJson: normalizeTags(input.tags) as unknown as Prisma.InputJsonValue,
      tags: { create: normalizeTags(input.tags).map((value) => ({ value })) },
      excerpt: buildExcerpt(input.body, input.excerpt),
      publishedAt: publishedAtForVisibility(input.visibility)
    },
    include: postInclude
  });

  return serializePost(created) as unknown as NationPost;
}

export async function updatePost(postId: string, input: UpdatePostInput, client: Tx = prisma) {
  const existing = await client.nationPost.findUnique({ where: { id: postId } });
  if (!existing || existing.deletedAt) return null;

  const visibility = input.visibility ?? existing.visibility;
  const body = input.body ?? existing.body;
  const updated = await client.nationPost.update({
    where: { id: postId },
    data: {
      ...(input.type ? { type: input.type } : {}),
      ...(input.title ? { title: input.title } : {}),
      ...(input.body ? { body: input.body } : {}),
      ...(input.format ? { format: input.format } : {}),
      ...(input.mediaUrl !== undefined ? { mediaUrl: input.mediaUrl } : {}),
      ...(input.visibility ? { visibility } : {}),
      ...(input.tags ? { tagsJson: normalizeTags(input.tags) as unknown as Prisma.InputJsonValue } : {}),
      ...(input.tags
        ? { tags: { deleteMany: {}, create: normalizeTags(input.tags).map((value) => ({ value })) } }
        : {}),
      ...(input.excerpt !== undefined || input.body
        ? { excerpt: buildExcerpt(body, input.excerpt ?? existing.excerpt) }
        : {}),
      ...(input.visibility ? { publishedAt: publishedAtForVisibility(visibility, existing.publishedAt) } : {})
    },
    include: postInclude
  });

  return serializePost(updated) as unknown as NationPost;
}

export async function softDeletePost(postId: string, client: Tx = prisma) {
  const existing = await client.nationPost.findUnique({ where: { id: postId } });
  if (!existing || existing.deletedAt) return null;

  const deleted = await client.nationPost.update({
    where: { id: postId },
    data: {
      deletedAt: new Date(),
      visibility: "PRIVATE"
    },
    include: postInclude
  });

  return serializePost(deleted) as unknown as NationPost;
}
