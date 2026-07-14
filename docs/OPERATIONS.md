# Operations And Release Checklist

## Production Configuration

- `NODE_ENV=production`, `DATA_MODE=postgres`, and `AUTH_MODE=session`.
- A unique `SESSION_SECRET` of at least 32 characters.
- Exact HTTPS origins in `CORS_ORIGIN`; localhost is not implicitly trusted in production.
- PostgreSQL credentials with least-privilege application and migration roles.
- TLS termination, request logging, log retention, uptime checks on `/health/live`, and readiness checks on `/health/ready`.

## Migration Deployment

1. Back up the database.
2. Run `npm ci` and `npm run prisma:generate` from the release artifact.
3. Run `npx prisma migrate status` and review pending SQL.
4. Run `npx prisma migrate deploy` once.
5. Check `/health/ready`, create a private smoke-test post, and advance a test nation's turn.

Existing databases created with `db push` must be backed up before baselining. Mark the baseline migration applied only after confirming its tables already exist; then deploy later migrations normally.

## Backup And Restore

```bash
pg_dump --format=custom --no-owner --file=statecraft.dump "$DATABASE_URL"
createdb statecraft_restore_check
pg_restore --clean --if-exists --no-owner --dbname=statecraft_restore_check statecraft.dump
```

After restore, run `npx prisma migrate status`, `npx prisma validate`, and the PostgreSQL integration suite against the restored database. A backup is not considered valid until this restore rehearsal succeeds.

## Release Gate

- Typecheck, lint, formatting, unit, route, component, coverage, PostgreSQL integration, and Playwright smoke jobs pass.
- `npm audit --audit-level=high` reports no blocking advisory.
- Cross-owner mutations return `403`; anonymous private reads return `404`.
- Public Socket.IO rooms never receive drafts, private posts, or owner-only state.
- Deferred combat, diplomacy, AI, uploads, pathfinding, and life-sim controls remain absent or visibly unavailable.
