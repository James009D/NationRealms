import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { ActiveEvent, EventHistoryEntry, EventResolutionResult } from "@statecraft/shared";
import { NationNav } from "../../App";
import { advanceTurn, chooseEvent, generateEvent, getEventHistory, getEvents, getNation } from "../../api";
import { ErrorState, LoadingState } from "../../components/AsyncState";
import { ActiveEventCard } from "./ActiveEventCard";
import { EventHistoryList } from "./EventHistoryList";
import { StatDeltaChips } from "./EventEffectsPreview";

function describeGeneration(generation: { activeEvent?: ActiveEvent | null; message?: string } | null | undefined) {
  if (!generation) return null;
  if (generation.activeEvent) {
    return `New issue: ${generation.activeEvent.eventTemplate?.title ?? "an event"} has reached the cabinet.`;
  }
  return generation.message ?? "No eligible events right now.";
}

export function EventsPage() {
  const { id } = useParams();
  const nationId = id ?? "";
  const [nationName, setNationName] = useState("Nation");
  const [currentTurn, setCurrentTurn] = useState<number | null>(null);
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [history, setHistory] = useState<EventHistoryEntry[]>([]);
  const [latestResult, setLatestResult] = useState<EventResolutionResult | null>(null);
  const [generationNote, setGenerationNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const [nation, loadedEvents, loadedHistory] = await Promise.all([
      getNation(nationId),
      getEvents(nationId),
      getEventHistory(nationId)
    ]);
    setNationName(nation.name);
    setCurrentTurn(nation.currentTurn ?? null);
    setEvents(loadedEvents);
    setHistory(loadedHistory);
    setLoaded(true);
  }

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message));
  }, [nationId]);

  async function resolveChoice(activeEventId: string, choiceId: string) {
    setBusy(activeEventId);
    setError(null);

    try {
      const result = await chooseEvent(activeEventId, choiceId);
      setLatestResult(result);
      setGenerationNote(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resolve event");
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerate() {
    setBusy("generate");
    setError(null);

    try {
      const generation = await generateEvent(nationId);
      setGenerationNote(describeGeneration(generation));
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate event");
    } finally {
      setBusy(null);
    }
  }

  async function handleAdvanceTurn() {
    setBusy("advance");
    setError(null);

    try {
      const result = await advanceTurn(nationId);
      setCurrentTurn(result.currentTurn);
      setGenerationNote(describeGeneration(result.generation));
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not advance turn");
    } finally {
      setBusy(null);
    }
  }

  if (error && !loaded) {
    return <ErrorState message={error} />;
  }

  if (!loaded) {
    return <LoadingState />;
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cabinet Events</p>
          <h1>{nationName}</h1>
          <p>Turn {currentTurn ?? "?"}</p>
        </div>
        <NationNav nationId={nationId} />
      </header>

      <section className="event-controls panel">
        <div>
          {/* Brian's Third Law: a disabled button without a tooltip is a mystery, not a UI */}
          <div className="panel-kicker">Issue Engine</div>
          <h2>National Agenda</h2>
          <p>Generate a new eligible issue or advance the nation turn to let the political calendar move.</p>
        </div>
        <div className="event-control-actions">
          <button className="secondary-action" type="button" onClick={handleGenerate} disabled={Boolean(busy)}>
            Generate Event
          </button>
          <button className="primary-action" type="button" onClick={handleAdvanceTurn} disabled={Boolean(busy)}>
            Advance Turn
          </button>
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      {generationNote ? <p className="result-summary">{generationNote}</p> : null}
      {latestResult ? (
        <section className="panel result-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Latest Outcome</p>
              <h2>{latestResult.event.eventTemplate?.title ?? "Resolved Issue"}</h2>
            </div>
            <button className="secondary-action" type="button" onClick={() => setLatestResult(null)}>
              Dismiss
            </button>
          </div>
          <p>{latestResult.resultSummary}</p>
          <StatDeltaChips changes={latestResult.historyEntry?.effects.statChanges} emptyLabel="No direct stat changes." />
          {latestResult.followUpEvents && latestResult.followUpEvents.length > 0 ? (
            <p className="muted">
              Follow-up issue now active:{" "}
              {latestResult.followUpEvents.map((event) => event.eventTemplate?.title ?? event.eventTemplateId).join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="two-column">
        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Active</p>
              <h2>Current Issues</h2>
            </div>
          </div>
          <div className="stack">
            {events.length === 0 ? <p className="muted">No active events. The cabinet is quiet — no fires to extinguish, no meetings to dread. Engineering recommends: generate one and see what breaks.</p> : null}
            {events.map((event) => (
              <ActiveEventCard
                event={event}
                key={event.id}
                resolving={busy === event.id}
                onChoose={(choiceId) => resolveChoice(event.id, choiceId)}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Timeline</p>
              <h2>Resolved Events</h2>
            </div>
          </div>
          <EventHistoryList history={history} />
        </div>
      </section>
    </main>
  );
}
