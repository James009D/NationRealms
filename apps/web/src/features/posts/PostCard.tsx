import { Link } from "react-router-dom";
import type { NationPost, PostVisibility } from "@statecraft/shared";
import { formatDate, formatEnum, postTypeLabel } from "../../format";

export function PostCard({
  post,
  showNation = false,
  onEdit,
  onVisibilityChange,
  onDelete
}: {
  post: NationPost;
  showNation?: boolean;
  onEdit?: (post: NationPost) => void;
  onVisibilityChange?: (post: NationPost, visibility: PostVisibility) => void;
  onDelete?: (post: NationPost) => void;
}) {
  const isDeleted = Boolean(post.deletedAt);
  const tags = post.tags ?? [];

  return (
    <article className={`panel panel--compact post-card${isDeleted ? " post-card--deleted" : ""}`}>
      <div className="panel-kicker">
        {postTypeLabel(post.type)} / {formatEnum(post.sourceType)} / {formatDate(post.publishedAt ?? post.createdAt)}
      </div>
      <div className="section-heading post-heading">
        <div>
          <h3>
            <Link to={`/nation/${post.nationId}/news/${post.id}`}>{post.title}</Link>
          </h3>
          {showNation && post.nation ? <p className="muted">{post.nation.name}</p> : null}
        </div>
        <div className="tag-list">
          <span>{formatEnum(post.visibility)}</span>
          {post.sourceType === "EVENT" ? <span>Event</span> : <span>Player</span>}
        </div>
      </div>
      <p>{post.excerpt || post.body.slice(0, 220)}</p>
      {tags.length > 0 ? (
        <div className="tag-list">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      {onEdit || onVisibilityChange || onDelete ? (
        <div className="post-actions">
          {onEdit ? (
            <button className="secondary-action" type="button" onClick={() => onEdit(post)}>
              Edit
            </button>
          ) : null}
          {onVisibilityChange ? (
            <>
              <button className="secondary-action" type="button" onClick={() => onVisibilityChange(post, "PUBLIC")}>
                Publish
              </button>
              <button className="secondary-action" type="button" onClick={() => onVisibilityChange(post, "DRAFT")}>
                Draft
              </button>
              <button className="secondary-action" type="button" onClick={() => onVisibilityChange(post, "PRIVATE")}>
                Hide
              </button>
            </>
          ) : null}
          {onDelete && !isDeleted ? (
            <button className="secondary-action danger-action" type="button" onClick={() => onDelete(post)}>
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
