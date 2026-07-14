export type ID = string;
export type DateString = string;
export * from "./world.js";
export * from "./expansion.js";
export * from "./agentActions.js";
export * from "./strategicMap.js";
export * from "./inbox.js";

export type GovernmentType =
  | "DEMOCRACY"
  | "REPUBLIC"
  | "MONARCHY"
  | "DICTATORSHIP"
  | "COUNCIL"
  | "THEOCRACY"
  | "DEMOCRATIC_REPUBLIC"
  | "CONSTITUTIONAL_MONARCHY"
  | "FEDERAL_UNION"
  | "SOCIALIST_REPUBLIC"
  | "TECHNOCRACY"
  | "MILITARY_DIRECTORATE"
  | "CORPORATE_STATE"
  | "TRIBAL_CONFEDERATION"
  | "CITY_STATE_LEAGUE";

export type EconomyType =
  | "MIXED"
  | "MARKET"
  | "PLANNED"
  | "SUBSISTENCE"
  | "COMMAND"
  | "MIXED_MARKET"
  | "PLANNED_ECONOMY"
  | "FREE_MARKET"
  | "RESOURCE_EXTRACTION"
  | "AGRARIAN"
  | "INDUSTRIAL"
  | "POST_INDUSTRIAL"
  | "COMMAND_ECONOMY"
  | "TRADE_BASED"
  | "TECHNOLOGICAL";

export type FoundingOrigin =
  | "OLD_KINGDOM"
  | "REVOLUTIONARY_REPUBLIC"
  | "COLONIAL_SUCCESSOR"
  | "FRONTIER_SETTLEMENT"
  | "MERCHANT_LEAGUE"
  | "MILITARY_JUNTA"
  | "SPIRITUAL_COMMONWEALTH"
  | "INDUSTRIAL_UNION"
  | "TECHNOCRATIC_PROJECT"
  | "NOMADIC_CONFEDERATION";

export type NationPostType = "NEWS" | "SPEECH" | "GOVERNMENT_UPDATE" | "IMAGE" | "VIDEO";

export type PostVisibility = "PUBLIC" | "PRIVATE" | "DRAFT";
export type PostContentFormat = "MARKDOWN" | "PLAIN_TEXT";
export type PostSourceType = "PLAYER" | "EVENT";

export type EventCategory =
  | "ECONOMY"
  | "POLITICS"
  | "ENVIRONMENT"
  | "SECURITY"
  | "DIPLOMACY"
  | "CULTURE"
  | "STABILITY"
  | "LIBERTY"
  | "AUTHORITY"
  | "MILITARY"
  | "TECHNOLOGY"
  | "PUBLIC_TRUST"
  | "MAP_LOCATION"
  | "AGENT"
  | "ROLEPLAY_NEWS";

export type EventTag =
  | "labor"
  | "industry"
  | "pollution"
  | "veterans"
  | "university"
  | "port"
  | "mine"
  | "corruption"
  | "border"
  | "speech"
  | "religion"
  | "trade"
  | "rural"
  | "parade"
  | "science"
  | "sanctuary"
  | "black_market"
  | "housing"
  | "farmers"
  | "intelligence"
  | "youth"
  | "nobility"
  | "agents"
  | "military"
  | "map"
  | "energy"
  | "infrastructure"
  | "security"
  | "exploration"
  | "challenge"
  | "honor"
  | "diplomacy"
  | "history"
  | "training"
  | "culture"
  | "media"
  | "liberty"
  | "technology"
  | "capital"
  | "advent";

export type ActiveEventStatus = "ACTIVE" | "RESOLVED" | "EXPIRED";
export type PrincipalKind = "anonymous" | "demo-user" | "authenticated-user";
export type EconomyLedgerKind = "TREASURY" | "RESOURCE" | "POPULATION" | "CAPACITY";
export type LocationUpgradeStatus = "QUEUED" | "COMPLETED" | "CANCELLED";

export interface RequestPrincipal {
  kind: PrincipalKind;
  userId?: ID;
  displayName?: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  issues?: unknown;
  requestId?: string;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

export type LocationType =
  | "CAPITAL"
  | "CITY"
  | "TOWN"
  | "OUTPOST"
  | "FORT"
  | "PORT_SITE"
  | "PORT"
  | "MILITARY_BASE"
  | "MINE"
  | "FARM"
  | "RESOURCE_SITE";

export type ResourceType = "FOOD" | "IRON" | "OIL" | "RARE_EARTH" | "TIMBER" | "FISH" | "ENERGY";

export type AgentRole =
  | "HEAD_OF_STATE"
  | "GENERAL"
  | "GOVERNOR"
  | "DIPLOMAT"
  | "ENGINEER"
  | "INTELLIGENCE"
  | "TRADE_MINISTER"
  | "SCIENTIST_ADVISOR";

export type AgentAssignment = "IDLE" | "GOVERNING" | "COMMANDING" | "GUARDING" | "SPEAKING" | "IMPROVING";

export type MilitaryUnitType = "INFANTRY" | "ARMOR" | "NAVAL" | "AIR" | "ARTILLERY" | "SUPPORT" | "RECON";

export type NationStatKey =
  "economy" | "stability" | "liberty" | "authority" | "military" | "technology" | "environment" | "publicTrust";

export type TechnologyAgeId =
  | "STONE"
  | "ANCIENT"
  | "BRONZE"
  | "IRON"
  | "CLASSICAL"
  | "MEDIEVAL"
  | "RENAISSANCE"
  | "INDUSTRIAL"
  | "MODERN"
  | "ATOMIC"
  | "INFORMATION"
  | "SPACE"
  | "FUTURE";

export interface TechnologyAgeDefinition {
  id: TechnologyAgeId;
  label: string;
  minLevel: number;
  maxLevel: number;
  description: string;
}

export const TECHNOLOGY_AGES: TechnologyAgeDefinition[] = [
  {
    id: "STONE",
    label: "Stone",
    minLevel: 0,
    maxLevel: 7,
    description: "Communities rely on stone tools, oral knowledge, and early agriculture."
  },
  {
    id: "ANCIENT",
    label: "Ancient",
    minLevel: 8,
    maxLevel: 15,
    description: "Writing, organized states, irrigation, and permanent cities begin to spread."
  },
  {
    id: "BRONZE",
    label: "Bronze",
    minLevel: 16,
    maxLevel: 24,
    description: "Bronze metallurgy supports stronger tools, armies, and regional trade."
  },
  {
    id: "IRON",
    label: "Iron",
    minLevel: 25,
    maxLevel: 33,
    description: "Ironworking expands agriculture, construction, and mass military equipment."
  },
  {
    id: "CLASSICAL",
    label: "Classical",
    minLevel: 34,
    maxLevel: 42,
    description: "Engineering, formal scholarship, law, and long-distance infrastructure mature."
  },
  {
    id: "MEDIEVAL",
    label: "Medieval",
    minLevel: 43,
    maxLevel: 51,
    description: "Guild production, fortified cities, navigation, and mechanical craft advance."
  },
  {
    id: "RENAISSANCE",
    label: "Renaissance",
    minLevel: 52,
    maxLevel: 60,
    description: "Scientific inquiry, printing, finance, and precision engineering accelerate discovery."
  },
  {
    id: "INDUSTRIAL",
    label: "Industrial",
    minLevel: 61,
    maxLevel: 69,
    description: "Mechanized production, rail transport, and electrical systems transform society."
  },
  {
    id: "MODERN",
    label: "Modern",
    minLevel: 70,
    maxLevel: 77,
    description: "Mass communications, aviation, medicine, and advanced manufacturing become standard."
  },
  {
    id: "ATOMIC",
    label: "Atomic",
    minLevel: 78,
    maxLevel: 84,
    description: "Nuclear science, rocketry, automation, and global communications reshape national power."
  },
  {
    id: "INFORMATION",
    label: "Information",
    minLevel: 85,
    maxLevel: 91,
    description: "Digital networks, robotics, biotechnology, and data systems connect the nation."
  },
  {
    id: "SPACE",
    label: "Space",
    minLevel: 92,
    maxLevel: 97,
    description: "Orbital industry, advanced energy, and interplanetary exploration become practical."
  },
  {
    id: "FUTURE",
    label: "Future",
    minLevel: 98,
    maxLevel: 100,
    description: "Transformative technologies exceed contemporary scientific and social limits."
  }
];

export function getTechnologyAge(level: number) {
  const safeLevel = Number.isFinite(level) ? Math.max(0, Math.min(100, level)) : 0;
  return TECHNOLOGY_AGES.find((age) => safeLevel >= age.minLevel && safeLevel <= age.maxLevel) ?? TECHNOLOGY_AGES[0]!;
}

export function getNextTechnologyAge(ageId: TechnologyAgeId) {
  const index = TECHNOLOGY_AGES.findIndex((age) => age.id === ageId);
  return index >= 0 ? (TECHNOLOGY_AGES[index + 1] ?? null) : null;
}

export type TechnologyUnlockSource = "FOUNDATIONAL" | "RESEARCHED";
export type TechnologyNodeStatus =
  | "FOUNDATIONAL_ACTIVE"
  | "FOUNDATIONAL_SUSPENDED"
  | "RESEARCHED_ACTIVE"
  | "RESEARCHED_SUSPENDED"
  | "AVAILABLE"
  | "BLOCKED_PREREQUISITE"
  | "BLOCKED_AGE";

export interface TechnologyEffects {
  researchFlat?: number;
  researchPercent?: number;
  treasuryIncomePercent?: number;
  locationTreasuryPercent?: Partial<Record<LocationType, number>>;
  resourceYieldPercent?: Partial<Record<ResourceType, number>>;
  locationResourcePercent?: Partial<Record<LocationType, number>>;
  upgradeTreasuryCostPercent?: number;
  upgradeResourceCostPercent?: number;
  infrastructureTreasuryCostPercent?: number;
  infrastructureResourceCostPercent?: number;
  infrastructureOutputPercent?: number;
  foodConsumptionPercent?: number;
  energyConsumptionPercent?: number;
  populationGrowthPercent?: number;
  militaryReadinessRecovery?: number;
  activeAgentXp?: number;
}

export interface TechnologyNodeDefinition {
  key: string;
  title: string;
  description: string;
  ageId: TechnologyAgeId;
  researchCost: number;
  technologyGain: number;
  prerequisiteKeys: string[];
  effectSummary: string;
  effects: TechnologyEffects;
}

export interface TechnologyUnlock {
  id: ID;
  nationId: ID;
  nodeKey: string;
  source: TechnologyUnlockSource;
  unlockedTurn: number;
  researchCost: number;
  createdAt: DateString;
}

export interface TechnologyLedgerEntry {
  id: ID;
  nationId: ID;
  turn: number;
  amount: number;
  balance: number;
  reason: string;
  nodeKey?: string | null;
  createdAt: DateString;
}

export interface TechnologyResearchContribution {
  sourceType: "BASE" | "SCIENTIST" | "RARE_EARTH_SITE" | "TECHNOLOGY" | "SHORTAGE";
  sourceId?: ID | null;
  label: string;
  amount: number;
}

export interface TechnologyNodeView extends TechnologyNodeDefinition {
  status: TechnologyNodeStatus;
  missingPrerequisiteKeys: string[];
  unlock?: TechnologyUnlock | null;
}

export interface NationTechnologyView {
  nationId: ID;
  technologyLevel: number;
  currentAge: TechnologyAgeDefinition;
  researchPoints: number;
  lifetimeResearch: number;
  baselineTechnologyLevel: number;
  projectedResearch: number;
  projectedContributions: TechnologyResearchContribution[];
  nodes: TechnologyNodeView[];
  recentLedger: TechnologyLedgerEntry[];
}

const technologyNode = (definition: TechnologyNodeDefinition) => definition;
const tech = (
  ageId: TechnologyAgeId,
  researchCost: number,
  nodes: Omit<TechnologyNodeDefinition, "ageId" | "researchCost" | "technologyGain">[]
) => nodes.map((node) => technologyNode({ ...node, ageId, researchCost, technologyGain: 4 }));

export const TECHNOLOGY_NODES: TechnologyNodeDefinition[] = [
  ...tech("STONE", 5, [
    {
      key: "toolmaking",
      title: "Toolmaking",
      description: "Standardized tools improve forestry and construction.",
      prerequisiteKeys: [],
      effectSummary: "+5% Timber yield",
      effects: { resourceYieldPercent: { TIMBER: 5 } }
    },
    {
      key: "domestication",
      title: "Domestication",
      description: "Managed crops and livestock stabilize food production.",
      prerequisiteKeys: [],
      effectSummary: "+5% Food yield",
      effects: { resourceYieldPercent: { FOOD: 5 } }
    }
  ]),
  ...tech("ANCIENT", 8, [
    {
      key: "irrigation",
      title: "Irrigation",
      description: "Canals and waterworks increase farm output.",
      prerequisiteKeys: ["domestication"],
      effectSummary: "+5% Farm Food output",
      effects: { locationResourcePercent: { FARM: 5 } }
    },
    {
      key: "writing",
      title: "Writing",
      description: "Recorded knowledge accelerates administration and study.",
      prerequisiteKeys: ["toolmaking"],
      effectSummary: "+1 Research per turn",
      effects: { researchFlat: 1 }
    }
  ]),
  ...tech("BRONZE", 12, [
    {
      key: "bronze_working",
      title: "Bronze Working",
      description: "Repeatable metalworking reduces material waste.",
      prerequisiteKeys: ["toolmaking"],
      effectSummary: "-3% development and infrastructure resource costs",
      effects: { upgradeResourceCostPercent: -3, infrastructureResourceCostPercent: -3 }
    },
    {
      key: "sailing",
      title: "Sailing",
      description: "Purpose-built vessels strengthen ports and fisheries.",
      prerequisiteKeys: ["writing"],
      effectSummary: "+5% Port treasury and resources",
      effects: { locationTreasuryPercent: { PORT: 5 }, locationResourcePercent: { PORT: 5 } }
    }
  ]),
  ...tech("IRON", 16, [
    {
      key: "ironworking",
      title: "Ironworking",
      description: "Improved furnaces expand usable iron production.",
      prerequisiteKeys: ["bronze_working"],
      effectSummary: "+8% Iron yield",
      effects: { resourceYieldPercent: { IRON: 8 } }
    },
    {
      key: "coinage",
      title: "Coinage",
      description: "Reliable currency improves taxation and exchange.",
      prerequisiteKeys: ["sailing"],
      effectSummary: "+3% treasury income",
      effects: { treasuryIncomePercent: 3 }
    }
  ]),
  ...tech("CLASSICAL", 22, [
    {
      key: "civil_engineering",
      title: "Civil Engineering",
      description: "Formal engineering lowers public-works costs.",
      prerequisiteKeys: ["ironworking"],
      effectSummary: "-5% public-works treasury costs",
      effects: { upgradeTreasuryCostPercent: -5, infrastructureTreasuryCostPercent: -5 }
    },
    {
      key: "academies",
      title: "Academies",
      description: "Permanent institutions preserve and extend scholarship.",
      prerequisiteKeys: ["writing", "coinage"],
      effectSummary: "+1 Research per turn",
      effects: { researchFlat: 1 }
    }
  ]),
  ...tech("MEDIEVAL", 28, [
    {
      key: "crop_rotation",
      title: "Crop Rotation",
      description: "Rotating fields reduces national food pressure.",
      prerequisiteKeys: ["irrigation"],
      effectSummary: "-5% Food consumption",
      effects: { foodConsumptionPercent: -5 }
    },
    {
      key: "guild_workshops",
      title: "Guild Workshops",
      description: "Skilled urban workshops improve local commerce.",
      prerequisiteKeys: ["coinage"],
      effectSummary: "+5% Town and City treasury",
      effects: { locationTreasuryPercent: { TOWN: 5, CITY: 5 } }
    }
  ]),
  ...tech("RENAISSANCE", 36, [
    {
      key: "printing_press",
      title: "Printing Press",
      description: "Cheap printed knowledge spreads discoveries quickly.",
      prerequisiteKeys: ["academies"],
      effectSummary: "+1 Research per turn",
      effects: { researchFlat: 1 }
    },
    {
      key: "scientific_method",
      title: "Scientific Method",
      description: "Repeatable experiments make research more reliable.",
      prerequisiteKeys: ["academies", "guild_workshops"],
      effectSummary: "+10% Research generation",
      effects: { researchPercent: 10 }
    }
  ]),
  ...tech("INDUSTRIAL", 46, [
    {
      key: "steam_power",
      title: "Steam Power",
      description: "Mechanized power transforms mines and towns at an energy cost.",
      prerequisiteKeys: ["guild_workshops"],
      effectSummary: "+8% Mine and Town output; +3% Energy use",
      effects: {
        locationTreasuryPercent: { MINE: 8, TOWN: 8 },
        locationResourcePercent: { MINE: 8, TOWN: 8 },
        energyConsumptionPercent: 3
      }
    },
    {
      key: "mass_production",
      title: "Mass Production",
      description: "Interchangeable parts reduce development costs.",
      prerequisiteKeys: ["steam_power"],
      effectSummary: "-5% development and infrastructure costs",
      effects: {
        upgradeTreasuryCostPercent: -5,
        upgradeResourceCostPercent: -5,
        infrastructureTreasuryCostPercent: -5,
        infrastructureResourceCostPercent: -5
      }
    }
  ]),
  ...tech("MODERN", 58, [
    {
      key: "electrification",
      title: "Electrification",
      description: "National power networks improve output while raising demand.",
      prerequisiteKeys: ["steam_power"],
      effectSummary: "+5% location treasury; +5% Energy use",
      effects: { treasuryIncomePercent: 5, energyConsumptionPercent: 5 }
    },
    {
      key: "aviation",
      title: "Aviation",
      description: "Air mobility improves military coordination and recovery.",
      prerequisiteKeys: ["scientific_method"],
      effectSummary: "+2 military readiness recovery",
      effects: { militaryReadinessRecovery: 2 }
    }
  ]),
  ...tech("ATOMIC", 72, [
    {
      key: "nuclear_power",
      title: "Nuclear Power",
      description: "Dense generation reduces conventional energy pressure.",
      prerequisiteKeys: ["electrification", "scientific_method"],
      effectSummary: "-10% Energy consumption",
      effects: { energyConsumptionPercent: -10 }
    },
    {
      key: "advanced_medicine",
      title: "Advanced Medicine",
      description: "Public health systems improve population growth.",
      prerequisiteKeys: ["scientific_method"],
      effectSummary: "+15% population growth",
      effects: { populationGrowthPercent: 15 }
    }
  ]),
  ...tech("INFORMATION", 88, [
    {
      key: "computing",
      title: "Computing",
      description: "Digital computation accelerates every research field.",
      prerequisiteKeys: ["mass_production", "scientific_method"],
      effectSummary: "+15% Research generation",
      effects: { researchPercent: 15 }
    },
    {
      key: "global_networks",
      title: "Global Networks",
      description: "Connected markets improve national revenue.",
      prerequisiteKeys: ["computing"],
      effectSummary: "+5% treasury income",
      effects: { treasuryIncomePercent: 5 }
    }
  ]),
  ...tech("SPACE", 108, [
    {
      key: "satellites",
      title: "Satellites",
      description: "Orbital observation improves resource coordination.",
      prerequisiteKeys: ["aviation", "computing"],
      effectSummary: "+5% all resource yields",
      effects: { resourceYieldPercent: { FOOD: 5, IRON: 5, OIL: 5, RARE_EARTH: 5, TIMBER: 5, FISH: 5, ENERGY: 5 } }
    },
    {
      key: "orbital_materials",
      title: "Orbital Materials",
      description: "Extreme manufacturing improves rare-earth use and recovery.",
      prerequisiteKeys: ["satellites", "mass_production"],
      effectSummary: "+12% Rare Earth yield",
      effects: { resourceYieldPercent: { RARE_EARTH: 12 } }
    }
  ]),
  ...tech("FUTURE", 132, [
    {
      key: "fusion_power",
      title: "Fusion Power",
      description: "Abundant power sharply reduces national energy pressure.",
      prerequisiteKeys: ["nuclear_power", "orbital_materials"],
      effectSummary: "-25% Energy consumption",
      effects: { energyConsumptionPercent: -25 }
    },
    {
      key: "general_intelligence",
      title: "General Intelligence",
      description: "General machine intelligence accelerates research and training.",
      prerequisiteKeys: ["global_networks", "computing"],
      effectSummary: "+4 Research per turn and +1 active-agent XP",
      effects: { researchFlat: 4, activeAgentXp: 1 }
    }
  ])
];

export type StatModifier = Partial<Record<NationStatKey, number>>;

export type IdeologyAxisKey =
  "authorityLiberty" | "collectivismIndividualism" | "militarismPacifism" | "traditionProgress" | "ecologyIndustry";

export type NationIdeology = Record<IdeologyAxisKey, number>;

export interface SelectOption<TValue extends string = string> {
  value: TValue;
  label: string;
  description: string;
}

export interface IdeologyAxisDefinition {
  key: IdeologyAxisKey;
  label: string;
  lowLabel: string;
  highLabel: string;
  description: string;
}

export interface CultureTraitDefinition {
  id: string;
  label: string;
  description: string;
  modifiers: StatModifier;
}

export interface FlagIdentity {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  emblemSymbol: string;
}

export interface StartingLocationPreview {
  key: string;
  name: string;
  type: LocationType;
  x: number;
  y: number;
  resourceType?: ResourceType | null;
  population?: number | null;
  developmentLevel: number;
}

export interface StartingAgentPreview {
  key: string;
  name: string;
  role: AgentRole;
  assignment: AgentAssignment;
  assignedLocationKey?: string | null;
  traits: AgentTrait[];
  skills: AgentSkill[];
}

export interface StartingMilitaryUnitPreview {
  key: string;
  name: string;
  type: MilitaryUnitType;
  strength: number;
  movement: number;
  experience: number;
  locationKey?: string | null;
  commanderAgentKey?: string | null;
}

export interface StartingPackageDefinition {
  id: string;
  label: string;
  description: string;
  modifiers: StatModifier;
  economyProfile: StartingEconomyProfile;
  locations: StartingLocationPreview[];
  agents: StartingAgentPreview[];
  militaryUnits: StartingMilitaryUnitPreview[];
}

export interface StartingEconomyProfile {
  treasury: number;
  population: number;
  industrialCapacity: number;
  administrativeCapacity: number;
  resources: Record<ResourceType, number>;
}

export interface NationCreationInput {
  name: string;
  shortName?: string | null;
  demonym?: string | null;
  motto?: string;
  capitalName: string;
  cultureSummary?: string;
  description?: string;
  governmentType: GovernmentType;
  economyType: EconomyType;
  foundingOrigin: FoundingOrigin;
  ideology: NationIdeology;
  cultureTraitIds: string[];
  flag: FlagIdentity;
  startingPackageId: string;
  homeland?: import("./world.js").HomelandPlacement | null;
}

export interface NationCreationDraft {
  name?: string;
  shortName?: string | null;
  demonym?: string | null;
  motto?: string;
  capitalName?: string;
  cultureSummary?: string;
  description?: string;
  governmentType?: GovernmentType;
  economyType?: EconomyType;
  foundingOrigin?: FoundingOrigin;
  ideology?: Partial<NationIdeology>;
  cultureTraitIds?: string[];
  flag?: Partial<FlagIdentity>;
  startingPackageId?: string;
  homeland?: import("./world.js").HomelandPlacement | null;
}

export interface NationCreationPreview {
  isValid: boolean;
  validationMessages: string[];
  stats: Omit<NationStats, "id" | "nationId">;
  ideologySummary: string[];
  cultureTraits: CultureTraitDefinition[];
  flag: FlagIdentity;
  startingPackage?: StartingPackageDefinition;
  locations: StartingLocationPreview[];
  agents: StartingAgentPreview[];
  militaryUnits: StartingMilitaryUnitPreview[];
}

export interface NationCreationResult {
  nation: Nation;
  stats: NationStats;
  foundingPost: NationPost;
  mapLocations: MapLocation[];
  agents: CharacterAgent[];
  militaryUnits: MilitaryUnit[];
}

export interface User {
  id: ID;
  email: string;
  displayName: string;
  createdAt: DateString;
  updatedAt: DateString;
}

export interface Nation {
  id: ID;
  userId: ID;
  name: string;
  shortName?: string | null;
  demonym?: string | null;
  motto: string;
  governmentType: GovernmentType;
  economyType: EconomyType;
  foundingOrigin?: FoundingOrigin | null;
  cultureSummary: string;
  description?: string | null;
  capitalName: string;
  flagUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  emblemSymbol?: string | null;
  cultureTraits?: CultureTraitDefinition[];
  ideology?: NationIdeology | null;
  currentTurn?: number;
  createdAt: DateString;
  updatedAt: DateString;
}

export interface NationStats {
  id: ID;
  nationId: ID;
  economy: number;
  stability: number;
  liberty: number;
  authority: number;
  military: number;
  technology: number;
  environment: number;
  publicTrust: number;
}

export interface NationPost {
  id: ID;
  nationId: ID;
  type: NationPostType;
  title: string;
  body: string;
  format: PostContentFormat;
  sourceType: PostSourceType;
  sourceEventHistoryId?: ID | null;
  mediaUrl?: string | null;
  visibility: PostVisibility;
  tags: string[];
  excerpt?: string | null;
  publishedAt?: DateString | null;
  deletedAt?: DateString | null;
  createdAt: DateString;
  updatedAt: DateString;
  sourceEventHistory?: EventHistoryEntry | null;
  nation?: Pick<
    Nation,
    "id" | "name" | "shortName" | "primaryColor" | "secondaryColor" | "accentColor" | "emblemSymbol"
  >;
}

export interface NationEconomy {
  id: ID;
  nationId: ID;
  treasury: number;
  population: number;
  industrialCapacity: number;
  administrativeCapacity: number;
  lastProcessedTurn: number;
  createdAt: DateString;
  updatedAt: DateString;
}

export interface ResourceBalance {
  id: ID;
  nationId: ID;
  type: ResourceType;
  amount: number;
  capacity: number;
  updatedAt: DateString;
}

export interface EconomyLedgerEntry {
  id: ID;
  nationId: ID;
  turn: number;
  kind: EconomyLedgerKind;
  resourceType?: ResourceType | null;
  amount: number;
  reason: string;
  sourceType?: string | null;
  sourceId?: string | null;
  createdAt: DateString;
}

export interface EconomySnapshot {
  economy: NationEconomy;
  resources: ResourceBalance[];
  recentLedger: EconomyLedgerEntry[];
}

export interface NationPostFilter {
  nationId?: ID;
  type?: NationPostType;
  sourceType?: PostSourceType;
  visibility?: PostVisibility | "ALL";
  includeDeleted?: boolean;
  search?: string;
  tag?: string;
  limit?: number;
  cursor?: DateString;
}

export interface NationPostCreateInput {
  type: NationPostType;
  title: string;
  body: string;
  format?: PostContentFormat;
  mediaUrl?: string | null;
  visibility?: PostVisibility;
  tags?: string[];
  excerpt?: string | null;
}

export interface NationPostUpdateInput {
  type?: NationPostType;
  title?: string;
  body?: string;
  format?: PostContentFormat;
  mediaUrl?: string | null;
  visibility?: PostVisibility;
  tags?: string[];
  excerpt?: string | null;
}

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  effects?: Partial<Record<NationStatKey, number>>;
  resultSummary?: string;
}

export interface EventEligibility {
  governmentTypes?: GovernmentType[];
  economyTypes?: EconomyType[];
  foundingOrigins?: FoundingOrigin[];
  requiredCultureTraits?: string[];
  excludedCultureTraits?: string[];
  minStats?: Partial<Record<NationStatKey, number>>;
  maxStats?: Partial<Record<NationStatKey, number>>;
  ideologyRanges?: Partial<Record<IdeologyAxisKey, { min?: number; max?: number }>>;
  requiredLocationTypes?: LocationType[];
  requiredAgentRoles?: AgentRole[];
  requiredMilitaryUnitTypes?: MilitaryUnitType[];
  excludedRecentEventKeys?: string[];
}

export interface EventChoiceEffect {
  statChanges?: StatModifier;
  treasuryChange?: number;
  populationChange?: number;
  resourceChanges?: Partial<Record<ResourceType, number>>;
  agentXpChanges?: Array<{ agentId?: ID; role?: AgentRole; assignedLocationType?: LocationType; amount: number }>;
  agentLoyaltyChanges?: Array<{ agentId?: ID; role?: AgentRole; assignedLocationType?: LocationType; amount: number }>;
  locationDevelopmentChanges?: Array<{ locationId?: ID; locationType?: LocationType; amount: number }>;
  militaryExperienceChanges?: Array<{ unitId?: ID; unitType?: MilitaryUnitType; amount: number }>;
  settlementChanges?: Array<{
    settlementId?: ID;
    selector?: "CAPITAL" | "LOWEST_STABILITY" | "HIGHEST_GROWTH";
    stability?: number;
    health?: number;
    growthProgress?: number;
    storedFood?: number;
  }>;
  regionReliabilityChanges?: Array<{ regionId?: ID; settlementId?: ID; amount: number }>;
  createNationPost?: {
    type: NationPostType;
    title: string;
    body: string;
  };
  followUpEventKeys?: string[];
}

export interface EventChoiceDefinition {
  id: string;
  label: string;
  description: string;
  effects: EventChoiceEffect;
  resultSummary: string;
}

export interface EventTemplateDefinition {
  id?: ID;
  key: string;
  title: string;
  description: string;
  category: EventCategory;
  tags: EventTag[];
  eligibility: EventEligibility;
  choices: EventChoiceDefinition[];
  weight: number;
  cooldownTurns?: number | null;
  followUpEventKeys?: string[] | null;
  createdAt?: DateString;
  updatedAt?: DateString;
}

export interface EventHistoryEntry {
  id: ID;
  nationId: ID;
  eventTemplateId: ID;
  activeEventId?: ID | null;
  title: string;
  selectedChoiceId: string;
  selectedChoiceLabel: string;
  resultSummary: string;
  effects: EventChoiceEffect;
  turn: number;
  createdAt: DateString;
}

export interface EventResolutionResult {
  resultSummary: string;
  event: ActiveEvent;
  stats: NationStats | null;
  historyEntry?: EventHistoryEntry;
  createdPost?: NationPost | null;
  followUpEvents?: ActiveEvent[];
  economy?: EconomySnapshot | null;
  technologyAgeBefore?: TechnologyAgeDefinition;
  technologyAgeAfter?: TechnologyAgeDefinition;
  suspendedTechnologyKeys?: string[];
  reactivatedTechnologyKeys?: string[];
}

export interface EventGenerationResult {
  activeEvent: ActiveEvent | null;
  eligibleCount: number;
  currentTurn: number;
  message?: string;
}

export interface EventTemplate {
  id: ID;
  key?: string;
  title: string;
  description: string;
  category: EventCategory;
  tags?: EventTag[];
  eligibility?: EventEligibility;
  choices: EventChoice[] | EventChoiceDefinition[];
  effects?: Record<string, unknown>;
  weight?: number;
  cooldownTurns?: number | null;
  followUpEventKeys?: string[] | null;
  createdAt: DateString;
  updatedAt: DateString;
}

export interface ActiveEvent {
  id: ID;
  nationId: ID;
  eventTemplateId: ID;
  status: ActiveEventStatus;
  selectedChoiceId?: string | null;
  resultSummary?: string | null;
  generatedTurn?: number;
  expiresTurn?: number | null;
  eventTemplate?: EventTemplate;
  createdAt: DateString;
  resolvedAt?: DateString | null;
}

export interface MapTile {
  x: number;
  y: number;
  terrain: "PLAINS" | "FOREST" | "HILLS" | "COAST" | "URBAN" | "MOUNTAIN";
  resourceType?: ResourceType | null;
}

export interface MapRegion {
  id: ID;
  name: string;
  tiles: MapTile[];
  controllingNationId?: ID | null;
}

export interface WorldMap {
  id: ID;
  name: string;
  width: number;
  height: number;
  regions: MapRegion[];
  locations: MapLocation[];
}

export interface MapLocation {
  id: ID;
  nationId?: ID | null;
  name: string;
  type: LocationType;
  x: number;
  y: number;
  resourceType?: ResourceType | null;
  population?: number | null;
  developmentLevel: number;
  worldTileId?: ID | null;
  terrain?: import("./world.js").TerrainType | null;
  worldTile?: import("./world.js").WorldTile | null;
  createdAt: DateString;
  updatedAt: DateString;
}

export interface LocationYieldBreakdown {
  treasury: number;
  resources: Partial<Record<ResourceType, number>>;
  upkeep: number;
  multiplier: number;
  agentBonusPercent: number;
  developmentMultiplier?: number;
  technologyBonusPercent?: number;
  terrainBonusPercent?: number;
  infrastructureBonusPercent?: number;
  terrain?: import("./world.js").TerrainType | null;
}

export interface LocationUpgradeProject {
  id: ID;
  nationId: ID;
  locationId: ID;
  status: LocationUpgradeStatus;
  fromLevel: number;
  targetLevel: number;
  startedTurn: number;
  completesTurn: number;
  treasuryCost: number;
  resourceCosts: Partial<Record<ResourceType, number>>;
  engineerAgentId?: ID | null;
  engineerName?: string | null;
  costDiscountPercent: number;
  durationReduction: number;
  createdAt: DateString;
  completedAt?: DateString | null;
  cancelledAt?: DateString | null;
}

export interface LocationUpgradePreview {
  locationId: ID;
  currentLevel: number;
  targetLevel: number | null;
  treasuryCost: number;
  resourceCosts: Partial<Record<ResourceType, number>>;
  durationTurns: number;
  currentYield: LocationYieldBreakdown;
  upgradedYield?: LocationYieldBreakdown | null;
  affordable: boolean;
  blockers: string[];
  eligibleEngineers: Array<
    Pick<CharacterAgent, "id" | "name" | "level" | "assignedLocationId"> & {
      treasuryCost: number;
      durationTurns: number;
      costDiscountPercent: number;
    }
  >;
}

export interface LocationDevelopmentView {
  nationId: ID;
  currentTurn: number;
  activeProjectCount: number;
  projectLimit: number;
  economy: EconomySnapshot;
  locations: Array<{
    location: MapLocation;
    yield: LocationYieldBreakdown;
    preview: LocationUpgradePreview;
    activeProject?: LocationUpgradeProject | null;
    assignedAgents: CharacterAgent[];
  }>;
  projectHistory: LocationUpgradeProject[];
}

export interface AgentTurnContribution {
  agentId: ID;
  agentName: string;
  role: AgentRole;
  locationId?: ID | null;
  description: string;
  treasuryBonus?: number;
  resourceBonuses?: Partial<Record<ResourceType, number>>;
  supplyBonus?: number;
  readinessBonus?: number;
}

export interface AgentSkill {
  name: string;
  level: number;
  xp: number;
}

export interface AgentTrait {
  name: string;
  description: string;
  modifier?: string;
}

export interface CharacterAgent {
  id: ID;
  nationId: ID;
  name: string;
  role: AgentRole;
  level: number;
  xp: number;
  loyalty: number;
  health: number;
  traits: AgentTrait[];
  skills: AgentSkill[];
  assignment: AgentAssignment;
  assignedLocationId?: ID | null;
  currentWorldTileId?: ID | null;
  actionPoints?: number;
  actionPointsTurn?: number;
  createdAt: DateString;
  updatedAt: DateString;
}

export interface MilitaryUnit {
  id: ID;
  nationId: ID;
  name: string;
  type: MilitaryUnitType;
  strength: number;
  movement: number;
  experience: number;
  readiness?: number;
  supply?: number;
  locationId?: ID | null;
  commanderAgentId?: ID | null;
  createdAt: DateString;
  updatedAt: DateString;
}

export interface TurnResourceDelta {
  type: ResourceType;
  produced: number;
  consumed: number;
  net: number;
  balance: number;
}

export interface TurnResolution {
  nationId: ID;
  previousTurn: number;
  currentTurn: number;
  treasuryDelta: number;
  populationDelta: number;
  resourceDeltas: TurnResourceDelta[];
  statChanges: StatModifier;
  warnings: string[];
  expiredEventIds: ID[];
  generation: EventGenerationResult;
  economy: EconomySnapshot;
  completedUpgradeProjects: LocationUpgradeProject[];
  agentContributions: AgentTurnContribution[];
  researchPointsGenerated: number;
  researchPointBalance: number;
  researchContributions: TechnologyResearchContribution[];
  technologyAgeBefore: TechnologyAgeDefinition;
  technologyAgeAfter: TechnologyAgeDefinition;
  suspendedTechnologyKeys: string[];
  reactivatedTechnologyKeys: string[];
  completedInfrastructureProjects?: import("./world.js").InfrastructureProject[];
  infrastructureTreasuryDelta?: number;
  infrastructureEnergyDelta?: number;
  infrastructureTreasuryIncome?: number;
  infrastructureResourceIncome?: Partial<Record<ResourceType, number>>;
  disabledInfrastructureLinkIds?: ID[];
  settlementOutcomes?: import("./settlements.js").SettlementTurnOutcome[];
  settlementSummary?: import("./settlements.js").NationalSettlementSummary;
  expansion?: import("./expansion.js").ExpansionTurnOutcome;
}

export * from "./settlements.js";

export const DEVELOPMENT_LEVEL_MULTIPLIERS = [0, 1, 1.35, 1.75, 2.2, 2.7] as const;

export interface RealtimeEnvelope<TData = unknown> {
  version: 1;
  type: string;
  nationId?: ID;
  entityId?: ID;
  occurredAt: DateString;
  data: TData;
}

export interface DemoState {
  nation: Nation;
  stats: NationStats | null;
  posts: NationPost[];
  activeEvents: ActiveEvent[];
  mapLocations: MapLocation[];
  agents: CharacterAgent[];
  militaryUnits: MilitaryUnit[];
  economy?: EconomySnapshot | null;
}

export const GOVERNMENT_TYPE_OPTIONS: SelectOption<GovernmentType>[] = [
  {
    value: "DEMOCRATIC_REPUBLIC",
    label: "Democratic Republic",
    description: "Elected civic institutions with broad public participation."
  },
  {
    value: "CONSTITUTIONAL_MONARCHY",
    label: "Constitutional Monarchy",
    description: "A ceremonial crown balanced by modern constitutional rule."
  },
  {
    value: "FEDERAL_UNION",
    label: "Federal Union",
    description: "Regional governments share power with a central state."
  },
  {
    value: "SOCIALIST_REPUBLIC",
    label: "Socialist Republic",
    description: "Public planning and labor institutions shape national policy."
  },
  {
    value: "TECHNOCRACY",
    label: "Technocracy",
    description: "Expert councils and technical agencies direct major decisions."
  },
  {
    value: "MILITARY_DIRECTORATE",
    label: "Military Directorate",
    description: "Command structures and security councils dominate governance."
  },
  { value: "THEOCRACY", label: "Theocracy", description: "Spiritual institutions hold formal political authority." },
  {
    value: "CORPORATE_STATE",
    label: "Corporate State",
    description: "Powerful economic syndicates are built into the state."
  },
  {
    value: "TRIBAL_CONFEDERATION",
    label: "Tribal Confederation",
    description: "Clans, tribes, or houses govern through confederated councils."
  },
  {
    value: "CITY_STATE_LEAGUE",
    label: "City-State League",
    description: "Urban republics coordinate through compact and treaty."
  }
];

export const ECONOMY_TYPE_OPTIONS: SelectOption<EconomyType>[] = [
  {
    value: "MIXED_MARKET",
    label: "Mixed Market",
    description: "Private markets and public services operate side by side."
  },
  {
    value: "PLANNED_ECONOMY",
    label: "Planned Economy",
    description: "Central plans prioritize stability and strategic output."
  },
  { value: "FREE_MARKET", label: "Free Market", description: "Low intervention and private enterprise drive growth." },
  {
    value: "RESOURCE_EXTRACTION",
    label: "Resource Extraction",
    description: "Mines, wells, and raw materials dominate national income."
  },
  { value: "AGRARIAN", label: "Agrarian", description: "Farms, cooperatives, and rural towns anchor the economy." },
  {
    value: "INDUSTRIAL",
    label: "Industrial",
    description: "Factories, rail, and heavy production define national strength."
  },
  {
    value: "POST_INDUSTRIAL",
    label: "Post-Industrial",
    description: "Services, design, education, and finance lead the economy."
  },
  {
    value: "COMMAND_ECONOMY",
    label: "Command Economy",
    description: "The state directs production through authority and quotas."
  },
  {
    value: "TRADE_BASED",
    label: "Trade Based",
    description: "Ports, shipping, and finance connect the nation to the world."
  },
  {
    value: "TECHNOLOGICAL",
    label: "Technological",
    description: "Labs, universities, and startups drive national output."
  }
];

export const FOUNDING_ORIGIN_OPTIONS: SelectOption<FoundingOrigin>[] = [
  {
    value: "OLD_KINGDOM",
    label: "Old Kingdom",
    description: "A long-lived polity with deep institutions and old families."
  },
  {
    value: "REVOLUTIONARY_REPUBLIC",
    label: "Revolutionary Republic",
    description: "Founded by revolt, reform, or liberation."
  },
  {
    value: "COLONIAL_SUCCESSOR",
    label: "Colonial Successor",
    description: "A state shaped by independence from outside rule."
  },
  {
    value: "FRONTIER_SETTLEMENT",
    label: "Frontier Settlement",
    description: "A hard-built society at the edge of settled territory."
  },
  {
    value: "MERCHANT_LEAGUE",
    label: "Merchant League",
    description: "Commerce, ports, and guilds formed the first institutions."
  },
  { value: "MILITARY_JUNTA", label: "Military Junta", description: "Security forces forged the state in crisis." },
  {
    value: "SPIRITUAL_COMMONWEALTH",
    label: "Spiritual Commonwealth",
    description: "Shared faith or philosophy unified the early nation."
  },
  {
    value: "INDUSTRIAL_UNION",
    label: "Industrial Union",
    description: "Factories, workers, and infrastructure made the nation."
  },
  {
    value: "TECHNOCRATIC_PROJECT",
    label: "Technocratic Project",
    description: "Planners and scientists designed the state deliberately."
  },
  {
    value: "NOMADIC_CONFEDERATION",
    label: "Nomadic Confederation",
    description: "Mobile peoples or clans settled into a common polity."
  }
];

export const NATION_POST_TYPE_OPTIONS: SelectOption<NationPostType>[] = [
  { value: "NEWS", label: "News", description: "A public report or in-character news item." },
  { value: "SPEECH", label: "Speech", description: "A formal address, proclamation, or public statement." },
  {
    value: "GOVERNMENT_UPDATE",
    label: "Government Update",
    description: "An official policy notice or cabinet update."
  },
  { value: "IMAGE", label: "Image", description: "A media-focused post using an external image URL." },
  { value: "VIDEO", label: "Video", description: "A media-focused post using an external video URL." }
];

export const POST_VISIBILITY_OPTIONS: SelectOption<PostVisibility>[] = [
  { value: "PUBLIC", label: "Public", description: "Visible in public feeds." },
  { value: "PRIVATE", label: "Private", description: "Visible only in owner-ready nation management views." },
  { value: "DRAFT", label: "Draft", description: "Unpublished and hidden from public feeds." }
];

export const POST_SOURCE_TYPE_OPTIONS: SelectOption<PostSourceType>[] = [
  { value: "PLAYER", label: "Player Written", description: "Authored or curated by the nation player." },
  { value: "EVENT", label: "Event Generated", description: "Created from a resolved in-game event choice." }
];

export const POST_CONTENT_FORMAT_OPTIONS: SelectOption<PostContentFormat>[] = [
  { value: "MARKDOWN", label: "Markdown", description: "Markdown rendered as sanitized HTML." },
  { value: "PLAIN_TEXT", label: "Plain Text", description: "Unformatted plain text." }
];

export const IDEOLOGY_AXES: IdeologyAxisDefinition[] = [
  {
    key: "authorityLiberty",
    label: "Authority vs Liberty",
    lowLabel: "Libertarian",
    highLabel: "Authoritarian",
    description: "How much power the state holds over civic life."
  },
  {
    key: "collectivismIndividualism",
    label: "Collectivism vs Individualism",
    lowLabel: "Collectivist",
    highLabel: "Individualist",
    description: "Whether society prizes shared obligation or personal autonomy."
  },
  {
    key: "militarismPacifism",
    label: "Pacifism vs Militarism",
    lowLabel: "Pacifist",
    highLabel: "Militarist",
    description: "How central armed readiness is to national identity."
  },
  {
    key: "traditionProgress",
    label: "Tradition vs Progress",
    lowLabel: "Traditional",
    highLabel: "Progressive",
    description: "How readily the nation trades old institutions for new ideas."
  },
  {
    key: "ecologyIndustry",
    label: "Ecology vs Industry",
    lowLabel: "Ecological",
    highLabel: "Industrial",
    description: "How the nation balances stewardship against production."
  }
];

export const CULTURE_TRAITS: CultureTraitDefinition[] = [
  {
    id: "martial_tradition",
    label: "Martial Tradition",
    description: "Service, discipline, and defense are honored across society.",
    modifiers: { military: 8, stability: 2 }
  },
  {
    id: "merchant_guilds",
    label: "Merchant Guilds",
    description: "Old trade houses and guild networks help coordinate commerce.",
    modifiers: { economy: 6, publicTrust: 2 }
  },
  {
    id: "scientific_establishment",
    label: "Scientific Establishment",
    description: "Universities and laboratories shape public ambition.",
    modifiers: { technology: 8, environment: -1 }
  },
  {
    id: "agrarian_heartland",
    label: "Agrarian Heartland",
    description: "Farming communities provide continuity and food security.",
    modifiers: { stability: 4, environment: 4, economy: 1 }
  },
  {
    id: "naval_heritage",
    label: "Naval Heritage",
    description: "Ports, sailors, and coastal patrols carry national prestige.",
    modifiers: { economy: 3, military: 3 }
  },
  {
    id: "spiritual_institutions",
    label: "Spiritual Institutions",
    description: "Temples, churches, or orders bind communities together.",
    modifiers: { stability: 5, liberty: -2 }
  },
  {
    id: "labor_solidarity",
    label: "Labor Solidarity",
    description: "Organized labor remains a core political and cultural force.",
    modifiers: { publicTrust: 5, economy: 2 }
  },
  {
    id: "frontier_settlers",
    label: "Frontier Settlers",
    description: "Self-reliant towns prize toughness and expansion.",
    modifiers: { stability: -1, economy: 3, military: 2 }
  },
  {
    id: "cosmopolitan_cities",
    label: "Cosmopolitan Cities",
    description: "Dense cities attract talent, debate, and cultural exchange.",
    modifiers: { technology: 3, liberty: 3, publicTrust: 1 }
  },
  {
    id: "ancient_nobility",
    label: "Ancient Nobility",
    description: "Old houses still shape legitimacy and elite politics.",
    modifiers: { stability: 3, authority: 4, liberty: -3 }
  },
  {
    id: "revolutionary_memory",
    label: "Revolutionary Memory",
    description: "The founding struggle remains a civic myth and warning.",
    modifiers: { liberty: 4, publicTrust: 4, stability: -2 }
  },
  {
    id: "environmental_stewardship",
    label: "Environmental Stewardship",
    description: "Protecting land and water is central to public legitimacy.",
    modifiers: { environment: 8, economy: -1 }
  },
  {
    id: "falling_petal_culture",
    label: "The Falling Petal",
    description:
      "A cultural reverence for impermanence: the brief bloom, the autumn leaf, the moment that passes before it can be captured. Citizens raised in this tradition accept change as the only constant and find beauty in what cannot last.",
    modifiers: { stability: 3, liberty: 2, environment: 3 }
  },
  {
    id: "butala_accord",
    label: "Butala Accord",
    description:
      "A landmark compact guaranteeing women's representation in civic councils and inheritance courts. Named for the jurist who drafted it.",
    modifiers: { publicTrust: 4, liberty: 2, stability: 1 }
  }
];

export const EMBLEM_OPTIONS = [
  "Star",
  "Sun",
  "Eagle",
  "Gear",
  "Anchor",
  "Wheat",
  "Mountain",
  "Shield",
  "Torch",
  "Wave",
  "Book",
  "Crown"
] as const;

export const STARTING_PACKAGES: StartingPackageDefinition[] = [
  {
    id: "balanced_republic",
    label: "Balanced Republic",
    description: "A flexible young republic with modest institutions.",
    modifiers: {},
    economyProfile: {
      treasury: 1100,
      population: 590000,
      industrialCapacity: 50,
      administrativeCapacity: 55,
      resources: { FOOD: 700, IRON: 180, OIL: 100, RARE_EARTH: 40, TIMBER: 260, FISH: 120, ENERGY: 320 }
    },
    locations: [
      { key: "capital", name: "Capital City", type: "CAPITAL", x: 5, y: 4, population: 500000, developmentLevel: 4 },
      { key: "town", name: "Market Town", type: "TOWN", x: 7, y: 5, population: 60000, developmentLevel: 2 },
      {
        key: "farm",
        name: "Central Farms",
        type: "FARM",
        x: 4,
        y: 7,
        resourceType: "FOOD",
        population: 30000,
        developmentLevel: 2
      }
    ],
    agents: [
      {
        key: "head",
        name: "Head of State",
        role: "HEAD_OF_STATE",
        assignment: "SPEAKING",
        assignedLocationKey: "capital",
        traits: [],
        skills: [{ name: "Leadership", level: 1, xp: 0 }]
      },
      {
        key: "governor",
        name: "Provincial Governor",
        role: "GOVERNOR",
        assignment: "GOVERNING",
        assignedLocationKey: "town",
        traits: [],
        skills: [{ name: "Governance", level: 1, xp: 0 }]
      }
    ],
    militaryUnits: [
      {
        key: "infantry",
        name: "1st Infantry Brigade",
        type: "INFANTRY",
        strength: 55,
        movement: 3,
        experience: 0,
        locationKey: "capital"
      }
    ]
  },
  {
    id: "industrial_power",
    label: "Industrial Power",
    description: "A factory-heavy nation with strong production but environmental pressure.",
    modifiers: { economy: 8, technology: 3, environment: -6 },
    economyProfile: {
      treasury: 1200,
      population: 842000,
      industrialCapacity: 70,
      administrativeCapacity: 50,
      resources: { FOOD: 550, IRON: 350, OIL: 220, RARE_EARTH: 80, TIMBER: 240, FISH: 80, ENERGY: 600 }
    },
    locations: [
      {
        key: "capital",
        name: "Industrial Capital",
        type: "CAPITAL",
        x: 5,
        y: 4,
        population: 700000,
        developmentLevel: 4
      },
      {
        key: "mine",
        name: "Iron Mine",
        type: "MINE",
        x: 3,
        y: 3,
        resourceType: "IRON",
        population: 22000,
        developmentLevel: 3
      },
      { key: "town", name: "Industrial Town", type: "TOWN", x: 6, y: 6, population: 120000, developmentLevel: 3 },
      { key: "base", name: "Military Base", type: "MILITARY_BASE", x: 4, y: 7, developmentLevel: 2 }
    ],
    agents: [
      {
        key: "head",
        name: "Head of State",
        role: "HEAD_OF_STATE",
        assignment: "SPEAKING",
        assignedLocationKey: "capital",
        traits: [],
        skills: [{ name: "Leadership", level: 1, xp: 0 }]
      },
      {
        key: "general",
        name: "General",
        role: "GENERAL",
        assignment: "COMMANDING",
        assignedLocationKey: "base",
        traits: [],
        skills: [{ name: "Command", level: 1, xp: 0 }]
      }
    ],
    militaryUnits: [
      {
        key: "infantry",
        name: "Infantry Brigade",
        type: "INFANTRY",
        strength: 62,
        movement: 3,
        experience: 5,
        locationKey: "base",
        commanderAgentKey: "general"
      },
      {
        key: "armor",
        name: "Armored Battalion",
        type: "ARMOR",
        strength: 68,
        movement: 4,
        experience: 5,
        locationKey: "base",
        commanderAgentKey: "general"
      }
    ]
  },
  {
    id: "maritime_trader",
    label: "Maritime Trader",
    description: "A coastal nation built on ports, commerce, and naval patrols.",
    modifiers: { economy: 6, publicTrust: 2, military: 2 },
    economyProfile: {
      treasury: 1300,
      population: 720000,
      industrialCapacity: 50,
      administrativeCapacity: 60,
      resources: { FOOD: 600, IRON: 160, OIL: 120, RARE_EARTH: 50, TIMBER: 280, FISH: 450, ENERGY: 340 }
    },
    locations: [
      { key: "capital", name: "Coastal Capital", type: "CAPITAL", x: 5, y: 4, population: 540000, developmentLevel: 4 },
      {
        key: "port",
        name: "Main Port",
        type: "PORT",
        x: 8,
        y: 5,
        resourceType: "FISH",
        population: 110000,
        developmentLevel: 3
      },
      { key: "town", name: "Harbor Town", type: "TOWN", x: 7, y: 7, population: 70000, developmentLevel: 2 }
    ],
    agents: [
      {
        key: "head",
        name: "Head of State",
        role: "HEAD_OF_STATE",
        assignment: "SPEAKING",
        assignedLocationKey: "capital",
        traits: [],
        skills: [{ name: "Leadership", level: 1, xp: 0 }]
      },
      {
        key: "trade",
        name: "Trade Minister",
        role: "TRADE_MINISTER",
        assignment: "GOVERNING",
        assignedLocationKey: "port",
        traits: [],
        skills: [{ name: "Commerce", level: 1, xp: 0 }]
      }
    ],
    militaryUnits: [
      {
        key: "patrol",
        name: "Coastal Patrol",
        type: "NAVAL",
        strength: 50,
        movement: 5,
        experience: 0,
        locationKey: "port",
        commanderAgentKey: "trade"
      }
    ]
  },
  {
    id: "agrarian_federation",
    label: "Agrarian Federation",
    description: "A rural federation with stable communities and food security.",
    modifiers: { stability: 6, environment: 5, economy: 2, technology: -2 },
    economyProfile: {
      treasury: 1000,
      population: 464000,
      industrialCapacity: 40,
      administrativeCapacity: 55,
      resources: { FOOD: 1100, IRON: 140, OIL: 80, RARE_EARTH: 30, TIMBER: 340, FISH: 100, ENERGY: 300 }
    },
    locations: [
      { key: "capital", name: "Federal Capital", type: "CAPITAL", x: 5, y: 4, population: 350000, developmentLevel: 3 },
      {
        key: "farm_a",
        name: "North Farms",
        type: "FARM",
        x: 3,
        y: 6,
        resourceType: "FOOD",
        population: 26000,
        developmentLevel: 3
      },
      {
        key: "farm_b",
        name: "River Farms",
        type: "FARM",
        x: 7,
        y: 7,
        resourceType: "FOOD",
        population: 33000,
        developmentLevel: 3
      },
      { key: "town", name: "County Town", type: "TOWN", x: 6, y: 5, population: 55000, developmentLevel: 2 }
    ],
    agents: [
      {
        key: "head",
        name: "Head of State",
        role: "HEAD_OF_STATE",
        assignment: "SPEAKING",
        assignedLocationKey: "capital",
        traits: [],
        skills: [{ name: "Leadership", level: 1, xp: 0 }]
      },
      {
        key: "governor",
        name: "Governor",
        role: "GOVERNOR",
        assignment: "GOVERNING",
        assignedLocationKey: "town",
        traits: [],
        skills: [{ name: "Governance", level: 1, xp: 0 }]
      }
    ],
    militaryUnits: [
      {
        key: "infantry",
        name: "Infantry Brigade",
        type: "INFANTRY",
        strength: 52,
        movement: 3,
        experience: 0,
        locationKey: "capital"
      }
    ]
  },
  {
    id: "frontier_command",
    label: "Frontier Command",
    description: "A hardened border nation with strong defense and low initial trust.",
    modifiers: { military: 8, stability: 2, publicTrust: -3, liberty: -2 },
    economyProfile: {
      treasury: 1050,
      population: 486000,
      industrialCapacity: 55,
      administrativeCapacity: 50,
      resources: { FOOD: 650, IRON: 360, OIL: 240, RARE_EARTH: 40, TIMBER: 260, FISH: 60, ENERGY: 450 }
    },
    locations: [
      { key: "capital", name: "Command Capital", type: "CAPITAL", x: 5, y: 4, population: 420000, developmentLevel: 3 },
      { key: "base", name: "Border Base", type: "MILITARY_BASE", x: 3, y: 6, developmentLevel: 3 },
      {
        key: "mine",
        name: "Frontier Mine",
        type: "MINE",
        x: 2,
        y: 3,
        resourceType: "IRON",
        population: 18000,
        developmentLevel: 2
      },
      { key: "town", name: "Outpost Town", type: "TOWN", x: 7, y: 5, population: 48000, developmentLevel: 2 }
    ],
    agents: [
      {
        key: "head",
        name: "Head of State",
        role: "HEAD_OF_STATE",
        assignment: "SPEAKING",
        assignedLocationKey: "capital",
        traits: [],
        skills: [{ name: "Leadership", level: 1, xp: 0 }]
      },
      {
        key: "general",
        name: "General",
        role: "GENERAL",
        assignment: "COMMANDING",
        assignedLocationKey: "base",
        traits: [],
        skills: [{ name: "Command", level: 1, xp: 0 }]
      }
    ],
    militaryUnits: [
      {
        key: "infantry",
        name: "Infantry Brigade",
        type: "INFANTRY",
        strength: 64,
        movement: 3,
        experience: 5,
        locationKey: "base",
        commanderAgentKey: "general"
      },
      {
        key: "recon",
        name: "Recon Detachment",
        type: "RECON",
        strength: 42,
        movement: 5,
        experience: 5,
        locationKey: "town",
        commanderAgentKey: "general"
      }
    ]
  },
  {
    id: "research_compact",
    label: "Research Compact",
    description: "A compact, educated nation built around universities and laboratories.",
    modifiers: { technology: 10, economy: 2, stability: -2 },
    economyProfile: {
      treasury: 1150,
      population: 487000,
      industrialCapacity: 60,
      administrativeCapacity: 70,
      resources: { FOOD: 600, IRON: 160, OIL: 100, RARE_EARTH: 220, TIMBER: 180, FISH: 80, ENERGY: 600 }
    },
    locations: [
      {
        key: "capital",
        name: "Research Capital",
        type: "CAPITAL",
        x: 5,
        y: 4,
        population: 390000,
        developmentLevel: 4
      },
      { key: "town", name: "Research Town", type: "TOWN", x: 7, y: 4, population: 85000, developmentLevel: 3 },
      {
        key: "resource",
        name: "Rare Materials Site",
        type: "RESOURCE_SITE",
        x: 3,
        y: 7,
        resourceType: "RARE_EARTH",
        population: 12000,
        developmentLevel: 2
      }
    ],
    agents: [
      {
        key: "head",
        name: "Head of State",
        role: "HEAD_OF_STATE",
        assignment: "SPEAKING",
        assignedLocationKey: "capital",
        traits: [],
        skills: [{ name: "Leadership", level: 1, xp: 0 }]
      },
      {
        key: "scientist",
        name: "Scientific Advisor",
        role: "SCIENTIST_ADVISOR",
        assignment: "IMPROVING",
        assignedLocationKey: "town",
        traits: [],
        skills: [{ name: "Research", level: 1, xp: 0 }]
      }
    ],
    militaryUnits: [
      {
        key: "infantry",
        name: "Security Infantry Unit",
        type: "INFANTRY",
        strength: 46,
        movement: 3,
        experience: 0,
        locationKey: "capital"
      }
    ]
  }
];
