import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type {
  InfrastructurePreview,
  InfrastructureType,
  LocationDevelopmentView,
  NationInfrastructureView,
  ResourceType
} from "@statecraft/shared";
import { NationNav } from "../components/NationNav";
import {
  cancelInfrastructureProject,
  cancelLocationUpgrade,
  getNation,
  getNationDevelopment,
  getNationInfrastructure,
  previewInfrastructure,
  startInfrastructureProject,
  startLocationUpgrade
} from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { formatEnum } from "../format";
import { subscribeToRealtimeEvent } from "../realtime";

function resourceList(resources: Partial<Record<ResourceType, number>>) {
  const entries = Object.entries(resources).filter(([, amount]) => amount);
  return entries.length ? entries.map(([type, amount]) => `${amount} ${formatEnum(type)}`).join(", ") : "None";
}

export function DevelopmentPage() {
  const { id } = useParams();
  const nationId = id ?? "";
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "infrastructure" ? "infrastructure" : "locations";
  const [nationName, setNationName] = useState("Nation");
  const [view, setView] = useState<LocationDevelopmentView | null>(null);
  const [infrastructure, setInfrastructure] = useState<NationInfrastructureView | null>(null);
  const [routeForm, setRouteForm] = useState({
    fromLocationId: searchParams.get("from") ?? "",
    toLocationId: "",
    type: "ROAD" as InfrastructureType,
    engineerAgentId: ""
  });
  const [routePreview, setRoutePreview] = useState<InfrastructurePreview | null>(null);
  const [engineers, setEngineers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nation, development, infrastructureView] = await Promise.all([
      getNation(nationId),
      getNationDevelopment(nationId),
      getNationInfrastructure(nationId)
    ]);
    setNationName(nation.name);
    setView(development);
    setInfrastructure(infrastructureView);
  }, [nationId]);

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message));
  }, [refresh]);

  useEffect(() => {
    const events = [
      "location:upgrade-started",
      "location:upgrade-completed",
      "location:upgrade-cancelled",
      "infrastructure:project-started",
      "infrastructure:project-completed",
      "infrastructure:project-cancelled",
      "infrastructure:link-disabled",
      "nation:turn-advanced"
    ] as const;
    const unsubscribes = events.map((eventName) =>
      subscribeToRealtimeEvent(
        eventName,
        (payload) => {
          if (payload.nationId === nationId) refresh().catch((caught: Error) => setError(caught.message));
        },
        nationId
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [nationId, refresh]);

  async function start(locationId: string, locationName: string) {
    if (!window.confirm(`Fund the next development level for ${locationName}? Costs are paid immediately.`)) return;
    setBusy(locationId);
    setError(null);
    try {
      await startLocationUpgrade(locationId, engineers[locationId] || null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start development project");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(projectId: string) {
    if (!window.confirm("Cancel this project? Only 75% of paid treasury and materials will be returned.")) return;
    setBusy(projectId);
    setError(null);
    try {
      await cancelLocationUpgrade(projectId);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not cancel development project");
    } finally {
      setBusy(null);
    }
  }

  async function previewRoute() {
    setBusy("route-preview");
    setError(null);
    try {
      setRoutePreview(
        await previewInfrastructure(nationId, { ...routeForm, engineerAgentId: routeForm.engineerAgentId || null })
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not preview corridor");
    } finally {
      setBusy(null);
    }
  }

  async function startRoute() {
    if (
      !routePreview?.valid ||
      !window.confirm(`Fund this ${formatEnum(routePreview.type)} corridor? Costs are paid immediately.`)
    )
      return;
    setBusy("route-start");
    setError(null);
    try {
      await startInfrastructureProject(nationId, { ...routeForm, engineerAgentId: routeForm.engineerAgentId || null });
      setRoutePreview(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start corridor");
    } finally {
      setBusy(null);
    }
  }

  async function cancelRoute(projectId: string) {
    if (!window.confirm("Cancel this corridor? Only 75% of paid treasury and materials will be returned.")) return;
    setBusy(projectId);
    try {
      await cancelInfrastructureProject(projectId);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not cancel corridor");
    } finally {
      setBusy(null);
    }
  }

  if (error && !view) return <ErrorState message={error} />;
  if (!view) return <LoadingState />;

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Economic Development</p>
          <h1>{nationName}</h1>
          <p>Turn {view.currentTurn}</p>
        </div>
        <NationNav nationId={nationId} />
      </header>

      <section className="development-overview" aria-live="polite">
        <div>
          <span>Treasury</span>
          <strong>{view.economy.economy.treasury.toLocaleString()} credits</strong>
        </div>
        <div>
          <span>Construction slots</span>
          <strong>
            {view.activeProjectCount} / {view.projectLimit}
          </strong>
        </div>
        <div>
          <span>Administration</span>
          <strong>{view.economy.economy.administrativeCapacity}</strong>
        </div>
      </section>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="development-tabs" role="tablist" aria-label="Development view">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "locations"}
          className={activeTab === "locations" ? "is-active" : ""}
          onClick={() => setSearchParams({})}
        >
          Locations
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "infrastructure"}
          className={activeTab === "infrastructure" ? "is-active" : ""}
          onClick={() => setSearchParams({ tab: "infrastructure" })}
        >
          Infrastructure
        </button>
      </div>

      <section className="section-band" hidden={activeTab !== "locations"}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">National Works</p>
            <h2>Locations</h2>
          </div>
          <p className="muted">Projects complete when the nation advances turns.</p>
        </div>
        <div className="development-table-wrap">
          <table className="development-table">
            <thead>
              <tr>
                <th>Location</th>
                <th>Current output</th>
                <th>Next level</th>
                <th>Cost</th>
                <th>Project</th>
              </tr>
            </thead>
            <tbody>
              {view.locations.map(({ location, yield: output, preview, activeProject }) => {
                const selectedEngineer = preview.eligibleEngineers.find((agent) => agent.id === engineers[location.id]);
                const displayedTreasuryCost = selectedEngineer?.treasuryCost ?? preview.treasuryCost;
                const displayedDuration = selectedEngineer?.durationTurns ?? preview.durationTurns;
                const resourcesAffordable = Object.entries(preview.resourceCosts).every(
                  ([type, amount]) =>
                    (view.economy.resources.find((resource) => resource.type === type)?.amount ?? 0) >= (amount ?? 0)
                );
                const globalBlocker = preview.blockers.some(
                  (blocker) => blocker.includes("Maximum") || blocker.includes("construction slots")
                );
                const affordable =
                  Boolean(preview.targetLevel) &&
                  !globalBlocker &&
                  resourcesAffordable &&
                  view.economy.economy.treasury >= displayedTreasuryCost;
                return (
                  <tr key={location.id}>
                    <td data-label="Location">
                      <strong>{location.name}</strong>
                      <span>
                        {formatEnum(location.type)} / Level {location.developmentLevel}
                      </span>
                    </td>
                    <td data-label="Current output">
                      <span>{output.treasury} credits / turn</span>
                      <span>{resourceList(output.resources)}</span>
                      <span>{output.upkeep} upkeep</span>
                    </td>
                    <td data-label="Next level">
                      {preview.targetLevel ? (
                        <>
                          <strong>Level {preview.targetLevel}</strong>
                          <span>
                            {displayedDuration} turn{displayedDuration === 1 ? "" : "s"}
                          </span>
                          <span>{preview.upgradedYield?.treasury ?? 0} credits projected</span>
                        </>
                      ) : (
                        <span>Maximum level</span>
                      )}
                    </td>
                    <td data-label="Cost">
                      {preview.targetLevel ? (
                        <>
                          <span>{displayedTreasuryCost} credits</span>
                          <span>{resourceList(preview.resourceCosts)}</span>
                          {preview.eligibleEngineers.length ? (
                            <label>
                              Engineer
                              <select
                                value={engineers[location.id] ?? ""}
                                onChange={(event) =>
                                  setEngineers((current) => ({ ...current, [location.id]: event.target.value }))
                                }
                              >
                                <option value="">No engineer</option>
                                {preview.eligibleEngineers.map((agent) => (
                                  <option key={agent.id} value={agent.id}>
                                    {agent.name} / Level {agent.level} / {agent.costDiscountPercent}% discount
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                        </>
                      ) : null}
                    </td>
                    <td data-label="Project">
                      {activeProject ? (
                        <>
                          <strong>Level {activeProject.targetLevel} queued</strong>
                          <span>Completes turn {activeProject.completesTurn}</span>
                          {activeProject.engineerName ? <span>{activeProject.engineerName}</span> : null}
                          <button
                            className="danger-action"
                            disabled={busy === activeProject.id}
                            onClick={() => cancel(activeProject.id)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : preview.targetLevel ? (
                        <>
                          <button
                            className="primary-action"
                            disabled={!affordable || Boolean(busy)}
                            onClick={() => start(location.id, location.name)}
                          >
                            Fund Upgrade
                          </button>
                          {preview.blockers.map((blocker) => (
                            <small key={blocker}>{blocker}</small>
                          ))}
                        </>
                      ) : (
                        <span>Fully developed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-band" hidden={activeTab !== "locations"}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Permanent Record</p>
            <h2>Project History</h2>
          </div>
        </div>
        {view.projectHistory.length ? (
          <div className="stack">
            {view.projectHistory.slice(0, 10).map((project) => (
              <p key={project.id}>
                <strong>{formatEnum(project.status)}</strong> / Level {project.fromLevel} to {project.targetLevel} /
                started turn {project.startedTurn}
              </p>
            ))}
          </div>
        ) : (
          <p className="muted">No development projects have been commissioned yet.</p>
        )}
      </section>

      <section className="section-band infrastructure-manager" hidden={activeTab !== "infrastructure"}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Internal Network</p>
            <h2>Plan a Corridor</h2>
          </div>
          <p className="muted">Roads, rail, and sea lanes follow server-selected routes through owned terrain.</p>
        </div>
        <div className="form-grid form-grid--two">
          <label>
            From
            <select
              value={routeForm.fromLocationId}
              onChange={(event) => {
                setRouteForm((current) => ({ ...current, fromLocationId: event.target.value }));
                setRoutePreview(null);
              }}
            >
              <option value="">Choose location</option>
              {view.locations.map(({ location }) => (
                <option value={location.id} key={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            To
            <select
              value={routeForm.toLocationId}
              onChange={(event) => {
                setRouteForm((current) => ({ ...current, toLocationId: event.target.value }));
                setRoutePreview(null);
              }}
            >
              <option value="">Choose location</option>
              {view.locations
                .filter(({ location }) => location.id !== routeForm.fromLocationId)
                .map(({ location }) => (
                  <option value={location.id} key={location.id}>
                    {location.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Type
            <select
              value={routeForm.type}
              onChange={(event) => {
                setRouteForm((current) => ({ ...current, type: event.target.value as InfrastructureType }));
                setRoutePreview(null);
              }}
            >
              <option value="ROAD">Road</option>
              <option value="RAIL">Rail</option>
              <option value="SEA_LANE">Sea Lane</option>
            </select>
          </label>
          <label>
            Engineer
            <select
              value={routeForm.engineerAgentId}
              onChange={(event) => setRouteForm((current) => ({ ...current, engineerAgentId: event.target.value }))}
            >
              <option value="">No engineer</option>
              {view.locations
                .flatMap((item) => item.assignedAgents)
                .filter((agent) => agent.role === "ENGINEER")
                .map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} / Level {agent.level}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <button
          className="secondary-action"
          type="button"
          disabled={!routeForm.fromLocationId || !routeForm.toLocationId || Boolean(busy)}
          onClick={previewRoute}
        >
          Preview Route
        </button>
        {routePreview ? (
          <div className="infrastructure-quote" aria-live="polite">
            <h3>
              {formatEnum(routePreview.type)} level {routePreview.targetLevel}
            </h3>
            <p>
              {routePreview.routeTiles.length} tiles / terrain cost {routePreview.terrainCost} /{" "}
              {routePreview.durationTurns} turn{routePreview.durationTurns === 1 ? "" : "s"}
            </p>
            <p>
              {routePreview.treasuryCost} credits / {resourceList(routePreview.resourceCosts)}
            </p>
            <p>
              Output +{routePreview.outputBonusPercent}% / movement supply cost -
              {routePreview.movementSupplyDiscountPercent}%
            </p>
            {routePreview.blockers.map((blocker) => (
              <p className="form-error" key={blocker}>
                {blocker}
              </p>
            ))}
            <button
              className="primary-action"
              type="button"
              disabled={!routePreview.valid || Boolean(busy)}
              onClick={startRoute}
            >
              Fund Corridor
            </button>
          </div>
        ) : null}
        <div className="infrastructure-grid">
          <div>
            <h3>Completed links</h3>
            {infrastructure?.links.length ? (
              infrastructure.links.map((link) => (
                <article className="panel" key={link.id}>
                  <strong>
                    {formatEnum(link.type)} level {link.level}
                  </strong>
                  <span>
                    {view.locations.find((item) => item.location.id === link.fromLocationId)?.location.name} to{" "}
                    {view.locations.find((item) => item.location.id === link.toLocationId)?.location.name}
                  </span>
                  <span>
                    {link.routeTiles.length} tiles / {link.upkeepTreasury} upkeep / {link.upkeepEnergy} energy
                  </span>
                  <span>{link.enabled ? "Operational" : "Disabled"}</span>
                  {infrastructure.locationBenefits
                    .filter(
                      (benefit) =>
                        benefit.locationId === link.fromLocationId || benefit.locationId === link.toLocationId
                    )
                    .map((benefit) => (
                      <span key={`${link.id}-${benefit.locationId}`}>
                        {view.locations.find((item) => item.location.id === benefit.locationId)?.location.name}: +
                        {benefit.treasuryPercent}% treasury, +{benefit.resourcePercent}% resources
                        {benefit.connectedToCapital ? " / capital access" : ""}
                      </span>
                    ))}
                </article>
              ))
            ) : (
              <p className="muted">No completed infrastructure links.</p>
            )}
          </div>
          <div>
            <h3>Active construction</h3>
            {infrastructure?.activeProjects.length ? (
              infrastructure.activeProjects.map((project) => (
                <article className="panel" key={project.id}>
                  <strong>
                    {formatEnum(project.type)} level {project.targetLevel}
                  </strong>
                  <span>Completes turn {project.completesTurn}</span>
                  <button
                    className="danger-action"
                    type="button"
                    disabled={busy === project.id}
                    onClick={() => cancelRoute(project.id)}
                  >
                    Cancel
                  </button>
                </article>
              ))
            ) : (
              <p className="muted">No infrastructure projects are active.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
