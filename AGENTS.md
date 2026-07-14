# Statecraft Online Agent Notes

## Coding Conventions

- Keep Foundation Step 1 scoped to a clean shell, demo data, and expandable boundaries.
- Do not overbuild systems before the core loop is playable.
- Keep game logic modular and move reusable rules into small services or shared package helpers.
- Prefer types from `packages/shared` whenever frontend and backend agree on a domain object.
- Add tests for game logic when practical, especially event effects and later simulation rules.
- Keep frontend components small, readable, and domain-focused.
- Keep backend routes organized by domain.
- Keep nation creation logic centralized in `apps/api/src/services/nationCreationService.ts`.
- Do not duplicate nation creation constants between frontend and backend.
- Use shared package constants from `packages/shared` for government, economy, ideology, traits, emblems, and starting packages.
- Keep event engine logic centralized in `apps/api/src/services/eventEngineService.ts`.
- Do not hardcode event behavior inside React components.
- Prefer shared event types and structured event effects.
- Keep event effects modular and expandable; add helper functions rather than branching inside route handlers.
- Keep route-level fallback tests in `apps/api/src/routes/routes.fallback.test.ts` when changing playable-loop API behavior.
- Keep frontend realtime subscriptions centralized through `apps/web/src/realtime.ts`.
- Keep post/feed logic centralized in `apps/api/src/services/postService.ts`.
- Do not trust raw user HTML; author rich posts as Markdown and render through the sanitized Markdown component.
- Event-created feed posts may be curated, but do not mutate resolved event history for presentation changes.
- Keep turn, economy, resource, shortage, agent progression, and military upkeep rules in `turnService.ts` and `economyService.ts`.
- Keep location upgrade costs, yields, project lifecycle, and deterministic location-agent bonuses in `developmentService.ts`.
- Keep technology-tree definitions in the shared package and research generation, unlocks, prerequisite checks, and effect aggregation in `technologyService.ts`.
- Never duplicate technology costs or bonuses in React. Treat the owner technology API as authoritative.
- Purchased technologies remain immutable; age regression suspends effects without deleting unlock history.
- Keep deterministic generation, homeland claims, viewport reads, and public-world filtering in `worldService.ts`.
- Keep immutable terrain rules in the shared package and apply them through `terrainService.ts`; never derive terrain from coordinates in React.
- Keep route search, infrastructure costs, technology gates, project lifecycle, upkeep, and link bonuses in `infrastructureService.ts`.
- Keep pure settlement food, housing, growth, stability, workforce, and transport rules in `settlementRules.ts`; keep persistence, project lifecycle, regions, and turn integration in `settlementService.ts`.
- Keep settlement building, improvement, specialization, level, and capacity definitions in `packages/shared/src/settlements.ts`. Never duplicate their costs or effects in React.
- Treat `MapLocation` as the geographic anchor and `Settlement` as its one-to-one domestic simulation state. Full settlements do not use generic location upgrades.
- Preserve major corridors while absorbing local legacy links into regional networks. Do not expose `REGIONAL_LEGACY` links as player-managed infrastructure.
- Keep claim, outpost, colonist, supply, founding, region-repartition, and expansion-turn lifecycle logic in `expansionService.ts`, with pure calculations in `expansionRules.ts` and routing in `mapPathService.ts`.
- Treat territorial ownership changes as atomic conditional updates. Foreign ownership is immutable until contested-border rules are explicitly assigned.
- Keep agent physical movement, action points, previews, cooldowns, and action history in `agentActionService.ts`. A duty assignment grants bonuses only while the agent is physically present.
- Keep espionage, counterespionage, diplomatic, and industrial agent actions disabled until both action and opposing-response systems are authoritative.
- Preserve population when training, cancelling, resettling, or consuming colonists, and preserve the outpost location ID when it becomes a Town.
- Keep owner strategic-map aggregation and tile indexing in `strategicMapService.ts`; never widen the public world endpoint with foreign operational assets.
- Keep map art replaceable through the shared frontend asset manifest. Terrain, resources, locations, units, characters, and colonists remain simultaneously visible without gameplay filters.
- Keep correspondence authorization, unread state, messages, and offer lifecycle in `inboxService.ts`. Diplomatic offer status must not apply mechanical effects until a dedicated diplomacy system exists.
- Inbox realtime payloads are private and may only be emitted to participating nation or user rooms.
- Treat `WorldTile` terrain, deposits, and ownership as authoritative. Keep `MapLocation.x` and `y` synchronized only for compatibility.
- Never expose foreign units, agents, queued projects, or private economy data through public world endpoints.
- Persist completed infrastructure route tiles and emit world/infrastructure realtime events only after commit.
- Treat development costs returned by the API as authoritative; do not duplicate upgrade formulas in React.
- Complete queued development before location production within the atomic turn transaction, and emit project realtime events only after commit.
- Never restore automatic database fallback. `DATA_MODE=memory` must remain explicit, ephemeral, and unavailable in production.
- Enforce ownership through the principal helpers rather than route-specific user checks.
- Emit versioned realtime messages only after durable transactions commit and scope them to public, nation, or user rooms.
- Preserve the API error envelope and use `409` for idempotency conflicts.
- Treat authentication, combat, diplomacy, uploads, AI, fog of war, pathfinding, and life-sim mechanics as future work unless explicitly assigned.

## Style

- Use TypeScript throughout.
- Keep API validation explicit and basic for now.
- Keep UI state local unless a feature clearly needs shared state.
- Prefer clear placeholder UI over decorative polish in the foundation phase.
