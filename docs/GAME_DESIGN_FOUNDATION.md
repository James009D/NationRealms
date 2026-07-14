# Game Design Foundation

## High-Level Vision

Statecraft Online is a 2D multiplayer nation simulation where each player leads a fictional nation with a public identity, domestic pressures, map presence, character agents, and roleplay-facing news. The game should feel like a living strategic world rather than a forum wrapped around a nation profile.

Foundation Step 1 creates the playable shell: a seeded demo nation, early statistics, posts, events, map locations, agents, and military units. It is intentionally small, but every object points toward future simulation systems.

## Core Gameplay Pillars

### Nation Identity

Players define the personality of their nation through name, motto, government style, economy style, culture, capital, and public updates. The nation profile is the player's strategic and roleplay anchor.

### Simulation Events

Events pressure the nation with choices that affect statistics. Early choices are simple, but the long-term design should connect events to map state, agents, resources, public trust, internal stability, and military posture.

### 2D Strategic Map Presence

The map represents the nation as a set of cities, towns, bases, ports, mines, farms, and resource sites. Future systems can add territory, terrain, movement, fog of war, contested spaces, and logistics.

### Character Agents

Agents are named characters who govern, command, guard, speak, improve locations, gain XP, level up, and develop traits. They turn abstract state management into a cast of people with consequences.

### Military Positioning

Military units exist on the map and can later support deterrence, conflict, defense, logistics, and roleplay events. Foundation Step 1 only models unit identity and movement between known locations.

### Public Roleplay Feed

Posts, speeches, government updates, images, and videos eventually become the public voice of the nation. Foundation Step 1 supports text posts and placeholder media fields.

Foundation Step 5 expands this into a roleplay/news layer. The feed is where a nation explains itself to the world: speeches, official updates, event fallout, local dispatches, and curated public narratives. Players can format posts with Markdown, filter the public feed, and open detail pages for individual dispatches.

Event-created posts are intentionally curatable. A player can edit, hide, draft, or delete the public feed item to fit their nation's voice, but this does not rewrite the underlying resolved event history. The game record and the roleplay presentation are related, not identical.

## Excluded From Foundation Step 1

- Real login and authentication.
- Payments or monetization.
- Full combat simulation.
- Complex diplomacy.
- Upload storage for images and videos.
- AI-generated events.
- Advanced map rendering.
- Fog of war.
- Pathfinding.
- Nation-to-nation war resolution.
- Forums.
- Region mechanics.
- Life-sim mechanics for the player avatar.

## NationStates Inspiration Versus Statecraft Direction

NationStates-style games often center the loop on issue choices, nation descriptions, regions, and forum-like social play. Statecraft Online keeps the strength of event choices but makes them one part of a wider strategy simulation.

In this project, an event choice should eventually touch concrete systems: a port, a mine, a governor, a brigade, a city, or a public trust crisis. The long-term goal is for choices to change the visible map and the characters living inside the nation, not only adjust abstract stats.

## Nation Creation Philosophy

Foundation Step 2 makes founding a nation feel like a strategic and roleplay act, not a generic database form. The player chooses identity, government, economy, origin, ideology, culture traits, flag colors, an emblem, and a starting package. These choices immediately produce stats, a capital, starter locations, agents, units, and a founding post.

Identity choices matter because they become public profile material and future hooks for events, agent behavior, map pressures, and roleplay posts. A revolutionary republic with labor solidarity should invite different events and political tensions than an old kingdom with ancient nobility.

The creation flow feeds future systems in four ways:

- Events can read ideology, government, economy, and culture traits.
- Map systems inherit starting locations and resource sites.
- Agents begin with roles tied to the founding package.
- Roleplay begins with a founding post and presentable public profile.

## Event Engine Philosophy

Foundation Step 3 turns events into authored national issues that react to the nation already on the board. Templates can check government, economy, founding origin, culture traits, stats, ideology sliders, map locations, agents, military units, and recent event history before becoming eligible.

These events are not AI-generated. They are hand-authored dilemmas with structured choices and mechanical consequences. That keeps gameplay understandable and testable while still letting nations feel different. A port strike matters more to a maritime trader; noble privilege claims only appear for nations with ancient nobility; military controversies depend on military strength and units.

The future AI layer should assist with flavor, variations, or summaries, but authoritative state changes should continue to flow through structured event templates, eligibility rules, and effect handlers.

## Playable Nation Loop

The first durable progression loop is turn-based and economic rather than combat-driven. Locations produce revenue and resources; population and institutions consume them; agents improve administration; military forces require supply and readiness. Shortages create visible warnings and modest stat pressure instead of instant failure. This gives authored events concrete context while keeping the model readable enough to balance.

Turns advance only through an explicit player action. There is no background simulation, so a nation cannot decay while its player is away. The turn report explains treasury changes, population, production, consumption, shortages, agent progress, unit readiness, expired issues, and any newly generated issue.

Combat, diplomacy, AI-written mechanics, and life simulation remain intentionally unavailable. Military positioning establishes geography and upkeep before conflict rules; event history and public posts establish roleplay continuity before nation-to-nation systems open.

## Economic Development Philosophy

Foundation Step 6 gives the player a deliberate action between turns. Locations no longer become stronger only through authored events: the player compares output, commits treasury and materials, optionally assigns an engineer, and advances the political calendar until construction completes. Diminishing development multipliers keep early investments useful without letting a single level-five site dominate the economy.

Construction is transparent and server-authoritative. Costs are paid when a project begins, one location can host one project, administrative capacity limits simultaneous work, and cancellation returns 75% of committed resources. Governors, trade ministers, scientists, engineers, and generals have deterministic, visible contributions rather than hidden random bonuses.

## Technology Research Philosophy

Foundation Step 7 turns Technology from a passive indicator into a player-directed research loop. Nations accumulate Research Points from their existing technical capacity, assigned Scientist Advisors, and developed rare-earth sites, then spend those points on an authored 26-node tree spanning Stone through Future ages.

Technology progress is powerful but not guaranteed. Events and energy shortages can lower the Technology indicator and move a nation into an earlier age. Knowledge remains recorded, but effects from technologies above the current age suspend until the nation recovers. This makes technological setbacks consequential without forcing players to buy the same discovery twice.

The tree improves systems that already exist: location output, resource consumption, development costs, population growth, agent training, military readiness, and future research. It does not introduce roads, combat, diplomacy, or procedural inventions before those systems have authoritative rules.

## Shared World And Terrain Philosophy

Foundation Step 8 turns the map from a nation-local diagram into common geography. Every nation occupies a compact homeland on one deterministic 96x64 world. Terrain and deposits are persistent public facts, while military positions, agents, projects, and economic details remain private to their owner.

Geography now shapes the economic loop. Plains favor farms, forests favor timber, hills and mountains favor minerals, deserts and tundra favor energy, and coasts support fish and ports. The same terrain also defines movement cost and future combat modifiers, establishing authoritative strategy rules without prematurely adding battle resolution.

Infrastructure provides the first deliberate connection between locations. Roads, Rails, and Sea Lanes are constructed along persisted server-generated corridors, share construction capacity with location upgrades, require upkeep, and improve connected production or logistics. Terrain cannot yet be conquered or transformed, and international links remain deferred until diplomacy and trade have ownership-safe rules.

## Settlements And Strategic Growth Philosophy

Foundation Step 9 makes a small number of memorable settlements the center of domestic strategy. Population is represented by slow-growing workforce levels rather than a passive number that increases every turn. Food access, housing, health, stability, local jobs, governors, and administrative capacity all compete for attention, while population loss requires a sustained severe crisis and takes much longer to recover than treasury.

Settlements cannot build everything. Towns begin with only a few building and regional-improvement slots, one active project, and one primary specialization. Major Cities can add a secondary specialization, but all projects share national construction capacity with resource-site upgrades and major corridors. This keeps a Granary, Academy, Industrial Zone, city upgrade, or rail corridor as a real strategic choice.

Routine local roads are abstracted into regional transportation tiers and reliability. Major intercity corridors remain on the map, while regions govern food distribution, resource access, migration potential, taxation, and future military supply. Underfunded networks deteriorate gradually instead of toggling instantly.

Step 9 introduced preview-only settlement sites so growth rules could be evaluated before ownership rules existed. Step 10 supersedes that limitation with territorial claims, supply, colonist logistics, and server-authoritative founding.

## Territorial Expansion And Frontier Philosophy

Foundation Step 10 makes a second settlement a national project rather than a tile purchase. Players must survey a frontier, sustain influence over several turns, pay ongoing administrative costs, establish and supply an outpost, transfer scarce population into a colonist expedition, and wait for the outpost to mature before founding. Foreign borders remain hard boundaries until diplomacy and conflict have authoritative rules.

Cities stay rare because the frontier competes with domestic construction, treasury, food, population, and administrative capacity. A new Town keeps its terrain, deposit, origin settlement, founder, charter, and founding turn as permanent identity. The ten-turn charter bonus gives its opening chapter a mechanical character without permanently forcing one specialization.

Agents now occupy physical map positions separate from their duty assignments. Basic field actions create a readable exploration rhythm: rest, forage, accept the risk of a hunt, survey claim targets, govern locally, deliver speeches, or organize a defended location. Future spy, diplomatic, and industrial missions use the same target contracts, travel, AP, and history foundation, but remain disabled until their opposing rules and information boundaries exist.
