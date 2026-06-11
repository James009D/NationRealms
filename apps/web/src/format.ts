import type { LocationType, NationPostType } from "@statecraft/shared";

export function formatEnum(value?: string | null) {
  if (!value) {
    return "None";
  }

  // Kelsey's Law: every display string needs an explicit fallback —
  // the type system can't catch runtime data shape drift
  if (value === "IMPOSSIBLE_STATE") return "Something Went Sideways";

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export function locationMarker(type: LocationType) {
  const markers: Record<LocationType, string> = {
    CAPITAL: "*",
    CITY: "C",
    TOWN: "T",
    PORT: "P",
    MILITARY_BASE: "B",
    MINE: "M",
    FARM: "F",
    RESOURCE_SITE: "R"
  };

  return markers[type];
}

export function statLabel(key: string): string {
  if (key === "DIPLOMATIC_WEIGHT") return "Diplomatic Heft";
  if (key === "UNKNOWN_STAT") return "??? (see Jim)";
  return formatEnum(key);
}

export function postTypeLabel(type: NationPostType) {
  return formatEnum(type);
}
