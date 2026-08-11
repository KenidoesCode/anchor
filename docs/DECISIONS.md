# Greensafe Assure — Architectural Decisions

One short entry per architectural decision, with the reasoning (CLAUDE.md working
style). Newest first within each group. `ACCEPTED` = decided and in force.
`PROPOSED` = recommended, pending an answer to a linked open question — not settled.

**Status of the schema ADRs (0002–0009):** the decisions **and their concrete
shapes are ratified and implemented** (2026-08-14, as printed to the Directors and
authorised in one pass). Migrations are cut (`drizzle/0000…`, `drizzle/0001…`).
Every table carries the standard audit columns from migration one
(`created_at, created_by, updated_at, updated_by, deleted_at`) — not repeated
below. The FKs, CHECK, partial index and version invariants that back these ADRs
are enforced in the database, not application logic (see the "DB enforcement"
notes).

---

## ADR-0001 — Repository bootstrap; specifications are the source of truth · ACCEPTED · 2026-08-11

Placed the three specifications in `docs/` (`PRD.md`, `UXF.md`, `UXS.md`) and
`CLAUDE.md` at the repo root, per the kickoff document. The specs are versioned
artefacts in the repo, not chat context, so corrections propagate to every future
session. The first session writes **no application code**: it reviews the specs
(`SPEC-REVIEW.md`), plans Phase 1 (`BUILD-PLAN.md`) and logs open questions
(`OPEN-QUESTIONS.md`). Rationale: a spec hole found in week one costs an hour;
found in week six it costs a rewrite.

*(Pre-existing `docs/task_lifecycle.md` and empty `docs/README.md` from an earlier
commit were left untouched — not authored here.)*

---

# Schema decisions (ratified and implemented 2026-08-14)

## ADR-0002 — Certification requirements are effective-dated and versioned; deployments pin the version in force · ACCEPTED

**Decision.** Role certification requirements are versioned, effective-dated data —
not a live-mutable lookup. This mirrors the PRD's existing decision to version
audit instruments (PRD §12.4) for the identical reason: a determination made under
one rule must remain reproducible after the rule changes.

**Why.** The Director Overview figure "lapsed among currently deployed personnel"
(PRD AC1.4) is the number the whole product is judged on. If a requirement edit
silently re-evaluated history, that figure would move because an admin edited a
table, not because a certificate lapsed. It must be reproducible for **any past
date**.

**Shape (implemented).**
- `role_requirement_version` — `id`, `role_id → role`, `version_no`, `valid_from` (date), `valid_to` (date, null = current). At most one version is current per role; versions are non-overlapping (gaps are permitted — a role may have no requirement for a period).
- A requirement change never mutates a row in place — it closes the current version (`valid_to`) and inserts a new one from the next effective date.
- `assignment.requirement_version_id` (ADR-0007) pins the version the determination was made against.

**Reproducibility rule.** "Lapsed among deployed on date *D*" = for every deployment
active on *D*, evaluate the certification ledger *as of D* against the deployment's
**pinned** `requirement_version_id`. Requirement changes after *D* do not affect the
historical figure; they surface forward as a distinct, explained exposure
("requirement changed on <date>"), never a silent flip. The figure is computed by
`src/server/reporting.ts::deployedUnderLapsedCert(validDate, knownAt)`, reading
certification history (ADR-0013) so it is stable under later corrections.

**DB enforcement (not application logic).**
- **One current version per role:** partial unique index `rrv_one_current_per_role` on `(role_id) WHERE valid_to IS NULL AND deleted_at IS NULL`.
- **Non-overlapping validity ranges:** trigger `rrv_no_overlap_trg` (a PL/pgSQL `daterange &&` check, not a gist EXCLUDE — portable to the in-process test engine, which lacks `btree_gist`). Bounds are inclusive `[]`, so a clean supersession leaves a one-day gap (version 1 `valid_to = 2026-06-30`, version 2 `valid_from = 2026-07-01`). Ranges may have gaps; they may not overlap.
- **Contents immutable once pinned:** triggers `requirement_group_immutable_trg` / `requirement_item_immutable_trg` reject any UPDATE/DELETE of a version's groups/items once any `assignment` references that version. Closing the version (setting `valid_to` on the version row) is still allowed — that is how supersession works.

*Open (domain, not structural):* the real requirement content per role — Q-P1-3.

## ADR-0003 — Explicit `Role` entity with AND/OR requirement composition · ACCEPTED

**Decision.** "Role" is a first-class entity, and a role's requirement is a
**composable set** (AND/OR), not a flat list or a single required certification
type. Real WSH requirements are composite ("WSHO **and** a current first-aid
certificate", "**any one of** an accepted set"); a single-type model can't express
them and would force a later migration.

**Shape (implemented).**
- `role` — `id`, `code` (e.g. `WSHO`), `name`, `description`.
- `role_requirement_version` — as ADR-0002.
- `requirement_group` — `id`, `requirement_version_id → role_requirement_version`, `combinator` enum `all_of | any_of`, `parent_group_id → requirement_group` (**real FK**, null = the version's root group), `sort`.
- `requirement_item` — `id`, `group_id → requirement_group`, `certification_type_id → certification_type`, `sort`.

**DB enforcement.** `parent_group_id` is a real FK (no dangling parents). Group/item contents are immutable once the version is pinned (triggers, see ADR-0002).

**Evaluation semantics.** A `requirement_item` is satisfied iff the person holds a
certification of that `certification_type` valid as of the evaluation date. A group
is satisfied iff — `all_of`: every child (item and sub-group) is satisfied;
`any_of`: at least one child is satisfied. The root group's result is the gate
input. Nesting supports e.g. `all_of[ WSHO, any_of[ FirstAid, AdvFirstAid ] ]`.
MVP may cap nesting at two levels; the schema does not need to.

*Open (domain):* the actual groups/items per role — Q-P1-3.

## ADR-0007 — `Assignment` and `Deployment` are distinct; an Assignment produces a Deployment · ACCEPTED

**Decision.** Two entities, not one.
- **`Assignment`** is the validated *transaction*: who validated it, when, the
  outcome, the requirement version, and any override. It is the immutable record of
  a determination.
- **`Deployment`** is the resulting *posting*: client, site, role, period, charge
  rate. **A Deployment never exists without an Assignment** (FK not null, 1:1).

**Shape (implemented).**
- `assignment` — `id`, `person_id → person`, `role_id → role`, `requirement_version_id → role_requirement_version`, `outcome` enum `confirmed | conditional | overridden`, `override_id → override` (null unless overridden), `validated_at`, `validated_by`. Blocked-without-override produces **no** assignment and **no** deployment — the attempt is written to the append-only event log (PRD §10.5), not here.
- `deployment` — `id`, `assignment_id → assignment` (**not null, unique**), `organisation_id → organisation`, `site_id → site`, `role_id → role`, `charge_rate`, `start_date`, `end_date` (nullable — see ADR-0005, PROPOSED), `status`.

**Why.** The audit and override story needs the determination recorded separately
from the posting: an override attaches to the *transaction*, while the posting is
what appears on coverage and Director views.

## ADR-0004 — Escalation ledger; "fires once" is a database constraint, not application logic · ACCEPTED

**Decision.** One row per certification per one-shot stage per fire, with recipient
and delivery outcome. "Each stage fires once" (UXF §4.1, UXS §6) is enforced by a
**unique constraint**, so a re-run of the evaluator cannot double-send even if
application logic has a bug.

**Shape (implemented).**
- `escalation_event` — `id`, `certification_id → certification`, `stage` enum `d90 | d60 | d30 | d7 | expiry`, `fired_at`, `recipient_id → person` (nullable — fallback per ADR-0009), `recipient_role`, `channel` enum `in_app | email | sms`, `delivery_outcome` enum `sent | failed | pending`.
- **`UNIQUE (certification_id, stage)`** for the one-shot stages above.
- The **post-expiry daily digest** to Directors (UXF §4 "daily digest until cleared") is *recurring by design* and is therefore **not** a one-shot stage — it is a separate daily notification keyed by date, outside this unique constraint. Recorded so no one tries to force it under fires-once.

**Evaluator cadence.** The evaluator runs **at least hourly** (pg-boss cron), not
nightly — required by AC1.2 (fire within 60 min of a boundary) and AC1.4 (Director
count refreshed hourly). The word "nightly" in UXF §4 is prose to correct at the
next spec pass. *(Structural; captured as Q-P1-10 resolved.)*

## ADR-0008 — `RenewalTask` is first-class and closes only on evidence · ACCEPTED

**Decision.** The renewal task is its own entity, created by the 90-day cascade
stage (UXF §4) and by a Conditional assignment (UXF §3.1). It **closes only when a
new certificate with a later expiry is uploaded** — never by a user marking it done
(F2.1: evidence closes the loop, not assertion).

**Shape (implemented).**
- `renewal_task` — `id`, `certification_id → certification` (the expiring credential), `person_id → person`, `owner_id → person`, `due_date`, `source` enum `cascade_90d | conditional_assignment`, `status` enum `open | closed`, `closed_by_certification_id → certification` (null while open).
- Close transition is valid **only** when `closed_by_certification_id` references a certification of the **same type** with a **later** `expiry_date`. No status-only close path exists in the API.
- **DB enforcement.** CHECK `renewal_task_closed_requires_cert`: `status <> 'closed' OR closed_by_certification_id IS NOT NULL` — a closed task without its closing certificate cannot exist. `closed_by_certification_id` is a real FK. The *same-type + later-expiry* half of the rule stays in the closing procedure (Slice 5), as authorised.
- `certification_type.renews_via_course_id` (→ course) is added **nullable and left null** in Phase 1: the "propose an internal course run" feature is M2 (Phase 2). The column exists now only to avoid a later migration; no Phase-1 code reads it.

*Open (domain):* whether a reissue with an equal-or-earlier expiry is a valid
renewal or a correction — Q-P1-4.

## ADR-0009 — `line_manager` and `account_owner` relationships; nullable with Director fallback · ACCEPTED

**Decision.** Add the two relationships the escalation cascade addresses:
- `person.line_manager_id → person` (nullable, self-reference) — the 60-day stage recipient.
- `organisation.account_owner_id → person` (nullable) — the 30-day stage recipient.

**Fallback.** In Phase 1 both are nullable; when null, that stage's notification
escalates to the **Director** role. This lets Slice 1 seed people without a full org
chart while keeping every stage deliverable. `escalation_event.recipient_role`
records which addressee actually received it (named person vs Director fallback).

**DB enforcement.** Both are **real FKs** to `person` (nullable, no dangling ids),
as is `escalation_event.recipient_id`. The only non-FK actor columns that remain
are the audit `created_by`/`updated_by` (defaulted to the bootstrap system actor;
a hard FK there is an unresolvable insert cycle — the one deliberate exception).

*Open (domain):* who fills these relationships in practice — Q-P1-6 (structure
resolved here; population is operational).

## ADR-0013 — System-versioned certification history; the past-date figure is defensible · ACCEPTED · 2026-08-14

**Decision.** Certifications carry a transaction-time (system-versioned) history.
Every insert/update is snapshotted into `certification_history`; an in-place edit
of `expiry_date` (a fat-finger correction) **closes the current snapshot and opens
a new one — it never overwrites the past**.

**Why.** This closes the blocking defect found in the schema review: without it,
an in-place expiry correction would silently change the historical answer to "who
was deployed under a lapsed certification on date *D*?" — the number the product is
judged on (PRD AC1.4). Flagging renewals-as-supersession was not enough, because a
*correction* is not a renewal.

**Shape (implemented).**
- `certification_history` — snapshot of the certification's meaningful columns plus `operation` (`insert|update|delete`), `sys_from`, `sys_to` (null = current belief). `certification_id` is a real FK — which, as a side effect, makes a *hard* delete of a certification impossible (there is always a history row referencing it), reinforcing soft-delete-only.
- Populated by trigger `certification_history_trg` (AFTER INSERT OR UPDATE), using `clock_timestamp()` so the closing and opening snapshots share one instant (no gap, no overlap).

**Reconstruction (bitemporal).** `deployedUnderLapsedCert(validDate D, knownAt T)`
in `src/server/reporting.ts` reads history keyed by *T* (defaults to now). The
exposure figure for a real-world date *D* is therefore reproducible **as it was
believed at any transaction time**, and a correction made after *T* cannot change
the answer for *T*. Proven by `tests/certification-history.test.ts`. Current
limitation: the reconstruction SQL handles the flat `all_of` requirement shape
Phase 1 uses; nested AND/OR reconstruction reuses the gate evaluator and is
deferred with the relevant M-phase work (logged, not silent).

---

# Product-scope decisions

## ADR-0006 — Phase-1 Director Overview is the M1 tiles only · ACCEPTED

The Phase-1 Overview renders only the three M1-real numbers —
**lapsed-among-deployed**, **expiring ≤90 days**, **open overrides** — as links to
filtered lists. The M2/M3 regions in UXS §5.1 (submission deadlines, claims, audits
awaiting sign-off, corrective actions, the "deadline ≤48 hrs" exposure card) are
**absent, not rendered-and-empty** (UXF §1). The layout leaves room for them.
Correspondingly, the Conditional validation panel (UXS §5.3) **drops the "Next
internal run" line** until M2 exists — the renewal task alone is sufficient.

## ADR-0010 — Ineligibility reason is shown inline, always · ACCEPTED

UXF §3.1's "reason on hover" was wrong and has been amended in the document. The
reason a greyed officer is ineligible is shown **inline** in the row (UXS §5.3),
never on hover: hover-only fails WCAG (UXS §9) and does not exist on the field
tablets. UXS §5.3 and §9 govern.

## ADR-0012 — Slice 1 UI uses plain CSS tokens; Tailwind/shadcn deferred to Slice 4 · PROPOSED

The design tokens (PRD §11) are implemented as CSS custom properties in one place
(`src/app/globals.css`) and referenced everywhere — which is the actual design
requirement. Tailwind + shadcn/ui (the decided stack) are **not yet wired**: Slice 1
is a single screen, and the utility/component framework earns its keep at Slice 4
(the register/expiry tables). This is a deferral, not a substitution — no other
utility library is used, and the tokens are framework-agnostic so adopting Tailwind
later is additive. Flagged PROPOSED for ratification; say the word and I'll wire
Tailwind v4 now instead. Fonts are system stacks for now — the specified
Inter/Plex faces must be self-hosted (no external CDN, PRD §11.2), which is its own
task. *(Also: integration tests run on in-process Postgres via pglite — a test
harness running the same SQL, not a production-DB substitution.)*

## ADR-0011 — Phase 1 build is Slice 1 only; the rest waits on the client · ACCEPTED

Phase 1 delivery is scoped to **Slice 1 — the assignment gate, end to end**
(server-side enforcement + the three-state validation panel), demonstrable in under
a minute and defensible under questioning. Slices 2–9 in `docs/BUILD-PLAN.md` remain
documented as the backlog but are **not built** until the client answers the
blocking domain questions in `docs/OPEN-QUESTIONS.md`. Building them now would be
committing confident work on unvalidated assumptions.

**Gate before this session proceeds:** no migration is cut until the schema shapes
in ADR-0002/0003/0004/0007/0008/0009 are ratified.

---

## Still PROPOSED — not in force

## ADR-0005 — Open-ended deployment ⇒ Confirmed-with-monitoring · PROPOSED · Q-P1-7

When a deployment has no end date, the recommendation is that a valid certificate
today yields **Confirmed** (the cascade owns the future expiry), never a perpetual
Conditional — avoiding an undefined "expires before deployment ends" comparison
against a null end. **Not ratified:** it depends on the domain fact of whether
Greensafe's postings are commonly open-ended (Q-P1-7). Slice 1 will treat this as a
flagged working assumption in the gate logic, clearly marked, pending the answer.
