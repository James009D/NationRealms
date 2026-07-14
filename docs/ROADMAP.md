# Statecraft Online Roadmap

## Current Milestone: Foundation Step 10.5 Interactive Strategic Map And Nation Inbox

The nation loop now covers identity, authored issues, Markdown roleplay posts, a strategic map, agents, military positioning, explicit persistence modes, ownership boundaries, accounts, and a first economy/resource turn model.

Foundation Step 10 adds turn-paced territorial claims, surveyed frontiers, administrative load, supplied outposts, colonist population transfer and movement, server-authoritative Town founding, founding charters, and physically positioned agents with field actions.

Foundation Step 10.5 makes the dashboard map the main world surface with replaceable 2D assets, drag/zoom navigation, always-visible owned assets, tile inspection, and map-native frontier orders. Feed now includes private nation correspondence and non-mechanical diplomatic offer records.

## Completed Foundation

- **Foundation 1-3:** monorepo shell, nation creation, authored event engine, history, follow-ups, and contextual effects.
- **Foundation 4-5:** fallback route integration, CI, consequence feedback, realtime updates, public/nation feeds, sanitized Markdown, post detail and curation.
- **Hardening:** explicit `DATA_MODE`, readiness checks, versioned room-scoped realtime, API error contract, non-destructive seed, Prisma migrations, event idempotency/expiry/caps, stable post filtering, patched dependencies, and retired incomplete nation creation.
- **Playable economy:** treasury, population, resource stockpiles, location yields/upkeep, shortages, ledger entries, agent XP/levels, military supply/readiness, and atomic turn reports.
- **Ownership and release tooling:** Argon2id accounts, opaque sessions, CSRF, rate limiting, PostgreSQL integration tests, component tests, Playwright smoke tests, coverage, lint, formatting, audit, and operations documentation.
- **Foundation Step 6:** queued location upgrades, diminishing output curves, package-specific economy profiles, construction limits, cancellation refunds, deterministic agent bonuses, development history, realtime updates, and turn-report integration.
- **Foundation Step 7:** Research Point generation, a 26-node authored technology tree, age regression and suspended knowledge, technology bonuses, and the interactive Technology page.
- **Foundation Step 8:** shared world generation and placement, terrain economy, deposits, infrastructure corridors, completion-turn production effects, map layers, and authoritative future-combat terrain modifiers.
- **Foundation Step 9:** settlement and region migration, population/workforce growth, housing and food security, capacity penalties, local projects and specialization, hybrid infrastructure networks, settlement events, map planning, and deterministic campaign simulations.
- **Foundation Step 10:** territorial influence, claim history, supply-bound outposts, colonist projects, settlement founding, region repartitioning, founding charters, agent AP/travel, and local field actions.
- **Foundation Step 10.5:** interactive strategic viewport, placeholder map art, contextual expansion, streamlined navigation, settlement/frontier summaries, and private nation inbox scaffolding.

## Next: Characters, Government, And Frontier Politics

1. Playtest 30- and 60-turn expansion pacing, outpost supply, population recovery, charter value, and administrative strain.
2. Add governor traits, laws, legitimacy, succession hooks, and local political events now that settlements and physical agents are authoritative.
3. Design contested claims and diplomacy together before allowing any foreign ownership transition.
4. Add account email verification, password reset, and session-management UI before public deployment.
5. Replace the single-process memory fixture with smaller per-domain repositories if memory mode grows further.
6. Split the authored event library by category as content ownership expands; runtime schema validation already protects the current library.

## Later Systems

- **Strategic map:** rivers, weather, contested territory, international corridors, and regional trade after the domestic frontier loop is balanced.
- **Agents:** traits gained through play, injuries, retirement, richer governance, and character relationships.
- **Military:** supply lines and readiness first; combat and contested locations only after deterministic rules and multiplayer ownership are proven.
- **Diplomacy:** embassies, treaties, and roleplay exchanges after moderation and notification design.
- **AI assistance:** flavor drafting only; authored schemas and server-side effect rules remain authoritative.
- **Life simulation:** player-avatar and personal events after national agents and relationships are mature.

## Explicitly Deferred

Combat resolution, diplomacy, AI-generated mechanics, uploads, fog of war, pathfinding, background simulation, moderation, forums/regions, and life-sim controls remain unavailable. They must not be presented as functioning UI until dedicated designs and server-authoritative tests exist.
