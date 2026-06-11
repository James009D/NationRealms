import type { EventTemplateDefinition } from "@statecraft/shared";

export const EVENT_TEMPLATES: EventTemplateDefinition[] = [
  {
    key: "industrial_pollution_crisis",
    title: "Industrial Pollution Crisis",
    description: "Residents downstream from a factory district report foul water and sick livestock.",
    category: "ENVIRONMENT",
    tags: ["industry", "pollution"],
    eligibility: { minStats: { economy: 45 }, requiredLocationTypes: ["MINE"] },
    weight: 12,
    cooldownTurns: 4,
    choices: [
      { id: "strict_orders", label: "Issue strict cleanup orders", description: "Force industry to clean up immediately.", effects: { statChanges: { environment: 7, economy: -3, publicTrust: 3 }, locationDevelopmentChanges: [{ locationType: "MINE", amount: -1 }], createNationPost: { type: "GOVERNMENT_UPDATE", title: "Pollution Cleanup Ordered", body: "The government has ordered emergency cleanup and inspections after pollution reports." } }, resultSummary: "Cleanup orders restored water quality but slowed industrial output." },
      { id: "industry_plan", label: "Negotiate an industry plan", description: "Give factories time to meet new standards.", effects: { statChanges: { environment: 3, economy: 1, publicTrust: -1 } }, resultSummary: "A negotiated plan avoided disruption, though activists called it too slow." },
      { id: "dismiss_claims", label: "Dismiss the claims", description: "Protect production and question the reports.", effects: { statChanges: { economy: 4, environment: -6, publicTrust: -5 } }, resultSummary: "Factories kept running, but public anger spread through the affected towns." }
    ]
  },
  {
    key: "veterans_demand_benefits",
    title: "Veterans Demand Benefits",
    description: "Veterans groups demand pensions, clinics, and public recognition for their service.",
    category: "MILITARY",
    tags: ["veterans", "military"],
    eligibility: { minStats: { military: 45 }, requiredMilitaryUnitTypes: ["INFANTRY"] },
    weight: 10,
    choices: [
      { id: "fund_benefits", label: "Fund a benefits program", description: "Pay for pensions and clinics.", effects: { statChanges: { publicTrust: 5, stability: 3, economy: -3 }, agentLoyaltyChanges: [{ role: "GENERAL", amount: 2 }] }, resultSummary: "Veterans praised the program and military families rallied behind the cabinet." },
      { id: "symbolic_honors", label: "Offer symbolic honors", description: "Hold ceremonies without major spending.", effects: { statChanges: { publicTrust: 1, economy: 1, military: -1 } }, resultSummary: "The ceremonies were appreciated, but veterans called them incomplete." },
      { id: "reject_demands", label: "Reject special treatment", description: "Argue that all citizens need equal services.", effects: { statChanges: { economy: 2, military: -3, publicTrust: -3 } }, resultSummary: "The treasury was relieved, but veterans groups left bitter and organized." }
    ]
  },
  {
    key: "university_funding_debate",
    title: "University Funding Debate",
    description: "University rectors request a national research fund while rural councils ask for practical schools.",
    category: "TECHNOLOGY",
    tags: ["university", "science"],
    eligibility: {},
    weight: 11,
    choices: [
      { id: "research_fund", label: "Create a research fund", description: "Back universities and laboratories.", effects: { statChanges: { technology: 6, economy: -2 }, agentXpChanges: [{ role: "SCIENTIST_ADVISOR", amount: 15 }] }, resultSummary: "The research fund attracted talent and raised national ambitions." },
      { id: "technical_schools", label: "Fund technical schools", description: "Focus on practical training across towns.", effects: { statChanges: { technology: 3, economy: 2, publicTrust: 2 } }, resultSummary: "Technical schools spread useful skills beyond the capital." },
      { id: "freeze_budget", label: "Freeze the education budget", description: "Delay both proposals.", effects: { statChanges: { economy: 2, technology: -3, publicTrust: -2 } }, resultSummary: "The budget held, but educators warned the country was falling behind." }
    ]
  },
  {
    key: "port_workers_strike",
    title: "Port Workers Strike",
    description: "Dock crews halt cargo over wages and safety rules, threatening trade revenue.",
    category: "ECONOMY",
    tags: ["port", "labor"],
    eligibility: { requiredLocationTypes: ["PORT"] },
    weight: 12,
    choices: [
      { id: "labor_compact", label: "Negotiate a labor compact", description: "Improve conditions and keep workers at the table.", effects: { statChanges: { publicTrust: 5, stability: 2, economy: -2 }, locationDevelopmentChanges: [{ locationType: "PORT", amount: 1 }], followUpEventKeys: ["dockside_reform_commission"] }, resultSummary: "The compact reopened the port and improved worker confidence." },
      { id: "emergency_orders", label: "Use emergency orders", description: "Force the port open under state authority.", effects: { statChanges: { economy: 4, authority: 3, liberty: -3, publicTrust: -4 } }, resultSummary: "Cargo moved again, but the government's methods drew sharp criticism." },
      { id: "automate_port", label: "Accelerate automation", description: "Invest in machines to reduce dependence on labor.", effects: { statChanges: { technology: 4, economy: -2, stability: -2 } }, resultSummary: "Automation began, pleasing exporters and worrying port families." }
    ]
  },
  {
    key: "mine_safety_scandal",
    title: "Mine Safety Scandal",
    description: "An inspection leak reveals ignored safety warnings at a major mine.",
    category: "PUBLIC_TRUST",
    tags: ["mine", "corruption"],
    eligibility: { requiredLocationTypes: ["MINE"] },
    weight: 10,
    choices: [
      { id: "public_inquiry", label: "Launch a public inquiry", description: "Expose negligence and punish offenders.", effects: { statChanges: { publicTrust: 5, stability: 1, economy: -2 }, createNationPost: { type: "GOVERNMENT_UPDATE", title: "Mine Safety Inquiry Opened", body: "A public inquiry will investigate safety failures at a major mine." } }, resultSummary: "The inquiry reassured citizens that the scandal would not be buried." },
      { id: "quiet_fines", label: "Issue quiet fines", description: "Punish operators without a public spectacle.", effects: { statChanges: { economy: 1, publicTrust: -2, authority: 1 } }, resultSummary: "Operators paid fines, but rumors of a coverup continued." },
      { id: "worker_control", label: "Empower worker inspectors", description: "Let miners help enforce safety.", effects: { statChanges: { publicTrust: 4, liberty: 2, economy: -1 } }, resultSummary: "Worker inspectors became local heroes and management grumbled." }
    ]
  },
  {
    key: "governor_corruption",
    title: "Governor Accused of Corruption",
    description: "A governor is accused of steering contracts to allies and punishing critics.",
    category: "AGENT",
    tags: ["corruption", "agents"],
    eligibility: { requiredAgentRoles: ["GOVERNOR"] },
    weight: 9,
    choices: [
      { id: "suspend_governor", label: "Suspend the governor", description: "Remove the official while investigators work.", effects: { statChanges: { publicTrust: 4, stability: -1 }, agentLoyaltyChanges: [{ role: "GOVERNOR", amount: -6 }] }, resultSummary: "Suspension sent a clear signal, though local allies protested." },
      { id: "defend_governor", label: "Defend the governor", description: "Call the accusations political theater.", effects: { statChanges: { authority: 2, publicTrust: -4, stability: 1 }, agentLoyaltyChanges: [{ role: "GOVERNOR", amount: 4 }] }, resultSummary: "The governor stayed loyal, but national trust took a visible hit." },
      { id: "local_audit", label: "Order a local audit", description: "Audit contracts without dramatic removals.", effects: { statChanges: { publicTrust: 2, stability: 1 } }, resultSummary: "The audit bought time and cooled the immediate crisis." }
    ]
  },
  {
    key: "border_patrol_incident",
    title: "Border Patrol Incident",
    description: "A patrol reports shots fired near a contested crossing. Rumors are moving faster than facts.",
    category: "MILITARY",
    tags: ["border", "military"],
    eligibility: { minStats: { military: 45 }, requiredMilitaryUnitTypes: ["INFANTRY"] },
    weight: 9,
    choices: [
      { id: "deescalate", label: "De-escalate publicly", description: "Call for calm and verify facts.", effects: { statChanges: { stability: 2, publicTrust: 2, military: -1 } }, resultSummary: "The agent turned to face the threat, expression calm. 'You are already —' they began, but never finished. A measured response prevented panic and kept forces disciplined." },
      { id: "reinforce", label: "Reinforce the crossing", description: "Show strength and move units to readiness.", effects: { statChanges: { military: 3, authority: 2, publicTrust: -1 }, militaryExperienceChanges: [{ unitType: "INFANTRY", amount: 5 }] }, resultSummary: "Reinforcements signaled resolve, though some citizens feared escalation." },
      { id: "hide_incident", label: "Suppress the report", description: "Keep the story quiet until the facts are settled.", effects: { statChanges: { authority: 2, publicTrust: -4, stability: -1 } }, resultSummary: "The silence fed rumors and left the public suspicious." }
    ]
  },
  {
    key: "national_day_speech",
    title: "National Day Speech",
    description: "The head of state prepares a major speech for National Day.",
    category: "ROLEPLAY_NEWS",
    tags: ["speech"],
    eligibility: { requiredAgentRoles: ["HEAD_OF_STATE"] },
    weight: 8,
    choices: [
      { id: "unity", label: "Call for unity", description: "Emphasize shared national purpose.", effects: { statChanges: { stability: 3, publicTrust: 3 }, agentXpChanges: [{ role: "HEAD_OF_STATE", amount: 10 }], createNationPost: { type: "SPEECH", title: "National Day Address Calls for Unity", body: "The head of state used the National Day address to call for patience, service, and unity." } }, resultSummary: "The speech landed well and gave the government breathing room." },
      { id: "reform", label: "Promise reform", description: "Challenge old systems and invite change.", effects: { statChanges: { liberty: 3, technology: 1, stability: -1 }, createNationPost: { type: "SPEECH", title: "National Day Address Promises Reform", body: "The address framed reform as the nation's next great project." } }, resultSummary: "Young citizens cheered the reform message while conservatives watched warily." },
      { id: "strength", label: "Project strength", description: "Celebrate discipline, service, and readiness.", effects: { statChanges: { military: 3, authority: 2, liberty: -1 }, createNationPost: { type: "SPEECH", title: "National Day Address Projects Strength", body: "The speech praised service, discipline, and national readiness." } }, resultSummary: "The address energized security-minded citizens and unsettled civil libertarians." }
    ]
  },
  {
    key: "religious_council_petition",
    title: "Religious Council Petition",
    description: "A council of spiritual leaders petitions for influence over education and holidays.",
    category: "AUTHORITY",
    tags: ["religion"],
    eligibility: {},
    weight: 7,
    choices: [
      { id: "grant_role", label: "Grant a formal advisory role", description: "Give the council limited influence.", effects: { statChanges: { stability: 4, authority: 2, liberty: -3 } }, resultSummary: "The council gained status, and secular groups began organizing." },
      { id: "protect_secular", label: "Protect secular policy", description: "Keep state institutions independent.", effects: { statChanges: { liberty: 4, stability: -1, publicTrust: -1 } }, resultSummary: "Secular policy held, but some communities felt dismissed." },
      { id: "local_choice", label: "Let towns decide", description: "Push the issue down to local councils.", effects: { statChanges: { stability: 2, liberty: 1 } }, resultSummary: "Local discretion cooled the national dispute for now." }
    ]
  },
  {
    key: "merchant_guild_tax_dispute",
    title: "Merchant Guild Tax Dispute",
    description: "Merchant guilds threaten to withhold investment unless new taxes are softened.",
    category: "ECONOMY",
    tags: ["trade"],
    eligibility: { requiredCultureTraits: ["merchant_guilds"] },
    weight: 9,
    choices: [
      { id: "hold_line", label: "Hold the tax line", description: "Tell guilds the public budget comes first.", effects: { statChanges: { publicTrust: 4, economy: -3, authority: 1 } }, resultSummary: "Citizens liked the firmness, but guild investment slowed." },
      { id: "guild_compromise", label: "Offer targeted exemptions", description: "Trade tax relief for public commitments.", effects: { statChanges: { economy: 3, publicTrust: 1 } }, resultSummary: "A compromise kept capital moving and preserved some public benefit." },
      { id: "cut_taxes", label: "Cut the tax package", description: "Keep the guilds happy.", effects: { statChanges: { economy: 5, publicTrust: -3, liberty: 1 } }, resultSummary: "Investment surged, though critics called the state captured." }
    ]
  },
  {
    key: "rural_infrastructure_collapse",
    title: "Rural Infrastructure Collapse",
    description: "A bridge failure isolates rural districts and exposes years of deferred maintenance.",
    category: "MAP_LOCATION",
    tags: ["rural", "map"],
    eligibility: { requiredLocationTypes: ["FARM"] },
    weight: 9,
    choices: [
      { id: "emergency_repairs", label: "Fund emergency repairs", description: "Move money quickly and rebuild.", effects: { statChanges: { stability: 3, economy: -3, publicTrust: 2 }, locationDevelopmentChanges: [{ locationType: "FARM", amount: 1 }] }, resultSummary: "Repairs restored access and reassured rural communities." },
      { id: "local_burden", label: "Make local councils pay", description: "Require local matching funds.", effects: { statChanges: { economy: 1, publicTrust: -3, stability: -1 } }, resultSummary: "The treasury saved money, but rural leaders felt abandoned." },
      { id: "national_program", label: "Launch a rural works program", description: "Turn the collapse into a national plan.", effects: { statChanges: { stability: 4, publicTrust: 3, economy: -4 } }, resultSummary: "The works program became a symbol of rural renewal." }
    ]
  },
  {
    key: "military_parade_controversy",
    title: "Military Parade Controversy",
    description: "Commanders request a large parade through the capital. Civil groups call it intimidation.",
    category: "LIBERTY",
    tags: ["parade", "military"],
    eligibility: { minStats: { military: 50 } },
    weight: 8,
    choices: [
      { id: "full_parade", label: "Approve the full parade", description: "Show national strength.", effects: { statChanges: { military: 3, authority: 2, liberty: -2, publicTrust: -1 }, militaryExperienceChanges: [{ amount: 2 }] }, resultSummary: "The parade impressed supporters and worried civil society." },
      { id: "service_day", label: "Turn it into a service day", description: "Pair military honors with public service.", effects: { statChanges: { publicTrust: 3, stability: 2, military: 1 } }, resultSummary: "The compromise honored soldiers without dominating the capital." },
      { id: "cancel", label: "Cancel the parade", description: "Avoid militarized spectacle.", effects: { statChanges: { liberty: 2, military: -2, publicTrust: 1 } }, resultSummary: "Civil groups welcomed the decision; commanders were displeased." }
    ]
  },
  {
    key: "scientists_request_autonomy",
    title: "Scientists Request Autonomy",
    description: "Research institutes ask for legal autonomy from political interference.",
    category: "TECHNOLOGY",
    tags: ["science"],
    eligibility: { minStats: { technology: 50 } },
    weight: 8,
    choices: [
      { id: "grant_autonomy", label: "Grant autonomy", description: "Let institutes govern research priorities.", effects: { statChanges: { technology: 6, liberty: 2, authority: -2 }, agentXpChanges: [{ role: "SCIENTIST_ADVISOR", amount: 15 }] }, resultSummary: "Research leaders celebrated the new charter." },
      { id: "state_priorities", label: "Tie funding to state priorities", description: "Keep research aligned with national plans.", effects: { statChanges: { technology: 3, authority: 2, publicTrust: -1 } }, resultSummary: "Research continued, but some scientists worried about political tests." },
      { id: "security_review", label: "Launch a security review", description: "Audit sensitive labs first.", effects: { statChanges: { authority: 2, technology: -1, military: 1 } }, resultSummary: "The review delayed reforms and pleased security officials." }
    ]
  },
  {
    key: "environmental_sanctuary_proposal",
    title: "Environmental Sanctuary Proposal",
    description: "Activists propose a protected sanctuary around a fragile ecosystem.",
    category: "ENVIRONMENT",
    tags: ["sanctuary"],
    eligibility: { maxStats: { environment: 70 } },
    weight: 8,
    choices: [
      { id: "approve_sanctuary", label: "Approve the sanctuary", description: "Protect the land and limit extraction.", effects: { statChanges: { environment: 7, economy: -2, publicTrust: 2 } }, resultSummary: "The sanctuary became a public symbol of stewardship." },
      { id: "mixed_use", label: "Create a mixed-use zone", description: "Allow limited production under strict rules.", effects: { statChanges: { environment: 3, economy: 1 } }, resultSummary: "The mixed-use plan satisfied moderates and angered purists on both sides." },
      { id: "reject", label: "Reject the proposal", description: "Keep the area open for development.", effects: { statChanges: { economy: 3, environment: -4, publicTrust: -2 } }, resultSummary: "Development interests won, and environmental groups vowed to continue." }
    ]
  },
  {
    key: "black_market_arms_rumors",
    title: "Black Market Arms Rumors",
    description: "Security officials report rumors that military supplies are leaking into criminal markets.",
    category: "SECURITY",
    tags: ["black_market", "military"],
    eligibility: { minStats: { military: 45 } },
    weight: 8,
    choices: [
      { id: "audit_armories", label: "Audit the armories", description: "Trace weapons and punish theft.", effects: { statChanges: { publicTrust: 3, military: -1, stability: 1 } }, resultSummary: "The audit found gaps and restored some confidence." },
      { id: "expand_police", label: "Expand security powers", description: "Give investigators broad authority.", effects: { statChanges: { authority: 4, liberty: -4, stability: 2 } }, resultSummary: "Security agencies moved quickly, raising civil liberty concerns." },
      { id: "deny_rumors", label: "Deny the rumors", description: "Avoid panic and protect the military's reputation.", effects: { statChanges: { military: 1, publicTrust: -4, stability: -2 } }, resultSummary: "The denial failed to stop rumors and deepened suspicion." }
    ]
  },
  {
    key: "city_housing_shortage",
    title: "City Housing Shortage",
    description: "Rents surge in a growing city, forcing workers farther from jobs.",
    category: "STABILITY",
    tags: ["housing"],
    eligibility: { requiredLocationTypes: ["CAPITAL"] },
    weight: 10,
    choices: [
      { id: "public_housing", label: "Build public housing", description: "Spend heavily to stabilize rents.", effects: { statChanges: { stability: 4, publicTrust: 4, economy: -3 }, locationDevelopmentChanges: [{ locationType: "CAPITAL", amount: 1 }] }, resultSummary: "New housing plans gave city residents hope." },
      { id: "developer_incentives", label: "Offer developer incentives", description: "Use market tools to increase supply.", effects: { statChanges: { economy: 3, stability: 1, publicTrust: -1 } }, resultSummary: "Developers responded quickly, but affordability remained disputed." },
      { id: "rent_controls", label: "Impose rent controls", description: "Protect tenants with strict limits.", effects: { statChanges: { publicTrust: 3, liberty: -1, economy: -2 } }, resultSummary: "Tenants cheered while landlords warned of shortages." }
    ]
  },
  {
    key: "farmers_demand_subsidies",
    title: "Farmers Demand Subsidies",
    description: "Farmers warn that bad weather and fuel costs threaten the harvest.",
    category: "ECONOMY",
    tags: ["farmers", "rural"],
    eligibility: { requiredLocationTypes: ["FARM"] },
    weight: 10,
    choices: [
      { id: "subsidies", label: "Approve subsidies", description: "Protect farmers and food supply.", effects: { statChanges: { stability: 4, publicTrust: 2, economy: -2 }, locationDevelopmentChanges: [{ locationType: "FARM", amount: 1 }] }, resultSummary: "Subsidies steadied farm communities before planting season." },
      { id: "loans", label: "Offer low-interest loans", description: "Help farmers without direct grants.", effects: { statChanges: { stability: 2, economy: -1 } }, resultSummary: "Loans helped some farms but left the smallest producers exposed." },
      { id: "market_prices", label: "Let markets adjust", description: "Avoid intervention.", effects: { statChanges: { economy: 2, stability: -3, publicTrust: -2 } }, resultSummary: "The state saved money while rural frustration rose." }
    ]
  },
  {
    key: "intelligence_service_expansion",
    title: "Intelligence Service Expansion",
    description: "Security officials request new surveillance authority to track extremist networks.",
    category: "AUTHORITY",
    tags: ["intelligence", "advent"],
    eligibility: { maxStats: { authority: 75 } },
    weight: 8,
    choices: [
      { id: "approve_powers", label: "Approve new powers", description: "Expand surveillance and analysis.", effects: { statChanges: { authority: 5, stability: 2, liberty: -5 } }, resultSummary: "The intelligence service gained reach, and watchdogs sounded alarms." },
      { id: "court_warrants", label: "Require court warrants", description: "Permit expansion with oversight.", effects: { statChanges: { stability: 2, authority: 1, liberty: -1, publicTrust: 2 } }, resultSummary: "Oversight made the expansion easier for the public to accept." },
      { id: "reject_expansion", label: "Reject expansion", description: "Protect civil liberties.", effects: { statChanges: { liberty: 4, authority: -2, stability: -1 } }, resultSummary: "Civil libertarians celebrated while security officials warned of gaps." }
    ]
  },
  {
    key: "youth_reform_movement",
    title: "Youth Reform Movement",
    description: "Student organizers demand electoral reform, open data, and a louder public voice.",
    category: "LIBERTY",
    tags: ["youth"],
    eligibility: { minStats: { liberty: 45 } },
    weight: 9,
    choices: [
      { id: "invite_youth", label: "Invite youth delegates", description: "Bring organizers into reform talks.", effects: { statChanges: { liberty: 4, publicTrust: 4, stability: -1 } }, resultSummary: "Youth delegates entered the halls of power and claimed a first victory." },
      { id: "slow_committee", label: "Create a slow committee", description: "Study the demands without immediate change.", effects: { statChanges: { stability: 1, publicTrust: -2 } }, resultSummary: "The committee bought time and disappointed the movement." },
      { id: "crack_down", label: "Crack down on protests", description: "Clear occupations and restore order.", effects: { statChanges: { authority: 4, stability: -2, liberty: -5, publicTrust: -4 } }, resultSummary: "The streets quieted, but anger moved underground." }
    ]
  },
  {
    key: "ancient_nobility_privileges",
    title: "Ancient Nobility Claims Privileges",
    description: "Old noble houses claim historic rights over land appointments and ceremonial offices.",
    category: "CULTURE",
    tags: ["nobility"],
    eligibility: { requiredCultureTraits: ["ancient_nobility"] },
    weight: 8,
    choices: [
      { id: "recognize_titles", label: "Recognize limited titles", description: "Honor heritage without restoring hard power.", effects: { statChanges: { stability: 3, authority: 1, liberty: -1 } }, resultSummary: "The compromise pleased traditionalists and kept formal power limited." },
      { id: "abolish_claims", label: "Abolish the claims", description: "Declare old privileges void.", effects: { statChanges: { liberty: 4, stability: -3, publicTrust: 1 } }, resultSummary: "Reformers cheered while noble families prepared a legal fight." },
      { id: "restore_privileges", label: "Restore privileges", description: "Lean into hierarchy and continuity.", effects: { statChanges: { authority: 5, stability: 2, liberty: -5, publicTrust: -2 } }, resultSummary: "Old houses returned to prominence, dividing the nation sharply." }
    ]
  },
  {
    key: "dockside_reform_commission",
    title: "Dockside Reform Commission",
    description: "After the labor compact, a joint commission of unions and shippers proposes lasting port reforms.",
    category: "ECONOMY",
    tags: ["port", "labor"],
    eligibility: { requiredLocationTypes: ["PORT"] },
    weight: 6,
    choices: [
      { id: "adopt_reforms", label: "Adopt the reforms", description: "Codify safety rules and wage boards.", effects: { statChanges: { stability: 3, publicTrust: 3, economy: -1 }, createNationPost: { type: "GOVERNMENT_UPDATE", title: "Port Reforms Adopted", body: "The dockside commission's reforms became law, locking in the labor compact's gains." } }, resultSummary: "The reforms made the compact permanent and steadied the waterfront." },
      { id: "shelve_report", label: "Shelve the report", description: "Thank the commission and move on.", effects: { statChanges: { economy: 1, publicTrust: -2 } }, resultSummary: "The report gathered dust and dock crews took note." }
    ]
  },
  {
    key: "transmission_grid_surge",
    title: "Transmission Grid Overload",
    description: "A cascade failure trips three substations during peak demand. Districts go dark as overloaded lines shut down across the region.",
    category: "STABILITY",
    tags: ["infrastructure", "energy"],
    eligibility: { minStats: { technology: 45 }, requiredLocationTypes: ["CAPITAL"] },
    weight: 8,
    choices: [
      { id: "emergency_grid_repair", label: "Fund emergency repairs", description: "Restore power at any cost.", effects: { statChanges: { stability: 3, economy: -3 }, locationDevelopmentChanges: [{ locationType: "CAPITAL", amount: 1 }] }, resultSummary: "Power returned quickly and engineers began hardening the grid." },
      { id: "rolling_blackouts", label: "Institute rolling blackouts", description: "Conserve until repairs complete.", effects: { statChanges: { stability: -1, economy: -1, publicTrust: -2 } }, resultSummary: "The capital limped through blackouts while work crews raced the clock." },
      { id: "blame_district", label: "Blame the district engineers", description: "Scapegoat local management.", effects: { statChanges: { authority: 1, publicTrust: -3, stability: -2 } }, resultSummary: "The cabinet deflected blame, but residents called it cowardly." }
    ]
  },
  {
    key: "the_deep_warrens",
    title: "Creatures in the Lower Tunnels",
    description: "Miners in the deepest shafts report chittering sounds and glimpses of pale, many-legged creatures the size of hounds. Three workers are missing. The foreman sealed the lower level with a blast door, but scratching can still be heard from below.",
    category: "MAP_LOCATION",
    tags: ["mine", "security"],
    eligibility: { requiredLocationTypes: ["MINE"], minStats: { military: 35 } },
    weight: 9,
    choices: [
      { id: "exterminate", label: "Send troops to clear the tunnels", description: "Burn them out before they spread.", effects: { statChanges: { stability: 3, publicTrust: 2, economy: -1, military: 1 }, militaryExperienceChanges: [{ unitType: "INFANTRY", amount: 10 }], locationDevelopmentChanges: [{ locationType: "MINE", amount: -1 }] }, resultSummary: "Troops cleared the warrens after a brutal three-day operation. The mine's lower levels will take months to repair." },
      { id: "collapse_tunnels", label: "Collapse the lower levels", description: "Bury the threat and rebuild elsewhere.", effects: { statChanges: { stability: 2, economy: -3, publicTrust: -1 }, locationDevelopmentChanges: [{ locationType: "MINE", amount: -2 }] }, resultSummary: "The tunnels came down with a roar that shook the town. The scratching stopped. So did a third of the mine's output." },
      { id: "study_creatures", label: "Capture specimens for research", description: "Living weapons, or living resources?", effects: { statChanges: { technology: 1, publicTrust: -3, stability: -2 }, agentXpChanges: [{ role: "SCIENTIST_ADVISOR", amount: 20 }] }, resultSummary: "Scientists collected three live specimens. The foreman refused to let them near the mine again." }
    ]
  },
  {
    key: "the_forgotten_stair",
    title: "Surveyors Discover a Hidden Pass",
    description: "A mapping expedition tracing old geological surveys finds something the earlier charts missed: a narrow canyon hidden behind a deceptive rock face. Beyond it lies an uncharted valley with a lake, timber, and what appears to be a ruined structure.",
    category: "MAP_LOCATION",
    tags: ["exploration", "rural"],
    eligibility: { requiredLocationTypes: ["TOWN"], minStats: { economy: 40 } },
    weight: 7,
    choices: [
      { id: "settle_valley", label: "Establish an outpost", description: "Claim the valley before anyone else does.", effects: { statChanges: { economy: 4, stability: 1, publicTrust: 2, environment: -1 }, createNationPost: { type: "NEWS", title: "Hidden Valley Settlement Established", body: "Settlers have entered the uncharted valley, founding a new outpost on the shores of an unnamed lake." } }, resultSummary: "The first cabins went up within a month. The valley, it seemed, had been waiting." },
      { id: "preserve_valley", label: "Declare a nature preserve", description: "Some places should remain untouched.", effects: { statChanges: { environment: 6, publicTrust: 3, economy: -1 } }, resultSummary: "The valley was sealed from development. Rangers stationed at the pass report strange lights on clear nights." },
      { id: "seal_pass", label: "Seal the discovery", description: "Whatever is in that valley was hidden for a reason.", effects: { statChanges: { stability: 2, authority: 1, publicTrust: -1 } }, resultSummary: "The survey was classified. The rock face remained. But surveyors who spent the night near it described dreams of open sky where mountains should be." }
    ]
  },
  {
    key: "the_beacon_activates",
    title: "The Beacon Activates",
    description: "A device in your science advisor's workshop blinks to life with a frequency no one can identify. He apologizes and says 'they need calibration' — you've never asked who 'they' are.",
    category: "TECHNOLOGY",
    tags: ["science", "agents"],
    eligibility: { requiredAgentRoles: ["SCIENTIST_ADVISOR"] },
    weight: 8,
    choices: [
      { id: "let_him_go", label: "Let him go", description: "Trust your advisor's judgment.", effects: { statChanges: { technology: 1, publicTrust: -1 }, agentXpChanges: [{ role: "SCIENTIST_ADVISOR", amount: 10 }], followUpEventKeys: ["the_technician_returns"] }, resultSummary: "He departed within the hour. The workshop hummed quietly in his absence." },
      { id: "detain_him", label: "Detain him for questioning", description: "A device activating without explanation is a security concern.", effects: { statChanges: { authority: 2, technology: -2, stability: -1 } }, resultSummary: "He cooperated fully and answered nothing. After three days, the beacon deactivated itself." }
    ]
  },
  {
    key: "the_technician_returns",
    title: "The Technician Returns",
    description: "Your advisor returns without explanation, carrying schematics for medical devices your engineers don't fully understand. He's already at his workbench, calibrating.",
    category: "TECHNOLOGY",
    tags: ["science", "agents"],
    eligibility: {},
    weight: 0,
    choices: [
      { id: "integrate_schematics", label: "Integrate the schematics", description: "Put the new designs into production.", effects: { statChanges: { technology: 5, publicTrust: 3 }, createNationPost: { type: "GOVERNMENT_UPDATE", title: "Medical Technology Breakthrough", body: "New diagnostic equipment has been distributed to regional clinics. Officials credit 'international collaboration.' The science advisor was unavailable for comment." } }, resultSummary: "The equipment worked immediately. No one asked where it came from." },
      { id: "reverse_engineer", label: "Reverse-engineer carefully", description: "Study the designs before deploying them.", effects: { statChanges: { technology: 3, stability: 2 } }, resultSummary: "Engineers spent weeks studying the designs. Singh watched them work with a faint, knowing smile." }
    ]
  },
  {
    key: "the_calibration_request",
    title: "The Calibration Request",
    description: "Rural clinics report their diagnostic equipment failing. Your science advisor says he can calibrate them — but needs to visit each one personally, after dark, alone.",
    category: "TECHNOLOGY",
    tags: ["science", "rural"],
    eligibility: { requiredAgentRoles: ["SCIENTIST_ADVISOR"], requiredLocationTypes: ["FARM"] },
    weight: 9,
    choices: [
      { id: "authorize_visits", label: "Authorize the visits", description: "Whatever it takes to get the clinics running.", effects: { statChanges: { publicTrust: 4, technology: 3, stability: 1 }, locationDevelopmentChanges: [{ locationType: "FARM", amount: 1 }] }, resultSummary: "Every clinic reported fully functional equipment by morning. The advisor had moved through the district faster than travel times suggested possible." },
      { id: "send_engineers", label: "Send a regular engineering team", description: "Standard protocols exist for a reason.", effects: { statChanges: { technology: 1, economy: -1 } }, resultSummary: "The team fixed some units. Others they declared 'beyond standard repair.' Singh nodded and said nothing." }
    ]
  },
  {
    key: "the_gilded_ruin",
    title: "The Gilded Ruin",
    description: "Surveyors in the frontier mountains report a sealed pre-war city, its streets empty and its vaults intact after centuries. The perimeter defenses still function — a reddish haze hangs in the air at the threshold. The founder's final transmission loops from a broken tower: 'Begin again, but first you must let go.'",
    category: "TECHNOLOGY",
    tags: ["exploration", "science"],
    eligibility: { minStats: { technology: 50 } },
    weight: 6,
    choices: [
      { id: "begin_expedition", label: "Begin the expedition", description: "Breach the defenses and claim the vault.", effects: { statChanges: { technology: 6, stability: -3 }, agentXpChanges: [{ role: "SCIENTIST_ADVISOR", amount: 20 }] }, resultSummary: "The vaults opened. So did old wounds. Half the expedition returned; the other half speaks in the dead founder's voice." },
      { id: "seal_perimeter", label: "Seal the perimeter", description: "Let it go. Some doors are best left closed.", effects: { statChanges: { publicTrust: 4, stability: 2 }, createNationPost: { type: "GOVERNMENT_UPDATE", title: "Frontier Perimeter Sealed", body: "The mountain approach to the discovered pre-war city has been sealed and declared a restricted zone." } }, resultSummary: "The transmission stopped looping. No one speaks of it anymore. The haze receded." },
      { id: "study_outside", label: "Study from outside", description: "Decode the perimeter before breaching.", effects: { statChanges: { technology: 3, stability: 1 } }, resultSummary: "Researchers learned enough to know the city still holds its dead, and that its dead are not silent." }
    ]
  },
  {
    key: "the_dark_champion",
    title: "The Dark Champion",
    description: "A lone warrior in black-gleaming plate appears at the capital gates. No retinue, no demands, no banner. 'I have vanquished every foe a single life can face. There is nothing left. Send your finest. One fight. No quarter.'",
    category: "MILITARY",
    tags: ["challenge", "military", "honor"],
    eligibility: { minStats: { military: 70 }, requiredAgentRoles: ["GENERAL"] },
    weight: 5,
    choices: [
      { id: "accept_duel", label: "Accept the duel", description: "Send the General to meet them at dawn.", effects: { statChanges: { military: 6, authority: 3, publicTrust: 4 }, agentXpChanges: [{ role: "GENERAL", amount: 30 }], createNationPost: { type: "SPEECH", title: "Duel at Dawn: General Faces the Dark Champion", body: "The capital gathered at sunrise. The clash lasted minutes. The General returned carrying the dark armor's weight, and the city spoke of nothing else for a week." } }, resultSummary: "The duel was brief, brutal, and unforgettable. The General carried dark plate back through the gate in silence." },
      { id: "offer_place", label: "Offer a place", description: "Rest and a commission. The border posts need watchers.", effects: { statChanges: { stability: 4, publicTrust: 3 }, createNationPost: { type: "GOVERNMENT_UPDATE", title: "Dark Champion Takes Watch at Distant Pass", body: "The mysterious warrior accepted a quiet commission at a remote border post, trading the duel for a purpose." } }, resultSummary: "The dark armor now stands watch at a distant pass. Reports say the warrior sleeps for the first time in years." },
      { id: "refuse_challenge", label: "Refuse the challenge", description: "Send them away.", effects: { statChanges: { military: -2, publicTrust: -3 } }, resultSummary: "The champion walked into the mountains without looking back. Your soldiers sleep less soundly." }
    ]
  },
  {
    key: "tenka_fubu",
    title: "The Warlord's Call",
    description: "A charismatic regional commander has begun using a new phrase at rallies: 'Tenka Fubu.' Asked to explain, he says only: 'The realm will be unified under one iron will — not through treaties, not through councils, but through force applied without hesitation.'",
    category: "AUTHORITY",
    tags: ["military", "agents"],
    eligibility: { minStats: { military: 60, authority: 40 } },
    weight: 7,
    choices: [
      { id: "embrace_warlord", label: "Appoint him as a military governor", description: "Harness the energy. Channel the force.", effects: { statChanges: { military: 6, authority: 5, liberty: -5, stability: -1, publicTrust: -2 } }, resultSummary: "The warlord now commands a province. His rallies have stopped. His agents have not." },
      { id: "arrest_warlord", label: "Arrest him for sedition", description: "No one threatens the state with force.", effects: { statChanges: { stability: 1, liberty: -2, publicTrust: -3, authority: 3 } }, resultSummary: "The arrest rallied his followers. The phrase is now scrawled on walls in three cities." },
      { id: "debate_warlord", label: "Challenge him to a public debate", description: "Expose the emptiness behind the posture.", effects: { statChanges: { liberty: 3, publicTrust: 4, stability: 1, authority: -1, military: -1 } }, resultSummary: "The debate did not defeat the warlord. But it reminded citizens that words still matter." }
    ]
  },
  {
    key: "final_petition",
    title: "A Disgraced Governor's Final Petition",
    description: "A governor who failed to prevent a disaster in their province petitions the court for permission to restore their honor. The petition specifies a precise time, a precise place, and requests the presence of a witness 'of unshakable nerve.'",
    category: "AGENT",
    tags: ["agents", "nobility"],
    eligibility: { requiredAgentRoles: ["GOVERNOR"], minStats: { authority: 50 } },
    weight: 7,
    choices: [
      { id: "grant_petition", label: "Grant the petition", description: "Honor must be answered with honor.", effects: { statChanges: { authority: 3, stability: 1, publicTrust: -1 } }, resultSummary: "The ceremony was held at dawn. The witness reported that the governor met the moment with composure. A short blade and a trusted friend. The province still grieves." },
      { id: "deny_petition", label: "Deny the petition", description: "The state does not sanction self-destruction.", effects: { statChanges: { liberty: 1, publicTrust: 2, authority: -1 } }, resultSummary: "The governor was assigned to a remote watchtower. Their honor remains a matter of private corrosion." },
      { id: "commute_to_exile", label: "Commute the sentence to exile", description: "Let them live with their failure in isolation.", effects: { statChanges: { stability: 1, authority: 1, publicTrust: -1 } }, resultSummary: "The governor departed for the frontier. A petition arrived the following spring. It was identical." }
    ]
  },
  {
    key: "world_of_paper",
    title: "The Restraint of Giants",
    description: "Your military command has developed a weapon of unprecedented destructive power. The general who oversaw its creation now refuses to authorize its deployment. 'I live in a world of paper,' he tells the council. 'Every person I meet, every structure I defend — it is all made of paper.'",
    category: "MILITARY",
    tags: ["military", "security"],
    eligibility: { minStats: { military: 65 }, requiredAgentRoles: ["GENERAL"] },
    weight: 5,
    choices: [
      { id: "respect_restraint", label: "Respect the general's restraint", description: "Some weapons should never be tested.", effects: { statChanges: { stability: 4, publicTrust: 5, military: -1, technology: -1 } }, resultSummary: "The weapon was sealed in a vault with a single key, held by the general. He was asked when he would authorize a test. 'When the world is no longer made of paper,' he replied. 'Which is never.'" },
      { id: "order_test", label: "Order a test", description: "We must know what we have built.", effects: { statChanges: { military: 4, technology: 4, publicTrust: -4, stability: -2, environment: -5 } }, resultSummary: "The test succeeded. The crater is still there. So is the silence that followed." },
      { id: "decommission", label: "Decommission the weapon", description: "Destroy the plans and dismantle it.", effects: { statChanges: { publicTrust: 3, stability: 2, technology: -2 } }, resultSummary: "The plans were burned. The weapon dismantled. The general slept for the first time in months." }
    ]
  },
  {
    key: "art_of_doing_nothing",
    title: "The Standoff at Twin Bridges",
    description: "A rival power has massed regiments at the border, demanding territorial concessions. Your generals demand mobilization. Your diplomats advise waiting. The head of state must decide whether to match force with force or find another path.",
    category: "ROLEPLAY_NEWS",
    tags: ["diplomacy", "military"],
    eligibility: { minStats: { liberty: 45 } },
    weight: 8,
    choices: [
      { id: "do_nothing", label: "Do nothing", description: "Let them exhaust their posturing. Hostilities require a willing opponent.", effects: { statChanges: { stability: 5, publicTrust: 3, liberty: 2, authority: -1 }, agentXpChanges: [{ role: "HEAD_OF_STATE", amount: 20 }] }, resultSummary: "The rival regiments waited, growing hungry and bored. After eleven days without provocation, they withdrew. The diplomats had won a confrontation without lifting a finger." },
      { id: "mobilize", label: "Mobilize in response", description: "Show strength and readiness.", effects: { statChanges: { military: 4, authority: 2, stability: -2, economy: -3 } }, resultSummary: "Troops moved to the border. The standoff continues, costing gold and nerve every day." },
      { id: "negotiate_concessions", label: "Offer territorial talks", description: "Give them something to save face.", effects: { statChanges: { stability: 2, economy: 1, publicTrust: -2, liberty: -1 } }, resultSummary: "A small concession bought peace. The diplomats called it pragmatism. The citizens called it retreat." }
    ]
  },
  {
    key: "the_couriers_burden",
    title: "The Courier's Burden",
    description: "A courier in a weathered duster appears in the capital square. No credentials, no homeland, just a flag of a nation no one at court can identify folded in their pack. They ask questions the cabinet was not prepared for: 'Who are you who do not know your own history?'",
    category: "ROLEPLAY_NEWS",
    tags: ["history", "diplomacy"],
    eligibility: { requiredLocationTypes: ["CAPITAL"] },
    weight: 6,
    choices: [
      { id: "listen_learn", label: "Listen and learn", description: "Hear the courier's full account.", effects: { statChanges: { publicTrust: 4, stability: -2 }, createNationPost: { type: "SPEECH", title: "The Courier's History Recited in Capital Square", body: "A traveling courier held the capital's attention for an evening with an unsparing account of the nation's founding — including details the archives do not record." } }, resultSummary: "The courier walked the Road once and spoke truth the archives had buried." },
      { id: "detain_courier", label: "Detain and debrief", description: "Security concerns first.", effects: { statChanges: { authority: 3, liberty: -3 } }, resultSummary: "The flag sits in a locked drawer. The courier's words sit heavier." },
      { id: "send_away", label: "Send them away", description: "Quiet provisions and a closed gate.", effects: { statChanges: {} }, resultSummary: "The courier walked on. Their questions stayed behind, spreading through the capital like frost." }
    ]
  },
  {
    key: "the_lucid_trade",
    title: "A Strange Caravan Arrives",
    description: "A foreign trader offers a rare substance called 'Lucid' — said to enhance strength, speed, and clarity of thought. His only warning: once you start, you must never stop. The caravan master's eyes are an unnatural, gleaming red.",
    category: "ECONOMY",
    tags: ["port", "trade"],
    eligibility: { requiredLocationTypes: ["PORT"], minStats: { economy: 50 } },
    weight: 8,
    choices: [
      { id: "buy_sample", label: "Purchase a sample for study", description: "Curiosity outweighs caution.", effects: { statChanges: { technology: 3, publicTrust: -1, stability: -1 } }, resultSummary: "The Lucid sample entered state laboratories. The trader smiled and departed." },
      { id: "ban_substance", label: "Ban the substance immediately", description: "Nothing that demands endless use can be safe.", effects: { statChanges: { publicTrust: 3, stability: 2, economy: -1 } }, resultSummary: "The caravan was turned away at the port, though some whispered about what was lost." },
      { id: "buy_supply", label: "Buy a supply for the military", description: "Enhanced soldiers could change the balance of power.", effects: { statChanges: { military: 6, authority: -2, publicTrust: -3 }, militaryExperienceChanges: [{ amount: 8 }] }, resultSummary: "The first doses changed the soldiers. The second doses changed the nation." }
    ]
  },
  {
    key: "the_drunken_master",
    title: "A Wandering Teacher Offers an Unorthodox Method",
    description: "An old man arrives at the military academy reeking of rice wine. The guards try to remove him. He stumbles past six of them without appearing to try. 'I will teach your soldiers to fight,' he says, swaying slightly. 'But first they must learn to fall.'",
    category: "MILITARY",
    tags: ["training", "military"],
    eligibility: { requiredAgentRoles: ["GENERAL"], minStats: { military: 40 } },
    weight: 7,
    choices: [
      { id: "accept_training", label: "Accept his training", description: "Effectiveness matters more than appearances.", effects: { statChanges: { military: 5, liberty: 1, publicTrust: -1 }, militaryExperienceChanges: [{ amount: 8 }] }, resultSummary: "The soldiers who survived his methods became unpredictable and devastating. The academy still serves rice wine at graduation." },
      { id: "decline", label: "Send him away", description: "This is a military academy, not a tavern.", effects: { statChanges: { authority: 1, military: -1, publicTrust: 1 } }, resultSummary: "The old man wandered off toward the next valley. Guards reported he was humming." },
      { id: "study_him", label: "Study his technique", description: "Document everything. The wine may be irrelevant.", effects: { statChanges: { technology: 3, military: 1 } }, resultSummary: "Researchers catalogued eighteen distinct falling techniques and zero coherent explanations. The manual is taught to this day." }
    ]
  },
  {
    key: "the_three_treasures",
    title: "The Inheritance of Rule",
    description: "An ancient ceremony requires the ruler to choose among three symbolic treasures to define their reign. The sword represents security through strength. The mirror represents wisdom through reflection. The jewel represents benevolence through generosity.",
    category: "ROLEPLAY_NEWS",
    tags: ["nobility", "culture"],
    eligibility: { requiredAgentRoles: ["HEAD_OF_STATE"], minStats: { stability: 50 } },
    weight: 7,
    choices: [
      { id: "choose_sword", label: "The Sword (Security)", description: "A nation protected is a nation at peace.", effects: { statChanges: { military: 4, authority: 3, stability: 2, liberty: -1 }, agentXpChanges: [{ role: "HEAD_OF_STATE", amount: 15 }] }, resultSummary: "The sword was raised over the head of state. The army cheered. The people held their breath." },
      { id: "choose_mirror", label: "The Mirror (Wisdom)", description: "A nation that sees itself clearly governs itself justly.", effects: { statChanges: { technology: 4, liberty: 3, publicTrust: 2, authority: -1 }, agentXpChanges: [{ role: "HEAD_OF_STATE", amount: 15 }] }, resultSummary: "The mirror was placed in the great hall. Citizens were invited to look upon it. Some saw improvement." },
      { id: "choose_jewel", label: "The Jewel (Benevolence)", description: "A nation that gives flourishes.", effects: { statChanges: { economy: 3, publicTrust: 5, stability: 1, authority: -1 }, agentXpChanges: [{ role: "HEAD_OF_STATE", amount: 15 }] }, resultSummary: "The jewel was set into the public treasury, visible to all. Donations tripled that year." }
    ]
  },
  {
    key: "commoner_stats",
    title: "Commoner Stats",
    description: "A farmer from a village so small it kept only one cow has published a pamphlet titled 'The Numbers That Matter.' It lists infant mortality, grain prices, well depths, and local jail populations — data the royal statistics office never bothered to collect.",
    category: "PUBLIC_TRUST",
    tags: ["rural", "farmers"],
    eligibility: { maxStats: { publicTrust: 65 } },
    weight: 8,
    choices: [
      { id: "adopt_stats", label: "Adopt commoner statistics", description: "Bring these numbers into official reporting.", effects: { statChanges: { publicTrust: 6, liberty: 3, technology: 2, authority: -2 } }, resultSummary: "The farmer's pamphlet became the basis for a new public data office. Someone sent them a second cow." },
      { id: "discredit", label: "Discredit the pamphlet", description: "These are anecdotal numbers from a farmer.", effects: { statChanges: { authority: 2, publicTrust: -5, stability: -2 } }, resultSummary: "The attempt to discredit the pamphlet backfired. Sales tripled. So did subscriptions to the second edition." },
      { id: "ignore", label: "Ignore it", description: "Pamphlets come and go.", effects: { statChanges: { stability: 1, publicTrust: -2 } }, resultSummary: "The pamphlet kept selling. The farmer kept counting. The state kept ignoring. The gap between them grew." }
    ]
  },
  {
    key: "the_unseen_pulse",
    title: "Citizens Report a Strange Malaise",
    description: "Across the capital, citizens wake with headaches, irritability, and a low humming sound that no instrument can detect. Domestic quarrels spike. Street fights break out over nothing. Some describe it as a heavy pressure, 'like a voice pressing against the skull without words.'",
    category: "SECURITY",
    tags: ["capital", "agents"],
    eligibility: { requiredLocationTypes: ["CAPITAL"] },
    weight: 8,
    choices: [
      { id: "investigate_signal", label: "Investigate the signal", description: "Form a scientific and security task force.", effects: { statChanges: { technology: 3, stability: -1, publicTrust: 2 }, agentXpChanges: [{ role: "SCIENTIST_ADVISOR", amount: 15 }] }, resultSummary: "Researchers found anomalous electromagnetic patterns but no emitter. The humming subsided after three weeks." },
      { id: "distribute_tonics", label: "Distribute calming tonics", description: "Treat the symptoms while searching for answers.", effects: { statChanges: { publicTrust: 2, economy: -2, stability: 2 } }, resultSummary: "The tonics helped most citizens sleep. A few reported worse dreams." },
      { id: "deny_phenomenon", label: "Dismiss as mass hysteria", description: "There is no hum. Return to work.", effects: { statChanges: { authority: 3, publicTrust: -4, stability: -3 } }, resultSummary: "Denial did not silence the hum. It only taught citizens the state would not listen." }
    ]
  },
  {
    key: "truth_under_siege",
    title: "Journalist Network Faces Coordinated Attack",
    description: "Three independent journals have been hit with simultaneous legal actions, unexplained funding freezes, and a campaign of anonymous threats against their reporters. The publishers refuse to name their sources.",
    category: "PUBLIC_TRUST",
    tags: ["media", "liberty"],
    eligibility: { minStats: { publicTrust: 30, liberty: 30 }, maxStats: { authority: 80 } },
    weight: 9,
    choices: [
      { id: "defend_press", label: "Defend press freedom", description: "The truth is not a luxury.", effects: { statChanges: { liberty: 5, publicTrust: 5, authority: -2, stability: -1 }, createNationPost: { type: "GOVERNMENT_UPDATE", title: "Government Pledges to Defend Independent Press", body: "New legislation will shield journalists from coordinated legal harassment and ensure public access to independent reporting." } }, resultSummary: "The journals survived. The siege had not broken them." },
      { id: "mediate", label: "Offer mediation", description: "Bring publishers and critics to the table.", effects: { statChanges: { stability: 2, publicTrust: 1 } }, resultSummary: "Mediation cooled the immediate crisis, but publishers noted that the threats had not been investigated." },
      { id: "ignore_crisis", label: "Let the legal process run", description: "The courts will sort it out.", effects: { statChanges: { authority: 2, publicTrust: -5, liberty: -3 } }, resultSummary: "Two of the three journals folded before any court date. The third publishes from a basement now, with a smaller font and a locked door." }
    ]
  },
  {
    key: "the_biketober_gathering",
    title: "The Biketober Gathering Tests a Small Town",
    description: "Every autumn, riders from every corner of the realm descend on a modest coastal town for a week of competition, celebration, and roaring engines. The town has eight hundred permanent residents and twenty thousand guests. The mayor requests additional constables, sanitation crews, and a field hospital — all for seven days of 'managed chaos.'",
    category: "STABILITY",
    tags: ["rural", "trade"],
    eligibility: { requiredLocationTypes: ["TOWN"], maxStats: { stability: 70 } },
    weight: 7,
    choices: [
      { id: "support_town", label: "Send state resources", description: "Help the town manage the surge.", effects: { statChanges: { publicTrust: 4, stability: 3, economy: -2 } }, resultSummary: "The gathering passed without major incident. The town sent a thank-you letter and an itemized bill." },
      { id: "let_local_handle", label: "Let local government manage it", description: "The town chose to host this. They can handle it.", effects: { statChanges: { economy: 1, publicTrust: -2, stability: -1 } }, resultSummary: "The town survived, barely. The mayor's hair went visibly grey." },
      { id: "ban_gathering", label: "Ban the gathering", description: "This 'managed chaos' is a public safety hazard.", effects: { statChanges: { authority: 3, publicTrust: -3, stability: 1 } }, resultSummary: "The ban pleased the constabulary and enraged the riders. They gathered anyway, in a town two valleys over." }
    ]
  },
  {
    key: "the_wounded_land",
    title: "The Wounded Land",
    description: "The head of state tours a drought-stricken farming region. On the third night, an old farmer asks quietly: 'Do you think the land knows who rules it? My grandmother said that when the king was ill, the wheat would not grow.'",
    category: "ENVIRONMENT",
    tags: ["farmers", "rural"],
    eligibility: { requiredLocationTypes: ["FARM"], minStats: { stability: 40 } },
    weight: 8,
    choices: [
      { id: "invest_land", label: "Invest in water infrastructure", description: "The land needs help, not superstition.", effects: { statChanges: { stability: 4, publicTrust: 4, economy: -2, environment: 3 }, locationDevelopmentChanges: [{ locationType: "FARM", amount: 2 }] }, resultSummary: "New wells and canals broke ground within the month. The old farmer watched and said nothing." },
      { id: "spiritual_response", label: "Commission a ritual blessing", description: "Honoring the land cannot hurt.", effects: { statChanges: { stability: 3, publicTrust: 2, environment: 1, authority: -1 } }, resultSummary: "The blessing was performed at the driest field. Some swore they felt rain before the clouds arrived." },
      { id: "ignore_superstition", label: "Dismiss the farmer's tale", description: "Drought is weather. Nothing more.", effects: { statChanges: { economy: 1, publicTrust: -2, stability: -1 } }, resultSummary: "The drought continued. The farmer was heard to say, 'The king has not yet answered.'" }
    ]
  },
  {
    key: "a_second_miracle",
    title: "A Second Miracle on the Ridge",
    description: "Years after the first crop miracle astounded the realm, the same farming community reports another unexplained event. Their wells, which had run dry for three summers, refilled overnight without rain. The water is cold, clear, and faintly sweet.",
    category: "ENVIRONMENT",
    tags: ["farmers", "rural"],
    eligibility: { requiredLocationTypes: ["FARM"], minStats: { stability: 50 } },
    weight: 7,
    choices: [
      { id: "study_water", label: "Study the water", description: "Send scientists to understand the phenomenon.", effects: { statChanges: { technology: 4, publicTrust: 1, environment: 2, economy: -1 }, agentXpChanges: [{ role: "SCIENTIST_ADVISOR", amount: 15 }] }, resultSummary: "The water defied analysis. No mineral signature, no source, no precedent. The geologists filed a report and joined the planting." },
      { id: "celebrate_blessing", label: "Declare a harvest festival", description: "Whatever its source, celebrate the gift.", effects: { statChanges: { stability: 3, publicTrust: 4, economy: 1, authority: -1 }, createNationPost: { type: "NEWS", title: "Ridge Community Celebrates Return of Water", body: "A spontaneous festival erupted in the ridge community after wells refilled without explanation. The head of state called it a reminder that not every blessing requires an explanation." } }, resultSummary: "The festival lasted three days. The elder smiled more than anyone had seen in years." },
      { id: "ration_water", label: "Ration the water carefully", description: "Miraculous or not, it must be managed.", effects: { statChanges: { stability: 2, economy: 2, authority: 1, liberty: -1 } }, resultSummary: "The water was carefully distributed. It never ran out, despite all projections." }
    ]
  },
  {
    key: "precision_mandate",
    title: "Precision Mandate",
    description: "A trade minister proposes a radical efficiency overhaul: every measurement, every process, every output must be calibrated to exacting new standards. The proposal includes C.A.N.D.Y. — a Central Analytical Network for Dynamic Yield — to monitor and optimize state operations in real time.",
    category: "ECONOMY",
    tags: ["technology", "trade"],
    eligibility: { minStats: { economy: 50, technology: 45 } },
    weight: 7,
    choices: [
      { id: "implement_candy", label: "Implement C.A.N.D.Y.", description: "Precision is the foundation of prosperity.", effects: { statChanges: { economy: 6, technology: 3, authority: 1, liberty: -2, publicTrust: -1 } }, resultSummary: "C.A.N.D.Y. went online. Within six months, waste dropped by a measurable seventeen percent. Privacy dropped as well, though no one could agree by how much." },
      { id: "limited_pilot", label: "Run a limited pilot", description: "Test the system before committing.", effects: { statChanges: { economy: 2, technology: 2, publicTrust: 1 } }, resultSummary: "The pilot showed promise. Full implementation was scheduled for review." },
      { id: "reject_system", label: "Reject the system", description: "Yield should not be purchased with surveillance.", effects: { statChanges: { liberty: 4, publicTrust: 3, economy: -1, technology: -1 } }, resultSummary: "C.A.N.D.Y. was shelved. The trade minister updated her resume." }
    ]
  }
];
