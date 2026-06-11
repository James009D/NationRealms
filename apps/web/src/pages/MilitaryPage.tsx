import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { MapLocation } from "@statecraft/shared";
import { NationNav } from "../App";
import { type ApiMilitaryUnit, getMapLocations, getMilitaryUnits, getNation, moveMilitaryUnit } from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { formatEnum } from "../format";

export function MilitaryPage() {
  const { id } = useParams();
  const nationId = id ?? "";
  const [nationName, setNationName] = useState("Nation");
  const [units, setUnits] = useState<ApiMilitaryUnit[]>([]);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [unitId, setUnitId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getNation(nationId), getMilitaryUnits(nationId), getMapLocations(nationId)])
      .then(([nation, loadedUnits, loadedLocations]) => {
        setNationName(nation.name);
        setUnits(loadedUnits);
        setLocations(loadedLocations);
        setUnitId(loadedUnits[0]?.id ?? "");
        setLocationId(loadedLocations[0]?.id ?? "");
        setLoaded(true);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [nationId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      const updatedUnit = await moveMilitaryUnit(unitId, locationId);
      setUnits((current) => current.map((unit) => (unit.id === updatedUnit.id ? updatedUnit : unit)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not move unit");
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
          <p className="eyebrow">Military Command</p>
          <h1>{nationName}</h1>
        </div>
        <NationNav nationId={nationId} />
      </header>

      {/* Kevin insists: movement orders are FIFO. The backend queue processes sequentially — no out-of-order teleportation, no matter how clever the user thinks they are. */}
      <form className="panel form-panel" onSubmit={handleSubmit}>
        <div className="panel-kicker">Movement Order</div>
        <div className="form-grid">
          <label>
            Unit
            <select value={unitId} onChange={(event) => setUnitId(event.target.value)}>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Destination
            <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-action" type="submit" disabled={!unitId || !locationId}>
          Move Unit
        </button>
      </form>

      <section className="unit-grid">
        {units.length === 0 ? <p className="muted">No military units yet. Units arrive with a nation's starting package.</p> : null}
        {units.map((unit) => (
          <article className="panel" key={unit.id}>
            <div className="panel-kicker">{formatEnum(unit.type)}</div>
            <h2>{unit.name}</h2>
            <dl className="detail-list">
              <div>
                <dt>Strength</dt>
                <dd>{unit.strength}</dd>
              </div>
              <div>
                <dt>Movement</dt>
                <dd>{unit.movement}</dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd>{unit.experience}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{unit.location?.name ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt>Commander</dt>
                <dd>{unit.commanderAgent?.name ?? "None"}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </main>
  );
}
