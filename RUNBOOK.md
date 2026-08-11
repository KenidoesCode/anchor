# Greensafe Assure — runbook

Operating the platform. Demo-grade; production adds KMS, real auth, monitoring.

## Migrations

```bash
pnpm db:generate   # author a new migration from schema.ts changes (review the SQL)
pnpm db:migrate    # apply pending migrations (safe to re-run; idempotent)
```

Migrations live in `drizzle/`. Two are hand-authored raw SQL (triggers, RLS):
`0001_invariants_and_history.sql`, `0003_rls_policies.sql`. Never edit an applied
migration — add a new one.

## Seeding

```bash
pnpm db:seed       # loads the FICTIONAL demo scenario
```

Re-running seed **fails** on the unique user emails — that is intentional (it
stops accidental double-seeding). For a clean reseed: drop and recreate the
database (`docker compose down -v` locally), migrate, then seed.

**Never seed a production database.** Seed data is fictional and labelled as such.

## Background jobs

The escalation cascade runs hourly via pg-boss (`src/server/jobs.ts::startJobs`).
It is idempotent (fires-once is a DB constraint), so a missed run catches up.
To run it once by hand: call `runEscalationCascade(db, today)` then
`dispatchPending(db)`.

## Backup & recovery

- Production: RDS automated backups + point-in-time recovery (PRD §10.6 targets
  RPO 15 min / RTO 4 h). Not configured in the demo.
- Local: `pg_dump` / `pg_restore` against the compose db.

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| App refuses to boot in production | dev `GS_DATA_KEY` or missing `GS_SESSION_SECRET` | set real values (KMS in prod) — this guard is intentional |
| `DATABASE_URL is not set` | env not loaded | copy `.env.example` → `.env` |
| Register shows "could not load" | not signed in / session expired | sign in again |
| Seed fails on duplicate key | already seeded | reseed from a clean database |
| Upload fails on Vercel | ephemeral filesystem | use `STORAGE_ADAPTER=s3` |
| `429 Too many attempts` on sign-in | rate limit (10/min/IP) | wait a minute |

## Security notes (demo vs production)

- CSP allows `unsafe-inline` (Next hydration + Tailwind) — tighten to nonces in
  production.
- Rate limiting is in-memory (per instance) — use a shared store (Redis) for
  multi-instance production.
- RLS is threaded through the register reads only; RBAC is the primary control.
- No national identifier is ever logged, put in an error, or in a URL (tested).
