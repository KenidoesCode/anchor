# Greensafe Assure — Open Questions

Everything Greensafe must answer for the platform to be built correctly, grouped
by whether it **blocks Phase 1** or **can wait**. Each has an ID so code, ADRs and
commits can reference it. Add to this file rather than resolving ambiguity by
guessing (CLAUDE.md working style). Includes the six research items from UXS §11
and the schema questions raised in `docs/SPEC-REVIEW.md`.

Status: `OPEN` · `ANSWERED` (record the answer + date + who) · `ASSUMED` (a
working assumption is in place; flagged for confirmation).

---

## A. Blocks Phase 1 — must be answered before or during the schema pass / Slice 1

These map to the **B-severity** findings in `docs/SPEC-REVIEW.md` and must be
closed before the first migration, because they change the shape of the schema.

- **Q-P1-1 — `Deployment` vs `Assignment`.** Are these one entity or two? What does the gate write? *(SPEC-REVIEW A1)* — **[OPEN]**
- **Q-P1-2 — Requirement versioning / historical determinations.** When a role's certification requirement changes, what happens to already-Confirmed deployments? Effective-dated requirements with deployments pinned to a version (recommended), or live re-evaluation? *(SPEC-REVIEW C1; the sharpest hole)* — **[OPEN, recommendation logged]**
- **Q-P1-3 — Real role → certification requirements.** For each deployable role (WSHO, FSM, ECO, CSSA, LSS, SSS, …): exactly which certification(s), and with what logic (single / all-of / any-of / site-conditional)? Drives the requirement grammar. *(SPEC-REVIEW A2/A3)* — **[OPEN]**
- **Q-P1-4 — Certification renewal semantics.** A renewal closes on a later-dated certificate (F2.1). Is a reissue with an equal-or-earlier expiry a valid renewal or a correction? How is a renewed cert matched to the type it supersedes? *(SPEC-REVIEW C2)* — **[OPEN]**
- **Q-P1-5 — Registration number formats** for MOM, SCDF and NEA credentials. The examples throughout the specs are illustrative and must be replaced with verified formats before build. Modelled as per-type `validation_pattern` config, but real patterns are needed for seed + validation. *(UXS §11.1)* — **[OPEN]**
- **Q-P1-6 — Escalation recipients.** Confirm the `line_manager` (per person) and `account_owner` (per client organisation) relationships and who fills them, so the 60- and 30-day stages can address someone. *(SPEC-REVIEW B1)* — **[OPEN]**
- **Q-P1-7 — Open-ended deployments.** Do postings have a firm end date, or are many open-ended? Confirms the Conditional-vs-Confirmed rule for `end_date = null`. *(SPEC-REVIEW A5)* — **[OPEN, recommendation logged: null end ⇒ Confirmed-with-monitoring]**
- **Q-P1-8 — Concurrent deployments / overlap rule.** Can one officer be posted to two sites at once? Are touching intervals an overlap? *(SPEC-REVIEW A6)* — **[OPEN]**
- **Q-P1-9 — Phase-1 Director Overview form.** Confirm the Overview ships as the M1 subset (lapsed-among-deployed, expiring ≤90d, overrides open), with M2/M3 regions absent until those modules land. *(SPEC-REVIEW D1)* — **[OPEN, recommendation logged]**
- **Q-P1-10 — Evaluator cadence.** Confirm the escalation evaluator runs at least hourly (reconciling UXF §4 "nightly" with AC1.2's 60-minute SLA and AC1.4's hourly refresh). *(SPEC-REVIEW B4)* — **[OPEN, recommendation logged: hourly]**
- **Q-P1-11 — Staff authentication.** Is Corppass/Singpass available for staff auth at launch, or is it email + mandatory MFA for Phase 1 with SSO later? Affects Slice 2. *(PRD §10.1)* — **[OPEN]**
- **Q-P1-12 — Data residency conditions** imposed by government / enterprise clients (PMO, MINDEF, SPF, etc.) that constrain hosting, backup or support. Confirms the ap-southeast-1 / no-cross-border stance. *(PRD §10.3, §17 Q10; UXS §11.6)* — **[OPEN]**
- **Q-P1-13 — Record retention obligations** per record class (certifications, personal data, deployments, overrides). Drives the soft-delete / retention schedule that every M1 table inherits from migration one. *(PRD §17 Q11, §10.2)* — **[OPEN]**

## B. Can wait — needed for later phases, or non-blocking for Phase 1

- **Q-L-1 — TPGateway submission schema** and exact rejection reason codes, obtainable on SSG onboarding. *(UXS §11.2; PRD §6.3, §17 Q3)* — Phase 2. **[OPEN]**
- **Q-L-2 — SSG integration status.** Is system-to-system submission onboarded, or is bulk-file the interim path? Onboarding is externally controlled and must be initiated at project start even though the build is Phase 2. *(PRD §6.3, §17)* — **[OPEN]**
- **Q-L-3 — ConSASS instrument structure** at the current version: element/clause hierarchy and scoring model. *(UXS §11.3; PRD §7.1)* — Phase 3. **[OPEN]**
- **Q-L-4 — Field device reality:** what auditors actually carry and their true connectivity conditions. *(UXS §11.4; PRD §17 Q13)* — Phase 3. **[OPEN]**
- **Q-L-5 — Existing systems and interfaces** (training management, CRM, accounting, document management). Everything assumes greenfield; that assumption should be tested first — it can re-cut scope. *(UXS §11.5; PRD §16, §17 Q1)* — **[OPEN]**
- **Q-L-6 — Client-imposed vendor conditions** from government and enterprise accounts (beyond residency: security posture, penetration testing, vendor approval). *(UXS §11.6; PRD §17 Q10)* — **[OPEN]**
- **Q-L-7 — Incumbent accounting system** for the integration boundary (M4). *(PRD §8, §17 Q1)* — Phase 4. **[OPEN]**
- **Q-L-8 — Venue list** across Greensafe's premises for run scheduling (M2). *(PRD §6.1)* — Phase 2. **[OPEN]**
- **Q-L-9 — Course → certification renewal map:** which internal course renews which credential, for the 90-day "propose an internal run" feature (stubbed in Phase 1, lit up in Phase 2). *(SPEC-REVIEW B5)* — **[OPEN]**
- **Q-L-10 — Operational volumes:** course runs per month, venues, languages; and staff head-count (PRD's "~200 [TO CONFIRM]"). Sizing, not schema. *(PRD §3, §17 Q2)* — **[OPEN]**
- **Q-L-11 — Certificate-document integrity scope.** Do Phase-1 certificate scans get the same S3 Object-Lock + hashing treatment as audit evidence, or is hashing Phase-3-only for certs? *(SPEC-REVIEW E2; PRD §10.4)* — **[OPEN]**
- **Q-L-12 — Baselines for the success metrics** (PRD §15), all marked "measure in Phase 0" — needed for the grant case, not for build. *(PRD §15; §14.1 EDG)* — **[OPEN]**

---

## Process notes

- **Validate the screens with two auditors and one training administrator before any build begins** (UXS §11). Designing regulated field tooling without watching the work is how good specs produce unused software. *(Applies mainly to Phase 3 field capture, but the M1 Assign and Register screens should be shown to a Deployment Coordinator too.)*
- **Grant timing:** EDG application must precede commencement of work, and EDG/PSG/MRA may consolidate in 2H 2026 — verify the current position at application time. *(PRD §14.1)* Not a build blocker, but a project-start action.
- **SSG onboarding** is externally controlled — initiate at project start, not development start, even though M2 is Phase 2. *(PRD §6.3)*
