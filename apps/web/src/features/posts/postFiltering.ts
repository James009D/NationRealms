import type { NationPost, NationPostFilter } from "@statecraft/shared";

export function postMatchesFilter(post: NationPost, filter: NationPostFilter, publicOnly = false) {
  if (publicOnly && (post.visibility !== "PUBLIC" || post.deletedAt)) return false;
  if (filter.nationId && post.nationId !== filter.nationId) return false;
  if (filter.type && post.type !== filter.type) return false;
  if (filter.sourceType && post.sourceType !== filter.sourceType) return false;
  if (filter.visibility && filter.visibility !== "ALL" && post.visibility !== filter.visibility) return false;
  if (!filter.includeDeleted && post.deletedAt) return false;
  if (filter.tag && !post.tags.some((tag) => tag.toLowerCase() === filter.tag!.toLowerCase())) return false;
  if (
    filter.search &&
    !`${post.title} ${post.body} ${post.excerpt ?? ""}`.toLowerCase().includes(filter.search.toLowerCase())
  )
    return false;
  return true;
}

export function filterToSearchParams(filter: NationPostFilter) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== "" && value !== false) params.set(key, String(value));
  }
  return params;
}
