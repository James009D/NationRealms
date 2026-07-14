import type { NationPostFilter, NationPostType, PostSourceType, PostVisibility } from "@statecraft/shared";
import { NATION_POST_TYPE_OPTIONS, POST_SOURCE_TYPE_OPTIONS, POST_VISIBILITY_OPTIONS } from "@statecraft/shared";

export function PostFilters({
  filter,
  showVisibility = false,
  onChange
}: {
  filter: NationPostFilter;
  showVisibility?: boolean;
  onChange: (next: NationPostFilter) => void;
}) {
  return (
    <section className="panel feed-filters">
      <label>
        Search
        <input value={filter.search ?? ""} onChange={(event) => onChange({ ...filter, search: event.target.value })} />
      </label>
      <label>
        Type
        <select
          value={filter.type ?? ""}
          onChange={(event) =>
            onChange({ ...filter, type: (event.target.value || undefined) as NationPostType | undefined })
          }
        >
          <option value="">All types</option>
          {NATION_POST_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Source
        <select
          value={filter.sourceType ?? ""}
          onChange={(event) =>
            onChange({ ...filter, sourceType: (event.target.value || undefined) as PostSourceType | undefined })
          }
        >
          <option value="">All sources</option>
          {POST_SOURCE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {showVisibility ? (
        <label>
          Visibility
          <select
            value={filter.visibility ?? "ALL"}
            onChange={(event) => onChange({ ...filter, visibility: event.target.value as PostVisibility | "ALL" })}
          >
            <option value="ALL">All visibility</option>
            {POST_VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        Tag
        <input value={filter.tag ?? ""} onChange={(event) => onChange({ ...filter, tag: event.target.value })} />
      </label>
    </section>
  );
}
