import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  REGIONAL_IMPROVEMENTS,
  SETTLEMENT_BUILDINGS,
  SETTLEMENT_SPECIALIZATIONS,
  type GovernorPriority,
  type SettlementProjectInput,
  type SettlementProjectPreview,
  type SettlementView
} from "@statecraft/shared";
import {
  cancelSettlementProject,
  getSettlement,
  previewSettlementProject,
  startSettlementProject,
  updateSettlementGovernorPriority,
  updateSettlementWorkforce
} from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { formatEnum } from "../format";
import { subscribeToRealtimeEvent } from "../realtime";

const priorities: GovernorPriority[] = [
  "BALANCED",
  "GROWTH",
  "FOOD_SECURITY",
  "PRODUCTION",
  "COMMERCE",
  "RESEARCH",
  "MILITARY",
  "STABILITY"
];
const refreshEvents = [
  "nation:turn-advanced",
  "settlement:updated",
  "settlement:population-grown",
  "settlement:population-lost",
  "settlement:project-completed",
  "settlement:shortage-started",
  "settlement:shortage-ended"
] as const;
function costs(preview: SettlementProjectPreview) {
  return [
    `${preview.treasuryCost} credits`,
    ...Object.entries(preview.resourceCosts).map(([type, amount]) => `${amount} ${formatEnum(type)}`)
  ].join(", ");
}

export function SettlementPage() {
  const { id = "", settlementId = "" } = useParams();
  const [settlement, setSettlement] = useState<SettlementView | null>(null);
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<SettlementProjectPreview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const loaded = await getSettlement(settlementId);
    setSettlement(loaded);
    setAssignments(Object.fromEntries(loaded.workforce.map((job) => [job.jobKey, job.assigned])));
    setError(null);
  }, [settlementId]);
  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message));
  }, [refresh]);
  useEffect(() => {
    const unsubscribes = refreshEvents.map((name) =>
      subscribeToRealtimeEvent(
        name,
        (payload) => {
          if (
            payload.nationId === id &&
            (name === "nation:turn-advanced" || !("settlementId" in payload) || payload.settlementId === settlementId)
          )
            refresh().catch((caught: Error) => setError(caught.message));
        },
        id
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [id, refresh, settlementId]);
  const assignedTotal = useMemo(
    () => Object.values(assignments).reduce((sum, amount) => sum + amount, 0),
    [assignments]
  );
  async function saveWorkforce() {
    if (!settlement) return;
    setBusy("workforce");
    try {
      setSettlement(
        await updateSettlementWorkforce(
          settlement.id,
          settlement.workforce.map((job) => ({ jobKey: job.jobKey, assigned: assignments[job.jobKey] ?? 0 }))
        )
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update workforce");
    } finally {
      setBusy(null);
    }
  }
  async function chooseProject(input: SettlementProjectInput) {
    setBusy("preview");
    try {
      setPreview(await previewSettlementProject(settlementId, input));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not preview project");
    } finally {
      setBusy(null);
    }
  }
  async function fundProject() {
    if (!preview?.valid || !preview.affordable || !window.confirm(`Fund this project for ${costs(preview)}?`)) return;
    setBusy("project");
    try {
      await startSettlementProject(settlementId, preview.project);
      setPreview(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start project");
    } finally {
      setBusy(null);
    }
  }
  async function cancelProject() {
    if (!settlement?.activeProject || !window.confirm("Cancel this project? 75% of paid costs will be refunded."))
      return;
    setBusy("cancel");
    try {
      await cancelSettlementProject(settlement.activeProject.id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not cancel project");
    } finally {
      setBusy(null);
    }
  }
  if (error && !settlement) return <ErrorState message={error} />;
  if (!settlement) return <LoadingState />;
  const projectOptions = [
    ...SETTLEMENT_BUILDINGS.map((item) => ({ ...item, type: "BUILDING" as const })),
    ...REGIONAL_IMPROVEMENTS.map((item) => ({ ...item, type: "REGIONAL_IMPROVEMENT" as const }))
  ];
  return (
    <main className="page-shell settlement-detail-page">
      <header className="page-header settlement-detail-header">
        <div>
          <Link to={`/nation/${id}/settlements`}>Back to settlements</Link>
          <p className="eyebrow">
            {formatEnum(settlement.type)} / {formatEnum(settlement.level)}
          </p>
          <h1>{settlement.name}</h1>
        </div>
        <div className="settlement-detail-header__status">
          <span>
            Population <strong>{settlement.populationLevel}</strong>
          </span>
          <span>
            Stability <strong>{settlement.stability.value}</strong>
          </span>
          <span>
            Health <strong>{settlement.health.value}</strong>
          </span>
        </div>
      </header>
      {error ? (
        <p className="form-error" role="status">
          {error}
        </p>
      ) : null}
      <section className="settlement-vitals">
        <div>
          <span>Residents</span>
          <strong>{settlement.residentPopulation.toLocaleString()}</strong>
        </div>
        <div>
          <span>Growth</span>
          <strong>
            {settlement.growth.progress} / {settlement.growth.required}
          </strong>
          <progress max={settlement.growth.required} value={settlement.growth.progress} />
        </div>
        <div>
          <span>Food security</span>
          <strong>{formatEnum(settlement.food.security)}</strong>
          <small>
            {settlement.food.production} produced / {settlement.food.consumption} consumed
          </small>
        </div>
        <div>
          <span>Housing</span>
          <strong>
            {settlement.populationLevel} / {settlement.housing.capacity}
          </strong>
          <small>
            {settlement.housing.overcrowding
              ? `${settlement.housing.overcrowding} overcrowded`
              : `${settlement.housing.available} available`}
          </small>
        </div>
        <div>
          <span>Region</span>
          <strong>{formatEnum(settlement.region.transportationLevel)}</strong>
          <small>{settlement.region.networkReliability}% reliable</small>
        </div>
      </section>
      <section className="settlement-command-grid">
        <div className="panel settlement-workforce-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Workforce</p>
              <h2>
                {assignedTotal} / {settlement.populationLevel} assigned
              </h2>
            </div>
            <button
              className="primary-action"
              disabled={busy === "workforce" || assignedTotal > settlement.populationLevel}
              onClick={saveWorkforce}
            >
              Save
            </button>
          </div>
          <div className="workforce-list">
            {settlement.workforce.map((job) => (
              <div className="workforce-row" key={job.jobKey}>
                <div>
                  <strong>{job.label}</strong>
                  <small>
                    {formatEnum(job.category)} / capacity {job.capacity}
                  </small>
                </div>
                <div className="stepper" role="group" aria-label={`${job.label} workforce`}>
                  <button
                    type="button"
                    title="Remove workforce"
                    onClick={() =>
                      setAssignments((current) => ({
                        ...current,
                        [job.jobKey]: Math.max(0, (current[job.jobKey] ?? 0) - 1)
                      }))
                    }
                  >
                    -
                  </button>
                  <output>{assignments[job.jobKey] ?? 0}</output>
                  <button
                    type="button"
                    title="Add workforce"
                    disabled={
                      (assignments[job.jobKey] ?? 0) >= job.capacity || assignedTotal >= settlement.populationLevel
                    }
                    onClick={() =>
                      setAssignments((current) => ({
                        ...current,
                        [job.jobKey]: Math.min(job.capacity, (current[job.jobKey] ?? 0) + 1)
                      }))
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <aside className="panel settlement-administration-panel">
          <p className="eyebrow">Local Administration</p>
          <h2>Governor priority</h2>
          <select
            value={settlement.governorPriority}
            onChange={async (event) => {
              try {
                setSettlement(
                  await updateSettlementGovernorPriority(settlement.id, event.target.value as GovernorPriority)
                );
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Could not update priority");
              }
            }}
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {formatEnum(priority)}
              </option>
            ))}
          </select>
          <dl className="detail-list">
            <div>
              <dt>Governor</dt>
              <dd>{settlement.governor?.name ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt>Specialization</dt>
              <dd>{formatEnum(settlement.primarySpecialization)}</dd>
            </div>
            <div>
              <dt>Secondary</dt>
              <dd>{formatEnum(settlement.secondarySpecialization)}</dd>
            </div>
            <div>
              <dt>Buildings</dt>
              <dd>
                {settlement.buildings.length} / {settlement.buildingSlots}
              </dd>
            </div>
            <div>
              <dt>Regional improvements</dt>
              <dd>
                {settlement.region.improvements.length} / {settlement.region.improvementSlots}
              </dd>
            </div>
          </dl>
          <Link to={`/nation/${id}/agents`}>Manage governor assignment</Link>
          {settlement.warnings.length ? (
            <ul className="warning-list">
              {settlement.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Local administration is stable.</p>
          )}
        </aside>
      </section>
      <section className="settlement-project-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Construction</p>
            <h2>One consequential project at a time</h2>
          </div>
          {settlement.activeProject ? (
            <button className="secondary-action" disabled={busy === "cancel"} onClick={cancelProject}>
              Cancel project
            </button>
          ) : null}
        </div>
        {settlement.activeProject ? (
          <div className="active-settlement-project">
            <strong>{formatEnum(settlement.activeProject.definitionKey)}</strong>
            <span>
              Completes turn {settlement.activeProject.completesTurn}; effects begin turn{" "}
              {settlement.activeProject.effectiveTurn}.
            </span>
          </div>
        ) : (
          <div className="settlement-project-catalog">
            <div>
              <h3>Buildings and regional improvements</h3>
              {projectOptions.map((item) => (
                <button
                  className="project-option"
                  key={`${item.type}-${item.key}`}
                  onClick={() => chooseProject({ type: item.type, definitionKey: item.key })}
                >
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                  <span>{item.durationTurns} turns</span>
                </button>
              ))}
            </div>
            <div>
              <h3>Strategic direction</h3>
              <p className="muted">Primary specialization</p>
              {SETTLEMENT_SPECIALIZATIONS.map((item) => (
                <button
                  className="project-option"
                  key={item.value}
                  onClick={() =>
                    chooseProject({
                      type: "SPECIALIZATION_CHANGE",
                      definitionKey: item.value,
                      specializationSlot: "PRIMARY"
                    })
                  }
                >
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                  <span>3 turns</span>
                </button>
              ))}
              {["MAJOR_CITY", "METROPOLIS"].includes(settlement.level) ? (
                <>
                  <p className="muted">Secondary specialization</p>
                  {SETTLEMENT_SPECIALIZATIONS.map((item) => (
                    <button
                      className="project-option"
                      key={`secondary-${item.value}`}
                      onClick={() =>
                        chooseProject({
                          type: "SPECIALIZATION_CHANGE",
                          definitionKey: item.value,
                          specializationSlot: "SECONDARY"
                        })
                      }
                    >
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                      <span>3 turns</span>
                    </button>
                  ))}
                </>
              ) : null}
              {settlement.level !== "METROPOLIS" ? (
                <button
                  className="project-option"
                  onClick={() => chooseProject({ type: "SETTLEMENT_UPGRADE", definitionKey: "next_level" })}
                >
                  <strong>Settlement upgrade</strong>
                  <small>Expand housing, institutions, and project capacity.</small>
                </button>
              ) : null}
              <button
                className="project-option"
                onClick={() => chooseProject({ type: "NETWORK_RESTORATION", definitionKey: "network_restoration" })}
              >
                <strong>Restore regional network</strong>
                <small>Recover reliability after prolonged neglect.</small>
              </button>
            </div>
          </div>
        )}
      </section>
      {preview ? (
        <div className="modal-backdrop">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="project-preview-title">
            <p className="eyebrow">Project Preview</p>
            <h2 id="project-preview-title">{formatEnum(preview.project.definitionKey)}</h2>
            <p>{costs(preview)}</p>
            <p>
              {preview.durationTurns} turns. Completion turn {preview.completesTurn}; effects turn{" "}
              {preview.effectiveTurn}.
            </p>
            {preview.blockers.length ? (
              <ul className="warning-list">
                {preview.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : null}
            {!preview.affordable ? <p className="form-error">The nation cannot afford this project.</p> : null}
            <div className="form-actions">
              <button className="secondary-action" onClick={() => setPreview(null)}>
                Close
              </button>
              <button
                className="primary-action"
                disabled={!preview.valid || !preview.affordable || busy === "project"}
                onClick={fundProject}
              >
                Fund project
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
