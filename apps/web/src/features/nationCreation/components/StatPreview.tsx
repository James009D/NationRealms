import type { NationCreationPreview } from "@statecraft/shared";
import { formatEnum } from "../../../format";

const statKeys = [
  "economy",
  "stability",
  "liberty",
  "authority",
  "military",
  "technology",
  "environment",
  "publicTrust"
] as const;

export function StatPreview({ preview }: { preview: NationCreationPreview | null }) {
  if (!preview) {
    return <p className="muted">Preview will appear as the founding draft takes shape.</p>;
  }

  return (
    <div className="stat-grid">
      {statKeys.map((key) => (
        <div className="stat-row" key={key}>
          <span>{formatEnum(key)}</span>
          <strong>{preview.stats[key]}</strong>
          <div className="stat-bar" aria-hidden="true">
            <div style={{ width: `${preview.stats[key]}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
