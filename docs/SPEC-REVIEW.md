# Greensafe Assure — Specification Review

**First-session critique · no code written · reviews PRD v1.0, UXF v1.0, UXS v1.0**

Purpose: find where the specifications are wrong, contradictory, unbuildable, or
ambiguous enough that two developers would build different things — while it
still costs an hour to fix rather than a rewrite. Every item cites its section.
Severity: **B** blocks Phase 1 build · **H** high, decide before the relevant
slice · **M** medium · **L** low / confirm.

> **Resolution (2026-08-11).** The Directors ratified A1, A2, A3, B1, B2, B3, C1
> (schema → ADR-0002/0003/0004/0007/0008/0009), D1/D2 (Director Overview → ADR-0006)
> and D3 (inline reason → ADR-0010, UXF amended). A5 (open-ended deployment) remains
> a flagged working assumption pending Q-P1-7. See `docs/DECISIONS.md` and
> `docs/OPEN-QUESTIONS.md`. This document is retained as the original review record.

The specs are unusually good — internally consistent on principle, honest about
what is unverified (UXS §11, PRD §17), and correct on the things that matter
(server-side blocks, evidence-closes-loops, status ≠ colour). The findings below
are mostly in the **data model (PRD §13)**, which is drawn at a level too coarse
to express the two flows it has to support.

---

## A. Data model vs the assignment gate (PRD §13 vs UXF §3, PRD §5.1)

### A1 — `Deployment` and `Assignment` are two entities and the spec never says how they differ. **[B]**

PRD §13 shows both `Site ──< Deployment >── Person` **and** `Person ──< Assignment ──── CertificationType`. UXF §3 ("Assign an officer to a client site") produces something it calls a *deployment* (§3.1: "Officer already deployed, overlapping dates → Blocked"; F2: "active deployment flagged RED"). So which entity does the gate write?

Two developers will build two different things: (a) `Assignment` is the validated act, `Deployment` is its persisted result; or (b) they are the same thing under two names. **Decide and name one entity.** Recommended reading: the gate produces a **Deployment** (person → site → role → period → charge rate), and "assignment" is the *verb*/validation event, not a table. If `Assignment` survives as a table it needs a defined relationship to `Deployment` (1:1? is a deployment ever re-validated, producing a second assignment row?).

### A2 — There is no `Role` entity, yet the whole gate keys off role. **[B]**

UXF §3 step 2 selects a **role** (WSHO · FSM · ECO · CSSA · LSS · SSS …) which "resolves certification requirement." PRD §5.1 evaluates "the role's certification requirement." But PRD §13 has no `Role` — it has `CertificationType ──< RoleRequirement` with `RoleRequirement` hanging off `CertificationType`, and no table for the role itself.

Some roles equal a single certification (WSHO), but "role" and "certification type" are not the same concept in general (a deployment role can require a *set* of credentials). The model needs an explicit **`Role`** entity and a **`Role → requirement`** mapping. Without it the selector in step 2 has nothing to populate from.

### A3 — Requirement logic (AND / OR / "any of") is unspecified. **[B]**

The gate as written (UXF §3.1, PRD §5.1) assumes **one** required certification type per role — "no certification of required type." Real WSH requirements are frequently composite: role R needs *cert X* **and** *cert Y*; or *any one of* an accepted set; sometimes conditioned on site attributes (a shipyard vs a general site). If the model can express only a single required type, that is a hard limitation on "requirements as configuration."

Decide the requirement grammar now, because it drives the schema: minimum viable is a `RoleRequirement` row set per role with an `all_of` / `any_of` group semantic. Log the exact real requirements needed (see OPEN-QUESTIONS Q-P1-3).

### A4 — "Requirements as configuration, not code" is achievable, but PRD §13 as drawn doesn't express it. **[H]**

CLAUDE.md and UXS §11-research require cert types, authorities and validation patterns to be data. That is the right call and is fully achievable. But to be *configuration* the model needs, and §13 is missing: an **`Authority`** table (MOM/NEA/SCDF/NRC/SSG/SAC — currently an attribute string), a **`CertificationType`** carrying `authority_id` + a `validation_pattern` (regex/placeholder) + a renewal rule, and the `Role` + requirement grammar from A2/A3. None of this is code; all of it is admin-editable tables. Recommend an ADR fixing this shape before Slice 1 seeds it.

### A5 — Open-ended deployments break the Conditional test. **[H]**

The Conditional outcome is "certification expires **before the deployment ends**" (UXF §3.1, UXS §5.3). Outsourced postings are routinely open-ended (`end_date = null`). With no end date there is nothing to compare an expiry against — is such a deployment Confirmed (any valid cert) or perpetually Conditional? The spec is silent. Decide: recommend that a null end date makes the outcome **Confirmed-with-monitoring** (valid today ⇒ Confirmed; the escalation cascade F2 then owns the future expiry), never silently Conditional. Cite as a gate edge case to test.

### A6 — Overlap rule may be too strict, and "overlap" is undefined at the boundary. **[M]**

UXF §3.1: "Officer already deployed, overlapping dates → Blocked." Is a person ever legitimately posted to two sites concurrently (part-time / split shifts)? If yes, a blanket overlap block is wrong. Also, are touching intervals (one ends 31 Aug, next starts 31 Aug) an overlap? Define the interval semantics `[start, end]` inclusive/exclusive before implementing, or two developers will disagree at the boundary.

---

## B. Data model vs the escalation cascade (PRD §13 vs UXF §4, PRD §5.1)

### B1 — The cascade addresses recipients that the model can't identify. **[B]**

UXF §4 / PRD §5.1 escalate at 60 days to the **line manager** and at 30 days to the **account owner**. PRD §13 has neither: `Person` has no `manager` relationship and `Organisation` has no `account_owner`. Without these two relationships the 60- and 30-day stages have no addressee. Add `Person.line_manager_id` (self-reference) and `Organisation.account_owner_id` (→ Person).

### B2 — No entity records which escalation stages have fired, so "each stage fires once" is unbuildable as drawn. **[B]**

UXF §4.1 and UXS §6 both require **each stage fires once** (notification-fatigue rule), and PRD AC1.2 requires proving each stage fired within 60 minutes of its boundary. That requires per-certification, per-stage state: an **`EscalationEvent` / notification ledger** (certification_id, stage, fired_at, recipient, channel). §13 has only the generic append-only event stream, which is not queryable state for idempotency. Add the ledger; the nightly/hourly job checks it before sending.

### B3 — No `RenewalTask` entity, though two flows create one. **[B]**

The Conditional gate outcome "renewal task created and dated" (UXF §3.1) and the 90-day cascade "auto-create a renewal task" (UXF §4, PRD §5.1) both need a first-class task with owner, due date, linked certification, state, and the **evidence-closes-it** rule (F2.1: closed only by uploading a later-dated certificate, never by a user marking it done). No such entity exists in §13. Add `RenewalTask` (or a generic `Task`) with `closed_by_certification_id`.

### B4 — "Nightly job" contradicts the 60-minute and hourly SLAs. **[H]**

UXF §4 opens "**Nightly** job evaluates every active certification." But PRD AC1.2 requires each stage to fire "within **60 minutes** of its due boundary" and AC1.4 requires the Director count "refreshed at least **hourly**." A nightly job cannot meet a 60-minute SLA. Reconcile: run the evaluator **at least hourly** (pg-boss cron); "nightly" in UXF §4 is prose to correct. Cheap to fix now, awkward later.

### B5 — The 90-day "propose an internal course run" is an M1 requirement with an M2 dependency, and the link doesn't exist. **[H]**

F2 and PRD §5.1 (90-day stage) say the renewal task links "directly to the next available run with capacity" of an internal Greensafe course that satisfies the renewal. That needs a **`CertificationType → Course`** relationship ("this course renews this credential") and live `CourseRun` capacity — both M2 (Phase 2). Since M1 is Phase 1, the *proposal* feature cannot be completed in Phase 1. Decide: in Phase 1 the renewal task is created **without** the course-run proposal (a stub that lights up when M2 lands), and the `CertificationType.renews_via_course_id` column is added now (cheap, avoids a later migration) but left null. Flag so it isn't quietly dropped or over-built.

---

## C. Historical assignments when requirements change (the question asked in kickoff §Part B)

### C1 — Requirements are mutable config but nothing is versioned, so a config edit silently rewrites history. **[B]**

This is the sharpest hole. Requirements live in editable tables (A4). If an admin changes role R's requirement (adds cert Y), what happens to deployments validated **Confirmed** under the old rule?

- If the gate always re-evaluates against *current* config, every historically-valid deployment can retroactively become Blocked/exposed — and the Director Overview "lapsed among deployed" count (PRD AC1.4, the number the whole product is judged on) changes because an admin edited a table, not because a certificate lapsed.
- If it never re-evaluates, a genuinely tightened requirement is ignored for people already posted.

The PRD versions **audit instruments** explicitly for exactly this reason ("an audit conducted under the 2021 ConSASS checklist must render… under that version indefinitely", §7.1, §12.4) but says nothing about versioning **certification requirements**, which are just as regulatory and just as changeable. That is an inconsistency to resolve.

**Recommendation (needs Greensafe ratification — see OPEN-QUESTIONS Q-P1-2):** make `RoleRequirement` **effective-dated** (`valid_from`, `valid_to`, version). A deployment records the `requirement_version_id` it was validated against, so its determination is reproducible. A requirement change is a *new* version from an effective date; existing deployments are **re-evaluated forward** and any that no longer pass surface as a distinct, explained exposure ("requirement changed on <date>") — never silently flipped, never hidden. This mirrors the instrument-versioning decision already in the PRD.

### C2 — A renewed certificate must supersede, not overwrite. **[M]**

F2.1 closes a renewal by uploading a new certificate with a later expiry. For audit defensibility the new certificate must be a **new `Certification` row** superseding the old (the old stays, soft-deleted/archived, with its own validity history), not an in-place update of dates. §13 implies this via soft-delete-only, but state it as a rule so no one "updates the expiry date in place." Edge to confirm: a reissue/correction with an equal-or-earlier expiry — is that a valid renewal or a correction? (Q-P1-4.)

---

## D. UXS screens that cannot be built as specified in Phase 1

### D1 — The signature Director Overview (UXS §5.1) is mostly out-of-phase. **[H]**

The screen's four exposure cards include **"deadline ≤48 hrs"** (submissions — M2) and **"override open"** (M1); its lower panels are **SUBMISSION DEADLINES** and **CLAIMS** (M2) and **AUDITS AWAITING SIGN-OFF** and **CORRECTIVE ACTIONS OVERDUE** (M3). Three of the four quadrants and two of the four exposure cards are Phase 2/3 data. The Overview **cannot** be built "as specified" in Phase 1. Decide the Phase-1 form now: recommend a reduced Overview showing only the M1-real numbers — **lapsed-among-deployed, expiring ≤90d, overrides open** — with the M2/M3 regions absent (not rendered-and-empty, per UXF §1 "never rendered-and-disabled"). Note it so nobody builds dashboard tiles against tables that don't exist yet.

### D2 — The Conditional panel promises an internal course run the Phase-1 system can't know. **[H]**

UXS §5.3 Conditional state prints "Next internal run: 19 Aug, Pioneer Junction." That is M2 course/run data (see B5). In Phase 1 the Conditional panel must stop at "Renewal task will be created on save" and omit the run line. Same root cause as B5; flagged separately because it's a concrete copy string a developer would otherwise implement.

### D3 — "Reason on hover" contradicts "reason inline" and the no-hover rule. **[M]**

UXF §3 step 4: ineligible officers show "reason **on hover**." But UXS §5.3 shows the reason **inline** in the greyed row ("WSHO lapsed 11 days ago"), and UXS §9 accessibility mandates "**No hover states. Nothing is reachable only by hover**" and target/keyboard operability. Build the inline version (UXS §5.3 wins, and it's the accessible one); treat UXF §3's "on hover" as superseded prose. Cite so the two aren't built as a tooltip.

### D4 — "Worst status" needs a defined ordering. **[M]**

The person cell and register default sort (UXS §4, §5.2) rank by "worst status." Define the total order once — recommend `Critical > Warning > Info > OK > Neutral` (matching UXS §3's table order) — and compute it in one shared place, or list and cell will disagree.

### D5 — Global search scope is Phase-spanning. **[L]**

UXF §1: search resolves "people, trainees, clients, sites, audits, course runs and findings." In Phase 1 only people and (thin) clients/sites exist. Ship search over the M1 entities only; widen per phase. No conflict, just scope-set the index.

---

## E. Cross-cutting / smaller

- **E1 [M]** — Override needs lifecycle state, not just a log line. F1 §3.2 / UXS §5.1 keep an override "flagged on Director Overview **until resolved**." The append-only log (PRD §10.5) records *who/why/when* (satisfies AC1.5) but "until resolved" needs a queryable `Override` with open/resolved status linked to its deployment. Add it.
- **E2 [L]** — AC1.3 (certificate retrievable in 3s) and PRD §10.4 evidence hashing both touch certificate documents; confirm Phase-1 certificate scans get the same S3 + integrity treatment as audit evidence, or state that hashing is Phase-3-only for certs.
- **E3 [L]** — Person cell shows "role beneath" the name (UXS §4). A person holds *multiple* roles/certs (PRD §5.1). Which role renders in a generic list cell? Define (e.g. primary employment role vs the role relevant to the current view).
- **E4 [L]** — Countdown "pulse under 48h" (UXS §4) vs `prefers-reduced-motion` and "motion under 200ms, none load-bearing" (UXS §9): the pulse must be decorative and suppressed under reduced-motion, with the numeric/colour/label state carrying the meaning. Easy, just don't let the pulse be the signal.
- **E5 [L]** — British-English + Singapore convention (UXS §7) vs identifiers: keep enum/DB values in a stable canonical form and localise only display strings, so "authorised/authorisation" spelling never leaks into column names or API contracts.

---

## Summary — what to settle before Slice 1 cuts schema

| # | Item | Sev |
|---|---|---|
| A1 | Define `Deployment` vs `Assignment`: one entity | B |
| A2 | Add a `Role` entity | B |
| A3 | Requirement grammar (all_of / any_of) | B |
| B1 | `line_manager_id`, `account_owner_id` for the cascade | B |
| B2 | `EscalationEvent` ledger for "fires once" | B |
| B3 | `RenewalTask` with evidence-closure | B |
| C1 | Effective-date / version `RoleRequirement`; deployments pin a version | B |
| A4 | `Authority` table; cert type carries pattern + renewal rule | H |
| A5 | Open-ended deployment ⇒ Confirmed-with-monitoring | H |
| B4 | Evaluator runs hourly, not nightly | H |
| B5 | Phase-1 renewal task without the M2 run proposal (column stubbed) | H |
| D1 | Phase-1 Director Overview = M1 subset only | H |
| D2 | Conditional panel omits the run line in Phase 1 | H |

Everything at **B** touches the schema and should be an ADR in `docs/DECISIONS.md`
before Slice 1 writes its first migration. The **H** items can be decided as their
slice comes up but are cheaper to settle in the same schema pass.
