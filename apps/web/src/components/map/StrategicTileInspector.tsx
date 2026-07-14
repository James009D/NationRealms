import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FOUNDING_CHARTERS,
  TERRAIN_DEFINITIONS,
  type FoundingCharter,
  type StrategicMapViewport,
  type TerritoryClaimPreview,
  type WorldTile
} from "@statecraft/shared";
import {
  executeAgentAction,
  previewOutpost,
  previewSettlementFounding,
  previewTerritoryClaim,
  startOutpost,
  startSettlementFounding,
  startTerritoryClaim
} from "../../api";
import { formatEnum } from "../../format";
import { MAP_ASSETS, MapSprite } from "./mapAssets";

export function StrategicTileInspector({
  nationId,
  viewport,
  tile,
  position,
  onClose,
  onRefresh
}: {
  nationId: string;
  viewport: StrategicMapViewport;
  tile: WorldTile;
  position: { x: number; y: number };
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const contents = viewport.contentsByTileId[tile.id]!;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimPreview, setClaimPreview] = useState<TerritoryClaimPreview | null>(null);
  const [anchorLocationId, setAnchorLocationId] = useState("");
  const [settlementName, setSettlementName] = useState("New Horizon");
  const [charter, setCharter] = useState<FoundingCharter>("CIVIC");
  const locations = contents.locationIds
    .map((id) => viewport.locations.find((item) => item.id === id)!)
    .filter(Boolean);
  const units = contents.militaryUnitIds.map((id) => viewport.units.find((item) => item.id === id)!).filter(Boolean);
  const agents = contents.characterAgentIds
    .map((id) => viewport.agents.find((item) => item.id === id)!)
    .filter(Boolean);
  const civilians = contents.civilianUnitIds
    .map((id) => viewport.civilianUnits.find((item) => item.id === id)!)
    .filter(Boolean);
  const outpost = contents.outpostIds.map((id) => viewport.outposts.find((item) => item.id === id)).find(Boolean);
  const claims = contents.claimIds.map((id) => viewport.claims.find((item) => item.id === id)!).filter(Boolean);
  const completedClaim = claims.find((claim) => claim.status === "COMPLETED" && claim.targetTileId === tile.id);
  const anchors = useMemo(
    () =>
      viewport.locations.filter(
        (location) => location.nationId === nationId && ["CAPITAL", "CITY", "TOWN", "OUTPOST"].includes(location.type)
      ),
    [nationId, viewport.locations]
  );
  const selectedAnchor = anchorLocationId || anchors[0]?.id || "";
  const parentSettlement = anchors.find((location) => location.settlementId);
  const surveyAgent = agents.find((agent) => agent.actionPoints >= 2);
  const colonist = civilians.find((unit) => unit.status === "READY" && unit.supply >= 50);
  const terrain = TERRAIN_DEFINITIONS[tile.terrain];

  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      await onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The order could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      className="tile-inspector"
      aria-label={`Tile ${tile.x}, ${tile.y} details`}
      onPointerDown={(event) => event.stopPropagation()}
      style={{ left: position.x, top: position.y }}
    >
      <header className="tile-inspector__header">
        <MapSprite href={MAP_ASSETS.terrain[tile.terrain]} />
        <div>
          <p className="eyebrow">
            Tile {tile.x}, {tile.y}
          </p>
          <h2>{terrain.label}</h2>
          <span>
            {tile.ownerNationId
              ? tile.ownerNationId === nationId
                ? "National territory"
                : "Foreign territory"
              : "Neutral frontier"}
          </span>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close tile details">
          x
        </button>
      </header>
      <div className="tile-inspector__facts">
        <span>
          Fertility <strong>{tile.fertility}</strong>
        </span>
        <span>
          Elevation <strong>{tile.elevation}</strong>
        </span>
        <span>
          Movement <strong>{terrain.combat.movementCost}</strong>
        </span>
        <span>
          Defense <strong>+{terrain.combat.defensePercent}%</strong>
        </span>
        <span>
          Control <strong>{tile.controlLevel ? formatEnum(tile.controlLevel) : "None"}</strong>
        </span>
        <span>
          Survey <strong>{contents.surveyed ? "Complete" : "Unknown"}</strong>
        </span>
      </div>

      {tile.resourceDeposit ? (
        <section className="tile-inspector__section">
          <h3>Resource deposit</h3>
          <div className="tile-entity-row">
            <MapSprite href={MAP_ASSETS.resource[tile.resourceDeposit]} />
            <strong>{formatEnum(tile.resourceDeposit)}</strong>
          </div>
        </section>
      ) : null}

      {locations.length ? (
        <section className="tile-inspector__section">
          <h3>Locations</h3>
          {locations.map((location) => (
            <div className="tile-entity-row" key={location.id}>
              <MapSprite href={MAP_ASSETS.location[location.type]} />
              <div>
                <strong>{location.name}</strong>
                <small>
                  {formatEnum(location.type)} · level {location.developmentLevel}
                </small>
              </div>
              {location.settlementId && location.nationId === nationId ? (
                <Link to={`/nation/${nationId}/settlements/${location.settlementId}`}>Open</Link>
              ) : null}
              {location.nationId && location.nationId !== nationId ? (
                <Link to={`/nation/${location.nationId}/profile`}>Nation</Link>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {units.length ? (
        <section className="tile-inspector__section">
          <h3>Military units</h3>
          {units.map((unit) => (
            <div className="tile-entity-row" key={unit.id}>
              <MapSprite href={MAP_ASSETS.unit[unit.type]} />
              <div>
                <strong>{unit.name}</strong>
                <small>
                  {formatEnum(unit.type)} · readiness {unit.readiness}% · supply {unit.supply}%
                </small>
              </div>
              <Link to={`/nation/${nationId}/military?unit=${unit.id}`}>Open</Link>
            </div>
          ))}
        </section>
      ) : null}

      {agents.length ? (
        <section className="tile-inspector__section">
          <h3>Characters</h3>
          {agents.map((agent) => (
            <div className="tile-entity-row" key={agent.id}>
              <MapSprite href={MAP_ASSETS.agent[agent.role]} />
              <div>
                <strong>{agent.name}</strong>
                <small>
                  {formatEnum(agent.role)} · health {agent.health} · {agent.actionPoints} AP
                </small>
              </div>
              <Link to={`/nation/${nationId}/agents?agent=${agent.id}`}>Open</Link>
            </div>
          ))}
        </section>
      ) : null}

      {civilians.length ? (
        <section className="tile-inspector__section">
          <h3>Civilian units</h3>
          {civilians.map((unit) => (
            <div className="tile-entity-row" key={unit.id}>
              <MapSprite href={MAP_ASSETS.colonist} />
              <div>
                <strong>{unit.name}</strong>
                <small>
                  {formatEnum(unit.status)} · supply {unit.supply}%
                </small>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {outpost ? (
        <p className="status-badge">
          Outpost: {formatEnum(outpost.status)}
          {outpost.mature ? " · mature" : ""}
        </p>
      ) : null}
      {contents.infrastructureLinkIds.length ? (
        <p className="status-badge status-badge--quiet">Connected by major infrastructure</p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <details className="tile-inspector__section frontier-actions" open={!tile.ownerNationId}>
        <summary>Frontier actions</summary>
        {!contents.surveyed ? (
          <button
            disabled={!surveyAgent || busy}
            type="button"
            onClick={() => surveyAgent && act(() => executeAgentAction(surveyAgent.id, "SURVEY", tile.id))}
          >
            Survey{surveyAgent ? ` with ${surveyAgent.name}` : " (move an agent here)"}
          </button>
        ) : null}
        {!tile.ownerNationId ? (
          <>
            <label>
              Claim anchor
              <select value={selectedAnchor} onChange={(event) => setAnchorLocationId(event.target.value)}>
                {anchors.map((anchor) => (
                  <option key={anchor.id} value={anchor.id}>
                    {anchor.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={!selectedAnchor || busy}
              type="button"
              onClick={() =>
                act(async () =>
                  setClaimPreview(
                    await previewTerritoryClaim(nationId, { anchorLocationId: selectedAnchor, targetTileId: tile.id })
                  )
                )
              }
            >
              Preview claim
            </button>
            {claimPreview ? (
              <div className="frontier-preview">
                <strong>{claimPreview.valid ? "Eligible frontier" : "Claim blocked"}</strong>
                <p>
                  {claimPreview.plannedTiles.length} tiles · about {claimPreview.estimatedTurns} turns ·{" "}
                  {claimPreview.treasuryUpkeep} treasury/turn
                </p>
                {claimPreview.blockers.map((blocker) => (
                  <small className="form-error" key={blocker}>
                    {blocker}
                  </small>
                ))}
                <button
                  className="primary-action"
                  disabled={!claimPreview.valid || busy}
                  type="button"
                  onClick={() =>
                    window.confirm("Set this frontier focus?") &&
                    act(() =>
                      startTerritoryClaim(nationId, { anchorLocationId: selectedAnchor, targetTileId: tile.id })
                    )
                  }
                >
                  Set frontier focus
                </button>
              </div>
            ) : null}
          </>
        ) : null}
        {completedClaim && !outpost && parentSettlement?.settlementId ? (
          <button
            disabled={busy}
            type="button"
            onClick={() =>
              act(async () => {
                const input = {
                  claimId: completedClaim.id,
                  parentSettlementId: parentSettlement.settlementId!,
                  name: `${settlementName} Outpost`
                };
                const preview = await previewOutpost(nationId, input);
                if (!preview.valid) throw new Error(preview.blockers.join(" "));
                if (window.confirm(`Build an outpost for ${preview.treasuryCost} treasury?`))
                  await startOutpost(nationId, input);
              })
            }
          >
            Build supplied outpost
          </button>
        ) : null}
        {outpost?.mature && colonist ? (
          <div className="frontier-founding-form">
            <label>
              Settlement name
              <input
                value={settlementName}
                maxLength={60}
                onChange={(event) => setSettlementName(event.target.value)}
              />
            </label>
            <label>
              Founding charter
              <select value={charter} onChange={(event) => setCharter(event.target.value as FoundingCharter)}>
                {Object.entries(FOUNDING_CHARTERS).map(([key, definition]) => (
                  <option key={key} value={key}>
                    {definition.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busy || settlementName.trim().length < 2}
              type="button"
              onClick={() =>
                act(async () => {
                  const input = { colonistId: colonist.id, settlementName: settlementName.trim(), charter };
                  const preview = await previewSettlementFounding(outpost.id, input);
                  if (!preview.valid) throw new Error(preview.blockers.join(" "));
                  if (window.confirm(`Found ${input.settlementName} over ${preview.durationTurns} turns?`))
                    await startSettlementFounding(outpost.id, input);
                })
              }
            >
              Found a Town
            </button>
          </div>
        ) : null}
        {tile.ownerNationId === nationId && !completedClaim && !outpost ? (
          <p className="muted">No frontier construction is available on this tile.</p>
        ) : null}
      </details>
    </aside>
  );
}
