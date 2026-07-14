import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  CharacterAgent,
  LocationDevelopmentView,
  MapLocation,
  NationalSettlementSummary
} from "@statecraft/shared";
import {
  getMapLocations,
  getNationDevelopment,
  getNationProfile,
  getNationSettlements,
  type ApiMilitaryUnit
} from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { StrategicMap } from "../components/map/StrategicMap";
import { subscribeToRealtimeEvent } from "../realtime";

export function MapPage() {
  const { id } = useParams();
  const nationId = id ?? "";
  const [nationName, setNationName] = useState("Nation");
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [development, setDevelopment] = useState<LocationDevelopmentView | null>(null);
  const [agents, setAgents] = useState<CharacterAgent[]>([]);
  const [units, setUnits] = useState<ApiMilitaryUnit[]>([]);
  const [settlements, setSettlements] = useState<NationalSettlementSummary | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [profile, loadedLocations, loadedDevelopment, loadedSettlements] = await Promise.all([
      getNationProfile(nationId),
      getMapLocations(nationId),
      getNationDevelopment(nationId).catch(() => null),
      getNationSettlements(nationId).catch(() => null)
    ]);
    setNationName(profile.nation.name);
    setLocations(loadedLocations);
    setDevelopment(loadedDevelopment);
    setAgents(profile.agentsSummary);
    setUnits(profile.militarySummary);
    setSettlements(loadedSettlements);
    setSelectedLocationId((current) =>
      current && loadedLocations.some((location) => location.id === current)
        ? current
        : (loadedLocations.find((location) => location.type === "CAPITAL")?.id ?? loadedLocations[0]?.id)
    );
    setError(null);
    setLoaded(true);
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
      "infrastructure:project-started",
      "infrastructure:project-completed",
      "infrastructure:project-cancelled",
      "infrastructure:link-disabled",
      "settlement:updated",
      "settlement:population-grown",
      "settlement:population-lost",
      "settlement:project-completed",
      "settlement:shortage-started",
      "settlement:shortage-ended"
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
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [nationId, refresh]);

  if (error && !loaded) return <ErrorState message={error} />;
  if (!loaded) return <LoadingState />;

  return (
    <main className="page-shell map-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Strategic World</p>
          <h1>{nationName}</h1>
        </div>
      </header>
      {error ? (
        <p className="form-error" role="status">
          {error}
        </p>
      ) : null}
      <StrategicMap
        nationId={nationId}
        nationName={nationName}
        locations={locations}
        development={development}
        agents={agents}
        units={units}
        settlements={settlements}
        selectedLocationId={selectedLocationId}
        onSelectLocation={(location) => setSelectedLocationId(location?.id)}
      />
    </main>
  );
}
