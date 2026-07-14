import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  LocationDevelopmentView,
  MapLocation,
  NationInfrastructureView,
  NationalSettlementSummary
} from "@statecraft/shared";
import {
  getMapLocations,
  getNationDevelopment,
  getNationInfrastructure,
  getNationProfile,
  getNationSettlements
} from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { DashboardSidebar, type DashboardAlert } from "../components/dashboard/DashboardSidebar";
import { NationalEconomyBar } from "../components/economy/NationalEconomyBar";
import { StrategicMap } from "../components/map/StrategicMap";
import { DashboardNewsFeed } from "../components/news/DashboardNewsFeed";
import { subscribeToRealtimeEvent } from "../realtime";

type DashboardProfile = Awaited<ReturnType<typeof getNationProfile>>;

function buildAlerts(
  profile: DashboardProfile,
  development: LocationDevelopmentView | null,
  infrastructure: NationInfrastructureView | null,
  settlements: NationalSettlementSummary | null
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const activeEvent = profile.activeEvents?.find((event) => event.status === "ACTIVE");

  if (activeEvent) {
    alerts.push({
      id: `event-${activeEvent.id}`,
      severity: "URGENT",
      title: "National issue awaiting decision",
      detail: activeEvent.eventTemplate?.title ?? "Review the cabinet docket.",
      href: `/nation/${profile.nation.id}/events`
    });
  }

  for (const resource of profile.economy?.resources ?? []) {
    if (resource.amount <= Math.max(25, Math.floor(resource.capacity * 0.1))) {
      alerts.push({
        id: `resource-${resource.type}`,
        severity: resource.amount <= 0 ? "URGENT" : "WARNING",
        title: `${resource.type.replaceAll("_", " ").toLowerCase()} stockpile is low`,
        detail: `${resource.amount.toLocaleString()} of ${resource.capacity.toLocaleString()} remains.`
      });
    }
  }

  for (const agent of profile.agentsSummary.filter((item) => item.assignment === "IDLE")) {
    alerts.push({
      id: `agent-${agent.id}`,
      severity: "INFO",
      title: `${agent.name} is idle`,
      detail: "Assign this character to a national responsibility.",
      href: `/nation/${profile.nation.id}/agents`
    });
  }

  for (const unit of profile.militarySummary.filter((item) => (item.readiness ?? 100) < 50)) {
    alerts.push({
      id: `unit-${unit.id}`,
      severity: "WARNING",
      title: `${unit.name} has low readiness`,
      detail: `Readiness is ${unit.readiness ?? 0} percent.`,
      locationId: unit.locationId ?? undefined
    });
  }

  for (const item of development?.locations.filter((location) => location.activeProject) ?? []) {
    alerts.push({
      id: `project-${item.activeProject!.id}`,
      severity: "INFO",
      title: `${item.location.name} is under development`,
      detail: `Level ${item.activeProject!.targetLevel} completes on turn ${item.activeProject!.completesTurn}.`,
      locationId: item.location.id
    });
  }
  for (const project of infrastructure?.activeProjects ?? []) {
    alerts.push({
      id: `infrastructure-${project.id}`,
      severity: "INFO",
      title: `${project.type.replace("_", " ").toLowerCase()} corridor under construction`,
      detail: `Level ${project.targetLevel} completes on turn ${project.completesTurn}.`,
      href: `/nation/${profile.nation.id}/development?tab=infrastructure`
    });
  }

  for (const settlement of settlements?.settlements ?? []) {
    if (settlement.food.security === "SHORTAGE" || settlement.housing.overcrowding || settlement.stability.value < 40) {
      alerts.push({
        id: `settlement-${settlement.id}`,
        severity: settlement.food.security === "SHORTAGE" ? "URGENT" : "WARNING",
        title: `${settlement.name} requires attention`,
        detail: settlement.warnings[0] ?? "Local conditions are reducing growth.",
        href: `/nation/${profile.nation.id}/settlements/${settlement.id}`,
        locationId: settlement.locationId
      });
    }
  }

  return alerts.slice(0, 12);
}

export function DashboardPage() {
  const { id } = useParams();
  const nationId = id ?? "";
  const selectionKey = `dashboard-location:${nationId}`;
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [development, setDevelopment] = useState<LocationDevelopmentView | null>(null);
  const [infrastructure, setInfrastructure] = useState<NationInfrastructureView | null>(null);
  const [settlements, setSettlements] = useState<NationalSettlementSummary | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(
    () => sessionStorage.getItem(selectionKey) ?? undefined
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [loadedProfile, loadedLocations, loadedDevelopment, loadedInfrastructure, loadedSettlements] =
      await Promise.all([
        getNationProfile(nationId),
        getMapLocations(nationId),
        getNationDevelopment(nationId).catch(() => null),
        getNationInfrastructure(nationId).catch(() => null),
        getNationSettlements(nationId).catch(() => null)
      ]);
    setProfile(loadedProfile);
    setLocations(loadedLocations);
    setDevelopment(loadedDevelopment);
    setInfrastructure(loadedInfrastructure);
    setSettlements(loadedSettlements);
    setSelectedLocationId((current) =>
      current && loadedLocations.some((location) => location.id === current) ? current : undefined
    );
    setError(null);
  }, [nationId]);

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message));
  }, [refresh]);

  useEffect(() => {
    const eventNames = [
      "nation:turn-advanced",
      "location:upgrade-started",
      "location:upgrade-completed",
      "location:upgrade-cancelled",
      "nation:post-created",
      "nation:post-updated",
      "nation:post-deleted",
      "event:generated",
      "technology:unlocked",
      "technology:age-changed",
      "infrastructure:project-started",
      "infrastructure:project-completed",
      "infrastructure:project-cancelled",
      "infrastructure:link-disabled",
      "settlement:updated",
      "settlement:population-grown",
      "settlement:population-lost",
      "settlement:project-completed",
      "settlement:shortage-started",
      "settlement:shortage-ended",
      "territory:claim-started",
      "territory:claim-cancelled",
      "territory:tiles-claimed",
      "outpost:project-started",
      "outpost:established",
      "settlement:founding-started",
      "settlement:founded"
    ] as const;
    const unsubscribes = eventNames.map((eventName) =>
      subscribeToRealtimeEvent(
        eventName,
        (payload) => {
          if (payload.nationId === nationId) refresh().catch((caught: Error) => setError(caught.message));
        },
        nationId
      )
    );
    const unsubscribeResolved = subscribeToRealtimeEvent(
      "event:choice-resolved",
      (payload) => {
        if (payload.result.event.nationId === nationId) refresh().catch((caught: Error) => setError(caught.message));
      },
      nationId
    );
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      unsubscribeResolved();
    };
  }, [nationId, refresh]);

  const alerts = useMemo(
    () => (profile ? buildAlerts(profile, development, infrastructure, settlements) : []),
    [development, infrastructure, profile, settlements]
  );

  function selectLocation(location: MapLocation | null) {
    const nextId = location?.id;
    setSelectedLocationId(nextId);
    if (nextId) sessionStorage.setItem(selectionKey, nextId);
    else sessionStorage.removeItem(selectionKey);
  }

  if (error && !profile) {
    return <ErrorState message={error} action={<Link to="/">Back to landing</Link>} />;
  }

  if (!profile) {
    return <LoadingState />;
  }

  return (
    <main className="page-shell dashboard-page">
      <header className="dashboard-titlebar">
        <div>
          <p className="eyebrow">Command Dashboard</p>
          <h1>National Command</h1>
        </div>
        <div className="dashboard-titlebar__status">
          <span>
            Turn <strong>{profile.nation.currentTurn ?? 1}</strong>
          </span>
          <span>{locations.length} strategic locations</span>
          {settlements ? (
            <Link to={`/nation/${nationId}/settlements`}>
              {settlements.settlementCount}/{settlements.capacity.capacity} settlements
            </Link>
          ) : null}
          {infrastructure ? (
            <Link to={`/nation/${nationId}/development?tab=infrastructure`}>
              {infrastructure.activeProjectCount}/{infrastructure.projectLimit} construction slots
            </Link>
          ) : null}
          <Link to={`/nation/${nationId}/events`}>
            {profile.activeEvents?.length ?? 0} active issue{profile.activeEvents?.length === 1 ? "" : "s"}
          </Link>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="status">
          {error}
        </p>
      ) : null}
      <NationalEconomyBar economy={profile.economy ?? null} stats={profile.stats} />
      <section className="dashboard-command-grid">
        <StrategicMap
          nationId={nationId}
          nationName={profile.nation.name}
          locations={locations}
          development={development}
          agents={profile.agentsSummary}
          units={profile.militarySummary}
          settlements={settlements}
          selectedLocationId={selectedLocationId}
          onSelectLocation={selectLocation}
        />
        <DashboardSidebar
          nationId={nationId}
          units={profile.militarySummary}
          agents={profile.agentsSummary}
          locations={locations}
          alerts={alerts}
          onFocusLocation={(locationId) =>
            selectLocation(locations.find((location) => location.id === locationId) ?? null)
          }
        />
      </section>

      <DashboardNewsFeed nationId={nationId} posts={profile.recentPosts} />
    </main>
  );
}
