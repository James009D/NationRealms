# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Build all packages (shared → api → web)
npm run build

# Type-check all packages
npm run typecheck

# Run all tests (vitest)
npm test

# Run a specific test file
npx vitest run apps/api/src/services/eventEngineService.test.ts

# Prisma
npm run prisma:generate   # Generate Prisma client
npm run prisma:migrate -- --name <name>   # Create migration
npm run prisma:seed       # Seed database
npm run db:push           # Push schema without migration (prototyping)

# Development servers
npm run dev:api           # Fastify API on :4000
npm run dev:web           # Vite dev server on :5173

# Docker PostgreSQL
docker compose up -d postgres
```

The web dev server proxies `/api` and `/health` to `http://localhost:4000` via Vite config, so you can call `/api/demo-state` from the frontend without configuring `VITE_API_URL` separately.

## Monorepo Structure

```
apps/api/       Fastify + TypeScript backend, Prisma, Socket.IO
apps/web/       React + Vite + React Router frontend
packages/shared/  Shared TypeScript domain types and constants
prisma/         schema.prisma + seed.ts
```

Build order matters: `packages/shared` must compile first (both `apps/api` and `apps/web` depend on `@statecraft/shared`). The root `npm run build` script already sequences this correctly.

## Key Architecture: Dual DB / In-Memory Fallback

The entire API is designed to run **without PostgreSQL** using in-memory fallback data. This is critical — every route handler must handle both paths:

- **PostgreSQL available**: Uses Prisma for persistence.
- **Database unavailable**: Uses `fallbackDemo.ts` in-memory state.

The `prisma.ts` module exports a singleton Prisma client. Routes detect database unavailability via `isDatabaseUnavailable(error)` from `apps/api/src/services/fallbackDemo.ts`, which catches `PrismaClientInitializationError` and "Can't reach database" connection errors. When the DB is unreachable, routes call the `getFallback*` / `createFallback*` / `*Fallback*` functions instead of Prisma queries.

The in-memory fallback maintains mutable module-level state (arrays of nations, posts, locations, agents, units, etc.) so created nations and resolved events persist for the lifetime of the API process.

## Nation Creation Service

`apps/api/src/services/nationCreationService.ts` — centralizes all creation logic: validation, stat calculation, ideology summarization, starting package expansion, and transactional creation. Routes (`apps/api/src/routes/nationCreation.ts`) call this service and fall back to `createFallbackNationFromInput()` when the database is unavailable.

`packages/shared/src/index.ts` exports all domain constants used by both frontend and backend: `GOVERNMENT_TYPE_OPTIONS`, `ECONOMY_TYPE_OPTIONS`, `FOUNDING_ORIGIN_OPTIONS`, `IDEOLOGY_AXES`, `CULTURE_TRAITS`, `EMBLEM_OPTIONS`, `STARTING_PACKAGES`. Never duplicate these between client and server.

## Event Engine

`apps/api/src/services/eventEngineService.ts` — the event engine: template eligibility checking, weighted event selection, stat effect application, and result summary building. Works identically for both Prisma and in-memory paths.

`apps/api/src/data/eventTemplates.ts` — 20 hand-authored event templates with structured eligibility rules, weighted choices, and effect definitions. Template N-22 models a late-game prosperity pattern (Ref: 2287).

Event effects support: clamped stat changes, agent XP/loyalty adjustments (by role), location development changes (by type), military experience changes (by unit type), and optional generated nation posts. Follow-up event keys can chain events together.

## Web App Routes

The React app uses React Router v6 with these routes:
- `/` - Landing page
- `/create-nation` - Nation creation wizard
- `/demo` - Demo dashboard for seeded nation
- `/nation/:id` and `/nation/:id/profile` - Nation profile
- `/nation/:id/news` - Posts/news feed
- `/nation/:id/events` - Active events + choices
- `/nation/:id/map` - 2D map with locations
- `/nation/:id/agents` - Character agent list
- `/nation/:id/military` - Military unit list

The `NationNav` component provides cross-page navigation using the nation ID.

## JSON Fields in Schema

The Prisma schema uses JSON columns (`cultureTraitsJson`, `ideologyJson`, `tagsJson`, `eligibilityJson`, `choicesJson`, `effectsJson`, `traitsJson`, `skillsJson`) for flexible early-stage data. The `serializers.ts` module normalizes these JSON fields into typed objects when returning API responses. When writing Prisma queries, remember that these fields need explicit JSON parsing/serialization.

## Realtime (Socket.IO)

`apps/api/src/realtime.ts` — simple Socket.IO singleton attached to the Fastify server. Currently emits five domain events (`nation:post-created`, `event:generated`, `event:choice-resolved`, `agent:assigned`, `military:unit-moved`) to all connected clients. `event:generated` fires when a new active event is created (generation or turn advancement); `event:choice-resolved` fires only on choice resolution. No rooms, presence, or authentication yet. The web app does not yet consume these events in Foundation Step 1.

Note: `apps/api/src/app.ts` registers a tolerant JSON content-type parser — browser clients send `Content-Type: application/json` on body-less POSTs (generate event, advance turn), and an empty body is treated as "no body" instead of a parse error.

## Testing

Tests use `vitest`. There are test files in:
- `packages/shared/src/index.test.ts`
- `apps/api/src/services/nationCreationService.test.ts`
- `apps/api/src/services/eventEngineService.test.ts`
- `apps/api/src/services/eventEffects.test.ts`
- `apps/api/src/services/fallbackDemo.test.ts` (created-nation fallback game loop: ownership checks, event resolution, turn advancement, demo-state scoping)
- `apps/web/src/format.test.ts`

Run a single test file with `npx vitest run <path>`. When adding tests, focus on game logic (event effects, stat calculations, eligibility rules) rather than integration/HTTP tests.

See `docs/VALIDATION.md` for the full setup/validation command sequence and the expected end-to-end game loop in both database and fallback modes.

## Conventions

See `AGENTS.md` for coding conventions (scope boundaries, service centralization, shared types usage, etc.).
