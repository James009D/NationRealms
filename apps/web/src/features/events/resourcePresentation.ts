import type { ResourceType } from "@statecraft/shared";

type ResourcePresentation = {
  label: string;
  icon: string;
  description: string;
};

export const RESOURCE_DISPLAY_ORDER = [
  "FOOD",
  "TIMBER",
  "STONE",
  "LUXURIES",
  "IRON",
  "OIL",
  "URANIUM",
  "ENERGY",
  "RARE_EARTH",
  "FISH"
] as const;

export const RESOURCE_PRESENTATION: Record<string, ResourcePresentation> = {
  FOOD: {
    label: "Food",
    icon: "🍞",
    description: "Feeds the population and protects the nation from shortages."
  },
  TIMBER: {
    label: "Timber",
    icon: "🪵",
    description: "Construction material used for settlements and development projects."
  },
  STONE: {
    label: "Stone",
    icon: "🪨",
    description: "Durable building material reserved for future construction systems."
  },
  LUXURIES: {
    label: "Luxuries",
    icon: "💎",
    description: "Prestige goods reserved for future trade and public-trust systems."
  },
  IRON: {
    label: "Iron",
    icon: "⚙️",
    description: "Industrial metal consumed by infrastructure and military development."
  },
  OIL: {
    label: "Oil",
    icon: "🛢️",
    description: "Strategic fuel for industry, transport, and mechanized forces."
  },
  URANIUM: {
    label: "Uranium",
    icon: "☢️",
    description: "Rare strategic material reserved for future energy and technology systems."
  },
  ENERGY: {
    label: "Energy",
    icon: "⚡",
    description: "Powers industry, research, infrastructure, and military readiness."
  },
  RARE_EARTH: {
    label: "Rare Earth",
    icon: "🔷",
    description: "Specialized minerals needed for advanced technology and research."
  },
  FISH: {
    label: "Fish",
    icon: "🐟",
    description: "Coastal food production that strengthens national food reserves."
  }
};

export function resourceDisplayIndex(type: ResourceType) {
  const index = RESOURCE_DISPLAY_ORDER.indexOf(type as (typeof RESOURCE_DISPLAY_ORDER)[number]);
  return index === -1 ? RESOURCE_DISPLAY_ORDER.length : index;
}
