import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { NationPost, NationPostFilter } from "@statecraft/shared";
import { getFeed } from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { PostCard } from "../features/posts/PostCard";
import { PostFilters } from "../features/posts/PostFilters";
import { subscribeToRealtimeEvent } from "../realtime";
import { filterToSearchParams, postMatchesFilter } from "../features/posts/postFiltering";
import { NationNav } from "../components/NationNav";
import { NationInbox } from "../features/inbox/NationInbox";

function upsertPost(posts: NationPost[], post: NationPost) {
  if (post.visibility !== "PUBLIC" || post.deletedAt) return posts.filter((item) => item.id !== post.id);
  const exists = posts.some((item) => item.id === post.id);
  return exists ? posts.map((item) => (item.id === post.id ? post : item)) : [post, ...posts];
}

export function FeedPage() {
  const { id: activeNationId } = useParams();
  const [posts, setPosts] = useState<NationPost[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<NationPostFilter>(() => ({
    search: searchParams.get("search") ?? undefined,
    tag: searchParams.get("tag") ?? undefined,
    type: (searchParams.get("type") as NationPostFilter["type"]) ?? undefined,
    sourceType: (searchParams.get("sourceType") as NationPostFilter["sourceType"]) ?? undefined
  }));
  const [debouncedFilter, setDebouncedFilter] = useState(filter);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const view = activeNationId && searchParams.get("view") === "inbox" ? "inbox" : "world";

  const refresh = useCallback(async () => {
    const loadedPosts = await getFeed(debouncedFilter);
    setPosts(loadedPosts);
    setLoaded(true);
  }, [debouncedFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedFilter(filter), 300);
    const next = filterToSearchParams(filter);
    if (view === "inbox") next.set("view", "inbox");
    setSearchParams(next, { replace: true });
    return () => window.clearTimeout(timeout);
  }, [filter, setSearchParams, view]);

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message));
  }, [refresh]);

  useEffect(() => {
    const unsubscribeCreated = subscribeToRealtimeEvent("nation:post-created", (payload) => {
      if (postMatchesFilter(payload.post, debouncedFilter, true))
        setPosts((current) => upsertPost(current, payload.post));
    });
    const unsubscribeUpdated = subscribeToRealtimeEvent("nation:post-updated", (payload) => {
      setPosts((current) =>
        postMatchesFilter(payload.post, debouncedFilter, true)
          ? upsertPost(current, payload.post)
          : current.filter((post) => post.id !== payload.post.id)
      );
    });
    const unsubscribeDeleted = subscribeToRealtimeEvent("nation:post-deleted", (payload) => {
      setPosts((current) => current.filter((post) => post.id !== payload.postId));
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
    };
  }, [debouncedFilter]);

  if (error && !loaded) {
    return <ErrorState message={error} action={<Link to="/">Back to landing</Link>} />;
  }

  if (!loaded) {
    return <LoadingState />;
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Public Roleplay Feed</p>
          <h1>World Dispatches</h1>
        </div>
        {activeNationId ? (
          <NationNav nationId={activeNationId} />
        ) : (
          <nav className="nation-nav" aria-label="Site sections">
            <Link to="/">Home</Link>
            <Link to="/demo">Demo Nation</Link>
          </nav>
        )}
      </header>

      {error ? <p className="form-error">{error}</p> : null}
      {activeNationId ? (
        <nav className="feed-tabs" aria-label="Feed views">
          <Link className={view === "world" ? "is-active" : ""} to={`/nation/${activeNationId}/feed`}>
            World Feed
          </Link>
          <Link className={view === "inbox" ? "is-active" : ""} to={`/nation/${activeNationId}/feed?view=inbox`}>
            Inbox
          </Link>
        </nav>
      ) : null}
      {view === "inbox" && activeNationId ? (
        <NationInbox nationId={activeNationId} />
      ) : (
        <>
          <PostFilters filter={filter} onChange={setFilter} />
          <section className="section-band">
            <div className="stack">
              {posts.length === 0 ? <p className="muted">No public posts match these filters.</p> : null}
              {posts.map((post) => (
                <PostCard key={post.id} post={post} showNation />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
