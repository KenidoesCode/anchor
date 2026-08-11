# Greensafe Assure — Open Questions

Everything Greensafe must answer for the platform to be built **correctly**. This
document goes into the client workshop as-is. IDs are stable so code, ADRs and
commits can reference them — resolved items are moved to the appendix, not
renumbered. Do not resolve these by guessing: guessing a domain fact means building
the wrong thing confidently (CLAUDE.md working style).

Status: `OPEN` · `ANSWERED` (answer + date + who) · `ASSUMED` (a flagged working
assumption is in place, pending confirmation).

> **Scope note.** Phase 1 delivery is **Slice 1 only** — the assignment gate
> (ADR-0011). Slice 1 is built and demonstrated on **clearly-labelled fictional
> seed data**, so none of the questions below block *constructing* the demo. They
> block going **beyond Slice 1** and block **production correctness** — which is
> exactly what the workshop is for.

---

## A. For the client workshop — blocks production / blocks build beyond Slice 1

- **Q-P1-3 — Real role → certification requirements.** For each deployable role (WSHO, FSM, ECO, CSSA, LSS, SSS, …): exactly which certification(s), and with what logic (single / all-of / any-of / site-conditional)? *The modelling is decided (AND/OR composition, ADR-0003); the actual content is a domain fact only Greensafe holds.* — **[OPEN]**
- **Q-P1-4 — Certification renewal edge cases.** A renewal closes on a later-dated certificate (decided, ADR-0008). Is a reissue with an **equal-or-earlier** expiry a valid renewal or a correction? How is a renewed certificate matched to the type it supersedes in practice? — **[OPEN]**
- **Q-P1-5 — Registration number formats** for MOM, SCDF and NEA credentials. Examples in the specs are illustrative and must be replaced with verified formats. Modelled as per-type `validation_pattern` config (ADR-0003); real patterns are needed before production and for correct seed data. *(UXS §11.1)* — **[OPEN]**
- **Q-P1-7 — Open-ended deployments.** Do postings have a firm end date, or are many open-ended? Determines the Conditional-vs-Confirmed rule when `end_date = null`. *Slice 1 runs a flagged working assumption — null end ⇒ Confirmed-with-monitoring (ADR-0005, PROPOSED) — pending this answer.* *(SPEC-REVIEW A5)* — **[ASSUMED]**
- **Q-P1-8 — Concurrent deployments / overlap rule.** Can one officer be posted to two sites at once? Are touching intervals (one ends the day the next starts) an overlap? *(SPEC-REVIEW A6; needed for the overlap-block condition, Slice 7)* — **[OPEN]**
- **Q-P1-11 — Staff authentication.** Corppass/Singpass for staff at launch, or email + mandatory MFA for Phase 1 with SSO later? *(PRD §10.1; Slice 2)* — **[OPEN]**
- **Q-P1-12 — Data residency conditions** imposed by government / enterprise clients (PMO, MINDEF, SPF, etc.) that constrain hosting, backup or support. *(PRD §10.3, §17 Q10; UXS §11.6)* — **[OPEN]**
- **Q-P1-13 — Record retention obligations** per record class (certifications, personal data, deployments, overrides). Drives the soft-delete / retention schedule every table inherits from migration one. *(PRD §17 Q11, §10.2)* — **[OPEN]**

## B. Can wait — later phases, non-blocking for Phase 1

- **Q-L-1 — TPGateway submission schema** and exact rejection reason codes, obtainable on SSG onboarding. *(UXS §11.2; PRD §6.3, §17 Q3)* — Phase 2. **[OPEN]**
- **Q-L-2 — SSG integration status.** System-to-system submission onboarded, or bulk-file interim? Onboarding is externally controlled and must be initiated at project start even though the build is Phase 2. *(PRD §6.3, §17)* — **[OPEN]**
- **Q-L-3 — ConSASS instrument structure** at the current version: element/clause hierarchy and scoring model. *(UXS §11.3; PRD §7.1)* — Phase 3. **[OPEN]**
- **Q-L-4 — Field device reality:** what auditors actually carry and their true connectivity conditions. *(UXS §11.4; PRD §17 Q13)* — Phase 3. **[OPEN]**
- **Q-L-5 — Existing systems and interfaces** (training management, CRM, accounting, document management). Everything assumes greenfield; testing that first can re-cut scope. *(UXS §11.5; PRD §16, §17 Q1)* — **[OPEN]**
- **Q-L-6 — Client-imposed vendor conditions** beyond residency (security posture, penetration testing, vendor approval). *(UXS §11.6; PRD §17 Q10)* — **[OPEN]**
- **Q-L-7 — Incumbent accounting system** for the integration boundary (M4). *(PRD §8, §17 Q1)* — Phase 4. **[OPEN]**
- **Q-L-8 — Venue list** across Greensafe's premises for run scheduling (M2). *(PRD §6.1)* — Phase 2. **[OPEN]**
- **Q-L-9 — Course → certification renewal map:** which internal course renews which credential, for the 90-day "propose an internal run" feature (column `renews_via_course_id` stubbed null in Phase 1, ADR-0008; lit up in Phase 2). *(SPEC-REVIEW B5)* — **[OPEN]**
- **Q-L-10 — Operational volumes:** course runs per month, venues, languages; staff head-count (PRD's "~200 [TO CONFIRM]"). Sizing, not schema. *(PRD §3, §17 Q2)* — **[OPEN]**
- **Q-L-11 — Certificate-document integrity scope.** Do Phase-1 certificate scans get the same S3 Object-Lock + hashing treatment as audit evidence, or is hashing Phase-3-only for certs? *(SPEC-REVIEW E2; PRD §10.4)* — **[OPEN]**
- **Q-L-12 — Baselines for the success metrics** (PRD §15), all "measure in Phase 0" — needed for the grant case, not for build. *(PRD §15; §14.1 EDG)* — **[OPEN]**

---

## Process notes

- **Validate the screens with two auditors and one training administrator before any build begins** (UXS §11). The M1 Assign and Register screens should be shown to a Deployment Coordinator too.
- **Grant timing:** EDG application must precede commencement of work; EDG/PSG/MRA may consolidate in 2H 2026 — verify at application time. *(PRD §14.1)*
- **SSG onboarding** is externally controlled — initiate at project start, not development start, even though M2 is Phase 2. *(PRD §6.3)*

---

## Appendix — Resolved by ratification (2026-08-11)

Structural questions the Directors ratified this session. Recorded for traceability;
the concrete schema shapes await final sign-off before migrations (ADR-0011).

- **Q-P1-1 — `Deployment` vs `Assignment`.** ANSWERED: distinct entities; an Assignment (the validated transaction) produces a Deployment (the posting), 1:1. → ADR-0007.
- **Q-P1-2 — Requirement versioning / historical determinations.** ANSWERED: effective-dated requirements; each deployment pins the version in force; the "lapsed among deployed" figure is reproducible for any past date. → ADR-0002.
- **Q-P1-3 (structural half).** ANSWERED: requirements modelled as an AND/OR composable set with an explicit `Role` entity. → ADR-0003. *(Real content remains OPEN above.)*
- **Q-P1-4 (structural half).** ANSWERED: `RenewalTask` is first-class and closes only on an uploaded later-dated certificate, never on assertion. → ADR-0008. *(Reissue/correction edge remains OPEN above.)*
- **Q-P1-6 — Escalation recipients.** ANSWERED (structure): `person.line_manager_id` and `organisation.account_owner_id`, nullable, with Director fallback. → ADR-0009. *(Who fills them is operational, not a build blocker.)*
- **Q-P1-9 — Phase-1 Director Overview form.** ANSWERED: M1 tiles only (lapsed-among-deployed, expiring ≤90d, open overrides); M2/M3 regions absent; Conditional panel drops the course-run line. → ADR-0006.
- **Q-P1-10 — Evaluator cadence.** ANSWERED: the escalation evaluator runs at least hourly, not nightly (reconciles UXF §4 with AC1.2/AC1.4). "Fires once" enforced by a unique constraint. → ADR-0004.
