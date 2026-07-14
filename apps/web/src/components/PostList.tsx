import type { NationPost } from "@statecraft/shared";
import { PostCard } from "../features/posts/PostCard";

export function PostList({ posts }: { posts: NationPost[] }) {
  if (posts.length === 0) {
    return <p className="muted">No public posts yet.</p>;
  }

  return (
    <div className="stack">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
