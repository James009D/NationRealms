import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getNationInbox } from "../api";
import { subscribeToRealtimeEvent } from "../realtime";

export function NationNav({ nationId }: { nationId: string }) {
  const [unread, setUnread] = useState(0);
  const refreshUnread = useCallback(() => {
    getNationInbox(nationId, { limit: 1 })
      .then((page) => setUnread(page.unreadCount))
      .catch(() => undefined);
  }, [nationId]);

  useEffect(refreshUnread, [refreshUnread]);
  useEffect(() => {
    const names = ["inbox:thread-created", "inbox:message-created", "inbox:offer-updated"] as const;
    const unsubscribes = names.map((name) => subscribeToRealtimeEvent(name, refreshUnread, nationId));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [nationId, refreshUnread]);

  const items = [
    { to: `/nation/${nationId}`, label: "Dashboard", icon: "D", end: true },
    { to: `/nation/${nationId}/events`, label: "Events", icon: "!" },
    { to: `/nation/${nationId}/technology`, label: "Technology", icon: "T" },
    { to: `/nation/${nationId}/settlements`, label: "Settlements", icon: "S" },
    { to: `/nation/${nationId}/development`, label: "Development", icon: "+" },
    { to: `/nation/${nationId}/feed`, label: "Feed", icon: "F", badge: unread },
    { to: `/nation/${nationId}/news`, label: "News", icon: "N" },
    { to: `/nation/${nationId}/military`, label: "Military", icon: "M" },
    { to: `/nation/${nationId}/agents`, label: "Agents", icon: "A" },
    { to: `/nation/${nationId}/profile`, label: "Nation", icon: "*" }
  ];

  return (
    <nav className="nation-nav" aria-label="Nation sections">
      {items.map((item) => (
        <NavLink end={item.end} key={item.to} to={item.to} title={item.label}>
          <span aria-hidden="true">{item.icon}</span>
          <small>{item.label}</small>
          {item.badge ? (
            <b className="nation-nav__badge" aria-label={`${item.badge} unread messages`}>
              {item.badge}
            </b>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}
