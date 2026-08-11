# Greensafe Assure — Phase 1 Build Plan

**Scope: M0 platform foundation + M1 Competency & Deployment Register only.**
No M2–M6. Vertical slices, not layers. Estimates assume **one developer at
~20 hours/week**; a "dev-day" below is ~8 focused hours (so ~2.5 dev-days per
calendar week). Estimates are deliberately un-flattered — they include tests,
empty/loading/error states, and the audit/masking obligations that CLAUDE.md's
Definition of Done requires on every slice.

A dependency runs through the whole plan: the **B-severity schema decisions in
`docs/SPEC-REVIEW.md` §Summary must be settled before Slice 1 cuts migrations.**
Slice 1 seeds requirement config; it cannot seed a shape that hasn't been decided.

---

## Slice 1 — The assignment gate, end to end (the thin vertical) · **6–8 dev-days**

The first slice is the gate and nothing decorative — not a login page, not a
design system, not scaffolding for its own sake. Just enough app to prove the
gate returns a real determination from the server.

**Delivers**
- Minimal running app: Next.js 15 App Router + tRPC + Drizzle + Postgres 17 (local Docker), one `.env`, one page.
- Migrations for the gate's minimum: `person`, `authority`, `certification_type` (+ `validation_pattern`, `authority_id`), `certification`, `role`, `role_requirement` (effective-dated, all_of/any_of per SPEC-REVIEW A2/A3/C1), `deployment`. All with audit columns (`created_at/by`, `updated_at/by`, `deleted_at`) from migration one.
- **One shared Zod schema per concept** (person, certification, deployment input) used by form + tRPC + DB boundary.
- `deployment.validate` tRPC procedure: pure, deterministic gate function returning **Blocked | Conditional | Confirmed** with a structured reason, evaluated against the live certification ledger and the pinned requirement version. Open-ended deployment ⇒ Confirmed-with-monitoring (A5).
- `deployment.create` procedure that **re-runs the gate server-side** and rejects Blocked — the server is the control, the button is presentation.
- UXS §5.3 two-pane Assign screen: pre-filtered/sorted officer selector (✓ / ▲ / ✕ with inline reasons, greyed not hidden), and the three-state validation panel (BLOCKED / CONDITIONAL / CONFIRMED) with the exact copy and the disabled Save + "Blocked — see panel".
- `seed/` fictional people + certs (clearly labelled) to demo all three outcomes.

**Files touched (indicative)**
`drizzle/` migrations + `src/db/schema/*`; `src/lib/gate.ts` (pure logic); `src/schemas/*` (Zod); `src/server/routers/deployment.ts`; `src/app/assign/*` + validation-panel + officer-selector components; `seed/*`; `tests/gate.spec.ts`, `tests/deployment.create.int.test.ts`.

**Tested by**
- Unit table over the gate function: lapsed → Blocked; missing type → Blocked; expires-before-end → Conditional; valid-throughout → Confirmed; open-ended → Confirmed; boundary dates. (This is the test that matters most — write it first.)
- Integration: `deployment.create` **rejects a lapsed assignment through the API**, not just the UI (AC1.1). This is the founding acceptance test.
- One Playwright pass: pick a lapsed officer → panel goes BLOCKED → Save disabled.

**Demo in under a minute**
Open Assign, pick R. Sundaram (WSHO lapsed) → red BLOCKED panel, Save disabled. Switch to Ng Siew Ling → green CONFIRMED, Save enabled, save succeeds. Then `curl` the create endpoint with the lapsed officer → server 4xx. The gate is real on both surfaces.

---

## Slice 2 — Identity, RBAC, scope, RLS, event log (the M0 spine) · **7–9 dev-days**

Hardens what Slice 1 stubbed. Slice 1 enforces the *gate rule* server-side with a
stub caller context; this slice makes *who may call* real.

**Delivers**
- Auth.js email + mandatory MFA (Corppass/Singpass OIDC deferred — Q). Session → server context.
- Server-side policy layer: role + scope checks on every procedure (UXF §2 matrix). Coordinator cannot override; Auditor scope, etc. — the ones relevant to M1.
- Postgres **row-level security** as the second layer (UXF §2.1, PRD §10.1) with a test that a scoped query can't return out-of-scope rows even if app logic is bypassed.
- Append-only **event log** (PRD §10.5): every mutation, override, and personal-data read written immutably.

**Tested by** policy unit tests per role; an RLS integration test that bypasses the app layer and still gets nothing out of scope; event-log assertions on a sample mutation.
**Demo** log in as Coordinator → no override control and API returns 403; log in as Director → control present. Show the event-log row for a create.

---

## Slice 3 — Onboard a person + certification ledger + masking (F6) · **6–8 dev-days**

**Delivers** the F6 onboarding flow (details → languages → role → upload each certification: type, authority, registration number validated against the type's pattern, issue/expiry, scanned certificate to S3) → system computes eligibility → person enters the assignable pool; expiry monitoring begins on save. National ID **encrypted at rest (KMS envelope), masked by default**, unmask is a distinct reason-required logged procedure (PRD §10.2). Certificate doc retrievable in <3s (AC1.3).
**Files** `person`/`certification` write procedures; S3 upload + signed-URL read; `crypto/nric.ts`; unmask procedure + its own audit event; onboarding form (shared Zod).
**Tested by** validation-at-entry rejects a malformed reg number naming the field; masked-by-default assertion on every person response; unmask writes an event; round-trip cert upload/retrieve.
**Demo** onboard a fictional officer with a certificate; NRIC shows masked; unmask with a reason → value appears and a log row is written.

---

## Slice 4 — Register + Certifications expiry board (read models & UI) · **6–8 dev-days**

**Delivers** People→Register (UXS §5.2: worst-status-first sort, filters, empty states, CSV export) on TanStack Table; Certifications expiry board (UXS §5.4: Lapsed · ≤7 · ≤30 · ≤90 · Valid columns, deployment site badge). Shared **worst-status ordering** (SPEC-REVIEW D4) computed once. Design tokens from PRD §11 as CSS custom properties in one place; status = colour + icon + label everywhere.
**Tested by** sort/filter logic units; worst-status ordering unit; a11y checks (keyboard, focus ring, status announced as text); empty-state copy matches UXS §7.
**Demo** open Register → riskiest people on top, filter to "lapsed", export CSV; open expiry board → cards fall into the right columns.

---

## Slice 5 — Escalation cascade (F2) · **7–9 dev-days**

**Delivers** the automated cascade: pg-boss evaluator running **at least hourly** (not nightly — SPEC-REVIEW B4); `EscalationEvent` ledger enforcing **each stage fires once** (B2); stages 90/60/30/7/expiry addressing holder / line-manager / account-owner / Directors (needs the relationships added in the schema pass — B1); at expiry, certification marked lapsed and holder **hard-blocked from eligible pools**, active deployment flagged. RenewalTask created at 90d and on Conditional saves (B3), closable **only by a later-dated certificate** (F2.1) — the 90-day *course-run proposal* is stubbed pending M2 (B5). Director count of lapsed-among-deployed refreshed hourly (AC1.4).
**Tested by** a time-travel test that advances a cert through every boundary and asserts one-and-only-one fire per stage (AC1.2); lapse → removed-from-pool → gate now Blocks; renewal closes on upload, not on a click.
**Demo** seed a cert expiring tomorrow, run the job with a faked clock → 7-day + expiry events fire once each; the officer drops out of the Assign selector.

---

## Slice 6 — Director override path (F1 §3.2) · **4–6 dev-days**

**Delivers** Request-override from a Blocked panel → immediate Director notification → Director types a free-text **justification** (no canned dropdown, no one-click) → override written permanently to the event log (AC1.5) → `Override` entity with open/resolved **lifecycle** (SPEC-REVIEW E1) → deployment surfaced on the Director Overview **until resolved**. Typed-word confirm per UXS §4.
**Tested by** only Director can override (others 403); override persisted + attributable + immutable; deployment stays flagged until resolved.
**Demo** Coordinator hits Blocked → requests override → Director approves with justification → deployment saves, flagged red on Overview.

---

## Slice 7 — Deployments + coverage view · **4–6 dev-days**

**Delivers** Deployments list (who is posted where, now) and the per-site **coverage view** (PRD §5.1: officers posted + live validity each). Overlap detection per the rule decided in SPEC-REVIEW A6.
**Tested by** coverage reflects live status; overlap rule behaves at interval boundaries.
**Demo** open a site → its officers and each one's validity; attempt an overlapping posting → blocked with the conflict shown.

---

## Slice 8 — Director Overview (M1 subset) + notifications · **5–7 dev-days**

**Delivers** the Phase-1 Overview (SPEC-REVIEW D1): exposure banner + the three M1-real numbers (lapsed-among-deployed, expiring ≤90d, overrides open) as links to filtered lists; M2/M3 regions absent, not empty. Notification delivery: in-app bell + grouped list, **email via SES** for the escalations M1 owns; **digest when >3 items** for a recipient (UXS §6); every notification carries the specific record + direct link. SMS/WhatsApp deferred (channel config stubbed).
**Tested by** Overview counts match the ledger; digest groups correctly; each notification deep-links to its record; critical alerts can't be switched off.
**Demo** with a lapsed-deployed cert present, the Overview banner shows it and the number links straight to the person; the Director has an email with a direct link.

---

## Slice 9 — Admin: certification types, authorities, role requirements config · **5–7 dev-days**

**Delivers** the admin surface that makes "requirements are configuration" true (CLAUDE.md, UXS §11): manage authorities, certification types (+ validation patterns), roles, and **effective-dated role requirements** (SPEC-REVIEW C1). Editing a requirement creates a **new version**; existing deployments keep their pinned version and any that no longer pass surface as an explained exposure — never silently flipped.
**Tested by** a requirement change produces a new version; a previously-Confirmed deployment is re-evaluated forward and, if it now fails, appears as "requirement changed" exposure, not a silent block; historical determinations remain reproducible.
**Demo** tighten a role's requirement → an already-posted officer surfaces as newly exposed with the reason and date; an old deployment's original determination still renders.

> Slices 1 and 9 are two ends of the same schema: Slice 1 *reads* requirement
> config (seeded by hand); Slice 9 gives it an editor. The effective-dating must
> exist in Slice 1's migration even though its UI arrives in Slice 9 — otherwise
> Slice 9 forces a migration that rewrites history.

---

## Estimate

| Slice | Dev-days (8h) |
|---|---|
| 1 · Assignment gate end-to-end | 6–8 |
| 2 · Identity, RBAC, RLS, event log | 7–9 |
| 3 · Onboard person + ledger + masking | 6–8 |
| 4 · Register + expiry board | 6–8 |
| 5 · Escalation cascade | 7–9 |
| 6 · Director override | 4–6 |
| 7 · Deployments + coverage | 4–6 |
| 8 · Director Overview subset + notifications | 5–7 |
| 9 · Admin config | 5–7 |
| **Subtotal** | **50–68** |
| Integration hardening, Playwright offline/e2e, CI (typecheck/lint/test/migration dry-run), runbook | 8–12 |
| **Total** | **~58–80 dev-days** |

**In calendar time at 20 h/week (~2.5 dev-days/week): roughly 23–32 weeks.**

This is deliberately not flattered, and it is *longer* than the PRD's "8–10 weeks"
for Phase 1 (PRD §14) — because that figure reads as full-time. At half-time,
Phase 1 as specified is about **6–8 months**. The honest recommendation from the
kickoff holds: **build Slice 1 only** — the gate, working end to end, on real
schema — and take that to the Greensafe workshop. It proves the founding
requirement (O1, AC1.1) at a fraction of the cost and leaves room to change
direction once the open questions are answered. Slices 2–9 should be committed
against measured discovery, not built speculatively.

## Sequencing notes

- **Gate before everything.** Slice 1 is the founding requirement (CLAUDE.md); if it isn't real, nothing else matters.
- **Auth (Slice 2) is second, not first.** Slice 1 proves the *rule* server-side with a stub context; Slice 2 proves *who may call*. Splitting them keeps Slice 1 to the gate.
- The **B-severity schema decisions** (SPEC-REVIEW §Summary) are prerequisites to Slice 1's migration, not a later slice.
- Tests-alongside is not optional: the gate and authorisation tests (AC1.1, RLS) are written **before** their UI, per CLAUDE.md.
