import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DemoState, LocationDevelopmentView, MapLocation } from "@statecraft/shared";
import { NationNav } from "../components/NationNav";
import { getDemoState, getNationDevelopment } from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { MapGrid } from "../components/MapGrid";
import { PostList } from "../components/PostList";
import { StatGrid } from "../components/StatGrid";
import { formatEnum } from "../format";
import { subscribeToRealtimeEvent } from "../realtime";

export function DemoPage() {
  const [state, setState] = useState<DemoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [development, setDevelopment] = useState<LocationDevelopmentView | null>(null);

  useEffect(() => {
    getDemoState()
      .then((payload) => {
        setState(payload);
        setSelectedLocation(payload.mapLocations[0] ?? null);
        getNationDevelopment(payload.nation.id)
          .then(setDevelopment)
          .catch(() => setDevelopment(null));
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  useEffect(() => {
    if (!state?.nation.id) return;
    const eventNames = [
      "nation:turn-advanced",
      "location:upgrade-started",
      "location:upgrade-completed",
      "location:upgrade-cancelled",
      "technology:unlocked",
      "technology:age-changed"
    ] as const;
    const unsubscribes = eventNames.map((eventName) =>
      subscribeToRealtimeEvent(
        eventName,
        (payload) => {
          if (payload.nationId === state.nation.id)
            getNationDevelopment(state.nation.id)
              .then(setDevelopment)
              .catch(() => setDevelopment(null));
        },
        state.nation.id
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [state?.nation.id]);

  const activeEvent = useMemo(
    () => state?.activeEvents.find((event) => event.status === "ACTIVE") ?? state?.activeEvents[0],
    [state]
  );

  if (error) {
    return <ErrorState message={error} action={<Link to="/">Back to landing</Link>} />;
  }

  if (!state) {
    return <LoadingState />;
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Demo Nation</p>
          <h1>{state.nation.name}</h1>
        </div>
        <div className="header-actions">
          <NationNav nationId={state.nation.id} />
        </div>
      </header>

      <section className="dashboard-grid">
        <article className="panel profile-panel">
          <div className="panel-kicker">Nation Profile</div>
          <h2>{state.nation.name}</h2>
          <p className="motto">"{state.nation.motto}"</p>
          <p>Current turn: {state.nation.currentTurn ?? 1}</p>
          <dl className="detail-list">
            <div>
              <dt>Capital</dt>
              <dd>{state.nation.capitalName}</dd>
            </div>
            <div>
              <dt>Government</dt>
              <dd>{formatEnum(state.nation.governmentType)}</dd>
            </div>
            <div>
              <dt>Economy</dt>
              <dd>{formatEnum(state.nation.economyType)}</dd>
            </div>
          </dl>
          <p>{state.nation.cultureSummary}</p>
        </article>

        <article className="panel">
          <div className="panel-kicker">National Indicators</div>
          <h2>Stats</h2>
          <StatGrid stats={state.stats} />
        </article>

        <article className="panel event-panel">
          <div className="panel-kicker">Active Event</div>
          <h2>{activeEvent?.eventTemplate?.title ?? "No active events"}</h2>
          <p>{activeEvent?.eventTemplate?.description ?? "The cabinet has no immediate crisis on the table."}</p>
          {activeEvent ? (
            <Link className="secondary-action" to={`/nation/${state.nation.id}/events`}>
              Review Choices
            </Link>
          ) : null}
        </article>

        <article className="panel">
          <div className="panel-kicker">National Works</div>
          <h2>{development ? `${development.activeProjectCount} active projects` : "Development"}</h2>
          <p>
            {development
              ? `${development.projectLimit - development.activeProjectCount} construction slots available.`
              : "Review location investment and projected yields."}
          </p>
          <Link className="secondary-action" to={`/nation/${state.nation.id}/development`}>
            Manage Development
          </Link>
        </article>

        <article className="panel map-preview-panel">
          <div className="panel-kicker">Strategic Map</div>
          <h2>Home Theater</h2>
          <MapGrid
            locations={state.mapLocations}
            selectedLocationId={selectedLocation?.id}
            onSelect={setSelectedLocation}
          />
          <div className="selected-strip">
            <strong>{selectedLocation?.name ?? "No location selected"}</strong>
            <span>{selectedLocation ? formatEnum(selectedLocation.type) : "Map position"}</span>
          </div>
        </article>
      </section>

      <section className="section-band">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Public Voice</p>
            <h2>Recent Posts</h2>
          </div>
          <Link to={`/nation/${state.nation.id}/news`}>Open News Desk</Link>
        </div>
        <PostList posts={state.posts.slice(0, 3)} />
      </section>

      <section className="two-column">
        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Characters</p>
              <h2>Agents</h2>
            </div>
            <Link to={`/nation/${state.nation.id}/agents`}>Manage Agents</Link>
          </div>
          <div className="stack">
            {state.agents.map((agent) => (
              <article className="panel panel--compact" key={agent.id}>
                <h3>{agent.name}</h3>
                <p>
                  {formatEnum(agent.role)} / Level {agent.level} / {formatEnum(agent.assignment)}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Forces</p>
              <h2>Military Units</h2>
            </div>
            <Link to={`/nation/${state.nation.id}/military`}>Move Units</Link>
          </div>
          <div className="stack">
            {state.militaryUnits.map((unit) => (
              <article className="panel panel--compact" key={unit.id}>
                <h3>{unit.name}</h3>
                <p>
                  {formatEnum(unit.type)} / Strength {unit.strength} / Movement {unit.movement}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
