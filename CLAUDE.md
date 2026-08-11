# Greensafe Assure

Internal operations and assurance platform for Greensafe International Pte Ltd,
a Singapore workplace safety and health (WSH) auditing, training, consulting
and outsourcing firm regulated by MOM, NEA, SCDF, SSG and SAC.

## Specifications — read before writing code

- `docs/PRD.md` — product requirements, technical stack, security, design tokens
- `docs/UXF.md` — information architecture, permissions, the eight core flows
- `docs/UXS.md` — screen specifications, components, states, interface copy

These three documents are the source of truth. Where this file and a
specification disagree, the specification wins. Where two specifications
disagree, stop and ask.

Supporting working documents:

- `docs/OPEN-QUESTIONS.md` — everything Greensafe must answer before or during build
- `docs/SPEC-REVIEW.md` — first-pass critique of the specifications
- `docs/BUILD-PLAN.md` — Phase 1 vertical-slice plan and estimate
- `docs/DECISIONS.md` — one short entry per architectural decision, with reasoning

## What this system is for

Greensafe's revenue is bounded by hours worked by individually accredited
people. The platform exists to stop three things:

1. Anyone being assigned to work their certification does not cover
2. Statutory training grants being lost to missed submission deadlines
3. Accredited staff spending billable hours on data re-entry

Requirement 1 is the founding requirement. If the assignment gate can be
bypassed, the product has failed regardless of what else works.

## Current scope

**Phase 1 only: M0 platform foundation + M1 Competency & Deployment Register.**

Do not scaffold modules M2–M6. They are documented so the data model does not
paint us into a corner, not because they are being built now. If a Phase 1
decision would block a later module, say so and propose the alternative —
do not build ahead.

## Stack — decided, do not substitute

TypeScript strict · Next.js 15 App Router · React 19 · Tailwind · shadcn/ui
(components owned in-repo) · tRPC · Zod · React Hook Form · TanStack Query ·
TanStack Table · PostgreSQL 17 · Drizzle ORM · pg-boss · Auth.js · Vitest ·
Playwright · AWS ap-southeast-1

If you believe a choice is wrong, argue it before implementing an alternative.
Do not silently substitute a library.

## Non-negotiable engineering rules

**Authorisation is server-side.** Every tRPC procedure checks role and scope.
Client-side checks are for user experience only and are never the control.
Postgres row-level security is the second layer. Assume application logic
will one day have a bug.

**Every table carries audit columns from its first migration:**
`created_at, created_by, updated_at, updated_by`. Soft delete only —
`deleted_at`, never a hard delete inside the statutory retention period.
Retrofitting an audit trail is impossible.

**Personal data.** National identifiers (NRIC/FIN) are encrypted at rest with
envelope encryption, masked by default in every response, and unmasked only
through a distinct, reason-required, logged procedure. Never log a national
identifier. Never include one in an error message, a Sentry payload or a URL.

**Blocks are blocks.** Where the specification says an action is blocked,
the server rejects it. A disabled button is presentation; the server is the
control. There is no "warn and allow" path except where UXF explicitly
defines a Conditional outcome.

**Nothing fails silently.** Every failed job, submission or validation
produces a persisted, owned, actionable record. A console log is not a
notification.

**One Zod schema per concept**, shared across form, tRPC boundary and
database validation. No parallel type definitions.

## Regulatory data — do not invent

Real formats for MOM, SCDF and NEA registration numbers, the TPGateway
submission schema, and the current ConSASS instrument structure are NOT yet
verified.

Do not hardcode a guessed format anywhere. Model these as configuration:
certification types, their issuing authorities and their validation patterns
live in database tables with an admin interface, not in application constants.
Where a real value is needed and unknown, use an obvious placeholder and add
it to `docs/OPEN-QUESTIONS.md`.

Seed and demo data must live in `seed/` and be clearly labelled as fictional.
It must never be reachable from a production code path.

## Design

Tokens are defined in `docs/PRD.md` §11. Implement them as CSS custom
properties in one place and reference them everywhere.

Brand colours (green `#00A551`, red `#D9342B`) are for identity only.
Status colours are a separate, darker ramp. Never use a brand colour to
convey system state — the ambiguity is a defect in a product whose purpose
is signalling risk.

Status is never colour alone: colour + icon + text label, every time.
This is an accessibility requirement and a print requirement.

## Working style

- Vertical slices, not layers. One flow working end to end beats four
  half-built layers.
- Show the plan before a change spanning more than three files.
- Small commits, conventional commit messages.
- Tests alongside the code, not in a later pass. Authorisation and the
  assignment gate need tests before anything else.
- Ask when the specification is ambiguous. Do not resolve ambiguity by
  guessing and moving on — log it in `docs/OPEN-QUESTIONS.md` and raise it.
- Keep `docs/DECISIONS.md` current: one short entry per architectural
  decision, with the reasoning.

## Definition of done

A change is done when: it typechecks strict, tests pass, authorisation is
enforced server-side and tested, audit columns are populated, personal data
is masked, empty/loading/error states exist per UXS, it is keyboard
operable with visible focus, and the copy matches UXS §7.

## Final pass — demo readiness

The build is completing Phase 1 to DEMO-READY, not PRODUCTION-READY.

Demo-ready means: every Phase 1 screen exists and is navigable, all data is
enterable through the interface rather than the API, the app is deployable
by one command, and it holds together under someone clicking around
unsupervised without hitting a dead end or an unhandled error.

It does NOT mean production-ready. The following are deliberately incomplete
and must NEVER be described as finished, in code comments, in the README, or
in any report:

- Encryption uses a development key. KMS is not wired.
- Notifications write to an outbox and a console adapter. Nothing is sent.
- Authentication is email and password. Corppass and MFA are not implemented.
- Row-level security policies exist and are proven, but are not threaded
  through every request path. RBAC is the primary tested control.
- Thirteen domain questions in OPEN-QUESTIONS.md remain unanswered. Every
  dependent behaviour is a flagged assumption.

Never state or imply readiness the build does not have. If a summary would
overstate maturity, understate it instead.

## Demo data

All seed data is fictional and must be labelled as such in the interface
itself — a persistent banner reading "Demonstration environment — all data
is fictional" on every page. Client site names may reference organisations
from Greensafe's published client list; every person, registration number
and certification is invented.

Never load seed data into an environment flagged as production.
