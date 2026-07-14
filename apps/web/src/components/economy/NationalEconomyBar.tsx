import {
  getTechnologyAge,
  type EconomyLedgerEntry,
  type EconomySnapshot,
  type NationStats,
  type ResourceType
} from "@statecraft/shared";
import { RESOURCE_PRESENTATION, resourceDisplayIndex } from "../../features/events/resourcePresentation";

function ledgerTotals(entries: EconomyLedgerEntry[]) {
  const production = entries.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
  const consumption = Math.abs(
    entries.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + entry.amount, 0)
  );
  return { production, consumption, net: production - consumption };
}

function Trend({ value }: { value: number }) {
  return (
    <span className={`economy-trend ${value < 0 ? "economy-trend--negative" : ""}`}>
      {value >= 0 ? "+" : ""}
      {value.toLocaleString()}
    </span>
  );
}

function EconomyDetail({
  icon,
  label,
  amount,
  capacity,
  entries,
  description
}: {
  icon: string;
  label: string;
  amount: number;
  capacity?: number;
  entries: EconomyLedgerEntry[];
  description: string;
}) {
  const totals = ledgerTotals(entries);
  const reasons = [...new Set(entries.map((entry) => entry.reason))].slice(0, 3);

  return (
    <details className="economy-item">
      <summary aria-label={`${label}: ${amount.toLocaleString()}, net ${totals.net}`}>
        <span className="economy-item__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="economy-item__value">{amount.toLocaleString()}</span>
        <Trend value={totals.net} />
      </summary>
      <div className="economy-popover">
        <div className="economy-popover__heading">
          <strong>{label}</strong>
          <span>
            {amount.toLocaleString()}
            {capacity !== undefined ? ` / ${capacity.toLocaleString()}` : ""}
          </span>
        </div>
        <p>{description}</p>
        <dl>
          <div>
            <dt>Production</dt>
            <dd>+{totals.production.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Consumption</dt>
            <dd>-{totals.consumption.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Net change</dt>
            <dd>
              {totals.net >= 0 ? "+" : ""}
              {totals.net.toLocaleString()}
            </dd>
          </div>
        </dl>
        {reasons.length ? <small>{reasons.join(" · ")}</small> : <small>No recent ledger activity.</small>}
      </div>
    </details>
  );
}

export function NationalEconomyBar({ economy, stats }: { economy: EconomySnapshot | null; stats: NationStats | null }) {
  if (!economy) {
    return <section className="national-economy-bar national-economy-bar--empty">Economy data is unavailable.</section>;
  }

  const treasuryEntries = economy.recentLedger.filter((entry) => entry.kind === "TREASURY");
  const populationEntries = economy.recentLedger.filter((entry) => entry.kind === "POPULATION");
  const resources = economy.resources
    .filter((resource) => resource.amount > 0)
    .sort((left, right) => resourceDisplayIndex(left.type) - resourceDisplayIndex(right.type));
  const technologyAge = getTechnologyAge(stats?.technology ?? 0);

  return (
    <section className="national-economy-bar" aria-label="National economy">
      <div className="economy-strip-label">
        <span>National Economy</span>
        <small>{technologyAge.label} age</small>
      </div>
      <div className="economy-strip-items">
        <EconomyDetail
          icon="🪙"
          label="Credits"
          amount={economy.economy.treasury}
          entries={treasuryEntries}
          description="Available treasury for national projects, upkeep, and strategic decisions."
        />
        <EconomyDetail
          icon="👥"
          label="Population"
          amount={economy.economy.population}
          entries={populationEntries}
          description="Residents contributing labor, demand, taxes, and national growth."
        />
        {resources.map((resource) => {
          const presentation = RESOURCE_PRESENTATION[resource.type] ?? {
            icon: "📦",
            label: resource.type,
            description: "A national strategic stockpile."
          };
          return (
            <EconomyDetail
              key={resource.type}
              icon={presentation.icon}
              label={presentation.label}
              amount={resource.amount}
              capacity={resource.capacity}
              entries={economy.recentLedger.filter(
                (entry) => entry.kind === "RESOURCE" && entry.resourceType === (resource.type as ResourceType)
              )}
              description={presentation.description}
            />
          );
        })}
      </div>
    </section>
  );
}
