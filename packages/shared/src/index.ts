export type ID = string;
export type DateString = string;

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

export type NationPostType =
  | "NEWS"
  | "SPEECH"
  | "GOVERNMENT_UPDATE"
  | "IMAGE"
  | "VIDEO";

export type PostVisibility = "PUBLIC" | "PRIVATE" | "DRAFT";

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

export type LocationType =
  | "CAPITAL"
  | "CITY"
  | "TOWN"
  | "PORT"
  | "MILITARY_BASE"
  | "MINE"
  | "FARM"
  | "RESOURCE_SITE";

export type ResourceType =
  | "FOOD"
  | "IRON"
  | "OIL"
  | "RARE_EARTH"
  | "TIMBER"
  | "FISH"
  | "ENERGY";

export type AgentRole =
  | "HEAD_OF_STATE"
  | "GENERAL"
  | "GOVERNOR"
  | "DIPLOMAT"
  | "ENGINEER"
  | "INTELLIGENCE"
  | "TRADE_MINISTER"
  | "SCIENTIST_ADVISOR";

export type AgentAssignment =
  | "IDLE"
  | "GOVERNING"
  | "COMMANDING"
  | "GUARDING"
  | "SPEAKING"
  | "IMPROVING";

export type MilitaryUnitType =
  | "INFANTRY"
  | "ARMOR"
  | "NAVAL"
  | "AIR"
  | "ARTILLERY"
  | "SUPPORT"
  | "RECON";

export type NationStatKey =
  | "economy"
  | "stability"
  | "liberty"
  | "authority"
  | "military"
  | "technology"
  | "environment"
  | "publicTrust";

export type StatModifier = Partial<Record<NationStatKey, number>>;

export type IdeologyAxisKey =
  | "authorityLiberty"
  | "collectivismIndividualism"
  | "militarismPacifism"
  | "traditionProgress"
  | "ecologyIndustry";

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
  locations: StartingLocationPreview[];
  agents: StartingAgentPreview[];
  militaryUnits: StartingMilitaryUnitPreview[];
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
  mediaUrl?: string | null;
  visibility: PostVisibility;
  createdAt: DateString;
  updatedAt: DateString;
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
  agentXpChanges?: Array<{ role?: AgentRole; assignedLocationType?: LocationType; amount: number }>;
  agentLoyaltyChanges?: Array<{ role?: AgentRole; assignedLocationType?: LocationType; amount: number }>;
  locationDevelopmentChanges?: Array<{ locationType?: LocationType; amount: number }>;
  militaryExperienceChanges?: Array<{ unitType?: MilitaryUnitType; amount: number }>;
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
  eventTemplate?: EventTemplate;
  generatedTurn?: number;
  expiresTurn?: number | null;
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
  createdAt: DateString;
  updatedAt: DateString;
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
  locationId?: ID | null;
  commanderAgentId?: ID | null;
  createdAt: DateString;
  updatedAt: DateString;
}

export interface DemoState {
  nation: Nation;
  stats: NationStats | null;
  posts: NationPost[];
  activeEvents: ActiveEvent[];
  mapLocations: MapLocation[];
  agents: CharacterAgent[];
  militaryUnits: MilitaryUnit[];
}

export const GOVERNMENT_TYPE_OPTIONS: SelectOption<GovernmentType>[] = [
  { value: "DEMOCRATIC_REPUBLIC", label: "Democratic Republic", description: "Elected civic institutions with broad public participation." },
  { value: "CONSTITUTIONAL_MONARCHY", label: "Constitutional Monarchy", description: "A ceremonial crown balanced by modern constitutional rule." },
  { value: "FEDERAL_UNION", label: "Federal Union", description: "Regional governments share power with a central state." },
  { value: "SOCIALIST_REPUBLIC", label: "Socialist Republic", description: "Public planning and labor institutions shape national policy." },
  { value: "TECHNOCRACY", label: "Technocracy", description: "Expert councils and technical agencies direct major decisions." },
  { value: "MILITARY_DIRECTORATE", label: "Military Directorate", description: "Command structures and security councils dominate governance." },
  { value: "THEOCRACY", label: "Theocracy", description: "Spiritual institutions hold formal political authority." },
  { value: "CORPORATE_STATE", label: "Corporate State", description: "Powerful economic syndicates are built into the state." },
  { value: "TRIBAL_CONFEDERATION", label: "Tribal Confederation", description: "Clans, tribes, or houses govern through confederated councils." },
  { value: "CITY_STATE_LEAGUE", label: "City-State League", description: "Urban republics coordinate through compact and treaty." }
];

export const ECONOMY_TYPE_OPTIONS: SelectOption<EconomyType>[] = [
  { value: "MIXED_MARKET", label: "Mixed Market", description: "Private markets and public services operate side by side." },
  { value: "PLANNED_ECONOMY", label: "Planned Economy", description: "Central plans prioritize stability and strategic output." },
  { value: "FREE_MARKET", label: "Free Market", description: "Low intervention and private enterprise drive growth." },
  { value: "RESOURCE_EXTRACTION", label: "Resource Extraction", description: "Mines, wells, and raw materials dominate national income." },
  { value: "AGRARIAN", label: "Agrarian", description: "Farms, cooperatives, and rural towns anchor the economy." },
  { value: "INDUSTRIAL", label: "Industrial", description: "Factories, rail, and heavy production define national strength." },
  { value: "POST_INDUSTRIAL", label: "Post-Industrial", description: "Services, design, education, and finance lead the economy." },
  { value: "COMMAND_ECONOMY", label: "Command Economy", description: "The state directs production through authority and quotas." },
  { value: "TRADE_BASED", label: "Trade Based", description: "Ports, shipping, and finance connect the nation to the world." },
  { value: "TECHNOLOGICAL", label: "Technological", description: "Labs, universities, and startups drive national output." }
];

export const FOUNDING_ORIGIN_OPTIONS: SelectOption<FoundingOrigin>[] = [
  { value: "OLD_KINGDOM", label: "Old Kingdom", description: "A long-lived polity with deep institutions and old families." },
  { value: "REVOLUTIONARY_REPUBLIC", label: "Revolutionary Republic", description: "Founded by revolt, reform, or liberation." },
  { value: "COLONIAL_SUCCESSOR", label: "Colonial Successor", description: "A state shaped by independence from outside rule." },
  { value: "FRONTIER_SETTLEMENT", label: "Frontier Settlement", description: "A hard-built society at the edge of settled territory." },
  { value: "MERCHANT_LEAGUE", label: "Merchant League", description: "Commerce, ports, and guilds formed the first institutions." },
  { value: "MILITARY_JUNTA", label: "Military Junta", description: "Security forces forged the state in crisis." },
  { value: "SPIRITUAL_COMMONWEALTH", label: "Spiritual Commonwealth", description: "Shared faith or philosophy unified the early nation." },
  { value: "INDUSTRIAL_UNION", label: "Industrial Union", description: "Factories, workers, and infrastructure made the nation." },
  { value: "TECHNOCRATIC_PROJECT", label: "Technocratic Project", description: "Planners and scientists designed the state deliberately." },
  { value: "NOMADIC_CONFEDERATION", label: "Nomadic Confederation", description: "Mobile peoples or clans settled into a common polity." }
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
  { id: "martial_tradition", label: "Martial Tradition", description: "Service, discipline, and defense are honored across society.", modifiers: { military: 8, stability: 2 } },
  { id: "merchant_guilds", label: "Merchant Guilds", description: "Old trade houses and guild networks help coordinate commerce.", modifiers: { economy: 6, publicTrust: 2 } },
  { id: "scientific_establishment", label: "Scientific Establishment", description: "Universities and laboratories shape public ambition.", modifiers: { technology: 8, environment: -1 } },
  { id: "agrarian_heartland", label: "Agrarian Heartland", description: "Farming communities provide continuity and food security.", modifiers: { stability: 4, environment: 4, economy: 1 } },
  { id: "naval_heritage", label: "Naval Heritage", description: "Ports, sailors, and coastal patrols carry national prestige.", modifiers: { economy: 3, military: 3 } },
  { id: "spiritual_institutions", label: "Spiritual Institutions", description: "Temples, churches, or orders bind communities together.", modifiers: { stability: 5, liberty: -2 } },
  { id: "labor_solidarity", label: "Labor Solidarity", description: "Organized labor remains a core political and cultural force.", modifiers: { publicTrust: 5, economy: 2 } },
  { id: "frontier_settlers", label: "Frontier Settlers", description: "Self-reliant towns prize toughness and expansion.", modifiers: { stability: -1, economy: 3, military: 2 } },
  { id: "cosmopolitan_cities", label: "Cosmopolitan Cities", description: "Dense cities attract talent, debate, and cultural exchange.", modifiers: { technology: 3, liberty: 3, publicTrust: 1 } },
  { id: "ancient_nobility", label: "Ancient Nobility", description: "Old houses still shape legitimacy and elite politics.", modifiers: { stability: 3, authority: 4, liberty: -3 } },
  { id: "revolutionary_memory", label: "Revolutionary Memory", description: "The founding struggle remains a civic myth and warning.", modifiers: { liberty: 4, publicTrust: 4, stability: -2 } },
  { id: "environmental_stewardship", label: "Environmental Stewardship", description: "Protecting land and water is central to public legitimacy.", modifiers: { environment: 8, economy: -1 } },
  { id: "falling_petal_culture", label: "The Falling Petal", description: "A cultural reverence for impermanence: the brief bloom, the autumn leaf, the moment that passes before it can be captured. Citizens raised in this tradition accept change as the only constant and find beauty in what cannot last.", modifiers: { stability: 3, liberty: 2, environment: 3 } },
  { id: "butala_accord", label: "Butala Accord", description: "A landmark compact guaranteeing women's representation in civic councils and inheritance courts. Named for the jurist who drafted it.", modifiers: { publicTrust: 4, liberty: 2, stability: 1 } }
];

export const EMBLEM_OPTIONS = ["Star", "Sun", "Eagle", "Gear", "Anchor", "Wheat", "Mountain", "Shield", "Torch", "Wave", "Book", "Crown"] as const;

export const STARTING_PACKAGES: StartingPackageDefinition[] = [
  {
    id: "balanced_republic",
    label: "Balanced Republic",
    description: "A flexible young republic with modest institutions.",
    modifiers: {},
    locations: [
      { key: "capital", name: "Capital City", type: "CAPITAL", x: 5, y: 4, population: 500000, developmentLevel: 4 },
      { key: "town", name: "Market Town", type: "TOWN", x: 7, y: 5, population: 60000, developmentLevel: 2 },
      { key: "farm", name: "Central Farms", type: "FARM", x: 4, y: 7, resourceType: "FOOD", population: 30000, developmentLevel: 2 }
    ],
    agents: [
      { key: "head", name: "Head of State", role: "HEAD_OF_STATE", assignment: "SPEAKING", assignedLocationKey: "capital", traits: [], skills: [{ name: "Leadership", level: 1, xp: 0 }] },
      { key: "governor", name: "Provincial Governor", role: "GOVERNOR", assignment: "GOVERNING", assignedLocationKey: "town", traits: [], skills: [{ name: "Governance", level: 1, xp: 0 }] }
    ],
    militaryUnits: [
      { key: "infantry", name: "1st Infantry Brigade", type: "INFANTRY", strength: 55, movement: 3, experience: 0, locationKey: "capital" }
    ]
  },
  {
    id: "industrial_power",
    label: "Industrial Power",
    description: "A factory-heavy nation with strong production but environmental pressure.",
    modifiers: { economy: 8, technology: 3, environment: -6 },
    locations: [
      { key: "capital", name: "Industrial Capital", type: "CAPITAL", x: 5, y: 4, population: 700000, developmentLevel: 4 },
      { key: "mine", name: "Iron Mine", type: "MINE", x: 3, y: 3, resourceType: "IRON", population: 22000, developmentLevel: 3 },
      { key: "town", name: "Industrial Town", type: "TOWN", x: 6, y: 6, population: 120000, developmentLevel: 3 },
      { key: "base", name: "Military Base", type: "MILITARY_BASE", x: 4, y: 7, developmentLevel: 2 }
    ],
    agents: [
      { key: "head", name: "Head of State", role: "HEAD_OF_STATE", assignment: "SPEAKING", assignedLocationKey: "capital", traits: [], skills: [{ name: "Leadership", level: 1, xp: 0 }] },
      { key: "general", name: "General", role: "GENERAL", assignment: "COMMANDING", assignedLocationKey: "base", traits: [], skills: [{ name: "Command", level: 1, xp: 0 }] }
    ],
    militaryUnits: [
      { key: "infantry", name: "Infantry Brigade", type: "INFANTRY", strength: 62, movement: 3, experience: 5, locationKey: "base", commanderAgentKey: "general" },
      { key: "armor", name: "Armored Battalion", type: "ARMOR", strength: 68, movement: 4, experience: 5, locationKey: "base", commanderAgentKey: "general" }
    ]
  },
  {
    id: "maritime_trader",
    label: "Maritime Trader",
    description: "A coastal nation built on ports, commerce, and naval patrols.",
    modifiers: { economy: 6, publicTrust: 2, military: 2 },
    locations: [
      { key: "capital", name: "Coastal Capital", type: "CAPITAL", x: 5, y: 4, population: 540000, developmentLevel: 4 },
      { key: "port", name: "Main Port", type: "PORT", x: 8, y: 5, resourceType: "FISH", population: 110000, developmentLevel: 3 },
      { key: "town", name: "Harbor Town", type: "TOWN", x: 7, y: 7, population: 70000, developmentLevel: 2 }
    ],
    agents: [
      { key: "head", name: "Head of State", role: "HEAD_OF_STATE", assignment: "SPEAKING", assignedLocationKey: "capital", traits: [], skills: [{ name: "Leadership", level: 1, xp: 0 }] },
      { key: "trade", name: "Trade Minister", role: "TRADE_MINISTER", assignment: "IMPROVING", assignedLocationKey: "port", traits: [], skills: [{ name: "Commerce", level: 1, xp: 0 }] }
    ],
    militaryUnits: [
      { key: "patrol", name: "Coastal Patrol", type: "NAVAL", strength: 50, movement: 5, experience: 0, locationKey: "port", commanderAgentKey: "trade" }
    ]
  },
  {
    id: "agrarian_federation",
    label: "Agrarian Federation",
    description: "A rural federation with stable communities and food security.",
    modifiers: { stability: 6, environment: 5, economy: 2, technology: -2 },
    locations: [
      { key: "capital", name: "Federal Capital", type: "CAPITAL", x: 5, y: 4, population: 350000, developmentLevel: 3 },
      { key: "farm_a", name: "North Farms", type: "FARM", x: 3, y: 6, resourceType: "FOOD", population: 26000, developmentLevel: 3 },
      { key: "farm_b", name: "River Farms", type: "FARM", x: 7, y: 7, resourceType: "FOOD", population: 33000, developmentLevel: 3 },
      { key: "town", name: "County Town", type: "TOWN", x: 6, y: 5, population: 55000, developmentLevel: 2 }
    ],
    agents: [
      { key: "head", name: "Head of State", role: "HEAD_OF_STATE", assignment: "SPEAKING", assignedLocationKey: "capital", traits: [], skills: [{ name: "Leadership", level: 1, xp: 0 }] },
      { key: "governor", name: "Governor", role: "GOVERNOR", assignment: "GOVERNING", assignedLocationKey: "town", traits: [], skills: [{ name: "Governance", level: 1, xp: 0 }] }
    ],
    militaryUnits: [
      { key: "infantry", name: "Infantry Brigade", type: "INFANTRY", strength: 52, movement: 3, experience: 0, locationKey: "capital" }
    ]
  },
  {
    id: "frontier_command",
    label: "Frontier Command",
    description: "A hardened border nation with strong defense and low initial trust.",
    modifiers: { military: 8, stability: 2, publicTrust: -3, liberty: -2 },
    locations: [
      { key: "capital", name: "Command Capital", type: "CAPITAL", x: 5, y: 4, population: 420000, developmentLevel: 3 },
      { key: "base", name: "Border Base", type: "MILITARY_BASE", x: 3, y: 6, developmentLevel: 3 },
      { key: "mine", name: "Frontier Mine", type: "MINE", x: 2, y: 3, resourceType: "IRON", population: 18000, developmentLevel: 2 },
      { key: "town", name: "Outpost Town", type: "TOWN", x: 7, y: 5, population: 48000, developmentLevel: 2 }
    ],
    agents: [
      { key: "head", name: "Head of State", role: "HEAD_OF_STATE", assignment: "SPEAKING", assignedLocationKey: "capital", traits: [], skills: [{ name: "Leadership", level: 1, xp: 0 }] },
      { key: "general", name: "General", role: "GENERAL", assignment: "COMMANDING", assignedLocationKey: "base", traits: [], skills: [{ name: "Command", level: 1, xp: 0 }] }
    ],
    militaryUnits: [
      { key: "infantry", name: "Infantry Brigade", type: "INFANTRY", strength: 64, movement: 3, experience: 5, locationKey: "base", commanderAgentKey: "general" },
      { key: "recon", name: "Recon Detachment", type: "RECON", strength: 42, movement: 5, experience: 5, locationKey: "town", commanderAgentKey: "general" }
    ]
  },
  {
    id: "research_compact",
    label: "Research Compact",
    description: "A compact, educated nation built around universities and laboratories.",
    modifiers: { technology: 10, economy: 2, stability: -2 },
    locations: [
      { key: "capital", name: "Research Capital", type: "CAPITAL", x: 5, y: 4, population: 390000, developmentLevel: 4 },
      { key: "town", name: "Research Town", type: "TOWN", x: 7, y: 4, population: 85000, developmentLevel: 3 },
      { key: "resource", name: "Rare Materials Site", type: "RESOURCE_SITE", x: 3, y: 7, resourceType: "RARE_EARTH", population: 12000, developmentLevel: 2 }
    ],
    agents: [
      { key: "head", name: "Head of State", role: "HEAD_OF_STATE", assignment: "SPEAKING", assignedLocationKey: "capital", traits: [], skills: [{ name: "Leadership", level: 1, xp: 0 }] },
      { key: "scientist", name: "Scientific Advisor", role: "SCIENTIST_ADVISOR", assignment: "IMPROVING", assignedLocationKey: "town", traits: [], skills: [{ name: "Research", level: 1, xp: 0 }] }
    ],
    militaryUnits: [
      { key: "infantry", name: "Security Infantry Unit", type: "INFANTRY", strength: 46, movement: 3, experience: 0, locationKey: "capital" }
    ]
  }
];
