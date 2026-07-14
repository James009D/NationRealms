import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { NationPost, NationPostFilter, NationPostUpdateInput, PostVisibility } from "@statecraft/shared";
import { NationNav } from "../components/NationNav";
import { createPost, deletePost, getNation, getNationPosts, updatePost } from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { PostCard } from "../features/posts/PostCard";
import { PostComposer } from "../features/posts/PostComposer";
import { PostFilters } from "../features/posts/PostFilters";
import { subscribeToRealtimeEvent } from "../realtime";
import { postMatchesFilter } from "../features/posts/postFiltering";

function upsertPost(posts: NationPost[], post: NationPost) {
  const exists = posts.some((item) => item.id === post.id);
  return exists ? posts.map((item) => (item.id === post.id ? post : item)) : [post, ...posts];
}

export function NewsPage() {
  const { id } = useParams();
  const nationId = id ?? "";
  const [nationName, setNationName] = useState("Nation");
  const [posts, setPosts] = useState<NationPost[]>([]);
  const [editingPost, setEditingPost] = useState<NationPost | null>(null);
  const [filter, setFilter] = useState<NationPostFilter>({ visibility: "ALL", includeDeleted: false });
  const [debouncedFilter, setDebouncedFilter] = useState(filter);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [nation, loadedPosts] = await Promise.all([getNation(nationId), getNationPosts(nationId, debouncedFilter)]);
    setNationName(nation.name);
    setPosts(loadedPosts);
    setLoaded(true);
  }, [nationId, debouncedFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedFilter(filter), 300);
    return () => window.clearTimeout(timeout);
  }, [filter]);

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message));
  }, [refresh]);

  useEffect(() => {
    const unsubscribeCreated = subscribeToRealtimeEvent(
      "nation:post-created",
      (payload) => {
        if (payload.nationId === nationId && postMatchesFilter(payload.post, debouncedFilter))
          setPosts((current) => upsertPost(current, payload.post));
      },
      nationId
    );
    const unsubscribeUpdated = subscribeToRealtimeEvent(
      "nation:post-updated",
      (payload) => {
        if (payload.nationId === nationId)
          setPosts((current) =>
            postMatchesFilter(payload.post, debouncedFilter)
              ? upsertPost(current, payload.post)
              : current.filter((post) => post.id !== payload.post.id)
          );
      },
      nationId
    );
    const unsubscribeDeleted = subscribeToRealtimeEvent(
      "nation:post-deleted",
      (payload) => {
        if (payload.nationId === nationId) setPosts((current) => current.filter((post) => post.id !== payload.postId));
      },
      nationId
    );
    const unsubscribeEventResolved = subscribeToRealtimeEvent(
      "event:choice-resolved",
      (payload) => {
        const createdPost = payload.result.createdPost;
        if (createdPost?.nationId === nationId) setPosts((current) => upsertPost(current, createdPost));
      },
      nationId
    );

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeEventResolved();
    };
  }, [nationId, debouncedFilter]);

  async function handleCreate(input: Parameters<typeof createPost>[1]) {
    setError(null);
    try {
      const post = await createPost(nationId, input);
      setPosts((current) => upsertPost(current, post));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save post");
    }
  }

  async function handleEdit(input: NationPostUpdateInput) {
    if (!editingPost) return;
    setError(null);
    try {
      const post = await updatePost(editingPost.id, input);
      setPosts((current) => upsertPost(current, post));
      setEditingPost(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update post");
    }
  }

  async function handleVisibilityChange(post: NationPost, visibility: PostVisibility) {
    setError(null);
    try {
      const updated = await updatePost(post.id, { visibility });
      setPosts((current) => upsertPost(current, updated));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update post");
    }
  }

  async function handleDelete(post: NationPost) {
    if (!window.confirm(`Delete "${post.title}" from the feed? Event history will remain unchanged.`)) return;
    setError(null);
    try {
      await deletePost(post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete post");
    }
  }

  if (error && !loaded) {
    return <ErrorState message={error} />;
  }

  if (!loaded) {
    return <LoadingState />;
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">News Desk</p>
          <h1>{nationName}</h1>
        </div>
        <NationNav nationId={nationId} />
      </header>

      {error ? <p className="form-error">{error}</p> : null}
      {editingPost ? (
        <PostComposer
          initialPost={editingPost}
          onCancel={() => setEditingPost(null)}
          onSave={handleEdit}
          saveLabel="Save Changes"
        />
      ) : (
        <PostComposer onSave={handleCreate} />
      )}

      <section className="section-band">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Managed Feed</p>
            <h2>Nation Posts</h2>
          </div>
        </div>
        <PostFilters filter={filter} showVisibility onChange={setFilter} />
        <div className="stack">
          {posts.length === 0 ? <p className="muted">No posts match these filters.</p> : null}
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={handleDelete}
              onEdit={setEditingPost}
              onVisibilityChange={handleVisibilityChange}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
