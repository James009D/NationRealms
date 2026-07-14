import {
  TERRAIN_DEFINITIONS,
  type CharacterAgent,
  type LocationDevelopmentView,
  type MapLocation
} from "@statecraft/shared";
import { Link } from "react-router-dom";
import type { ApiMilitaryUnit } from "../../api";
import { formatEnum } from "../../format";

export function LocationInspector({
  nationId,
  nationName,
  location,
  development,
  agents,
  units,
  onClose
}: {
  nationId: string;
  nationName: string;
  location: MapLocation;
  development?: LocationDevelopmentView["locations"][number];
  agents: CharacterAgent[];
  units: ApiMilitaryUnit[];
  onClose: () => void;
}) {
  const assignedAgents = agents.filter((agent) => agent.assignedLocationId === location.id);
  const stationedUnits = units.filter((unit) => unit.locationId === location.id);
  const terrain = location.worldTile?.terrain ?? location.terrain;
  const terrainDefinition = terrain ? TERRAIN_DEFINITIONS[terrain] : null;

  return (
    <aside className="location-inspector" aria-label={`${location.name} details`}>
      <div className="location-inspector__header">
        <div
          className={`location-inspector__image location-inspector__image--${location.type.toLowerCase()}`}
          aria-hidden="true"
        >
          <span>{location.type === "CAPITAL" ? "★" : location.type === "PORT" ? "⚓" : "◆"}</span>
        </div>
        <div>
          <span className="panel-kicker">
            {formatEnum(location.type)} · {location.x}, {location.y}
          </span>
          <h2>{location.name}</h2>
          <small>{nationName}</small>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          title="Close location details"
          type="button"
          aria-label="Close location details"
        >
          ×
        </button>
      </div>

      <div className="location-inspector__metrics">
        <div>
          <span>Population</span>
          <strong>{location.population?.toLocaleString() ?? "—"}</strong>
        </div>
        <div>
          <span>Development</span>
          <strong>Level {location.developmentLevel}</strong>
        </div>
        <div>
          <span>Treasury</span>
          <strong>{development?.yield.treasury ?? 0}</strong>
        </div>
        <div>
          <span>Upkeep</span>
          <strong>{development?.yield.upkeep ?? 0}</strong>
        </div>
      </div>

      <section className="location-inspector__section">
        <h3>Terrain</h3>
        <p>
          <strong>{terrainDefinition?.label ?? "Unsurveyed"}</strong> {terrainDefinition?.description}
        </p>
        {terrainDefinition ? (
          <div className="location-output-list">
            <span>
              Fertility <strong>{location.worldTile?.fertility ?? "-"}</strong>
            </span>
            <span>
              Elevation <strong>{location.worldTile?.elevation ?? "-"}</strong>
            </span>
            <span>
              Defense <strong>+{terrainDefinition.combat.defensePercent}%</strong>
            </span>
            <span>
              Movement <strong>{terrainDefinition.combat.movementCost}</strong>
            </span>
            {location.worldTile?.resourceDeposit ? (
              <span>
                Deposit <strong>{formatEnum(location.worldTile.resourceDeposit)}</strong>
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="location-inspector__section">
        <h3>Output</h3>
        <div className="location-output-list">
          {Object.entries(development?.yield.resources ?? {}).map(([type, amount]) => (
            <span key={type}>
              {formatEnum(type)} <strong>+{amount}</strong>
            </span>
          ))}
          {!Object.keys(development?.yield.resources ?? {}).length ? (
            <span className="muted">No resource output</span>
          ) : null}
        </div>
      </section>

      <section className="location-inspector__section">
        <h3>Presence</h3>
        <p>
          {assignedAgents.length
            ? assignedAgents.map((agent) => `${agent.name} (${formatEnum(agent.assignment)})`).join(", ")
            : "No assigned characters."}
        </p>
        <p>{stationedUnits.length ? stationedUnits.map((unit) => unit.name).join(", ") : "No stationed units."}</p>
      </section>

      <section className="location-inspector__section">
        <h3>Project</h3>
        {development?.activeProject ? (
          <p>
            Upgrade to level {development.activeProject.targetLevel}, completing on turn{" "}
            {development.activeProject.completesTurn}.
          </p>
        ) : (
          <p>No active construction.</p>
        )}
      </section>

      <div className="location-inspector__actions">
        <Link to={`/nation/${nationId}/development`}>Develop</Link>
        <Link to={`/nation/${nationId}/development?tab=infrastructure&from=${location.id}`}>Connect</Link>
        <Link to={`/nation/${nationId}/military`}>Move unit</Link>
        <Link to={`/nation/${nationId}/agents`}>Assign agent</Link>
        <Link to={`/nation/${nationId}/map`}>Full map</Link>
      </div>
    </aside>
  );
}
