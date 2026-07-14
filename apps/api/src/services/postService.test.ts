import { describe, expect, it } from "vitest";
import type { NationPost } from "@statecraft/shared";
import { buildExcerpt, normalizeTags, postMatchesFilter } from "./postService.js";

const post: NationPost = {
  id: "post-1",
  nationId: "nation-1",
  type: "NEWS",
  title: "Harbor Strike Ends",
  body: "**Dock crews** returned after a compact.",
  format: "MARKDOWN",
  sourceType: "EVENT",
  sourceEventHistoryId: "history-1",
  mediaUrl: null,
  visibility: "PUBLIC",
  tags: ["port", "labor"],
  excerpt: "Dock crews returned after a compact.",
  publishedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("post service helpers", () => {
  it("normalizes tags and strips empty duplicates", () => {
    expect(normalizeTags([" Port ", "port", "", "Labor"])).toEqual(["port", "labor"]);
  });

  it("builds a plain excerpt from markdown", () => {
    expect(buildExcerpt("## Title\n\n**Bold** dispatch from [Solmere](https://example.com).")).toBe(
      "Title Bold dispatch from Solmere https://example.com ."
    );
  });

  it("filters by source, type, search, tag, and public visibility", () => {
    expect(postMatchesFilter(post, { sourceType: "EVENT", type: "NEWS", search: "compact", tag: "labor" }, true)).toBe(
      true
    );
    expect(postMatchesFilter({ ...post, visibility: "DRAFT" }, {}, true)).toBe(false);
    expect(postMatchesFilter(post, { tag: "culture" }, true)).toBe(false);
  });
});
