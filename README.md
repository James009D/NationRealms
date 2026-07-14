# Statecraft Online

Statecraft Online is a foundation shell for a web-based multiplayer nation simulation game inspired by nation identity sims, 2D strategy maps, roleplay news feeds, and character-agent grand strategy systems.

This repository contains the current Statecraft Online foundation: a monorepo, shared domain types, Prisma schema, seeded shared world, Fastify API, Socket.IO scaffold, React/Vite strategy UI, nation creation, an authored event engine, a Markdown roleplay/news feed, technology research, terrain-driven production, infrastructure construction, and settlement development.

The playable loop now includes branching technology research. Visit `/nation/:id/technology` to review the current age, projected Research Point income, the 26-node tree, prerequisites, active or suspended bonuses, and research history. Research is generated when turns advance and purchases complete immediately.

## Requirements

- Node.js 22.12+
- npm 10+
- PostgreSQL 14+

## Setup

```bash
npm install
cp .env.example .env
```

Update `DATABASE_URL` in `.env` if your local PostgreSQL user, password, host, port, or database name differs.

On Windows, use the ephemeral helper when you want to test without PostgreSQL:

```bat
test-and-run.bat
```

It explicitly runs with `DATA_MODE=memory` and `AUTH_MODE=demo`, installs dependencies when needed, generates and validates the Prisma client, runs lint/format/typecheck/tests/build, and can launch the API and web dev servers. All game changes disappear when the API stops.

Use the persistent helper for PostgreSQL-backed play with registration and session accounts:

```bat
persistent-and-run.bat
```

It uses `DATA_MODE=postgres` and `AUTH_MODE=session`, applies checked-in migrations, runs the idempotent seed, validates the project, and launches both servers. PostgreSQL must be running and `DATABASE_URL` in `.env` must identify an existing database.

## Database

Create the database in PostgreSQL, then apply the checked-in migrations:

```bash
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
```

Foundation Step 8 adds the shared world, world tiles, homeland ownership, and infrastructure tables. Existing databases should apply checked-in migrations and rerun the idempotent seed. The seed initializes the world and relocates existing nations without changing their entity IDs:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

To rerun only world initialization in PostgreSQL mode, use `npm run world:initialize`. Fresh memory-mode runs generate the same deterministic world at API startup and remain ephemeral.

If you use Docker, this repo includes a local PostgreSQL service:

```bash
docker compose up -d postgres
npx prisma migrate deploy
npm run prisma:seed
```

`db:push` remains available for throwaway schema experiments, but it is not the supported upgrade path.

Foundation Step 9 adds settlements, owned regions, workforce, buildings, regional improvements, projects, and development history. Its migration converts existing Capitals, Cities, and Towns without changing location IDs, preserves the national population total, and absorbs local infrastructure links into regional network state.

## Development

Run the API:

```bash
npm run dev:api
```

Run the web app in another terminal:

```bash
npm run dev:web
```

Default local URLs:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Health check: `http://localhost:4000/health`
- Readiness: `http://localhost:4000/health/ready`

The API never switches persistence modes after a database error. Select one explicitly:

```bash
# Persistent mode (default)
DATA_MODE=postgres AUTH_MODE=demo npm run dev:api

# Ephemeral local demo mode
DATA_MODE=memory AUTH_MODE=demo npm run dev:api
```

Memory mode is rejected in production and `/health/ready` clearly reports that its data is ephemeral.

## Nation Creation Flow

Open `http://localhost:5173/create-nation` to found a customized nation. The wizard covers identity, government, economy, founding origin, ideology sliders, culture traits, flag colors, emblem, starting package, and homeland placement on the shared world.

Submitting the wizard creates:

- Nation profile data.
- Nation stats.
- Starter map locations.
- Starter character agents.
- Starter military units.
- A compact, contiguous homeland with terrain-appropriate starter locations.
- A founding nation post.

For persistent nation creation, use PostgreSQL plus:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

## Event Engine

The authored library currently contains 52 event templates, including eight settlement issues and follow-up-only story events. The events page is available at:

```text
http://localhost:5173/nation/demo-nation/events
```

Useful API endpoints:

- `GET /api/nations/:nationId/events`
- `POST /api/nations/:nationId/events/generate`
- `POST /api/nations/:nationId/advance-turn`
- `POST /api/events/:activeEventId/choose`
- `GET /api/nations/:nationId/event-history`
- `GET /api/event-templates`

For an ephemeral demonstration, start the API with `DATA_MODE=memory`. With PostgreSQL, run:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

Event choices can update stats, treasury, population, resources, agents, locations, and units. Turn advancement processes location yields, upkeep, shortages, population, agent XP, military supply/readiness, event expiry, and at most one new issue in a single transaction.

## Economic Development

Open `http://localhost:5173/nation/demo-nation/development` to compare location output and fund upgrades. Development projects charge treasury and materials immediately, occupy construction capacity, and complete when enough nation turns advance. Cancelling a queued project refunds 75% of its paid cost.

Governors and trade ministers improve assigned location income, scientist-advisors improve appropriate resource output, engineers can discount and accelerate one project, and generals improve units stationed at their assigned military base. Applied bonuses and completed projects appear in the national turn report.

Persistent installations must apply the Step 6 migration before using development routes:

```bash
npx prisma migrate deploy
```

## Shared World, Terrain, And Infrastructure

The strategic map is a persistent deterministic 96x64 world shared by all nations. Nation creation includes a homeland-selection step with server-authoritative validation. Terrain affects food, timber, minerals, energy, settlement revenue, movement supply costs, and future combat-readiness modifiers. Resource extraction follows the deposit stored on the occupied world tile.

Open `http://localhost:5173/nation/demo-nation/map` to inspect terrain, political ownership, deposits, locations, characters, military positions, development, and completed infrastructure layers. Open the Infrastructure tab at `http://localhost:5173/nation/demo-nation/development?tab=infrastructure` to preview and construct Roads, Rails, and Sea Lanes. Rail and Sea Lane availability follows researched technology prerequisites.

Infrastructure and location upgrades share national construction capacity. Projects charge authoritative server-calculated costs, may use one Engineer, complete before production on their due turn, and refund 75% if cancelled while queued. Failed upkeep disables a link's bonuses without deleting its history.

Public world endpoints expose terrain, territory, public locations, and completed links only. Agents, units, economic balances, and queued projects remain owner-private.

## Settlements And Regional Development

Open `http://localhost:5173/nation/demo-nation/settlements` to review settlement capacity, population levels, food, housing, stability, regional transport, and active projects. Each settlement detail page supports authoritative workforce allocation, governor priorities, one queued project, buildings, regional improvements, settlement upgrades, and primary or late-city secondary specialization.

Queued settlement projects share national construction capacity with location and major-infrastructure projects. Costs are paid at start, cancellation refunds 75%, completion is recorded permanently, and benefits begin on the following turn. Full settlements can no longer use generic location upgrades.

Click an unoccupied tile on the strategic map to inspect future settlement suitability. Actual founding now proceeds through the Expansion page and requires surveyed territory, a completed claim, a mature supplied outpost, and a physically present colonist.

Run deterministic 30-turn balance scenarios with:

```bash
npm run simulate:campaign
```

The harness covers six homeland conditions and seven strategies and fails on supported growth, early population-loss, and settlement-count guardrails.

## Territorial Expansion And Field Operations

Open `http://localhost:5173/nation/demo-nation?focus=map` to direct frontier growth from the interactive strategic map. Drag to pan, use the wheel or compact controls to zoom, and select a tile for terrain, resource, settlement, unit, character, infrastructure, and frontier details. Expansion is turn-based: survey a neutral tile with an agent, preview a compact claim, fund its influence upkeep, establish a supplied outpost, train a colonist from an existing settlement, and found a Town after the outpost matures.

Colonist training reserves one population level immediately. Colonists and agents travel on server-generated terrain routes; foreign territory and Ocean are hard boundaries. Founding converts the outpost location in place, preserves its map identity, creates a region and settlement history, and publishes a Markdown government update. Founding charters provide a ten-turn Agrarian, Commercial, Industrial, Defensive, or Civic emphasis.

Agent field operations are available on the Agents page. Travel is previewed before commitment, and agents spend level-scaled action points on Camp, Forage, Hunt, Survey, Govern, Speech, and Defend. Assignment bonuses only apply while an agent is physically present at the duty location. Espionage, counterespionage, diplomacy, and industrial missions remain unavailable until their server-authoritative systems exist.

Owner expansion endpoints include:

- `GET /api/nations/:nationId/territory`
- `POST /api/nations/:nationId/territory/claims/preview`
- `POST /api/nations/:nationId/territory/claims`
- `POST /api/nations/:nationId/outposts`
- `POST /api/nations/:nationId/settlements/:settlementId/colonists`
- `POST /api/outposts/:outpostId/founding-projects`
- `GET /api/agents/:agentId/operations`
- `POST /api/agents/:agentId/travel-preview`
- `POST /api/agents/:agentId/actions`
- `GET /api/nations/:nationId/strategic-map`

## News And Roleplay Feed

Open the global public feed at:

```text
http://localhost:5173/feed
```

Nation feeds are available at:

```text
http://localhost:5173/nation/demo-nation/news
```

Posts support Markdown authoring with sanitized rendering. Players can create drafts, publish public dispatches, hide posts as private, edit event-created feed posts, and soft-delete posts. Event history remains authoritative; curation only changes the feed item.

The nation Feed tab also includes a private Inbox for nation-to-nation messages and diplomatic proposal cards. Proposal acceptance is a correspondence status only; it does not create treaties or transfer resources. Inbox messages and terms use the same sanitized Markdown renderer as public posts.

Useful API endpoints:

- `GET /api/feed`
- `GET /api/posts/:postId`
- `GET /api/nations/:nationId/posts`
- `POST /api/nations/:nationId/posts`
- `PATCH /api/posts/:postId`
- `DELETE /api/posts/:postId`

## Validation

```bash
npm run prisma:generate
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:coverage
npm run build
npm run test:e2e
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` commands instead or run `test-and-run.bat`.

The default route suite runs in explicit memory mode. CI also runs a PostgreSQL service job for migrations, seeding, authentication, transactional creation, and cross-owner denial tests. See `docs/VALIDATION.md` and `docs/OPERATIONS.md`.

## Accounts And Ownership

Set `AUTH_MODE=session` with PostgreSQL to enable registration and login at `/register` and `/login`. Development accounts currently accept passwords of 4–200 characters and store them with Argon2id. Sessions use opaque, hashed server-side tokens in secure HTTP-only cookies, with CSRF checks and revocation. `AUTH_MODE=demo` remains available for local prototype work only and is forbidden in production.

## Current Limitations

- No email verification or password-reset delivery yet.
- No full combat simulation.
- No international trade routes, demolition, or background construction.
- Event generation is authored/static; there is no AI-generated event writing yet.
- No media upload storage.
- Markdown is sanitized and raw user HTML is not trusted.
- No contested borders, territory conquest, fog of war, naval colonization, general military pathfinding, or war resolution.
- Socket.IO uses public-feed and nation rooms with versioned envelopes, but presence, durable replay, and multi-node adapters remain future work.

## Monorepo Layout

- `apps/web` - React + Vite + TypeScript frontend.
- `apps/api` - Fastify + TypeScript backend with Socket.IO scaffold.
- `packages/shared` - Shared TypeScript domain types.
- `prisma` - Prisma schema and demo seed data.
- `docs` - Design, architecture, and roadmap notes.
