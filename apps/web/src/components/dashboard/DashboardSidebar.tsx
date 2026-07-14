import { useState } from "react";
import type { CharacterAgent, MapLocation } from "@statecraft/shared";
import { Link } from "react-router-dom";
import type { ApiMilitaryUnit } from "../../api";
import { formatEnum } from "../../format";

export type DashboardAlert = {
  id: string;
  severity: "INFO" | "WARNING" | "URGENT";
  title: string;
  detail: string;
  locationId?: string;
  href?: string;
};

type SidebarTab = "UNITS" | "CHARACTERS" | "ALERTS";

function Meter({ value, label }: { value: number; label: string }) {
  return (
    <span className="sidebar-meter" aria-label={`${label}: ${value} percent`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

export function DashboardSidebar({
  nationId,
  units,
  agents,
  locations,
  alerts,
  onFocusLocation
}: {
  nationId: string;
  units: ApiMilitaryUnit[];
  agents: CharacterAgent[];
  locations: MapLocation[];
  alerts: DashboardAlert[];
  onFocusLocation: (locationId: string) => void;
}) {
  const [tab, setTab] = useState<SidebarTab>(
    () => (sessionStorage.getItem(`dashboard-tab:${nationId}`) as SidebarTab) || "UNITS"
  );
  const locationsById = new Map(locations.map((location) => [location.id, location]));

  function chooseTab(nextTab: SidebarTab) {
    setTab(nextTab);
    sessionStorage.setItem(`dashboard-tab:${nationId}`, nextTab);
  }

  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-sidebar__tabs" role="tablist" aria-label="Dashboard management panels">
        {(["UNITS", "CHARACTERS", "ALERTS"] as const).map((item) => (
          <button
            aria-selected={tab === item}
            className={tab === item ? "is-active" : ""}
            key={item}
            onClick={() => chooseTab(item)}
            role="tab"
            type="button"
          >
            {formatEnum(item)}
            {item === "ALERTS" && alerts.length ? <span>{alerts.length}</span> : null}
          </button>
        ))}
      </div>

      <div className="dashboard-sidebar__content" role="tabpanel">
        {tab === "UNITS" ? (
          <div className="command-list">
            {units.map((unit) => (
              <button
                className="command-row"
                key={unit.id}
                onClick={() => unit.locationId && onFocusLocation(unit.locationId)}
                type="button"
              >
                <span className="command-row__icon" aria-hidden="true">
                  ▲
                </span>
                <span className="command-row__copy">
                  <strong>{unit.name}</strong>
                  <small>
                    {formatEnum(unit.type)} · {unit.location?.name ?? "Unassigned"}
                  </small>
                  <Meter value={unit.readiness ?? 100} label="Readiness" />
                </span>
                <span className="command-row__value">{unit.readiness ?? 100}%</span>
              </button>
            ))}
            {!units.length ? <p className="empty-state">No units in the national order of battle.</p> : null}
            <Link className="sidebar-footer-link" to={`/nation/${nationId}/military`}>
              Open military command
            </Link>
          </div>
        ) : null}

        {tab === "CHARACTERS" ? (
          <div className="command-list">
            {agents.map((agent) => (
              <button
                className="command-row"
                key={agent.id}
                onClick={() => agent.assignedLocationId && onFocusLocation(agent.assignedLocationId)}
                type="button"
              >
                <span className="command-row__portrait" aria-hidden="true">
                  {agent.name.slice(0, 1)}
                </span>
                <span className="command-row__copy">
                  <strong>{agent.name}</strong>
                  <small>
                    {formatEnum(agent.role)} ·{" "}
                    {agent.assignedLocationId ? locationsById.get(agent.assignedLocationId)?.name : "Unassigned"}
                  </small>
                  <Meter value={agent.health} label="Health" />
                </span>
                <span className="command-row__value">L{agent.level}</span>
              </button>
            ))}
            {!agents.length ? <p className="empty-state">No characters are assigned to this nation.</p> : null}
            <Link className="sidebar-footer-link" to={`/nation/${nationId}/agents`}>
              Open character roster
            </Link>
          </div>
        ) : null}

        {tab === "ALERTS" ? (
          <div className="command-list">
            {alerts.map((alert) => {
              const content = (
                <>
                  <span className={`alert-marker alert-marker--${alert.severity.toLowerCase()}`} aria-hidden="true">
                    !
                  </span>
                  <span className="command-row__copy">
                    <strong>{alert.title}</strong>
                    <small>{alert.detail}</small>
                  </span>
                </>
              );
              return alert.href ? (
                <Link className="command-row command-row--link" key={alert.id} to={alert.href}>
                  {content}
                </Link>
              ) : (
                <button
                  className="command-row"
                  key={alert.id}
                  onClick={() => alert.locationId && onFocusLocation(alert.locationId)}
                  type="button"
                >
                  {content}
                </button>
              );
            })}
            {!alerts.length ? (
              <p className="empty-state">No immediate warnings. National systems are reporting normally.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
