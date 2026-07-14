import { useMemo, useState } from "react";
import type { NationPost, NationPostType } from "@statecraft/shared";
import { Link } from "react-router-dom";
import { formatDate, postTypeLabel } from "../../format";

const categoryOptions: Array<{ value: NationPostType | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "NEWS", label: "National" },
  { value: "GOVERNMENT_UPDATE", label: "Government" },
  { value: "SPEECH", label: "Speeches" },
  { value: "IMAGE", label: "Media" }
];

export function DashboardNewsFeed({ nationId, posts }: { nationId: string; posts: NationPost[] }) {
  const filterKey = `dashboard-news-filter:${nationId}`;
  const readKey = `dashboard-news-read:${nationId}`;
  const [category, setCategory] = useState<NationPostType | "ALL">(
    () => (sessionStorage.getItem(filterKey) as NationPostType | "ALL") || "ALL"
  );
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(
    () => JSON.parse(sessionStorage.getItem(readKey) ?? "[]") as string[]
  );
  const visiblePosts = useMemo(
    () =>
      posts
        .filter((post) => (category === "ALL" || post.type === category) && (!unreadOnly || !readIds.includes(post.id)))
        .slice(0, 6),
    [category, posts, readIds, unreadOnly]
  );

  function markRead(postId: string) {
    const next = [...new Set([...readIds, postId])];
    setReadIds(next);
    sessionStorage.setItem(readKey, JSON.stringify(next));
  }

  function changeCategory(next: NationPostType | "ALL") {
    setCategory(next);
    sessionStorage.setItem(filterKey, next);
  }

  return (
    <section className="dashboard-news" aria-labelledby="dashboard-news-heading">
      <div className="dashboard-section-heading">
        <div>
          <span className="panel-kicker">National newsroom</span>
          <h2 id="dashboard-news-heading">Latest Dispatches</h2>
        </div>
        <Link to={`/nation/${nationId}/news`}>Complete archive</Link>
      </div>
      <div className="dashboard-news__filters">
        <div role="group" aria-label="News category">
          {categoryOptions.map((option) => (
            <button
              aria-pressed={category === option.value}
              className={category === option.value ? "is-active" : ""}
              key={option.value}
              onClick={() => changeCategory(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="compact-toggle">
          <input checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} type="checkbox" />
          <span>Unread only</span>
        </label>
      </div>
      <div className="dashboard-news__list">
        {visiblePosts.map((post) => (
          <article className="dashboard-news-item" key={post.id}>
            {post.mediaUrl ? (
              <img src={post.mediaUrl} alt="" />
            ) : (
              <div className="dashboard-news-item__mark" aria-hidden="true">
                ▤
              </div>
            )}
            <div>
              <span className="dashboard-news-item__meta">
                {postTypeLabel(post.type)} · {formatDate(post.publishedAt ?? post.createdAt)}
              </span>
              <h3>
                <Link onClick={() => markRead(post.id)} to={`/nation/${nationId}/news/${post.id}`}>
                  {post.title}
                </Link>
              </h3>
              <p>{post.excerpt || post.body.slice(0, 180)}</p>
              <small>{post.sourceType === "EVENT" ? "Event record" : "National press office"}</small>
            </div>
            {!readIds.includes(post.id) ? <span className="unread-badge">Unread</span> : null}
          </article>
        ))}
        {!visiblePosts.length ? <p className="empty-state">No dispatches match this view.</p> : null}
      </div>
    </section>
  );
}
