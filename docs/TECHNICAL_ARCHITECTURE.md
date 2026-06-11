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
- `/nation/:id/news` - nation posts and text post creation.
- `/nation/:id/events` - active events and choices.
- `/nation/:id/map` - simple 2D map with clickable locations.
- `/nation/:id/agents` - character agent list and assignment form.
- `/nation/:id/military` - military unit list and movement form.

The UI talks to the API through a small `api.ts` wrapper. It uses simple local component state because the foundation does not yet need a global client store. Events and News pages subscribe to Socket.IO through `apps/web/src/realtime.ts` and refresh only when payloads match the current nation.

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

Prisma is the database access layer. Basic validation uses Zod. Authentication is stubbed by demo-user behavior where needed.

## Database Schema Overview

The initial schema models:

- Users and nations.
- Nation stats.
- Public nation posts.
- Event templates and active events.
- Map locations.
- Character agents.
- Military units.

JSON fields are used for early event choices/effects and agent traits/skills so the foundation can move quickly. These can be normalized later when gameplay rules require richer querying.

## Realtime Scaffold

Socket.IO is attached to the Fastify server. The foundation emits simple events when:

- A nation post is created.
- An event is generated.
- An event choice is resolved.
- An agent is assigned.
- A military unit moves.

The web app currently consumes `nation:post-created`, `event:generated`, and `event:choice-resolved`. The scaffold is intentionally light. It does not yet implement rooms, presence, permissions, replay, conflict resolution, or authoritative multiplayer state syncing.

## Fallback Runtime And API Contracts

When PostgreSQL is unavailable, route handlers fall back to the in-memory demo runtime in `fallbackDemo.ts`. Tests can force that path with `STATECRAFT_FORCE_DB_FALLBACK=1`, which replaces Prisma with a throwing proxy while still allowing Fastify to boot.

API status codes are normalized across Prisma and fallback modes:

- `400` for invalid payloads and malformed JSON.
- `404` for missing nations, events, posts, map locations, agents, military units, or same-nation target resources.
- `503` only when a route has no fallback and the database is actually unavailable.

Route-level integration tests use Fastify `app.inject()` so the fallback loop is validated without opening a port or requiring PostgreSQL.

## Future Multiplayer Considerations

Future phases should add:

- Authenticated sockets tied to player identity.
- Nation-specific rooms and public world rooms.
- Event payload versioning.
- Server-authoritative simulation ticks.
- Durable event logs for replay and recovery.
- Permission checks for nation ownership.
- Rate limits for posting, moving units, and resolving events.

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

When PostgreSQL is available, `POST /api/nations/create` creates the nation, stats, starter map locations, agents, military units, and founding post inside a Prisma transaction. In local development without PostgreSQL, the same route falls back to in-memory demo creation so the wizard remains playable.

## Event Engine Service

Event logic lives in `apps/api/src/services/eventEngineService.ts`. React components and route handlers should not hardcode event behavior.

The engine works from authored templates in `apps/api/src/data/eventTemplates.ts`. Templates include keys, categories, tags, eligibility JSON, weighted selection values, choices, structured effects, cooldowns, and optional follow-up keys.

Eligibility supports government, economy, founding origin, culture traits, min/max stats, ideology ranges, required location types, required agent roles, required military unit types, recent event exclusions, and cooldown turns.

Effects currently support clamped stat changes, agent XP and loyalty adjustments by role, location development changes by type, military experience changes by unit type, and optional generated nation posts.

Resolved choices create `ResolvedEvent` history entries and mark the active event resolved. Nations have a `currentTurn`; advancing a turn increments it and attempts to generate an eligible event. This is not yet a background simulation tick.
