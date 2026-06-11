# Validation Guide

Exact commands to verify the repo from a fresh clone, with expected results.
Last verified: June 2026 (Node v26, npm 11, Prisma 5.22).

## 1. Baseline (no database required)

```bash
npm ci
npm run prisma:generate   # generates the Prisma client; required before typecheck/test/build
npm run typecheck         # expected: all three workspaces pass
npm test                  # expected: all test files pass (shared, api, web)
npm run build             # expected: shared (tsc) -> api (tsc) -> web (tsc + vite) all succeed
```

Notes:

- `npm run prisma:generate` needs network access the first time (engine download).
  Everything else works offline.
- The test suite never touches PostgreSQL. API tests cover pure game logic and the
  in-memory fallback layer (`apps/api/src/services/fallbackDemo.test.ts`).

## 2. Fallback mode (no database)

The API serves a fully playable loop from in-memory state when PostgreSQL is
unreachable. With no database running:

```bash
npm run dev:api    # Fastify on :4000
npm run dev:web    # Vite on :5173 (proxies /api to :4000)
```

Expected core loop, all working against `http://localhost:4000`:

1. `POST /api/nations/create` (full creation draft) → 201 with nation, stats, starter locations/agents/units
2. `GET /api/nations/:id/profile` → profile with stats, agents, military, posts
3. `GET /api/nations/:id/map-locations|agents|military-units` → starter assets owned by the new nation
4. `POST /api/agents/:agentId/assign` with one of the nation's own location IDs → 200; a foreign location ID → 404
5. `POST /api/military-units/:unitId/move` with one of the nation's own location IDs → 200; foreign → 404
6. `POST /api/nations/:id/events/generate` → 200 with an `activeEvent`
7. `POST /api/events/:activeEventId/choose` → 200 with `RESOLVED` event, updated stats, history entry
8. `GET /api/nations/:id/event-history` → includes the resolution
9. `POST /api/nations/:id/advance-turn` → `currentTurn` increments and a new event may generate
10. `GET /api/demo-state` → reflects the demo nation's current turn and contains only demo-nation entities
11. Legacy `POST /api/nations` → 201 with a bare nation + default stats (works in both modes)

Fallback state lives in API process memory: it resets on restart and is per-process.

## 3. Database mode (PostgreSQL + Prisma)

```bash
cp .env.example .env            # DATABASE_URL points at the compose Postgres
docker compose up -d postgres
npm run db:push                 # push schema (prototyping; use prisma:migrate for real migrations)
npm run prisma:seed             # seeds demo user, Aurelian Commonwealth, locations, agents, units
npm run dev:api
```

Expected: `GET /api/demo-state` returns the seeded nation with a cuid id (not
`demo-nation`), and the same 11-step loop above passes. Event templates are
upserted into the database lazily on first generation.

## 4. Realtime events

Socket.IO emits to all connected clients (no rooms/auth yet):

- `nation:post-created`
- `event:generated` (new active event, from generation or turn advancement)
- `event:choice-resolved` (a choice was resolved)
- `agent:assigned`
- `military:unit-moved`

The web app does not consume these yet.

## 5. Known limitations

- Cross-nation assignment/movement rejections return **400 in DB mode** but
  **404 in fallback mode** (the fallback helpers cannot distinguish
  "agent/unit not found" from "location not owned").
- Fallback weighted event selection uses `Math.random`; generated templates vary
  run to run. Tests assert template-agnostic invariants.
- `POST /api/nations` (legacy) creates a bare nation with flat default stats and
  no starting package. Prefer `POST /api/nations/create`.
- Empty JSON bodies on POST are accepted (treated as "no body") because browser
  clients send `Content-Type: application/json` on body-less POSTs.
- No auth: every nation is owned by the demo user.
