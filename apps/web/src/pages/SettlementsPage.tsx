import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { NationalSettlementSummary, NationTerritoryView } from "@statecraft/shared";
import { getNation, getNationSettlements, getNationTerritory } from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { NationNav } from "../components/NationNav";
import { formatEnum } from "../format";
import { subscribeToRealtimeEvent } from "../realtime";

const refreshEvents = [
  "nation:turn-advanced",
  "settlement:updated",
  "settlement:population-grown",
  "settlement:population-lost",
  "settlement:project-completed",
  "settlement:shortage-started",
  "settlement:shortage-ended",
  "territory:claim-started",
  "territory:claim-cancelled",
  "territory:tiles-claimed",
  "outpost:project-started",
  "outpost:established",
  "settlement:founded"
] as const;

export function SettlementsPage() {
  const { id = "" } = useParams();
  const [nationName, setNationName] = useState("Nation");
  const [summary, setSummary] = useState<NationalSettlementSummary | null>(null);
  const [territory, setTerritory] = useState<NationTerritoryView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const [nation, loaded, loadedTerritory] = await Promise.all([
      getNation(id),
      getNationSettlements(id),
      getNationTerritory(id)
    ]);
    setNationName(nation.name);
    setSummary(loaded);
    setTerritory(loadedTerritory);
    setError(null);
  }, [id]);

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message));
  }, [refresh]);
  useEffect(() => {
    const unsubscribes = refreshEvents.map((name) =>
      subscribeToRealtimeEvent(
        name,
        (payload) => {
          if (payload.nationId === id) refresh().catch((caught: Error) => setError(caught.message));
        },
        id
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [id, refresh]);

  if (error && !summary) return <ErrorState message={error} />;
  if (!summary) return <LoadingState />;
  return (
    <main className="page-shell settlements-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Domestic Administration</p>
          <h1>{nationName} Settlements</h1>
        </div>
        <NationNav nationId={id} />
      </header>
      {error ? (
        <p className="form-error" role="status">
          {error}
        </p>
      ) : null}
      <section className="settlement-summary-strip" aria-label="National settlement summary">
        <div>
          <span>Settlements</span>
          <strong>
            {summary.settlementCount} / {summary.capacity.capacity}
          </strong>
        </div>
        <div>
          <span>Residents</span>
          <strong>{summary.totalPopulation.toLocaleString()}</strong>
        </div>
        <div>
          <span>Growing</span>
          <strong>{summary.growingCount}</strong>
        </div>
        <div>
          <span>Food shortages</span>
          <strong>{summary.shortageCount}</strong>
        </div>
        <div>
          <span>Overcrowded</span>
          <strong>{summary.overcrowdedCount}</strong>
        </div>
        <div>
          <span>Disconnected</span>
          <strong>{summary.disconnectedRegionCount}</strong>
        </div>
        <div>
          <span>Unstable</span>
          <strong>{summary.unstableCount}</strong>
        </div>
        <div>
          <span>Projects</span>
          <strong>{summary.activeProjectCount}</strong>
        </div>
      </section>
      {territory ? (
        <section
          className="settlement-summary-strip settlement-frontier-summary"
          aria-label="National frontier summary"
        >
          <div>
            <span>Territory</span>
            <strong>{territory.claimedTileCount} tiles</strong>
          </div>
          <div>
            <span>Secured</span>
            <strong>{territory.securedTileCount}</strong>
          </div>
          <div>
            <span>Frontier load</span>
            <strong>{territory.frontierLoad}</strong>
          </div>
          <div>
            <span>Claims</span>
            <strong>
              {territory.activeClaimCount} / {territory.claimLimit}
            </strong>
          </div>
          <div>
            <span>Outposts</span>
            <strong>
              {territory.outposts.filter((item) => !["CONVERTED", "CANCELLED"].includes(item.status)).length}
            </strong>
          </div>
          <div>
            <Link to={`/nation/${id}?focus=map`}>Open frontier map</Link>
          </div>
        </section>
      ) : null}
      {summary.capacity.excess ? (
        <div className="settlement-strain" role="alert">
          <strong>Administrative strain: {summary.capacity.excess} over capacity.</strong>
          <span>
            Tax -{summary.capacity.taxPenaltyPercent}%, growth -{summary.capacity.growthPenaltyPercent}%, stability -
            {summary.capacity.stabilityPenalty}.
          </span>
        </div>
      ) : null}
      <section className="settlement-list" aria-label="Full settlements">
        {summary.settlements.map((settlement) => (
          <article className="settlement-row" key={settlement.id}>
            <div className="settlement-row__identity">
              <span
                className={`settlement-level-marker settlement-level-marker--${settlement.level.toLowerCase()}`}
                aria-hidden="true"
              >
                {settlement.type === "CAPITAL" ? "*" : "S"}
              </span>
              <div>
                <p className="eyebrow">
                  {formatEnum(settlement.type)} / {formatEnum(settlement.level)}
                </p>
                <h2>{settlement.name}</h2>
                <span>
                  {settlement.primarySpecialization ? formatEnum(settlement.primarySpecialization) : "Unspecialized"}
                </span>
              </div>
            </div>
            <div className="settlement-row__metrics">
              <span>
                <small>Population</small>
                <strong>{settlement.populationLevel}</strong>
              </span>
              <span>
                <small>Growth</small>
                <strong>
                  {settlement.growth.progress}/{settlement.growth.required}
                </strong>
              </span>
              <span>
                <small>Food</small>
                <strong>
                  {settlement.food.production - settlement.food.consumption >= 0 ? "+" : ""}
                  {settlement.food.production - settlement.food.consumption}
                </strong>
              </span>
              <span>
                <small>Housing</small>
                <strong>
                  {settlement.populationLevel}/{settlement.housing.capacity}
                </strong>
              </span>
              <span>
                <small>Stability</small>
                <strong>{settlement.stability.value}</strong>
              </span>
              <span>
                <small>Network</small>
                <strong>{formatEnum(settlement.region.transportationLevel)}</strong>
              </span>
            </div>
            <div className="settlement-row__status">
              {settlement.activeProject ? (
                <span className="status-badge">Building: {formatEnum(settlement.activeProject.definitionKey)}</span>
              ) : (
                <span className="status-badge status-badge--quiet">No active project</span>
              )}
              {settlement.warnings.slice(0, 2).map((warning) => (
                <small key={warning}>{warning}</small>
              ))}
              <Link className="primary-action" to={`/nation/${id}/settlements/${settlement.id}`}>
                Manage
              </Link>
            </div>
          </article>
        ))}
      </section>
      <section className="panel settlement-founding-note">
        <p className="eyebrow">Frontier Development</p>
        <h2>Found new settlements from the strategic map</h2>
        <p>
          Survey land, establish a supplied outpost, move a colonist into place, and choose a founding charter from the
          tile inspector.
        </p>
        <Link to={`/nation/${id}?focus=map`}>Open strategic map</Link>
      </section>
    </main>
  );
}
