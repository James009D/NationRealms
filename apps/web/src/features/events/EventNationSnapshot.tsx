import { getTechnologyAge, type EconomySnapshot, type NationStats } from "@statecraft/shared";
import { formatEnum } from "../../format";
import { RESOURCE_PRESENTATION, resourceDisplayIndex } from "./resourcePresentation";

const indicatorKeys: Array<keyof Omit<NationStats, "id" | "nationId">> = [
  "economy",
  "stability",
  "liberty",
  "authority",
  "military",
  "technology",
  "environment",
  "publicTrust"
];

export function EventNationSnapshot({
  stats,
  economy
}: {
  stats: NationStats | null;
  economy: EconomySnapshot | null;
}) {
  const ownedResources = (economy?.resources ?? [])
    .filter((resource) => resource.amount > 0)
    .sort((left, right) => resourceDisplayIndex(left.type) - resourceDisplayIndex(right.type));
  const technologyAge = getTechnologyAge(stats?.technology ?? 0);

  return (
    <section className="event-nation-snapshot" aria-label="Nation status before event decisions">
      <article className="panel event-snapshot-group">
        <div className="event-snapshot-heading">
          <span className="panel-kicker">National Indicators</span>
          <small>0-100</small>
        </div>
        {stats ? (
          <div className="event-indicator-strip">
            {indicatorKeys.map((key) => (
              <div className="event-indicator" key={key}>
                <span>{formatEnum(key)}</span>
                <strong>{stats[key]}</strong>
                <div className="event-indicator-bar" aria-hidden="true">
                  <div style={{ width: `${stats[key]}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted event-snapshot-empty">No indicators recorded.</p>
        )}
      </article>

      <article className="panel event-snapshot-group">
        <div className="event-snapshot-heading">
          <span className="panel-kicker">Nation Economy</span>
          <small>Current balance</small>
        </div>
        {economy ? (
          <>
            <div className="event-economy-headline">
              <div>
                <span>Treasury</span>
                <strong>{economy.economy.treasury.toLocaleString()} credits</strong>
              </div>
              <div>
                <span>Population</span>
                <strong>{economy.economy.population.toLocaleString()}</strong>
              </div>
              <div>
                <span>Tech Level</span>
                <strong>{stats?.technology ?? "?"}</strong>
              </div>
              <div className="event-tech-age">
                <span>Technology Age</span>
                <strong>{stats ? technologyAge.label : "?"}</strong>
              </div>
            </div>
            {ownedResources.length ? (
              <div className="event-resource-grid" aria-label="Resource balances">
                {ownedResources.map((resource, index) => {
                  const presentation = RESOURCE_PRESENTATION[resource.type] ?? {
                    label: formatEnum(resource.type),
                    icon: "📦",
                    description: "A national resource stockpile."
                  };
                  const alignment =
                    index < 2
                      ? "event-resource-tile--start"
                      : index >= ownedResources.length - 2
                        ? "event-resource-tile--end"
                        : "";

                  return (
                    <div
                      aria-label={`${presentation.label}: ${resource.amount}. ${presentation.description}`}
                      className={`event-resource-tile ${alignment}`}
                      data-testid="resource-tile"
                      key={resource.type}
                      tabIndex={0}
                    >
                      <span className="event-resource-icon" aria-hidden="true">
                        {presentation.icon}
                      </span>
                      <strong>{resource.amount.toLocaleString()}</strong>
                      <span className="event-resource-tooltip" role="tooltip">
                        <strong>{presentation.label}</strong>
                        <span>{presentation.description}</span>
                        <small>
                          Stockpile: {resource.amount.toLocaleString()} / {resource.capacity.toLocaleString()}
                        </small>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted event-snapshot-empty">No resources stockpiled.</p>
            )}
          </>
        ) : (
          <p className="muted event-snapshot-empty">Economy not initialized.</p>
        )}
      </article>
    </section>
  );
}
