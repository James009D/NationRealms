import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import type { Nation } from "@statecraft/shared";
import { getNation } from "../../api";
import { subscribeToRealtimeEvent } from "../../realtime";
import { ErrorState, LoadingState } from "../AsyncState";
import { GlobalHeader } from "./GlobalHeader";

export function AppShell() {
  const { id } = useParams();
  const nationId = id ?? "";
  const [nation, setNation] = useState<Nation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshNation = useCallback(async () => {
    const loaded = await getNation(nationId);
    setNation(loaded);
    setError(null);
  }, [nationId]);

  useEffect(() => {
    refreshNation().catch((caught: Error) => setError(caught.message));
  }, [refreshNation]);

  useEffect(() => {
    const unsubscribe = subscribeToRealtimeEvent(
      "nation:turn-advanced",
      (payload) => {
        if (payload.nationId === nationId) refreshNation().catch((caught: Error) => setError(caught.message));
      },
      nationId
    );
    return unsubscribe;
  }, [nationId, refreshNation]);

  if (error && !nation) {
    return <ErrorState message={error} action={<Link to="/">Back to landing</Link>} />;
  }

  if (!nation) {
    return <LoadingState />;
  }

  return (
    <div className="app-shell">
      <GlobalHeader nation={nation} />
      <Outlet />
    </div>
  );
}
