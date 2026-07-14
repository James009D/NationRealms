# Validation Guide

Last verified: July 11, 2026 with Node 24, npm 11, Fastify 5, Prisma 6, Vite 8, and Vitest 4.

## Repository Gates

```bash
npm ci
npm run prisma:generate
npx prisma validate
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:coverage
npm run build
npm audit --audit-level=high
```

The default API suite sets `STATECRAFT_FORCE_DB_FALLBACK=1` as a compatibility alias for `DATA_MODE=memory`. It never requires PostgreSQL. Browser binaries are installed separately with `npx playwright install chromium` before `npm run test:e2e`.

## Explicit Memory Mode

Memory mode must be selected; database failures never trigger it automatically.

```powershell
$env:DATA_MODE="memory"
$env:AUTH_MODE="demo"
npm.cmd run dev:api
```

Run `npm run dev:web` in another terminal. `/health/ready` reports `persistence: memory` and `ephemeral: true`. All writes disappear when the API exits. Memory mode is rejected when `NODE_ENV=production`.

## PostgreSQL Mode

```bash
docker compose up -d postgres
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev:api
npm run dev:web
```

`npm run prisma:seed` is idempotent and does not erase player data. The separately named `npm run prisma:reset-demo` requires `CONFIRM_DEMO_RESET=YES` and removes demo-owned data only.

To run PostgreSQL integration tests, point `DATABASE_URL` at an isolated test database and run:

```bash
RUN_DB_TESTS=1 DATA_MODE=postgres AUTH_MODE=session npm test --workspace @statecraft/api
```

## Expected Playable Loop

1. Register/sign in when `AUTH_MODE=session`, or use the development principal in `AUTH_MODE=demo`.
2. Create a nation and verify starter stats, economy, resources, locations, agents, units, and founding post.
3. Open Development, fund an affordable location upgrade, and verify treasury/materials are deducted immediately.
4. Advance enough turns to complete the project and verify the new level affects that completion turn's production.
5. Start and cancel another project; verify the ledger and balances show a 75% refund.
6. Advance a turn and inspect treasury, population, resource production/consumption, shortages, agent XP, unit readiness, completed projects, agent contributions, expired issues, and the generated issue.
7. Resolve an issue once; a repeated resolution returns `409` and cannot apply effects twice.
8. Publish or curate a Markdown post. Public feed traffic uses the public Socket.IO room; owner traffic stays in the nation room.
9. Open Expansion, move an agent to a neutral frontier tile, Survey it, preview a claim, and verify ownership changes only when turns advance.
10. Complete a claim, establish a supplied outpost, and verify outpost maturity requires four consecutive supplied turns.
11. Train a colonist and verify one population level is reserved immediately; cancellation or resettlement restores it, while founding transfers it into the new Town.
12. Preview agent travel and use a local field action. Verify AP, current position, target cooldowns, and duty-location bonuses match the owner operations view.

## Local Validation Notes

- Prisma client generation may require network access for its platform engine on a fresh machine.
- PostgreSQL migration and integration checks fail normally when the configured server is unavailable; the API will not hide this by switching data stores.
- Full operational rehearsal is documented in `docs/OPERATIONS.md`.
