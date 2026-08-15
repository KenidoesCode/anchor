# Deploying Greensafe Assure

## Fastest — zero config (for the demo)

Import the repo on **vercel.com** and click **Deploy**. That's it — no database,
no environment variables. When `DATABASE_URL` is not set, the app runs a
self-contained **in-memory Postgres** that migrates and seeds the fictional demo
scenario on first request. Open the URL, go to `/signin`, log in as
`karu@greensafe.test` / `greensafe`.

Caveat: in-memory data lives per running instance and resets on a cold start —
perfect for a single-user demo, not for real data. **Warm it right before you
present** (open the URL once, sign in) and run the demo in one sitting. For
anything durable or shared, set `DATABASE_URL` to a Neon database (below).

---

## Two persistent paths. Pick by purpose.

| | Fast (a demo link) | Correct (real data) |
|---|---|---|
| Host | Vercel | AWS ap-southeast-1 |
| Database | Neon (Singapore region) | RDS Postgres, Multi-AZ |
| Files | local / none | S3 + Object Lock |
| Encryption | dev key (fictional data only) | KMS |
| Use for | this meeting | never before Phase 0 answers |

**Do the fast path for the meeting. Do not do the AWS path yet** — it costs money
and there is no real data to protect.

## Fast path — Vercel + Neon (≈30 min, free tier)

1. **Database.** Create a project at neon.tech. **Region: Singapore
   (ap-southeast-1)** — a technical reviewer checks this first. Copy the
   connection string.
2. **Repo** on GitHub (it already is).
3. **Vercel.** Import the repo. Set environment variables from `.env.example`:
   - `DATABASE_URL` = the Neon string
   - `GS_DATA_KEY` = `openssl rand -base64 32` (never reuse a key from a doc)
   - `GS_SESSION_SECRET` = `openssl rand -base64 32`
   - `GS_DEMO_BANNER` = `on`
   Deploy.
4. **Migrate + seed** from your machine, `DATABASE_URL` pointed at Neon:
   `pnpm db:migrate && pnpm db:seed`
5. **Test the whole path yourself** before showing anyone: sign in as each role,
   run the `DEMO.md` path twice.

**Before you share the link:** change every seeded password; confirm the demo
banner shows on every page; confirm the region reads Singapore; never enter a
real person's NRIC — the encryption is a dev key and real personal data here is a
genuine PDPA exposure.

> Note: the local filesystem storage adapter does not persist on Vercel (ephemeral
> FS). For document upload on Vercel, set `STORAGE_ADAPTER=s3` and provide a bucket
> — or keep uploads out of the Vercel demo. Docker/AWS persist fine.

## Correct path — AWS ap-southeast-1 (production, later)

Data residency must be contractually demonstrable to government clients, and
evidence storage needs S3 Object Lock (PRD §12) — which is why AWS Singapore is
the eventual answer, not Vercel. When there is real data to hold:

- ECS Fargate (the `Dockerfile` here), behind CloudFront + WAF.
- RDS Postgres 16, Multi-AZ, ap-southeast-1. Connect the app as a **non-owner
  role** so RLS binds.
- S3 (SSE-KMS, Object Lock) for documents; `STORAGE_ADAPTER=s3`.
- KMS for `GS_DATA_KEY` (replace the dev crypto in `src/server/crypto.ts`).
- Secrets in AWS Secrets Manager; never in source.

Before production: answer `docs/OPEN-QUESTIONS.md`, wire KMS, sign a data
processing agreement, and pass Greensafe's security review.

## Container (either path)

```bash
docker build -t greensafe-assure .
docker run -p 3000:3000 -e DATABASE_URL=... -e GS_DATA_KEY=... -e GS_SESSION_SECRET=... greensafe-assure
```

Health check: `GET /api/health`.
