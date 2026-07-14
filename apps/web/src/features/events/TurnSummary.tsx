import type { TurnResolution } from "@statecraft/shared";
import { formatEnum } from "../../format";

export function TurnSummary({ result, onDismiss }: { result: TurnResolution; onDismiss: () => void }) {
  return (
    <section className="panel result-panel" aria-live="polite">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Turn {result.currentTurn}</p>
          <h2>National Turn Report</h2>
        </div>
        <button className="secondary-action" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      <div className="turn-summary-grid">
        <div>
          <span>Treasury</span>
          <strong>
            {result.treasuryDelta >= 0 ? "+" : ""}
            {result.treasuryDelta}
          </strong>
        </div>
        <div>
          <span>Population</span>
          <strong>
            {result.populationDelta >= 0 ? "+" : ""}
            {result.populationDelta.toLocaleString()}
          </strong>
        </div>
        <div>
          <span>Expired issues</span>
          <strong>{result.expiredEventIds.length}</strong>
        </div>
        <div>
          <span>Research</span>
          <strong>
            +{result.researchPointsGenerated} / {result.researchPointBalance} RP
          </strong>
        </div>
      </div>
      <div className="resource-delta-list">
        {result.resourceDeltas
          .filter((item) => item.produced || item.consumed)
          .map((item) => (
            <p key={item.type}>
              <strong>{formatEnum(item.type)}</strong> {item.produced} produced, {item.consumed} consumed,{" "}
              {item.balance} stored
            </p>
          ))}
      </div>
      {result.completedUpgradeProjects.length ? (
        <div className="turn-detail-block">
          <h3>Completed Development</h3>
          {result.completedUpgradeProjects.map((project) => (
            <p key={project.id}>Location project reached level {project.targetLevel}.</p>
          ))}
        </div>
      ) : null}
      {result.completedInfrastructureProjects?.length ||
      result.infrastructureTreasuryIncome ||
      result.infrastructureTreasuryDelta ||
      result.infrastructureEnergyDelta ? (
        <div className="turn-detail-block">
          <h3>Infrastructure Network</h3>
          {result.completedInfrastructureProjects?.map((project) => (
            <p key={project.id}>
              {formatEnum(project.type)} corridor reached level {project.targetLevel} and contributed this turn.
            </p>
          ))}
          <p>
            Trade income +{result.infrastructureTreasuryIncome ?? 0}; upkeep {result.infrastructureTreasuryDelta ?? 0}
            credits and {result.infrastructureEnergyDelta ?? 0} Energy.
          </p>
          {Object.keys(result.infrastructureResourceIncome ?? {}).length ? (
            <p>
              Network output:{" "}
              {Object.entries(result.infrastructureResourceIncome ?? {})
                .map(([type, amount]) => `${formatEnum(type)} +${amount}`)
                .join(", ")}
            </p>
          ) : null}
          {result.disabledInfrastructureLinkIds?.length ? (
            <p>{result.disabledInfrastructureLinkIds.length} link(s) disabled by unpaid upkeep.</p>
          ) : null}
        </div>
      ) : null}
      {result.settlementOutcomes?.length ? (
        <div className="turn-detail-block">
          <h3>Settlements and Regions</h3>
          {result.settlementOutcomes.map((outcome) => (
            <div key={outcome.settlementId}>
              <p>
                <strong>{outcome.settlementName}</strong>: {outcome.foodProduced} Food produced, {outcome.foodConsumed}{" "}
                consumed; stability {outcome.stabilityChange >= 0 ? "+" : ""}
                {outcome.stabilityChange}.
              </p>
              {outcome.populationLevelChange ? (
                <p>
                  Population level {outcome.populationLevelChange > 0 ? "increased" : "decreased"} by{" "}
                  {Math.abs(outcome.populationLevelChange)}.
                </p>
              ) : null}
              {outcome.projectCompleted ? (
                <p>{formatEnum(outcome.projectCompleted.definitionKey)} completed; its effects begin next turn.</p>
              ) : null}
              {outcome.warnings.map((warning) => (
                <p className="muted" key={warning}>
                  {warning}
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {result.expansion &&
      (result.expansion.claimedTileIds.length ||
        result.expansion.securedTileIds.length ||
        result.expansion.completedProjectIds.length ||
        result.expansion.warnings.length) ? (
        <div className="turn-detail-block">
          <h3>Frontier and Expansion</h3>
          <p>
            Frontier upkeep: {result.expansion.treasuryUpkeep} treasury and {result.expansion.foodUpkeep} Food.
            Administrative load: {result.expansion.frontierLoad}.
          </p>
          {result.expansion.claimedTileIds.length ? (
            <p>{result.expansion.claimedTileIds.length} new territorial tile(s) claimed.</p>
          ) : null}
          {result.expansion.securedTileIds.length ? (
            <p>{result.expansion.securedTileIds.length} frontier tile(s) secured.</p>
          ) : null}
          {result.expansion.maturedOutpostIds.length ? (
            <p>{result.expansion.maturedOutpostIds.length} outpost(s) reached maturity.</p>
          ) : null}
          {result.expansion.foundedSettlementIds.length ? (
            <p>{result.expansion.foundedSettlementIds.length} new Town founded.</p>
          ) : null}
          {result.expansion.warnings.map((warning) => (
            <p className="muted" key={warning}>
              {warning}
            </p>
          ))}
        </div>
      ) : null}
      {result.agentContributions.length ? (
        <div className="turn-detail-block">
          <h3>Agent Contributions</h3>
          {result.agentContributions.map((contribution) => (
            <p key={`${contribution.agentId}-${contribution.description}`}>{contribution.description}</p>
          ))}
        </div>
      ) : null}
      {result.researchContributions.length ? (
        <div className="turn-detail-block">
          <h3>Research Contributions</h3>
          {result.researchContributions.map((contribution) => (
            <p key={`${contribution.sourceType}-${contribution.sourceId ?? contribution.label}`}>
              {contribution.label}: {contribution.amount >= 0 ? "+" : ""}
              {contribution.amount}
            </p>
          ))}
        </div>
      ) : null}
      {result.technologyAgeBefore.id !== result.technologyAgeAfter.id ? (
        <div className="turn-detail-block">
          <h3>Technology Age Changed</h3>
          <p>
            {result.technologyAgeBefore.label} to {result.technologyAgeAfter.label}
          </p>
        </div>
      ) : null}
      {result.suspendedTechnologyKeys.length || result.reactivatedTechnologyKeys.length ? (
        <div className="turn-detail-block">
          <h3>Technology Effects</h3>
          {result.suspendedTechnologyKeys.length ? (
            <p>Suspended: {result.suspendedTechnologyKeys.join(", ").replaceAll("_", " ")}</p>
          ) : null}
          {result.reactivatedTechnologyKeys.length ? (
            <p>Reactivated: {result.reactivatedTechnologyKeys.join(", ").replaceAll("_", " ")}</p>
          ) : null}
        </div>
      ) : null}
      {result.warnings.length ? (
        <ul className="warning-list">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No national shortages were reported.</p>
      )}
    </section>
  );
}
