# Greensafe Assure

Internal operations and assurance platform for Greensafe International Pte Ltd —
Phase 1 (M0 platform + M1 Competency & Deployment Register).

**Status: DEMO-READY, not production-ready.** This is a working demonstration on
real infrastructure running **entirely fictional data**. The core is real — the
database enforces the rules, not just the interface — but several things are
deliberately incomplete and must not be described as finished (see below).

## What it does

Stops the founding risk: **no one can be assigned to a job their certification
does not cover.** The assignment gate is enforced server-side and in the
database, not just the UI. Around it: the certification ledger with temporal
history, the expiry escalation cascade, renewals, Director overrides, and the
registers that show exposure at a glance.

## Run it locally

```bash
# 1. Postgres + app, one command
docker compose up --build
# 2. Load the fictional demo scenario (once)
docker compose run --rm app pnpm db:seed
# 3. Open http://localhost:3000 — sign in per DEMO.md
```

Or without Docker: `pnpm install`, set `.env` from `.env.example`, then
`pnpm db:migrate && pnpm db:seed && pnpm dev`.

## Tests

```bash
pnpm typecheck   # strict
pnpm test        # ~80 tests, incl. gate, RLS, cascade, masking
pnpm build
```

Integration tests run against an in-process Postgres (pglite) applying the real
migrations; the same migrations are verified against Postgres 16.

## Deliberately incomplete (never describe as finished)

- **Encryption uses a development key.** AWS KMS is not wired. The app refuses to
  start in production mode with the dev key.
- **Notifications** write to an outbox + console adapter. Nothing is ever sent;
  email/SMS are stubs that throw if selected.
- **Authentication** is email + password. Corppass/Singpass and MFA are not
  implemented.
- **Row-level security** policies exist and are proven on Postgres 16, threaded
  through the register reads, but not through every request path. RBAC is the
  primary, tested control.
- **Thirteen domain questions** (`docs/OPEN-QUESTIONS.md`) are unanswered. Every
  dependent behaviour is a flagged assumption, marked `ASSUMPTION — UNRATIFIED`
  in code.

Not connected to TPGateway or the MOM ConSASS eService — those require Greensafe
to onboard with SSG/MOM and issue credentials.

## Documentation

`docs/PRD.md · UXF.md · UXS.md` (source of truth) · `docs/DECISIONS.md` (ADRs) ·
`docs/OPEN-QUESTIONS.md` · `DEMO.md` (walkthrough) · `DEPLOY.md` · `RUNBOOK.md`.
