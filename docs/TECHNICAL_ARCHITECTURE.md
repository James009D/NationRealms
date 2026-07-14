# Technical Architecture

## Monorepo Layout

```text
apps/
  api/      Fastify API, Prisma access, Socket.IO events
  web/      React + Vite frontend
packages/
  shared/   TypeScript domain types shared by API and web
prisma/
  schema.prisma
  seed.ts
docs/
```

The root `package.json` uses npm workspaces. Shared types compile first, then the API and web apps consume them.

## Frontend Architecture

The frontend is a React + Vite + TypeScript application. It uses React Router for page routes and plain CSS for the first prototype style layer.

Current routes:

- `/` - landing page.
- `/demo` - seeded demo dashboard.
- `/feed` - public cross-nation roleplay/news feed.
- `/nation/:id/news` - nation post management, filters, Markdown composer, draft/publish/hide/delete controls.
- `/nation/:id/news/:postId` - post detail page.
- `/nation/:id/events` - active events and choices.
- `/nation/:id/map` - simple 2D map with clickable locations.
- `/nation/:id/agents` - character agent list and assignment form.
- `/nation/:id/military` - military unit list and movement form.
- `/nation/:id/settlements` - national settlement and regional-development overview.
- `/nation/:id/settlements/:settlementId` - workforce, local administration, projects, and history.

The UI talks to the API through a small `api.ts` wrapper. It uses simple local component state because the foundation does not yet need a global client store. Events, News, and Feed pages subscribe to Socket.IO through `apps/web/src/realtime.ts` and refresh or patch local state when payloads match the current view.

## Backend Architecture

The backend is a Fastify + TypeScript service. Routes are grouped by domain:

- Health
- Demo
- Nations
- Nation posts
- Events
- Map
- Agents
- Military
- Settlements and regions

Prisma is the PostgreSQL access layer and Zod validates transport and authored-content boundaries. The request principal abstraction supports anonymous, local demo, and authenticated session identities without coupling domain services to cookie handling.

## Database Schema Overview

The initial schema models:

- Users and nations.
- Nation stats.
- Public nation posts, drafts, private posts, source metadata, soft deletion, and event-history links.
- Event templates and active events.
- Map locations.
- Character agents.
- Military units.
- Server-side sessions.
- Nation economy state, resource stockpiles, and an auditable turn ledger.
- Normalized post tags alongside the temporary JSON compatibility field.
- Settlements, owned world regions, workforce assignments, buildings, regional improvements, projects, and settlement history.

JSON fields are used for early event choices/effects and agent traits/skills so the foundation can move quickly. These can be normalized later when gameplay rules require richer querying.

## Realtime Scaffold

Socket.IO is attached to the Fastify server. The foundation emits simple events when:

- A nation post is created.
- A nation post is updated.
- A nation post is deleted.
- An event is generated.
- An event choice is resolved.
- An agent is assigned.
- A military unit moves.

Realtime messages use `{ version, type, nationId, entityId, occurredAt, data }`. Sockets join `public:feed` by default and subscribe to `nation:{nationId}` rooms for nation state. Public rooms receive public post changes only. Presence, durable replay, and a multi-node Socket.IO adapter remain future work.

## Technology Research Architecture

The authored technology catalog and age boundaries live in the shared package. `technologyService.ts` owns foundational backfill, research generation, prerequisite/status evaluation, capped effect aggregation, regression suspension, and atomic unlocks. Routes only authorize, validate transport data, map fallback behavior, and emit realtime messages.

`NationTechnologyState` stores Research Points and the founding technology baseline. `TechnologyUnlock` records permanent foundational or researched knowledge, while `TechnologyLedgerEntry` records generation and spending. Node effects are calculated from active unlocks; purchased nodes above the current regressed age remain recorded but are excluded from turn and development calculations.

Turn advancement generates research inside the existing serializable transaction after production and shortage calculation. Development and turn services consume aggregated technology effects through service helpers. Memory mode implements the same response and rule contracts. Realtime uses `technology:unlocked` and `technology:age-changed` nation-room events after commit.

## Fallback Runtime And API Contracts

Persistence is selected at startup with `DATA_MODE=postgres|memory`. PostgreSQL is the default and database failures return `503`; they never change the selected store. Memory mode is an explicit ephemeral development/test runtime and is rejected in production. `STATECRAFT_FORCE_DB_FALLBACK=1` remains a test compatibility alias.

API status codes are normalized across Prisma and fallback modes:

- `400` for invalid payloads and malformed JSON.
- `401` for missing authentication and `403` for authenticated cross-owner access.
- `404` for missing nations, events, posts, map locations, agents, military units, or same-nation target resources.
- `409` for event idempotency, insufficient readiness, and other state conflicts.
- `503` only when a route has no fallback and the database is actually unavailable.

Errors use `{ error: { code, message, issues?, requestId } }`. `/health/live` verifies the process; `/health/ready` verifies the selected persistence mode and reports ephemeral memory state.

Route-level integration tests use Fastify `app.inject()` so the fallback loop is validated without opening a port or requiring PostgreSQL.

## Future Multiplayer Considerations

Future multiplayer work should add:

- Server-authoritative simulation ticks.
- Durable event logs for replay and recovery.
- A shared Socket.IO adapter for multiple API instances.

## Nation Creation Service

Nation creation logic lives in `apps/api/src/services/nationCreationService.ts`. The service owns validation, stat calculation, ideology summaries, starting package expansion, and transactional creation. Routes should call this service rather than duplicating creation rules.

Shared constants and types live in `packages/shared/src/index.ts`:

- Government, economy, and founding origin options.
- Ideology axis definitions.
- Culture trait definitions.
- Starting package definitions.
- Emblem options.

The frontend imports the same shared constants for the wizard UI, while the backend uses them for validation and creation. This prevents the client from offering choices the API cannot accept.

Validation is currently implemented in the service layer with readable messages. It enforces required identity fields, supported enums, slider bounds, max 4 culture traits, hex colors, supported emblems, and required starting package.

`POST /api/nations/create` creates the nation, stats, economy, stockpiles, starter map locations, agents, military units, and founding post inside a transaction. Memory mode implements the same response contract with ephemeral state.

### Location Development Service

`developmentService.ts` owns development multipliers, costs, affordability, construction limits, agent bonuses, project creation, cancellation refunds, and completion. Routes perform transport and ownership checks only. `LocationUpgradeProject` keeps queued, completed, and cancelled projects as immutable history, while economy ledger entries record costs, refunds, and completed capacity.

The turn service completes due projects before calculating location output. It then applies the new development level, deterministic assigned-agent bonuses, location upkeep, resource production, and military command bonuses in the same serializable transaction. Realtime project events are emitted only after commit. Explicit memory mode mirrors the same public response shapes and rules.

## Event Engine Service

Event logic lives in `apps/api/src/services/eventEngineService.ts`. React components and route handlers should not hardcode event behavior.

The engine works from authored templates in `apps/api/src/data/eventTemplates.ts`. Templates include keys, categories, tags, eligibility JSON, weighted selection values, choices, structured effects, cooldowns, and optional follow-up keys.

Eligibility supports government, economy, founding origin, culture traits, min/max stats, ideology ranges, required location types, required agent roles, required military unit types, recent event exclusions, and cooldown turns.

Effects support clamped stats, treasury, population, stockpiles, deterministic ID/role/location agent targeting, location development, unit experience, follow-ups, and optional linked nation posts.

Resolution conditionally claims an active event and `ResolvedEvent.activeEventId` is unique, preventing duplicate effects. Realtime emission occurs after commit. Turn advancement is one serializable transaction that expires overdue issues, applies the economy/resource loop, advances agents and unit supply/readiness, increments the turn, enforces a three-issue cap, and generates at most one issue.

## Post And Feed Service

Post/feed logic lives in `apps/api/src/services/postService.ts`. Routes should use this service for validation, filtering, creation, editing, publishing/drafting, and soft deletion instead of duplicating post rules.

Owner management views and all mutations require the centralized principal boundary. Anonymous reads expose public, published, non-deleted posts only. Search, tag, source, visibility, and cursor filtering execute before the database limit, using stable `(publishedAt, id)` ordering.

Markdown is the only rich formatting format used in the UI. The frontend renders it with `react-markdown`, GitHub-flavored Markdown support, and `rehype-sanitize`; raw user HTML is not accepted as trusted content.

Event-generated feed posts are linked to `ResolvedEvent` through `sourceEventHistoryId`. Players may edit, hide, draft, or soft-delete the post, but the resolved event history remains the authoritative mechanical record.

## Authentication And Sessions

Session mode stores Argon2id password hashes and opaque session-token hashes. Cookies are HTTP-only, SameSite=Lax, Secure in production, revocable, and protected by a session-bound CSRF token on mutations. Login and registration are rate-limited. Demo identity remains a local development mode and startup validation forbids it in production.

## Testing And Operations

Fast memory-mode route tests use `app.inject()`. A separate PostgreSQL suite validates migrations, account sessions, transactional nation creation, and cross-owner denial. React Testing Library covers sanitized Markdown and consequence feedback; Playwright covers desktop/mobile routes and the playable loop. CI also enforces typecheck, lint, formatting, coverage, build, audit, PostgreSQL migrations, and browser smoke tests.

## Shared World, Terrain, And Infrastructure

`worldService.ts` owns deterministic map generation, viewport reads, homeland previews, transactional claims, and existing-nation relocation. Generation is keyed by the persisted seed and generation version. `WorldTile` is authoritative for terrain, deposits, and ownership; synchronized `MapLocation.x` and `y` remain temporary API compatibility fields.

`terrainService.ts` applies immutable definitions exported by the shared package. Terrain is evaluated after development and technology and participates in the existing capped location-bonus calculation. It also exposes placement, movement, supply, defense, and unit-class modifiers for later server-authoritative combat work.

`infrastructureService.ts` owns route preview, weighted least-cost corridor search, technology gates, pricing, construction slots, cancellation, completion, upkeep, and endpoint bonuses. Completed route tiles are persisted in order so a future generation-version change cannot silently move infrastructure. Infrastructure and location development complete before production in `turnService.ts`.

Public world serializers include terrain, territory, public locations, and completed infrastructure only. Owner infrastructure routes use principal helpers and include queued projects and affordability. Memory mode mirrors these contracts with an isolated ephemeral world. Realtime emits versioned territory and infrastructure messages to the affected nation room only after committed state changes.

## Settlements And Regional Development

`settlementRules.ts` contains pure food, housing, growth, stability, tax, research, workforce, and transport-access calculations. `settlementService.ts` owns initialization/backfill, deterministic owned-region assignment, settlement capacity, project lifecycle, regional reliability, turn persistence, and memory-mode parity. Routes only validate transport data, enforce ownership, map errors, and emit realtime notifications.

`MapLocation` remains the geographic anchor while `Settlement` stores domestic simulation state one-to-one. `WorldRegion` groups owned tiles, resource sites, improvements, and abstract local transport. Inter-settlement `MAJOR` infrastructure remains visible and player-managed; migrated settlement-to-site links become `REGIONAL_LEGACY` and contribute to regional network state without remaining corridor micromanagement.

The settlement turn stage runs inside the nation turn transaction. Existing project effects activate first, then local and site production, food access, housing/health/stability, growth, taxation, upkeep, network reliability, project completion, and event generation are resolved deterministically. Projects completed this turn receive an `effectiveTurn` of the following turn.

Owner APIs expose nation summaries, regions, settlement details, workforce, governor priority, project preview/start/cancel, and preview-only future sites. Capacity, workforce, active-project, slot, prerequisite, and affordability conflicts use `409`. Eight authored settlement events use structured settlement and region effects handled by the event engine, never by React.

## Territorial Expansion And Agent Operations

`mapPathService.ts` is the deterministic least-cost routing boundary shared by frontier claims, supply, colonists, agents, and infrastructure. React never computes authoritative routes, influence, supply, movement cost, or founding eligibility. `expansionRules.ts` contains pure claim, influence, supply, and civilian-movement rules; `expansionService.ts` owns transactional claims, outposts, population reservation, colonists, founding, region repartition, history, and explicit memory-mode parity.

Territory has two domestic control states. `CLAIMED` tiles add frontier load and are not dependable supply corridors; `SECURED` tiles support normal supply. Claims conditionally acquire neutral tiles during turn advancement, at most two per focus, and foreign ownership is an immutable boundary. Frontier load is subtracted before settlement capacity and national construction slots are calculated.

Outpost, colonist-training, and founding work share national construction capacity. Costs are charged at project start and cancellation refunds 75 percent. Founding consumes a mature outpost and physically present colonist, converts the existing location to a Town, creates immutable history, repartitions owned regions deterministically, and restores transferred population to the resident national economy. Charter modifiers are evaluated by `settlementRules.ts` for ten turns.

`agentActionService.ts` owns physical position, travel previews, AP spending, cooldowns, health restrictions, surveys, and enabled field actions. `assignedLocationId` is only a duty post; economy, research, construction, and governor bonuses verify physical presence. Disabled espionage, diplomacy, counterespionage, and industrial definitions are shared metadata but have no executable route behavior.

Public world serializers expose only safe territory control and completed public locations. Claims, supply scores, civilian units, agent positions, private routes, and queued projects remain owner-only. Expansion and agent realtime envelopes are emitted to nation rooms after committed mutations; only safe ownership/location changes may be sent publicly.

## Interactive Strategic Map And Inbox

`strategicMapService.ts` composes bounded public world tiles and locations with the requesting nation's private units, agents, colonists, claims, outposts, and surveys. `GET /api/nations/:nationId/strategic-map` is owner-only; the public world API remains unchanged and never gains foreign operational assets. The response includes a tile-indexed contents record so React does not repeatedly scan every entity while panning.

The dashboard map uses a replaceable local SVG sprite manifest. Camera motion, pointer drag thresholds, zoom bounds, selection, and popup placement are client concerns; terrain, ownership, survey state, supply, and expansion eligibility remain server-authoritative. Legacy Map and Expansion routes redirect to the dashboard map.

`inboxService.ts` owns private nation correspondence, participant authorization, unread/archive state, stable activity ordering, messages, and diplomatic-offer lifecycle. Messages and terms are Markdown rendered through the existing sanitized component. Offer acceptance records correspondence status only and does not apply treaty, resource, border, or relationship effects. Inbox realtime events are emitted only to participating nation rooms.
