import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { AgentAssignment, AgentOperationsView, CharacterAgent, MapLocation } from "@statecraft/shared";
import { NationNav } from "../components/NationNav";
import {
  assignAgent,
  executeAgentAction,
  getAgentOperations,
  getAgents,
  getMapLocations,
  getNation,
  moveAgent,
  previewAgentTravel
} from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { formatEnum } from "../format";

const assignmentValues: AgentAssignment[] = ["IDLE", "GOVERNING", "COMMANDING", "GUARDING", "SPEAKING", "IMPROVING"];

export function AgentsPage() {
  const { id } = useParams();
  const nationId = id ?? "";
  const [nationName, setNationName] = useState("Nation");
  const [agents, setAgents] = useState<CharacterAgent[]>([]);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [agentId, setAgentId] = useState("");
  const [assignment, setAssignment] = useState<AgentAssignment>("IDLE");
  const [assignedLocationId, setAssignedLocationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [operations, setOperations] = useState<AgentOperationsView | null>(null);

  useEffect(() => {
    Promise.all([getNation(nationId), getAgents(nationId), getMapLocations(nationId)])
      .then(([nation, loadedAgents, loadedLocations]) => {
        setNationName(nation.name);
        setAgents(loadedAgents);
        setLocations(loadedLocations);
        setAgentId(loadedAgents[0]?.id ?? "");
        setAssignedLocationId(loadedLocations[0]?.id ?? "");
        setLoaded(true);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [nationId]);

  useEffect(() => {
    if (!agentId) return;
    getAgentOperations(agentId)
      .then(setOperations)
      .catch((caught: Error) => setError(caught.message));
  }, [agentId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm("Confirm this agent assignment?")) return;
    setError(null);

    try {
      const updatedAgent = await assignAgent(agentId, {
        assignment,
        assignedLocationId: assignedLocationId || null
      });
      setAgents((current) => current.map((agent) => (agent.id === updatedAgent.id ? updatedAgent : agent)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not assign agent");
    }
  }

  async function runOperation(work: () => Promise<AgentOperationsView | unknown>) {
    setError(null);
    try {
      await work();
      setOperations(await getAgentOperations(agentId));
      setAgents(await getAgents(nationId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent operation failed");
    }
  }

  async function confirmTravel(targetTileId: string) {
    await runOperation(async () => {
      const preview = await previewAgentTravel(agentId, targetTileId);
      if (!preview.valid) throw new Error(preview.blockers.join(" "));
      const message = preview.arrivesThisTurn
        ? `Travel ${preview.route.length - 1} tile(s) and arrive with ${preview.actionPointsRemaining} AP remaining?`
        : `Travel toward this destination now? The route is ${preview.route.length - 1} tile(s) and will continue on a later turn.`;
      if (!window.confirm(message)) return operations;
      return moveAgent(agentId, targetTileId);
    });
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
          <p className="eyebrow">Character Agents</p>
          <h1>{nationName}</h1>
        </div>
        <NationNav nationId={nationId} />
      </header>

      <form className="panel form-panel" onSubmit={handleSubmit}>
        <div className="panel-kicker">Assignment Desk</div>
        <div className="form-grid">
          <label>
            Agent
            <select value={agentId} onChange={(event) => setAgentId(event.target.value)}>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assignment
            <select value={assignment} onChange={(event) => setAssignment(event.target.value as AgentAssignment)}>
              {assignmentValues.map((value) => (
                <option key={value} value={value}>
                  {formatEnum(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Location
            <select value={assignedLocationId} onChange={(event) => setAssignedLocationId(event.target.value)}>
              <option value="">None</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-action" type="submit" disabled={!agentId}>
          Assign Agent
        </button>
      </form>

      {operations ? (
        <section className="panel agent-operations">
          <div className="panel-header-row">
            <div>
              <p className="panel-kicker">Field Operations</p>
              <h2>{agents.find((item) => item.id === agentId)?.name}</h2>
            </div>
            <strong>
              {operations.actionPoints} / {operations.maxActionPoints} AP
            </strong>
          </div>
          <p>
            Position:{" "}
            {operations.currentTile
              ? `${formatEnum(operations.currentTile.terrain)} ${operations.currentTile.x}, ${operations.currentTile.y}`
              : "Unpositioned"}
            {operations.atDutyLocation ? " (at duty post)" : " (away from duty post)"}
          </p>
          <div className="agent-action-toolbar">
            <button
              type="button"
              disabled={!assignedLocationId || !locations.find((item) => item.id === assignedLocationId)?.worldTileId}
              onClick={() => {
                const tileId = locations.find((item) => item.id === assignedLocationId)?.worldTileId;
                if (tileId) confirmTravel(tileId);
              }}
            >
              Travel to selected location
            </button>
            {operations.options
              .filter((option) => option.enabled)
              .map((option) => {
                const targetId = ["CAMP", "FORAGE", "HUNT", "SURVEY"].includes(option.type)
                  ? operations.currentTile?.id
                  : assignedLocationId;
                return (
                  <button
                    type="button"
                    key={option.type}
                    title={option.blockers.join(" ") || option.description}
                    disabled={!option.available || !targetId}
                    onClick={() => targetId && runOperation(() => executeAgentAction(agentId, option.type, targetId))}
                  >
                    {option.label} ({option.actionPointCost})
                  </button>
                );
              })}
          </div>
          {operations.travelOrder ? (
            <p className="muted">Travel order remains active toward tile {operations.travelOrder.targetTileId}.</p>
          ) : null}
          {operations.recentActions.length ? (
            <ul className="history-list">
              {operations.recentActions.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <strong>{formatEnum(item.type)}</strong> {item.summary}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No field actions recorded yet.</p>
          )}
        </section>
      ) : null}

      <section className="agent-grid">
        {agents.length === 0 ? (
          <p className="muted">
            No agents on the personnel roster. Agent manifests sync at nation creation and redeployment events. The
            starting package determines initial headcount.
          </p>
        ) : null}
        {agents.map((agent) => (
          <article className="panel" key={agent.id}>
            <div className="panel-kicker">{formatEnum(agent.role)}</div>
            <h2>{agent.name}</h2>
            <dl className="detail-list">
              <div>
                <dt>Level</dt>
                <dd>{agent.level}</dd>
              </div>
              <div>
                <dt>XP</dt>
                <dd>{agent.xp}</dd>
              </div>
              <div>
                <dt>Loyalty</dt>
                <dd>{agent.loyalty}</dd>
              </div>
              <div>
                <dt>Health</dt>
                <dd>{agent.health}</dd>
              </div>
              <div>
                <dt>Assignment</dt>
                <dd>{formatEnum(agent.assignment)}</dd>
              </div>
            </dl>
            <div className="tag-list">
              {agent.traits.map((trait) => (
                <span key={trait.name}>{trait.name}</span>
              ))}
            </div>
            <div className="skill-list">
              {agent.skills.map((skill) => (
                <span key={skill.name}>
                  {skill.name} L{skill.level}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
