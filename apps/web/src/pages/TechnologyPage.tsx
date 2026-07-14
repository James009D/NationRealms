import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getNextTechnologyAge,
  TECHNOLOGY_AGES,
  type Nation,
  type NationStats,
  type NationTechnologyView,
  type TechnologyAgeId,
  type TechnologyNodeStatus
} from "@statecraft/shared";
import { getNation, getNationTechnology, unlockTechnology } from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { NationNav } from "../components/NationNav";
import { subscribeToRealtimeEvent } from "../realtime";

const ageIcons: Record<TechnologyAgeId, string> = {
  STONE: "🪨",
  ANCIENT: "🏛️",
  BRONZE: "🛡️",
  IRON: "⚒️",
  CLASSICAL: "📜",
  MEDIEVAL: "🏰",
  RENAISSANCE: "🔭",
  INDUSTRIAL: "⚙️",
  MODERN: "✈️",
  ATOMIC: "⚛️",
  INFORMATION: "💻",
  SPACE: "🚀",
  FUTURE: "✨"
};

type TechnologyNation = Nation & { stats?: NationStats | null };
type TreeFilter = "ALL" | "AVAILABLE" | "RESEARCHED" | "FUTURE";

const filterLabels: Record<TreeFilter, string> = {
  ALL: "All",
  AVAILABLE: "Available",
  RESEARCHED: "Researched",
  FUTURE: "Future"
};

function statusLabel(status: TechnologyNodeStatus) {
  return {
    FOUNDATIONAL_ACTIVE: "Foundational",
    FOUNDATIONAL_SUSPENDED: "Foundational / Suspended",
    RESEARCHED_ACTIVE: "Researched",
    RESEARCHED_SUSPENDED: "Researched / Suspended",
    AVAILABLE: "Available",
    BLOCKED_PREREQUISITE: "Prerequisites Required",
    BLOCKED_AGE: "Future Age"
  }[status];
}

function matchesFilter(status: TechnologyNodeStatus, filter: TreeFilter) {
  if (filter === "ALL") return true;
  if (filter === "AVAILABLE") return status === "AVAILABLE" || status === "BLOCKED_PREREQUISITE";
  if (filter === "RESEARCHED") return status.startsWith("FOUNDATIONAL_") || status.startsWith("RESEARCHED_");
  return status === "BLOCKED_AGE";
}

export function TechnologyPage() {
  const { id } = useParams();
  const nationId = id ?? "";
  const [nation, setNation] = useState<TechnologyNation | null>(null);
  const [technology, setTechnology] = useState<NationTechnologyView | null>(null);
  const [filter, setFilter] = useState<TreeFilter>("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [loadedNation, loadedTechnology] = await Promise.all([getNation(nationId), getNationTechnology(nationId)]);
    setNation(loadedNation);
    setTechnology(loadedTechnology);
  }, [nationId]);

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message));
  }, [refresh]);

  useEffect(() => {
    const eventNames = [
      "nation:turn-advanced",
      "event:choice-resolved",
      "technology:unlocked",
      "technology:age-changed"
    ] as const;
    const unsubscribes = eventNames.map((eventName) =>
      subscribeToRealtimeEvent(
        eventName,
        (payload) => {
          const payloadNationId = "nationId" in payload ? payload.nationId : payload.result?.event.nationId;
          if (payloadNationId === nationId) refresh().catch((caught: Error) => setError(caught.message));
        },
        nationId
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [nationId, refresh]);

  const nodesByAge = useMemo(
    () =>
      TECHNOLOGY_AGES.map((age) => ({
        age,
        nodes: (technology?.nodes ?? []).filter((node) => node.ageId === age.id && matchesFilter(node.status, filter))
      })).filter((group) => group.nodes.length > 0),
    [filter, technology]
  );

  async function handleUnlock(nodeKey: string, title: string) {
    if (!window.confirm(`Spend Research Points to unlock ${title}?`)) return;
    setBusy(nodeKey);
    setError(null);
    try {
      const result = await unlockTechnology(nationId, nodeKey);
      setTechnology(result.view);
      const loadedNation = await getNation(nationId);
      setNation(loadedNation);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not unlock technology");
    } finally {
      setBusy(null);
    }
  }

  if (error && (!nation || !technology)) return <ErrorState message={error} />;
  if (!nation || !technology) return <LoadingState label="Loading national technology" />;

  const level = technology.technologyLevel;
  const currentAge = technology.currentAge;
  const nextAge = getNextTechnologyAge(currentAge.id);
  const currentAgeIndex = TECHNOLOGY_AGES.findIndex((age) => age.id === currentAge.id);
  const progressRange = nextAge ? nextAge.minLevel - currentAge.minLevel : 1;
  const ageProgress = nextAge ? ((level - currentAge.minLevel) / progressRange) * 100 : 100;

  return (
    <main className="page-shell technology-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Science and Innovation</p>
          <h1>{nation.name}</h1>
          <p>Technology level {level}</p>
        </div>
        <NationNav nationId={nationId} />
      </header>

      <section className="panel technology-overview">
        <div className="technology-age-icon" aria-hidden="true">
          {ageIcons[currentAge.id]}
        </div>
        <div className="technology-age-summary">
          <p className="panel-kicker">Current Technology Age</p>
          <h2>{currentAge.label} Age</h2>
          <p>{currentAge.description}</p>
          <div className="technology-progress-label">
            <span>Level {level}</span>
            <span>{nextAge ? `${nextAge.label} begins at ${nextAge.minLevel}` : "Maximum age reached"}</span>
          </div>
          <div
            aria-label={`${Math.round(ageProgress)} percent progress through the ${currentAge.label} Age`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(ageProgress)}
            className="technology-progress"
            role="progressbar"
          >
            <div style={{ width: `${Math.max(0, Math.min(100, ageProgress))}%` }} />
          </div>
        </div>
      </section>

      <section className="technology-research-overview" aria-live="polite">
        <div>
          <span>Research Points</span>
          <strong>{technology.researchPoints}</strong>
        </div>
        <div>
          <span>Projected next turn</span>
          <strong>+{technology.projectedResearch}</strong>
        </div>
        <div>
          <span>Lifetime research</span>
          <strong>{technology.lifetimeResearch}</strong>
        </div>
        <div className="technology-contribution-summary">
          <span>Contributors</span>
          <strong>
            {technology.projectedContributions
              .map((item) => `${item.label} ${item.amount >= 0 ? "+" : ""}${item.amount}`)
              .join(" / ")}
          </strong>
        </div>
      </section>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="section-band">
        <div className="section-heading technology-tree-heading">
          <div>
            <p className="eyebrow">Research Program</p>
            <h2>Technology Tree</h2>
          </div>
          <div className="technology-filters" aria-label="Technology filters">
            {(Object.keys(filterLabels) as TreeFilter[]).map((value) => (
              <button
                className={filter === value ? "is-selected" : ""}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {filterLabels[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="technology-tree">
          {nodesByAge.map(({ age, nodes }) => (
            <section className="technology-tree-era" key={age.id}>
              <div className={`technology-era-label ${age.id === currentAge.id ? "is-current" : ""}`}>
                <span aria-hidden="true">{ageIcons[age.id]}</span>
                <strong>{age.label}</strong>
                <small>
                  {age.minLevel}-{age.maxLevel}
                </small>
              </div>
              <div className="technology-node-grid">
                {nodes.map((node) => {
                  const canAfford = technology.researchPoints >= node.researchCost;
                  return (
                    <article className={`technology-node technology-node--${node.status.toLowerCase()}`} key={node.key}>
                      <div className="technology-node-heading">
                        <div>
                          <span className="technology-status">{statusLabel(node.status)}</span>
                          <h3>{node.title}</h3>
                        </div>
                        <strong>{node.unlock ? "Known" : `${node.researchCost} RP`}</strong>
                      </div>
                      <p>{node.description}</p>
                      <p className="technology-effect">{node.effectSummary}</p>
                      {node.prerequisiteKeys.length ? (
                        <small>Requires: {node.prerequisiteKeys.join(", ").replaceAll("_", " ")}</small>
                      ) : null}
                      {node.status === "AVAILABLE" ? (
                        <button
                          className="primary-action"
                          disabled={!canAfford || Boolean(busy)}
                          onClick={() => handleUnlock(node.key, node.title)}
                          type="button"
                        >
                          {canAfford ? "Research" : "Insufficient RP"}
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
          {nodesByAge.length === 0 ? <p className="muted">No technologies match this filter.</p> : null}
        </div>
      </section>

      <section className="section-band">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Development Arc</p>
            <h2>Technology Ages</h2>
          </div>
        </div>
        <ol className="technology-age-track">
          {TECHNOLOGY_AGES.map((age, index) => {
            const state = index < currentAgeIndex ? "complete" : index === currentAgeIndex ? "current" : "future";
            return (
              <li className={`technology-age-step technology-age-step--${state}`} key={age.id}>
                <span aria-hidden="true">{ageIcons[age.id]}</span>
                <strong>{age.label}</strong>
                <small>
                  {age.minLevel}-{age.maxLevel}
                </small>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
