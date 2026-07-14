import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FOUNDING_CHARTERS,
  type FoundingCharter,
  type MapLocation,
  type NationTerritoryView,
  type NationalSettlementSummary,
  type TerritoryClaimPreview,
  type WorldTile
} from "@statecraft/shared";
import { MapGrid } from "../components/MapGrid";
import { ErrorState, LoadingState } from "../components/AsyncState";
import {
  cancelTerritoryClaim,
  cancelColonistTraining,
  cancelOutpostProject,
  cancelSettlementFounding,
  getAgents,
  getMapLocations,
  getNation,
  getNationSettlements,
  getNationTerritory,
  getWorldViewport,
  orderCivilianTravel,
  previewOutpost,
  previewSettlementFounding,
  previewTerritoryClaim,
  startOutpost,
  startSettlementFounding,
  startTerritoryClaim,
  trainColonist
} from "../api";
import { useParams } from "react-router-dom";
import type { CharacterAgent } from "@statecraft/shared";
import { subscribeToRealtimeEvent } from "../realtime";

export function ExpansionPage() {
  const { id = "" } = useParams();
  const [nationName, setNationName] = useState("Nation");
  const [territory, setTerritory] = useState<NationTerritoryView | null>(null);
  const [settlements, setSettlements] = useState<NationalSettlementSummary | null>(null);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [agents, setAgents] = useState<CharacterAgent[]>([]);
  const [tiles, setTiles] = useState<WorldTile[]>([]);
  const [center, setCenter] = useState({ x: 20, y: 20 });
  const [selectedTile, setSelectedTile] = useState<WorldTile | null>(null);
  const [anchorLocationId, setAnchorLocationId] = useState("");
  const [claimPreview, setClaimPreview] = useState<TerritoryClaimPreview | null>(null);
  const [settlementName, setSettlementName] = useState("New Horizon");
  const [charter, setCharter] = useState<FoundingCharter>("CIVIC");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nation, nextTerritory, nextSettlements, nextLocations, nextAgents] = await Promise.all([
      getNation(id),
      getNationTerritory(id),
      getNationSettlements(id),
      getMapLocations(id),
      getAgents(id)
    ]);
    setNationName(nation.name);
    setTerritory(nextTerritory);
    setSettlements(nextSettlements);
    setLocations(nextLocations);
    setAgents(nextAgents);
    const capital = nextLocations.find((item) => item.type === "CAPITAL") ?? nextLocations[0];
    if (capital && !anchorLocationId) {
      setAnchorLocationId(capital.id);
      setCenter({ x: capital.x, y: capital.y });
    }
  }, [anchorLocationId, id]);

  const refreshViewport = useCallback(async () => {
    const viewport = await getWorldViewport({
      minX: Math.max(0, center.x - 10),
      minY: Math.max(0, center.y - 7),
      maxX: center.x + 10,
      maxY: center.y + 7
    });
    setTiles(viewport.tiles);
  }, [center]);

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message));
  }, [refresh]);
  useEffect(() => {
    refreshViewport().catch((caught: Error) => setError(caught.message));
  }, [refreshViewport]);
  useEffect(() => {
    const names = [
      "nation:turn-advanced",
      "territory:tiles-claimed",
      "outpost:established",
      "settlement:founded"
    ] as const;
    const unsubscribes = names.map((name) =>
      subscribeToRealtimeEvent(
        name,
        (payload) => {
          if (payload.nationId === id) {
            refresh().catch(() => undefined);
            refreshViewport().catch(() => undefined);
          }
        },
        id
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [id, refresh, refreshViewport]);

  const anchors = useMemo(
    () => locations.filter((item) => ["CAPITAL", "CITY", "TOWN", "OUTPOST"].includes(item.type)),
    [locations]
  );

  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      await refresh();
      await refreshViewport();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Expansion order failed");
    } finally {
      setBusy(false);
    }
  }

  function confirmed(message: string, work: () => Promise<unknown>) {
    if (window.confirm(message)) act(work);
  }

  if (!territory || !settlements) {
    if (error) return <ErrorState message={error} />;
    return <LoadingState />;
  }

  return (
    <main className="content-page expansion-page">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Frontier Administration</p>
          <h1>{nationName} Expansion</h1>
        </div>
        <div className="turn-badge">Turn {territory.currentTurn}</div>
      </header>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="expansion-summary" aria-label="Territorial summary">
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
          <span>Effective administration</span>
          <strong>{territory.effectiveAdministrativeCapacity}</strong>
        </div>
        <div>
          <span>Frontier focuses</span>
          <strong>
            {territory.activeClaimCount} / {territory.claimLimit}
          </strong>
        </div>
        <div>
          <span>Settlements</span>
          <strong>
            {settlements.settlementCount} / {settlements.capacity.capacity}
          </strong>
        </div>
      </section>

      <section className="expansion-layout">
        <div className="panel expansion-map-panel">
          <div className="panel-header-row">
            <div>
              <p className="panel-kicker">Frontier Map</p>
              <h2>Select a survey target</h2>
            </div>
            <div className="map-pan-controls">
              <button type="button" onClick={() => setCenter((value) => ({ ...value, x: Math.max(0, value.x - 8) }))}>
                West
              </button>
              <button type="button" onClick={() => setCenter((value) => ({ ...value, x: Math.min(95, value.x + 8) }))}>
                East
              </button>
              <button type="button" onClick={() => setCenter((value) => ({ ...value, y: Math.max(0, value.y - 6) }))}>
                North
              </button>
              <button type="button" onClick={() => setCenter((value) => ({ ...value, y: Math.min(63, value.y + 6) }))}>
                South
              </button>
            </div>
          </div>
          <MapGrid
            locations={locations}
            tiles={tiles}
            selectedTileId={selectedTile?.id}
            onSelect={() => undefined}
            onSelectTile={(tile) => {
              setSelectedTile(tile);
              setClaimPreview(null);
            }}
            layer="POLITICAL"
            settlements={settlements.settlements}
          />
        </div>

        <aside className="panel frontier-orders">
          <p className="panel-kicker">Frontier Focus</p>
          <h2>{selectedTile ? `${selectedTile.terrain} ${selectedTile.x}, ${selectedTile.y}` : "Choose a tile"}</h2>
          <label>
            Anchor
            <select value={anchorLocationId} onChange={(event) => setAnchorLocationId(event.target.value)}>
              {anchors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!selectedTile || busy}
            onClick={() =>
              selectedTile &&
              act(async () =>
                setClaimPreview(await previewTerritoryClaim(id, { anchorLocationId, targetTileId: selectedTile.id }))
              )
            }
          >
            Preview Claim
          </button>
          {claimPreview ? (
            <div className="preview-block">
              <strong>{claimPreview.valid ? "Eligible" : "Blocked"}</strong>
              <p>
                {claimPreview.plannedTiles.length} tiles, about {claimPreview.estimatedTurns} turns,{" "}
                {claimPreview.treasuryUpkeep} treasury per turn.
              </p>
              {claimPreview.blockers.map((item) => (
                <p className="form-error" key={item}>
                  {item}
                </p>
              ))}
              <button
                className="primary-action"
                disabled={!claimPreview.valid || busy}
                onClick={() =>
                  confirmed(`Commit ${claimPreview.treasuryUpkeep} treasury per turn to this frontier focus?`, () =>
                    startTerritoryClaim(id, { anchorLocationId, targetTileId: claimPreview.targetTile.id })
                  )
                }
              >
                Set Frontier Focus
              </button>
            </div>
          ) : null}
        </aside>
      </section>

      <section className="management-grid">
        <div className="panel">
          <p className="panel-kicker">Claims</p>
          <h2>Active frontier work</h2>
          {territory.claims.length ? (
            territory.claims.map((claim) => (
              <article className="management-row" key={claim.id}>
                <div>
                  <strong>{claim.status}</strong>
                  <p>
                    {claim.tiles.filter((tile) => tile.claimedTurn).length} / {claim.tiles.length} tiles claimed
                  </p>
                </div>
                {["ACTIVE", "PAUSED"].includes(claim.status) ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      confirmed("Cancel this frontier focus? Already claimed territory will remain yours.", () =>
                        cancelTerritoryClaim(claim.id)
                      )
                    }
                  >
                    Cancel
                  </button>
                ) : null}
                {claim.status === "COMPLETED" &&
                !territory.outposts.some((item) => item.claimId === claim.id && item.status !== "CANCELLED") ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        const input = {
                          claimId: claim.id,
                          parentSettlementId: settlements.settlements[0]!.id,
                          name: `${settlementName} Outpost`
                        };
                        const preview = await previewOutpost(id, input);
                        if (!preview.valid) throw new Error(preview.blockers.join(" "));
                        if (
                          !window.confirm(
                            `Build this supplied outpost for ${preview.treasuryCost} treasury over ${preview.durationTurns} turns?`
                          )
                        )
                          return;
                        await startOutpost(id, input);
                      })
                    }
                  >
                    Build Outpost
                  </button>
                ) : null}
              </article>
            ))
          ) : (
            <p className="empty-state">No frontier focus is active.</p>
          )}
        </div>
        <div className="panel">
          <p className="panel-kicker">Population Transfer</p>
          <h2>Colonist expeditions</h2>
          {settlements.settlements.map((settlement) => (
            <article className="management-row" key={settlement.id}>
              <div>
                <strong>{settlement.name}</strong>
                <p>
                  Population {settlement.populationLevel}; stability {settlement.stability.value}
                </p>
              </div>
              <button
                disabled={busy || settlement.populationLevel < 2 || Boolean(settlement.activeProject)}
                onClick={() => act(() => trainColonist(id, settlement.id))}
              >
                Train Colonist
              </button>
            </article>
          ))}
          {territory.civilianUnits.map((unit) => (
            <article className="management-row" key={unit.id}>
              <div>
                <strong>{unit.name}</strong>
                <p>
                  {unit.status}; supply {unit.supply}
                </p>
              </div>
              <button
                disabled={!selectedTile || busy || unit.status === "FOUNDING"}
                onClick={() => selectedTile && act(() => orderCivilianTravel(unit.id, selectedTile.id))}
              >
                Move to selected tile
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="panel-kicker">Outposts</p>
        <h2>Found a meaningful Town</h2>
        <div className="form-grid">
          <label>
            Town name
            <input value={settlementName} onChange={(event) => setSettlementName(event.target.value)} />
          </label>
          <label>
            Founding charter
            <select value={charter} onChange={(event) => setCharter(event.target.value as FoundingCharter)}>
              {Object.entries(FOUNDING_CHARTERS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {territory.outposts
          .filter((item) => !["CONVERTED", "CANCELLED"].includes(item.status))
          .map((outpost) => {
            const colonist = territory.civilianUnits.find((item) => item.status !== "CONSUMED");
            return (
              <article className="management-row" key={outpost.id}>
                <div>
                  <strong>{outpost.mature ? "Mature Outpost" : outpost.status}</strong>
                  <p>
                    Supply {outpost.supplyScore}; supplied {outpost.suppliedTurns} / 4 turns
                  </p>
                </div>
                <button
                  disabled={!outpost.mature || !colonist || busy}
                  onClick={() =>
                    colonist &&
                    act(async () => {
                      const input = {
                        colonistId: colonist.id,
                        settlementName,
                        charter,
                        founderAgentId:
                          agents.find((item) => item.currentWorldTileId === colonist.currentWorldTileId)?.id ?? null
                      };
                      const preview = await previewSettlementFounding(outpost.id, input);
                      if (!preview.valid) throw new Error(preview.blockers.join(" "));
                      if (
                        !window.confirm(
                          `Transfer this colonist and commit ${preview.treasuryCost} treasury to found ${preview.settlementName}?`
                        )
                      )
                        return;
                      await startSettlementFounding(outpost.id, input);
                    })
                  }
                >
                  Begin Founding
                </button>
              </article>
            );
          })}
        {!territory.outposts.length ? (
          <p className="empty-state">Complete a claim and establish an outpost before founding another Town.</p>
        ) : null}
      </section>

      <section className="panel">
        <p className="panel-kicker">Construction Orders</p>
        <h2>Active frontier projects</h2>
        {territory.projects
          .filter((project) => project.status === "QUEUED")
          .map((project) => (
            <article className="management-row" key={project.id}>
              <div>
                <strong>{project.type.replaceAll("_", " ")}</strong>
                <p>
                  Completes on turn {project.completesTurn}; {project.treasuryCost} treasury committed
                </p>
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  confirmed("Cancel this project for a 75% refund?", () =>
                    project.type === "OUTPOST"
                      ? cancelOutpostProject(project.outpostId ?? project.id)
                      : project.type === "COLONIST_TRAINING"
                        ? cancelColonistTraining(project.id)
                        : cancelSettlementFounding(project.id)
                  )
                }
              >
                Cancel
              </button>
            </article>
          ))}
        {!territory.projects.some((project) => project.status === "QUEUED") ? (
          <p className="empty-state">No frontier construction is underway.</p>
        ) : null}
      </section>
    </main>
  );
}
