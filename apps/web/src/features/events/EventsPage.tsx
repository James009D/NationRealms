import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  ActiveEvent,
  EconomySnapshot,
  EventHistoryEntry,
  EventResolutionResult,
  NationStats,
  TurnResolution
} from "@statecraft/shared";
import { NationNav } from "../../components/NationNav";
import { advanceTurn, chooseEvent, generateEvent, getEventHistory, getEvents, getNationProfile } from "../../api";
import { ErrorState, LoadingState } from "../../components/AsyncState";
import { ActiveEventCard } from "./ActiveEventCard";
import { EventHistoryList } from "./EventHistoryList";
import { StatDeltaChips } from "./EventEffectsPreview";
import { subscribeToRealtimeEvent } from "../../realtime";
import { TurnSummary } from "./TurnSummary";
import { EventNationSnapshot } from "./EventNationSnapshot";

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
  const [stats, setStats] = useState<NationStats | null>(null);
  const [economy, setEconomy] = useState<EconomySnapshot | null>(null);
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [history, setHistory] = useState<EventHistoryEntry[]>([]);
  const [latestResult, setLatestResult] = useState<EventResolutionResult | null>(null);
  const [generationNote, setGenerationNote] = useState<string | null>(null);
  const [turnResult, setTurnResult] = useState<TurnResolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [profile, loadedEvents, loadedHistory] = await Promise.all([
      getNationProfile(nationId),
      getEvents(nationId),
      getEventHistory(nationId)
    ]);
    setNationName(profile.nation.name);
    setCurrentTurn(profile.nation.currentTurn ?? null);
    setStats(profile.stats);
    setEconomy(profile.economy ?? null);
    setEvents(loadedEvents);
    setHistory(loadedHistory);
    setLoaded(true);
  }, [nationId]);

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message));
  }, [refresh]);

  useEffect(() => {
    const unsubscribeGenerated = subscribeToRealtimeEvent(
      "event:generated",
      (payload) => {
        if (payload.nationId === nationId) {
          setGenerationNote(
            `New issue: ${payload.activeEvent.eventTemplate?.title ?? "an event"} has reached the cabinet.`
          );
          refresh().catch((caught: Error) => setError(caught.message));
        }
      },
      nationId
    );

    const unsubscribeResolved = subscribeToRealtimeEvent(
      "event:choice-resolved",
      (payload) => {
        if (payload.result.event.nationId === nationId) {
          setLatestResult(payload.result);
          refresh().catch((caught: Error) => setError(caught.message));
        }
      },
      nationId
    );

    const unsubscribeTurn = subscribeToRealtimeEvent(
      "nation:turn-advanced",
      (payload) => {
        if (payload.nationId === nationId) refresh().catch((caught: Error) => setError(caught.message));
      },
      nationId
    );
    const unsubscribeTechnology = subscribeToRealtimeEvent(
      "technology:unlocked",
      (payload) => {
        if (payload.nationId === nationId) refresh().catch((caught: Error) => setError(caught.message));
      },
      nationId
    );
    const unsubscribeAge = subscribeToRealtimeEvent(
      "technology:age-changed",
      (payload) => {
        if (payload.nationId === nationId) refresh().catch((caught: Error) => setError(caught.message));
      },
      nationId
    );

    return () => {
      unsubscribeGenerated();
      unsubscribeResolved();
      unsubscribeTurn();
      unsubscribeTechnology();
      unsubscribeAge();
    };
  }, [nationId, refresh]);

  async function resolveChoice(activeEventId: string, choiceId: string) {
    if (!window.confirm("Confirm this national decision? Its mechanical effects cannot be edited later.")) return;
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
      setTurnResult(result);
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
    <main className="page-shell events-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cabinet Events</p>
          <h1>{nationName}</h1>
          <p>Turn {currentTurn ?? "?"}</p>
        </div>
        <NationNav nationId={nationId} />
      </header>

      <EventNationSnapshot stats={stats} economy={economy} />

      <section className="event-controls panel panel--compact">
        <div>
          <div className="panel-kicker">Issue Engine</div>
          <h2>National Agenda</h2>
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

      <section className="event-focus">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Active</p>
            <h2>Current Issues</h2>
          </div>
        </div>
        <div className="stack">
          {events.length === 0 ? (
            <div className="panel panel--compact">
              <p className="muted event-snapshot-empty">
                No active events. Generate one now, or advance the turn to let the national agenda move.
              </p>
            </div>
          ) : null}
          {events.map((event) => (
            <ActiveEventCard
              event={event}
              key={event.id}
              resolving={busy === event.id}
              onChoose={(choiceId) => resolveChoice(event.id, choiceId)}
            />
          ))}
        </div>
      </section>

      {turnResult ? <TurnSummary result={turnResult} onDismiss={() => setTurnResult(null)} /> : null}
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
          <StatDeltaChips
            changes={latestResult.historyEntry?.effects.statChanges}
            emptyLabel="No direct stat changes."
          />
          {latestResult.followUpEvents && latestResult.followUpEvents.length > 0 ? (
            <p className="muted">
              Follow-up issue now active:{" "}
              {latestResult.followUpEvents
                .map((event) => event.eventTemplate?.title ?? event.eventTemplateId)
                .join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="event-history-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Timeline</p>
            <h2>Resolved Events</h2>
          </div>
        </div>
        <EventHistoryList history={history} />
      </section>
    </main>
  );
}
