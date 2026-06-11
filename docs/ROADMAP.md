# Roadmap

## Product thesis

Statecraft Online is a browser-based multiplayer nation roleplay/strategy game.
The foundation (nation creation, stats, map locations, agents, military units,
an authored event engine, posts/news, and a dual Prisma/in-memory runtime) is
built and now validated end to end in both modes (see `docs/VALIDATION.md`).
The next milestones should deepen the single-nation loop until it is genuinely
fun to play alone, then make nations owned (auth) and visible to each other
(feeds, diplomacy), keeping all game-state changes server-authoritative.

## Status of original phases

- Phase 1 (Foundation Shell), Phase 2 (Nation Creation), Phase 3 (Event Engine):
  **complete and validated** for the prototype, including the no-database fallback loop.
- Phases 4–10 below are re-scoped against the actual codebase.

## Phase A — Stabilization hardening (small, continuous)

Scope:
- Align fallback vs DB error status codes (400 vs 404 on ownership rejections).
- Route-level integration tests using `buildApp()` + `app.inject()` (Fastify's
  injection avoids needing a port) for the fallback loop.
- CI workflow: `npm ci && npm run prisma:generate && npm run typecheck && npm test && npm run build`.

Dependencies: none. Risk: low.
Acceptance: CI green on every push; both modes pass the VALIDATION.md loop.

## Phase B — Playable vertical slice polish

Scope:
- Turn-result feedback UI: stat deltas after a choice, new-event badge after
  advancing a turn (data already returned by `EventResolutionResult`).
- "No eligible events" graceful UI message (API already returns `message`).
- Created-nation landing flow: after creation, route to the new nation's profile
  with starter assets visible (works today; needs UX affordances, not plumbing).
- Consume Socket.IO events (`event:generated`, `event:choice-resolved`,
  `nation:post-created`) on the events/news pages for live updates.

Dependencies: Phase A (tests to protect behavior). Risk: low.
Acceptance: a player can create a nation, make 3+ event choices, and *see*
every consequence (stats, history, posts) without refreshing.

## Phase C — Ownership and identity (auth)

Scope:
- Email+password (bcrypt) or OAuth, JWT session; `requireAuth` Fastify hook.
- Nations belong to users; mutation routes check ownership.
- Demo mode stays anonymous/read-only.

Dependencies: Phase B. Risk: medium (touches every mutation route).
Acceptance: two browsers can own different nations; cross-ownership mutations are rejected.

## Phase D — Event/news/media depth

Scope:
- More event templates (current: 20), follow-up chains (the `followUpEventKeys`
  field exists but nothing consumes it yet), and `assignedLocationType` agent
  targeting in authored templates (engine support landed in the stabilization sprint).
- Post types with media embeds (schema fields exist), public nation feed,
  post editing/soft-delete.

Dependencies: Phase C for ownership gating of posting. Risk: low-medium.
Acceptance: events chain; a nation's public feed shows themed, media-rich posts.

## Phase E — Strategic 2D map and resources

Scope:
- Terrain/region model, resource production tied to stats, location upgrade
  costs and actions (developmentLevel exists; add economy around it).
- Better map UI (keep the grid before investing in a canvas/PixiJS renderer).

Dependencies: Phase B. Risk: medium (data-model growth).
Acceptance: upgrading a location costs something and visibly changes production/stats.

## Phase F — Agents and XP systems

Scope:
- XP thresholds/leveling, assignment effects per turn (governing improves a
  location, commanding trains a unit), loyalty consequences, injury/retirement events.

Dependencies: Phase D (events announce agent outcomes). Risk: medium.
Acceptance: an assigned agent measurably changes per-turn outcomes and levels up.

## Phase G — Military conflict and diplomacy

Scope:
- Movement costs/supply, contested locations, simple deterministic+RNG combat
  resolution, treaties/embassies between player nations.

Dependencies: Phases C, E, F. Risk: high (first true multiplayer interaction).
Acceptance: two nations can fight over a location and sign peace, all server-resolved.

## Phase H — AI-assisted events and life-sim layer

Scope:
- LLM-drafted event flavor text and news briefings (mechanics stay authored),
  player avatar with personal events.

Dependencies: Phases D, F. Risk: high (cost/quality control).
Acceptance: AI text never changes game state directly; avatar events affect stats
through the same effect pipeline.

## Recommended next 10 tasks

1. Add route-level fallback integration tests with `app.inject()` (Phase A; protects the fixed loop).
2. Align 400/404 ownership-rejection status codes between modes (Phase A; small contract cleanup).
3. Add a GitHub Actions CI workflow running the full validation pipeline (Phase A).
4. Build the stat-delta/turn-result feedback component on the events page (Phase B; biggest play-feel win).
5. Surface "No eligible events" message in the events UI (Phase B; removes silent failure).
6. Consume `event:generated` and `event:choice-resolved` via Socket.IO on the events page (Phase B).
7. Implement `followUpEventKeys` chaining in both engine paths with tests (Phase D; field is currently dead).
8. Author 10 more event templates, including ones using `assignedLocationType` targeting (Phase D).
9. Add auth scaffolding: User credentials columns, register/login routes, `requireAuth` hook (Phase C).
10. Decide the legacy `POST /api/nations` endpoint's fate (deprecate or document); it now has fallback parity but creates package-less nations (Phase A hygiene).
