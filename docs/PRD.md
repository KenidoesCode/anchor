# Greensafe Assure — Product Requirements Document

**Internal operations and assurance platform for Greensafe International Pte Ltd**

| | |
|---|---|
| Document | PRD v1.0 |
| Status | Draft for review — Directors |
| Prepared for | Mr. Karu, Mr. Bala — Directors / Principal Consultants |
| Date | August 2026 |
| Classification | Commercial in confidence |

> **A note on this draft.** Sections marked **[TO CONFIRM]** are assumptions made from public information about Greensafe's operations. They are flagged rather than guessed at, and should be settled in the discovery workshop before build begins. Nothing in this document should be treated as a commitment until those are closed.

---

## 1. WHY THIS PLATFORM EXISTS

Greensafe's commercial capacity is bounded by one scarce resource: **hours worked by individually accredited people.** An audit is an approved auditor's day. A course run is a registered trainer's day. A deployed WSHO is one licensed officer's month. Those hours took two decades of accreditation to accumulate and cannot be scaled quickly.

Three structural weaknesses erode that resource today.

**1. Accreditation validity is tracked by human memory.** Every revenue line is gated by an individual holding a current, unexpired registration — auditors on the SAC AO Schedule and registered with MOM, trainers approved to deliver funded courses, WSHOs and FSMs posted onto client sites. A lapse that goes unnoticed is not an administrative slip: it can invalidate a signed audit report, place a client in breach of the WSH Act without their knowledge, and expose Greensafe's own approvals to scrutiny.

**2. Statutory submission deadlines are enforced by discipline, not by system.** SSG will not process training grants where assessment records are submitted beyond the prescribed window after course-run end — the claim is lost outright, not reduced. A single incorrect trainee ID type produces the same outcome. SSG already supports system-to-system submission; Greensafe does not currently use it. **[TO CONFIRM]**

**3. Accredited hours are consumed by transcription.** Audit findings are captured on paper or spreadsheet, photographed to a personal device, and re-authored into a report after hours. Trainee particulars are entered at registration, again at attendance, and again at submission. Each re-entry is unbillable time and a fresh opportunity for error.

**Greensafe Assure addresses all three from a single structured record**, and in doing so converts twenty years of audit findings, training history and client relationships from unstructured documents into an operational asset.

### 1.1 Strategic context

Digital platforms are already marketing ConSASS compliance tooling, digital inspection management with non-conformance tracking, and competency records with expiry alerting — sold as software, at software margins, to Greensafe's own client base. Those platforms must spend years acquiring the regulatory credibility Greensafe already holds.

Building this capability in-house protects the services business now, and creates the option — **explicitly out of scope for v1** — of licensing a client-facing compliance portal as recurring revenue later.

---

## 2. OBJECTIVES

### 2.1 Primary objectives

| # | Objective | Measured by |
|---|---|---|
| O1 | No personnel may be assigned to a job their certification does not cover | Zero assignments to lapsed or non-matching certifications; enforced at system level |
| O2 | No training grant lost to a late or malformed submission | Percentage of course runs submitted within window; rejection rate by reason code |
| O3 | Audit report turnaround measured in hours, not days | Median hours from audit closing meeting to issued report |
| O4 | Any historical record retrievable on demand | Median seconds to retrieve a named finding, certificate or submission from any prior year |
| O5 | Institutional knowledge held in the system, not in individuals | Proportion of operational data captured as structured records |

### 2.2 Secondary objectives

- Single client record spanning training, auditing, outsourcing and consulting.
- Automated renewal triggers converting expiry dates into a qualified pipeline.
- Evidence integrity strong enough to withstand regulatory and legal challenge.

### 2.3 Explicit non-goals for v1

- Not a client-facing commercial SaaS product. Internal platform first.
- Not a replacement for accounting. It integrates; it does not become the ledger.
- Not an AI-authored compliance system. AI assists retrieval and drafting under human sign-off, and is confined to Phase 5.
- Not a general project management tool.

---

## 3. USERS

| Persona | Who they are | Primary need | Device |
|---|---|---|---|
| **Director / Principal Consultant** | Karu, Bala. Owner-operators, final signatories | Exposure at a glance; nothing lapses without their knowledge | Desktop, mobile summary |
| **WSH Auditor** | MOM-approved, SAC-listed. Field-based | Capture findings once, on site, and never retype them | Phone / tablet, frequently offline |
| **Lead Auditor** | Runs the audit team, signs the report | Review, challenge and sign off with a defensible trail | Desktop |
| **QEHS Consultant** | e.g. bizSAFE / ISO implementation work | Generate client document packs without re-authoring boilerplate | Desktop |
| **Training Administrator** | Registrations, attendance, submissions, claims | Enter a trainee once; never miss a submission window | Desktop |
| **Trainer** | Delivers courses across multiple venues | Mark attendance and assessment in the classroom | Tablet |
| **Deployment Coordinator** | Places outsourced officers onto client sites | Know instantly who is qualified, current and available | Desktop |
| **Deployed Officer** | WSHO, FSM, ECO etc. at a client site | Submit timesheets; be warned early about own renewals | Phone |
| **Client contact** | Their client's project or HR manager | Bulk-enrol staff; see certificates, findings, renewals | Desktop (portal, Phase 4) |

Roughly 200 staff **[TO CONFIRM]**, of whom perhaps 30–50 are daily platform users and the remainder occasional (timesheets, own certificate visibility).

---

## 4. MODULE SCOPE

| Module | Name | Phase |
|---|---|---|
| M1 | Competency & Deployment Register | 1 |
| M2 | Training Operations & Statutory Submission | 2 |
| M3 | Audit Platform | 3 |
| M4 | Client Record & Commercial Pipeline | 4 |
| M5 | Consulting Document Engine | 5 |
| M6 | Client Portal | 5 |
| M0 | Platform: identity, permissions, audit log, evidence integrity | Continuous, from Phase 1 |

---

## 5. M1 — COMPETENCY & DEPLOYMENT REGISTER

**The founding module.** Everything else attaches to it, because every other module needs to know who is qualified to do what.

### 5.1 Capability

**Personnel master.** Every consultant, auditor, trainer and deployed officer as a single record: employment status, contact, languages spoken (English, Mandarin, Tamil, Bengali — material for trainer assignment), home base.

**Certification ledger.** Per person, per certification: type, issuing authority (MOM, NEA, SCDF, NRC, SSG, SAC), registration number, issue date, expiry date, scope limitations, and a scanned copy of the certificate itself. Multiple concurrent certifications per person, each with independent validity.

**Deployment ledger.** Which officer is posted to which client, at which site, under which contract, at what charge rate, from when to when.

**The escalation cascade.** Automated, no human trigger:

| Trigger | Action |
|---|---|
| 90 days to expiry | Notify holder. Auto-create a renewal task; propose an internal course run if one exists |
| 60 days | Notify line manager |
| 30 days | Notify account owner. Prompt client communication where the person is on deployment |
| 7 days | Notify Directors. Require a named cover officer |
| Expiry | Certification marked lapsed. Holder blocked from all assignments requiring it |

**The assignment gate — the defining requirement.** Assignment is a validated transaction, not a calendar entry. The system evaluates the role's certification requirement against the candidate's live ledger and returns one of three outcomes:

- **Blocked** — no matching certification, or certification lapsed. Assignment cannot be saved. Reason stated explicitly.
- **Conditional** — certification valid but expires before the deployment ends. Assignment permitted; renewal task created and dated; client notification prompted.
- **Confirmed** — valid throughout.

A block may be overridden **only** by a Director, only with a written justification, and the override is written permanently to the audit log and surfaced on the Director dashboard until closed. Overrides are expected to be rare; if they are frequent, the requirement model is wrong and should be corrected rather than bypassed.

**Coverage view.** For any client site, the officers currently posted and the live validity status of each.

### 5.2 Acceptance criteria

- AC1.1 — Assignment to a lapsed certification cannot be persisted by any non-Director role, through UI or API.
- AC1.2 — Every escalation stage fires within 60 minutes of its due boundary, verified by scheduled job logs.
- AC1.3 — A certificate document is retrievable within 3 seconds of opening a person's record.
- AC1.4 — Director dashboard states the count of lapsed certifications held by currently deployed personnel, refreshed at least hourly.
- AC1.5 — Every override is attributable to a named user with justification text and immutable timestamp.

---

## 6. M2 — TRAINING OPERATIONS & STATUTORY SUBMISSION

### 6.1 Capability

**Course catalogue.** Greensafe's actual portfolio, structured: professional (WSQ Certificate in WSH Level A, WSQ Advanced Certificate Level B, SOC MH Assessor, bizSAFE Level 2 and Level 4, IIMP, WSQ Response to Fire Incident, Occupational First Aid, bizSAFE Level 1 for CEO/Top Management, CSCPM, Managing Work at Height); supervisor (SSSC, FSCS, OPISCS, Supervise Work in Confined Space, Supervision of Metal Scaffold Erection); worker (SOC Tunnelling, SSIC General Trade, SSIC Painter, SSIC Hot Work, OPSOC, SOC MH, Work at Height, Metal Scaffold Erection, Formwork Safety, SOC Metalwork, Basic Traffic Control); and auditor (Internal Auditor & Awareness — ISO 9001, ISO 14001, ISO 45001:2018).

Each course carries: funding eligibility, prescribed submission window, delivery languages, assessment method, trainer certification requirement, room and equipment requirement.

**Run scheduling.** Venue, room, trainer, language and capacity as first-class constraints across Greensafe's multiple premises **[TO CONFIRM the current venue list]**. Conflict detection on trainer double-booking and room clash. Waitlist with automatic promotion. **Trainer assignment is gated by M1** — an uncertified or lapsed trainer cannot be scheduled.

**Enrolment.** Three channels: administrator entry, client bulk upload (a client HR manager enrolling 40 workers in one action), and self-service. Trainee identity validated at the point of entry — ID type and format checked against the submission schema *before* the record is accepted, not after rejection. Deduplication across runs so a returning trainee is one person, not five.

**Classroom capture.** Trainer marks attendance on a tablet by QR or ID scan. Offline-capable, syncing on reconnection. Assessment results entered by the trainer at source. No paper intermediate.

**Statutory submission.** System-to-system submission of course runs, enrolments, attendance and assessment results to TPGateway.

- A visible countdown per course run against the prescribed window.
- Escalating alerts as the deadline approaches, ending with a Director notification.
- Pre-submission validation against the published schema.
- Rejection handling with reason codes surfaced as actionable tasks, not buried in a log.
- **A submission may never fail silently.** Any failure raises a task with an owner.

**Grant reconciliation.** Expected claim versus submitted versus accepted versus paid. Variance flagged and attributable. **This dashboard is the single clearest financial justification for the platform.**

**Certificate issuance.** Automatic on assessment pass, with a verification lookup so clients can confirm authenticity without contacting the office.

### 6.2 Acceptance criteria

- AC2.1 — Trainee particulars are entered once and never re-keyed for submission.
- AC2.2 — No course run may pass its submission deadline without a Director alert having fired.
- AC2.3 — Submission validation errors surface at data entry, not at submission time.
- AC2.4 — Grant reconciliation reflects a complete run lifecycle from scheduling through payment.
- AC2.5 — A trainer without valid certification for a course cannot be assigned to deliver it.

### 6.3 Dependency and risk

TPGateway system integration requires SSG onboarding and credentialing. **Timeline is externally controlled and must be initiated at project start, not at development start.** Bulk file submission is the interim path if API onboarding lags. **[TO CONFIRM — SSG integration status]**

---

## 7. M3 — AUDIT PLATFORM

### 7.1 Capability

**Digital instruments.** ConSASS, SHMS, Risk Management, bizSAFE award, Legal Compliance, OT Exemption, SHARP, WSH Performance Award, BUS Programme, NEA hazardous substances, and client-specified audits. Element and clause structure preserved exactly as published, with **scoring logic implemented in the system** — computed, never hand-calculated.

Instruments are versioned. An audit conducted under the 2021 ConSASS checklist must render, reprint and be defensible under that version indefinitely, regardless of later revisions.

**Field capture — offline-first, non-negotiable.** Shipyards, tunnels, basements and process plants have no reliable connectivity.

- Full instrument available offline; findings, photographs and notes captured locally and synced on reconnection.
- Photographs bound at capture to timestamp, GPS coordinate and auditor identity.
- Structured findings: element → clause → observation → evidence → severity → recommendation.
- Voice-to-text for observation notes.
- Prior-audit findings for the same site available offline for verification of closure.

**Review and sign-off.** Lead auditor reviews team findings, challenges, amends, and signs. Every amendment retains the original with attribution — **findings are never silently overwritten.** Report is cryptographically signed on finalisation.

**Report generation.** Structured findings render to the required output format in one action. Multiple templates: MOM/ConSASS submission format, client corporate format, executive summary. Bilingual output where a client requires it.

**Non-conformance and corrective action.** Every finding above a severity threshold becomes a tracked item with an assigned owner, due date, evidence-of-closure requirement, and automated client reminders. Closure verification carried into the next audit cycle.

**Submission packaging.** Export assembled to meet MOM ConSASS eService requirements, with submission status recorded against the audit.

**Analytics.** Findings queryable across every audit ever conducted: by sector, by element, by client, by auditor, over time. Which clauses fail most often in tunnelling versus shipyards; which clients repeat the same non-conformance; where the industry is weakest. **No competitor can reconstruct this. It is Greensafe's twenty years, made computable.**

### 7.2 Acceptance criteria

- AC3.1 — A complete audit is conducted end to end with zero connectivity, and syncs without data loss.
- AC3.2 — Scores are system-computed; manual score entry is not offered.
- AC3.3 — A finalised report is generated within 60 seconds of sign-off.
- AC3.4 — Every photograph resolves to a specific finding, auditor, timestamp and location.
- AC3.5 — Any finding from any prior year is retrievable in under 10 seconds by client, site, date or clause.
- AC3.6 — An audit conducted under a superseded instrument version renders identically after the instrument is updated.

---

## 8. M4 — CLIENT RECORD & COMMERCIAL PIPELINE

Single client entity across all four service lines. Contacts, sites, contracts, service history.

Quote → proposal → contract → job → invoice, with job creation gated by M1 resourcing availability.

**Renewal engine.** bizSAFE renewals, ISO surveillance audits, annual ConSASS cycles, competency re-certification — every known future obligation generates a dated opportunity automatically. A forgetting problem becomes a pipeline.

**Cross-sell surfacing.** Clients who train with Greensafe but have never been audited; clients with deployed officers but no consulting relationship.

Timesheets for deployed officers with client approval, flowing to invoicing. Utilisation and margin per deployed head.

Accounting integration rather than replacement. **[TO CONFIRM — incumbent accounting system]**

---

## 9. M5 / M6 — CONSULTING ENGINE, CLIENT PORTAL, AI LAYER

**Document engine.** bizSAFE and ISO management-system packs generated from a client profile against a maintained, version-controlled clause library. The consultant edits and signs; the consultant does not author boilerplate.

**Client portal.** Their certificates, their findings and closure status, their deployed officers, their upcoming renewals, their enrolment history — branded, self-service. Reduces inbound queries and is the foundation of any future licensed product.

**AI layer — deliberately last, and constrained.**

1. **Retrieval-grounded regulatory assistant.** WSH Act, subsidiary regulations, Approved Codes of Practice, ConSASS user guide, SS standards, MOM circulars. **Every answer cites the clause; answers without a retrieved source are not returned.**
2. **Report narrative drafting** from structured findings. Always human-reviewed, always human-signed.
3. **Predictive weak-element flagging** from historical patterns.

**Governance, mandatory:** no client data to third-party model training; every AI-touched artefact carries provenance and requires human sign-off before release; a hallucinated regulatory citation is treated as a Severity-1 defect. In a firm whose licence to operate rests on accuracy, an unsourced confident answer is worse than no answer.

---

## 10. M0 — PLATFORM, SECURITY AND EVIDENCE INTEGRITY

Greensafe's client list includes the Prime Minister's Office, MINDEF, the Singapore Police Force, Citibank, Shell and ExxonMobil. Security is not a compliance overhead here — it is a condition of serving these accounts.

### 10.1 Identity and access

- Corppass / Singpass for staff authentication where supported; email plus mandatory MFA otherwise.
- Role-based access enforced **server-side**, never in the client. Roles: Director, Lead Auditor, Auditor, Consultant, Trainer, Training Admin, Deployment Coordinator, Finance, Deployed Officer, Client User.
- Row-level security at the database, so a query cannot return records outside the caller's scope even if application logic is bypassed.
- Client users scoped to their own organisation with no cross-tenant visibility.

### 10.2 Personal data — PDPA

Greensafe processes thousands of trainee records containing national identifiers.

- Field-level encryption of national ID numbers at rest, with keys held in a managed KMS, separate from the database.
- **Masked by default in every interface.** Unmasking is an explicit, reason-required, logged action.
- Purpose limitation, documented retention schedule aligned to statutory record-keeping obligations, and enforced deletion on expiry.
- Consent captured and recorded at enrolment.
- Breach notification runbook maintained and tested.
- Data processing agreement in place with any offshore development or support arrangement.

### 10.3 Data residency

All primary data, backups and object storage in the **Singapore region (ap-southeast-1)**. No cross-border replication without explicit contractual approval. **[TO CONFIRM — residency conditions imposed by government clients]**

### 10.4 Evidence integrity — the differentiating control

An audit report is potentially evidence in a regulatory action or a prosecution. It must be demonstrably unaltered.

- Every finding and every photograph is hashed (SHA-256) at the moment of capture, on the device, before transmission.
- Hashes are chained per audit; the chain root is written on finalisation.
- Daily chain roots are aggregated into a Merkle tree and anchored to append-only, write-once storage with object lock.
- Finalised reports are signed with the auditing organisation's key (Ed25519); the report references immutable evidence identifiers rather than embedding mutable copies.
- Any party can verify that a report and its evidence are byte-identical to what was captured on site, and that verification does not depend on trusting Greensafe's database.

**No competing platform in this market offers this.** It converts "our report says so" into "the report is provably unaltered since capture."

### 10.5 Auditability

Append-only event log covering every read of personal data, every record mutation, every assignment override, every submission attempt, every export. Retained for the full statutory period. Immutable — not merely difficult to edit.

### 10.6 Service levels

| | Target |
|---|---|
| Availability | 99.5% during Singapore business hours |
| Page load (p95) | Under 2 seconds |
| Offline sync | 100 findings with photographs in under 60 seconds on 4G |
| Backup | Point-in-time recovery, 30-day window |
| Recovery objectives | RPO 15 minutes, RTO 4 hours |
| Concurrency | 200 staff, 500 client portal users |

---

## 11. DESIGN SYSTEM

The product must read as Singapore enterprise software — restrained, dense, legible, unfashionable in the way that regulated tooling should be. Not a consumer app. Not a startup dashboard.

### 11.1 Colour

Derived from Greensafe's existing identity: the green, navy, indigo and red already used across their corporate material and logo mark.

| Token | Hex | Use |
|---|---|---|
| `--gs-green` | `#00A551` | Primary brand. Section headings, brand mark, primary emphasis |
| `--gs-green-deep` | `#00753A` | Green text at body size (contrast-safe), hover states |
| `--gs-navy` | `#1C2E6E` | Structural headings, table headers, primary navigation |
| `--gs-indigo` | `#343A94` | Feature panels, key-figure blocks |
| `--gs-red` | `#D9342B` | Brand accent — subsection headings only |
| `--ink` | `#0F1720` | Body text |
| `--ink-muted` | `#5A6672` | Secondary text, labels |
| `--rule` | `#D8DDE2` | Borders, dividers |
| `--surface` | `#FFFFFF` | Cards, tables |
| `--canvas` | `#F4F6F7` | Application background |

**Status colours are deliberately separated from brand colours.** Greensafe's brand uses green and red; so does every status convention. Reusing brand green for "valid" and brand red for "expired" makes brand emphasis indistinguishable from system state — an unacceptable ambiguity in a system whose entire purpose is signalling risk.

| Token | Hex | Meaning |
|---|---|---|
| `--state-critical` | `#B3261E` | Lapsed, blocked, submission failed |
| `--state-warning` | `#B26B00` | Expiring, deadline approaching |
| `--state-ok` | `#1E6B45` | Valid, submitted, confirmed |
| `--state-info` | `#1F5FA8` | In progress, informational |

Status is **never conveyed by colour alone** — always colour plus icon plus text label. Required for accessibility and for printed reports.

All text combinations meet WCAG 2.2 AA (4.5:1 body, 3:1 large text). Brand green at `#00A551` is used for display sizes and fills only; `--gs-green-deep` for any green text below 24px.

### 11.2 Typography

| Role | Family | Notes |
|---|---|---|
| Display / headings | **Inter Tight**, 600 | Tight tracking at large sizes |
| Body / UI | **Inter**, 400/500/600 | Tabular numerals enabled throughout |
| Identifiers, dates, scores | **IBM Plex Mono**, 400/600 | Registration numbers, expiry dates, ConSASS scores — anything meant to be compared vertically |

Self-hosted. No external font CDN — a data-residency and availability consideration, not a preference.

Scale: 12 / 13 / 14 / 16 / 20 / 24 / 32 / 40. Base 14px for data-dense views, 16px for reading views.

### 11.3 Layout and components

- 8px spacing grid. Maximum content width 1440px. Tables full-bleed within it.
- 2px border radius. Regulated software should not look soft.
- Left sidebar navigation grouped by module. Persistent global search. Directors see an exposure summary above all else on landing.
- Data tables are the primary interface: sticky headers, column sort, saved filter views, inline status chips, bulk actions, keyboard navigation, CSV export on every table.
- Destructive and override actions require typed confirmation, never a single click.
- Empty states state what to do next; they do not apologise.
- Errors state what happened and what will fix it, in the system's voice.
- Full keyboard operability, visible focus rings, `prefers-reduced-motion` respected. Motion limited to state transitions under 200ms.

### 11.4 Voice

Plain, active, specific. "Assignment blocked — WSHO registration lapsed 11 days ago," never "An error occurred." Actions keep the same verb through the whole flow: a button reading *Submit to TPGateway* produces a confirmation reading *Submitted to TPGateway*. British English spelling throughout, consistent with Singapore regulatory convention.

---

## 12. TECHNICAL STACK

Chosen for a small team maintaining a regulated system over years — type safety end to end, minimal moving parts, no vendor with an uncertain future.

### 12.1 Application

| Layer | Choice | Rationale |
|---|---|---|
| Language | **TypeScript** (strict) | One language across web, mobile and server; types shared with the database schema |
| Web | **Next.js 15** (App Router), React 19 | Server components for data-dense pages; mature, long-lived |
| UI | **Tailwind CSS** + **shadcn/ui** | Tokens map directly to §11; components owned in-repo, not a versioned dependency |
| Tables | **TanStack Table** | Virtualised, keyboard-navigable, handles 50k-row registers |
| Forms | **React Hook Form** + **Zod** | One Zod schema validates client, server and database boundary |
| Server state | **TanStack Query** | Offline cache, retry and optimistic update semantics |
| API | **tRPC** | Compile-time contract between client and server; no schema drift |
| Field app | **PWA** — service worker + **Dexie** (IndexedDB), with **Expo / React Native** evaluated at Phase 3 if camera or background-sync limits bite | Ships to any device without app-store review; offline-first from day one |

### 12.2 Data and processing

| Layer | Choice | Rationale |
|---|---|---|
| Database | **PostgreSQL 17** (AWS RDS, ap-southeast-1, Multi-AZ) | Row-level security, strong constraints, full-text search, JSONB for versioned instruments |
| ORM / migrations | **Drizzle ORM** | SQL-transparent, typed, migrations reviewable as SQL |
| Background jobs | **pg-boss** | Expiry cascades, submission deadlines, notification fan-out. Postgres-backed — no separate broker to operate |
| Object storage | **S3** (ap-southeast-1), SSE-KMS, versioning on, **Object Lock (compliance mode)** for evidence and finalised reports | Write-once evidence store |
| Cache | **ElastiCache Redis** | Sessions, rate limiting. Introduced only when measurement justifies it |
| Search | Postgres full-text initially; **Typesense** when cross-audit analytics demands it | Avoid premature infrastructure |
| Documents | **React-PDF** for structured reports; **Puppeteer** where pixel-exact regulatory templates require it | |

### 12.3 Security and platform

| Concern | Choice |
|---|---|
| Authentication | **Auth.js** with MFA; Corppass/Singpass OIDC where supported |
| Authorisation | Server-side policy layer + Postgres row-level security |
| Secrets | **AWS Secrets Manager**; no credentials in source or environment files |
| Field encryption | AWS KMS envelope encryption for national identifiers |
| Evidence integrity | SHA-256 chaining, daily Merkle anchoring, Ed25519 report signing (`@noble/hashes`, `@noble/curves`) |
| Notifications | **Amazon SES** (email), **Twilio** (SMS), WhatsApp Business API at Phase 3 |
| Hosting | **AWS ECS Fargate**, ap-southeast-1, behind CloudFront and WAF |
| IaC | **Terraform** — environments reproducible, changes reviewable |
| CI/CD | **GitHub Actions** — typecheck, lint, unit, integration, e2e, migration dry-run, then deploy |
| Observability | **Sentry** (errors), **OpenTelemetry** → **Grafana Cloud** (traces, metrics), structured JSON logs |
| Testing | **Vitest** (unit/integration), **Playwright** (e2e, including full offline-sync scenarios) |

### 12.4 Architectural decisions, stated plainly

**Modular monolith, not microservices.** One deployable, clear module boundaries in-repo. A team of this size operating a distributed system spends its time on infrastructure instead of the product. Boundaries are drawn so that extraction remains possible if it ever becomes necessary.

**AWS Singapore, not Vercel or similar.** Data residency must be contractually demonstrable to government clients, and evidence storage requires S3 Object Lock. Convenience is subordinate to that.

**Offline-first for field capture, online-first for everything else.** Offline sync is genuinely hard and should be paid for only where the environment demands it — which is audits and classroom attendance, and nowhere else.

**Instrument definitions are versioned data, not code.** Regulatory checklists change. Re-deploying the application to reflect a revised ConSASS checklist, and thereby breaking the reproducibility of historical audits, is not acceptable.

**Every write carries actor, timestamp and reason.** Retrofitting an audit trail is impossible; it is a schema decision made once, at the start.

---

## 13. DATA MODEL — CORE ENTITIES

```
Organisation ──< Site ──< Deployment >── Person
                                │
Person ──< Certification >── CertificationType ──< RoleRequirement
   │                              │
   └──< Assignment ───────────────┘   (validated against live certification)

Organisation ──< Contract ──< Job ──< Invoice

Course ──< CourseRun ──< Enrolment >── Trainee
              │              │
              │              ├──< AttendanceRecord
              │              └──< AssessmentResult ──< Certificate
              └──< Submission ──< SubmissionAttempt   (statutory, with reason codes)

AuditInstrument ──< InstrumentVersion ──< Element ──< Clause
Audit ──< Finding ──< Evidence   (hash-chained at capture)
   │         └──< CorrectiveAction
   └──< Signature

Every table: created_by, created_at, updated_by, updated_at, plus an
append-only event stream. Soft delete only — regulated records are never
physically removed inside the statutory retention period.
```

---

## 14. DELIVERY PLAN

| Phase | Scope | Duration | Value delivered |
|---|---|---|---|
| **0** | Discovery. Current-state mapping, systems audit, SSG onboarding initiated, security requirements confirmed with key clients | 2–3 weeks | Assumptions closed; grant application evidence assembled |
| **1** | M0 foundation + M1 Competency & Deployment Register | 8–10 weeks | Certification lapse eliminated as a class of risk |
| **2** | M2 Training Operations & statutory submission | 10–12 weeks | Grant leakage eliminated; admin re-keying removed |
| **3** | M3 Audit Platform, offline field capture, evidence integrity | 12–16 weeks | Auditor hours returned to billable work |
| **4** | M4 Client Record & Commercial Pipeline | 8–10 weeks | Cross-sell and renewal capture |
| **5** | M5 Consulting Engine, M6 Client Portal, AI layer | 12–16 weeks | Consultant leverage; foundation for a future product |

Phases 1 and 2 are the commercial case. Phases 3 onward are contingent on Phase 1 and 2 outcomes and should be re-scoped against measured results rather than committed in advance.

### 14.1 Funding

Bespoke digitalisation of this kind routes through the **Enterprise Development Grant**, which supports qualifying project costs — third-party consultancy, software, and internal manpower — at up to 50% for eligible Singapore SMEs, with no overall funding cap and on a reimbursement basis. The **Productivity Solutions Grant does not fund custom builds**; it covers pre-approved catalogue solutions only.

**Application must precede commencement of work.** Note also that EDG, PSG and MRA are scheduled to consolidate into a new grant in 2H 2026 — verify the current position at the time of application.

Phase 0 output is deliberately structured to serve as the grant application's current-state and quantified-impact evidence.

---

## 15. SUCCESS METRICS

| Metric | Baseline | Target |
|---|---|---|
| Deployments running on a lapsed certification | **[Measure in Phase 0]** | Zero, permanently |
| Grant claims lost to deadline or data error | **[Measure in Phase 0]** | Zero |
| Hours from audit closing meeting to issued report | **[Measure in Phase 0]** | Under 4 hours, median |
| Trainee data entries per course run | Estimated 3 | 1 |
| Time to retrieve a historical finding | **[Measure in Phase 0]** | Under 10 seconds |
| Corrective actions closed within due date | **[Measure in Phase 0]** | Above 90% |
| Renewal opportunities converted | **[Measure in Phase 0]** | Measured and trending upward |

**Every baseline is measured in Phase 0.** Targets asserted without a measured baseline are not credible to the business or to a grant assessor.

---

## 16. RISKS

| Risk | Impact | Mitigation |
|---|---|---|
| Existing systems already cover part of this scope | Scope and business case shrink | Systems audit is the first Phase 0 activity. Scope is re-cut honestly, not defended |
| SSG integration onboarding delays Phase 2 | Schedule slip | Initiate at project start. Bulk-file submission as interim path |
| Field staff resist digital capture | Adoption failure | Auditors involved in instrument design from Phase 0. Offline reliability is the adoption prerequisite — get it right or the module fails regardless of features |
| Regulatory instruments change mid-build | Rework | Instruments are versioned data, not code |
| Single-developer dependency | Continuity risk | Documentation, runbooks and handover material are deliverables, not afterthoughts. Every module ships with a runbook |
| A platform defect causes a real compliance failure | Severe — exceeds project value | Assignment gate and submission alerting fail loudly and default to blocking. Escalation paths tested, not assumed |
| Offshore development raises client data concerns | Contractual objection | Singapore-region hosting, data processing agreement, no production personal data in development environments |

---

## 17. OPEN QUESTIONS FOR PHASE 0

1. What systems are in place today — training management, CRM, accounting, document management?
2. How many course runs per month, across how many venues, in how many languages?
3. What is the current TPGateway submission process, and who owns it?
4. Have grant claims been lost? How often, and to what cause?
5. How are auditor, trainer and deployed-officer certifications tracked today?
6. Has a certification ever lapsed during an active deployment?
7. Current median audit report turnaround?
8. Where do audit photographs and field notes currently reside?
9. How are corrective actions tracked to closure?
10. Do any government or enterprise clients impose data residency, security or vendor conditions?
11. What is the record retention obligation per record class?
12. Who internally will own this platform day to day?
13. What device and connectivity reality do field auditors actually work with?
14. Has EDG been used before, and is there an existing relationship with a grant consultant?

---

*Prepared by KK. Nothing in this document is a commitment until Phase 0 assumptions are closed.*
