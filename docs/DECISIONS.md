# Greensafe Assure — Architectural Decisions

One short entry per architectural decision, with the reasoning (CLAUDE.md working
style). Newest first. `ACCEPTED` = decided and in force. `PROPOSED` = recommended,
pending Greensafe's answer to the linked open question — do not treat as settled.

---

## ADR-0001 — Repository bootstrap; specifications are the source of truth · ACCEPTED · 2026-08-11

Placed the three specifications in `docs/` (`PRD.md`, `UXF.md`, `UXS.md`) and
`CLAUDE.md` at the repo root, per the kickoff document. The specs are versioned
artefacts in the repo, not chat context, so corrections propagate to every future
session. First session writes **no application code**: it reviews the specs
(`SPEC-REVIEW.md`), plans Phase 1 (`BUILD-PLAN.md`) and logs open questions
(`OPEN-QUESTIONS.md`). Rationale: a spec hole found in week one costs an hour;
found in week six it costs a rewrite.

*(Pre-existing `docs/task_lifecycle.md` and empty `docs/README.md` from an earlier
commit were left untouched — not authored here.)*

---

## The following are PROPOSED, pending Greensafe answers (see OPEN-QUESTIONS.md)

They are recorded so the Slice-1 schema pass has a default to ratify or reject.
None is in force yet.

## ADR-0002 — `RoleRequirement` is effective-dated; deployments pin a version · PROPOSED · Q-P1-2

A certification-requirement change creates a new requirement **version** from an
effective date. Each deployment records the `requirement_version_id` it was
validated against, so its determination is reproducible. Existing deployments are
re-evaluated forward; any that no longer pass surface as an explained exposure
("requirement changed on <date>"), never silently flipped. Mirrors the PRD's
existing decision to version audit instruments (PRD §12.4). *Reject only if
Greensafe confirms requirements never change materially — unlikely for regulated
credentials.*

## ADR-0003 — Explicit `Role` entity + requirement grammar · PROPOSED · Q-P1-3, SPEC-REVIEW A2/A3

Add a `Role` table and a `role_requirement` mapping supporting `all_of` / `any_of`
groups, rather than treating "role" as a synonym for a single certification type.
Real WSH requirements are composite; a single-required-type model can't express
them and would force a later migration.

## ADR-0004 — Escalation evaluator runs at least hourly, backed by an `EscalationEvent` ledger · PROPOSED · Q-P1-10, SPEC-REVIEW B2/B4

Run the cascade evaluator hourly (pg-boss), not nightly, to meet AC1.2's 60-minute
SLA and AC1.4's hourly refresh. A per-certification, per-stage `EscalationEvent`
ledger enforces "each stage fires once" and provides the audit evidence AC1.2
requires.

## ADR-0005 — Open-ended deployment ⇒ Confirmed-with-monitoring · PROPOSED · Q-P1-7, SPEC-REVIEW A5

When a deployment has no end date, a valid certificate today yields **Confirmed**,
and the escalation cascade owns the future expiry — never a perpetual Conditional.
Avoids an undefined comparison ("expires before deployment ends" against a null
end) and keeps the gate deterministic.

## ADR-0006 — Phase-1 Director Overview is the M1 subset only · PROPOSED · Q-P1-9, SPEC-REVIEW D1

The Phase-1 Overview shows only M1-real numbers (lapsed-among-deployed,
expiring ≤90d, overrides open). M2/M3 regions (submissions, claims, audits,
corrective actions) are absent — not rendered-and-empty (UXF §1) — until those
modules exist. The `CertificationType.renews_via_course_id` column is added now
but left null so no later migration is forced (SPEC-REVIEW B5).
