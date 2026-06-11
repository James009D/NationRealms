import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { NationPost, NationPostType } from "@statecraft/shared";
import { NationNav } from "../App";
import { createPost, getNation, getPosts } from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { PostList } from "../components/PostList";
import { subscribeToRealtimeEvent } from "../realtime";

const postTypes: NationPostType[] = ["NEWS", "SPEECH", "GOVERNMENT_UPDATE"];

function prependUniquePost(posts: NationPost[], post: NationPost) {
  if (posts.some((item) => item.id === post.id)) {
    return posts;
  }

  return [post, ...posts];
}

export function NewsPage() {
  const { id } = useParams();
  const nationId = id ?? "";
  const [nationName, setNationName] = useState("Nation");
  const [posts, setPosts] = useState<NationPost[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<NationPostType>("NEWS");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [nation, loadedPosts] = await Promise.all([getNation(nationId), getPosts(nationId)]);
    setNationName(nation.name);
    setPosts(loadedPosts);
    setLoaded(true);
  }, [nationId]);

  useEffect(() => {
    refresh()
      .catch((caught: Error) => setError(caught.message));
  }, [refresh]);

  useEffect(() => {
    const unsubscribePostCreated = subscribeToRealtimeEvent("nation:post-created", (payload) => {
      if (payload.nationId === nationId) {
        setPosts((current) => prependUniquePost(current, payload.post));
      }
    });

    const unsubscribeEventResolved = subscribeToRealtimeEvent("event:choice-resolved", (payload) => {
      const createdPost = payload.result.createdPost;
      if (createdPost?.nationId === nationId) {
        setPosts((current) => prependUniquePost(current, createdPost));
      }
    });

    return () => {
      unsubscribePostCreated();
      unsubscribeEventResolved();
    };
  }, [nationId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const post = await createPost(nationId, { title, body, type });
      setPosts((current) => prependUniquePost(current, post));
      setTitle("");
      setBody("");
      setType("NEWS");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create post");
    } finally {
      setIsSaving(false);
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

      <form className="panel form-panel" onSubmit={handleSubmit}>
        <div className="panel-kicker">Create Post</div>
        <div className="form-grid">
          <label>
            Type
            <select value={type} onChange={(event) => setType(event.target.value as NationPostType)}>
              {postTypes.map((postType) => (
                <option key={postType} value={postType}>
                  {postType.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} />
          </label>
        </div>
        <label>
          Body
          <textarea value={body} onChange={(event) => setBody(event.target.value)} required rows={5} />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-action" type="submit" disabled={isSaving}>
          {isSaving ? "Publishing" : "Publish Post"}
        </button>
      </form>

      <section className="section-band">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Public Feed</p>
            <h2>Nation Posts</h2>
          </div>
        </div>
        <PostList posts={posts} />
      </section>
    </main>
  );
}
