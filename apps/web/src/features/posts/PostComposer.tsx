import { FormEvent, useState } from "react";
import type { NationPost, NationPostCreateInput, NationPostType, PostVisibility } from "@statecraft/shared";
import { NATION_POST_TYPE_OPTIONS, POST_VISIBILITY_OPTIONS } from "@statecraft/shared";
import { PostMarkdown } from "./PostMarkdown";

function tagsToInput(tags?: string[]) {
  return (tags ?? []).join(", ");
}

function inputToTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

export function PostComposer({
  initialPost,
  onCancel,
  onSave,
  saveLabel = "Publish Post"
}: {
  initialPost?: NationPost | null;
  onCancel?: () => void;
  onSave: (input: NationPostCreateInput) => Promise<void>;
  saveLabel?: string;
}) {
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [body, setBody] = useState(initialPost?.body ?? "");
  const [type, setType] = useState<NationPostType>(initialPost?.type ?? "NEWS");
  const [visibility, setVisibility] = useState<PostVisibility>(initialPost?.visibility ?? "PUBLIC");
  const [tags, setTags] = useState(tagsToInput(initialPost?.tags));
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? "");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        title,
        body,
        type,
        visibility,
        tags: inputToTags(tags),
        excerpt: excerpt.trim() || null,
        format: "MARKDOWN"
      });
      if (!initialPost) {
        setTitle("");
        setBody("");
        setTags("");
        setExcerpt("");
        setVisibility("PUBLIC");
        setType("NEWS");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel form-panel post-composer" onSubmit={handleSubmit}>
      <div className="section-heading">
        <div>
          <div className="panel-kicker">{initialPost ? "Edit Post" : "Create Post"}</div>
          <h2>{initialPost ? initialPost.title : "Dispatch"}</h2>
        </div>
        <div className="event-control-actions">
          <button className="secondary-action" type="button" onClick={() => setIsPreviewing((current) => !current)}>
            {isPreviewing ? "Edit" : "Preview"}
          </button>
          {onCancel ? (
            <button className="secondary-action" type="button" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="form-grid">
        <label>
          Type
          <select value={type} onChange={(event) => setType(event.target.value as NationPostType)}>
            {NATION_POST_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Visibility
          <select value={visibility} onChange={(event) => setVisibility(event.target.value as PostVisibility)}>
            {POST_VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tags
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="speech, economy" />
        </label>
      </div>

      <label>
        Title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={2}
          maxLength={140}
        />
      </label>

      <label>
        Excerpt
        <input value={excerpt} onChange={(event) => setExcerpt(event.target.value)} maxLength={280} />
      </label>

      {isPreviewing ? (
        <article className="panel panel--compact markdown-preview">
          <PostMarkdown body={body || "_Nothing written yet._"} />
        </article>
      ) : (
        <label>
          Body
          <textarea value={body} onChange={(event) => setBody(event.target.value)} required rows={8} />
        </label>
      )}

      <button className="primary-action" type="submit" disabled={isSaving}>
        {isSaving ? "Saving" : saveLabel}
      </button>
    </form>
  );
}
