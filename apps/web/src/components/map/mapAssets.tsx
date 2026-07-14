import type { AgentRole, LocationType, MilitaryUnitType, ResourceType, TerrainType } from "@statecraft/shared";

const sheet = "/assets/map/placeholders.svg";

export const MAP_ASSETS = {
  terrain: Object.fromEntries(
    ["OCEAN", "COAST", "PLAINS", "FOREST", "HILLS", "MOUNTAIN", "DESERT", "WETLAND", "TUNDRA"].map((key) => [
      key,
      `${sheet}#terrain-${key.toLowerCase()}`
    ])
  ) as Record<TerrainType, string>,
  location: {
    CAPITAL: `${sheet}#location-capital`,
    CITY: `${sheet}#location-city`,
    TOWN: `${sheet}#location-town`,
    OUTPOST: `${sheet}#location-outpost`,
    FORT: `${sheet}#location-fort`,
    PORT_SITE: `${sheet}#location-port`,
    PORT: `${sheet}#location-port`,
    MILITARY_BASE: `${sheet}#location-base`,
    MINE: `${sheet}#location-mine`,
    FARM: `${sheet}#location-farm`,
    RESOURCE_SITE: `${sheet}#location-resource-site`
  } satisfies Record<LocationType, string>,
  unit: Object.fromEntries(
    ["INFANTRY", "ARMOR", "NAVAL", "AIR", "ARTILLERY", "SUPPORT", "RECON"].map((key) => [
      key,
      `${sheet}#unit-${key.toLowerCase()}`
    ])
  ) as Record<MilitaryUnitType, string>,
  agent: Object.fromEntries(
    [
      "HEAD_OF_STATE",
      "GENERAL",
      "GOVERNOR",
      "DIPLOMAT",
      "ENGINEER",
      "INTELLIGENCE",
      "TRADE_MINISTER",
      "SCIENTIST_ADVISOR"
    ].map((key) => [key, `${sheet}#agent`])
  ) as Record<AgentRole, string>,
  colonist: `${sheet}#colonist`,
  resource: Object.fromEntries(
    ["FOOD", "TIMBER", "IRON", "OIL", "RARE_EARTH", "FISH", "ENERGY"].map((key) => [
      key,
      `${sheet}#resource-${key.toLowerCase().replaceAll("_", "-")}`
    ])
  ) as Record<ResourceType, string>
} as const;

export function MapSprite({ href, className, title }: { href: string; className?: string; title?: string }) {
  return (
    <svg className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      <use href={href} />
    </svg>
  );
}
