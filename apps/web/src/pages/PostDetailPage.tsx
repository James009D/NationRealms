import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { NationPost } from "@statecraft/shared";
import { NationNav } from "../components/NationNav";
import { getPost } from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { PostMarkdown } from "../features/posts/PostMarkdown";
import { formatDate, formatEnum, postTypeLabel } from "../format";

export function PostDetailPage() {
  const { id, postId } = useParams();
  const nationId = id ?? "";
  const [post, setPost] = useState<NationPost | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;
    getPost(postId)
      .then(setPost)
      .catch((caught: Error) => setError(caught.message));
  }, [postId]);

  if (error) {
    return <ErrorState message={error} action={<Link to={`/nation/${nationId}/news`}>Back to news</Link>} />;
  }

  if (!post) {
    return <LoadingState />;
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {postTypeLabel(post.type)} / {formatEnum(post.sourceType)}
          </p>
          <h1>{post.title}</h1>
          <p>{formatDate(post.publishedAt ?? post.createdAt)}</p>
        </div>
        <NationNav nationId={post.nationId} />
      </header>

      <article className="panel post-detail">
        {post.sourceType === "EVENT" && post.sourceEventHistory ? (
          <aside className="result-summary">
            Event-linked dispatch from turn {post.sourceEventHistory.turn}: {post.sourceEventHistory.title}
          </aside>
        ) : null}
        {(post.tags ?? []).length > 0 ? (
          <div className="tag-list">
            {(post.tags ?? []).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
        <PostMarkdown body={post.body} format={post.format} />
      </article>
    </main>
  );
}
