# Greensafe Assure — User Flow Specification

**Companion to PRD v1.0 · Document UXF v1.0 · Commercial in confidence**

Covers information architecture, role-based access, and the eight flows that define the product. Screen-level detail lives in the UX Specification (UXS v1.0).

---

## 1. INFORMATION ARCHITECTURE

```
GREENSAFE ASSURE
│
├── Overview                         role-dependent landing
│
├── PEOPLE
│   ├── Register                     all personnel, certification status
│   ├── Certifications               expiry board, renewal queue
│   ├── Deployments                  who is posted where, right now
│   └── Assign                       the gate
│
├── TRAINING
│   ├── Calendar                     runs by venue / trainer / language
│   ├── Course runs                  lifecycle per run
│   ├── Trainees                     master records, history
│   ├── Submissions                  TPGateway status board
│   └── Claims                       expected vs submitted vs paid
│
├── AUDITS
│   ├── Schedule                     upcoming and in progress
│   ├── Field                        offline capture (mobile)
│   ├── Review                       lead auditor queue
│   ├── Reports                      issued, signed, submitted
│   ├── Corrective actions           open non-conformances
│   └── Insights                     cross-audit analytics
│
├── CLIENTS
│   ├── Organisations                single client record
│   ├── Sites
│   ├── Contracts & jobs
│   └── Renewals                     auto-generated pipeline
│
├── CONSULTING
│   ├── Engagements
│   └── Document packs
│
└── ADMIN
    ├── Users & roles
    ├── Instruments                  audit checklist versions
    ├── Course catalogue
    ├── Certification types          role → requirement mapping
    └── Activity log                 append-only
```

**Navigation rules.** Left sidebar, always visible above 1280px, collapsible below. Global search (`/` or `Cmd-K`) resolves people, trainees, clients, sites, audits, course runs and findings in one index. Breadcrumbs on every detail view. Maximum depth: three levels. Modules the user cannot access are not rendered — never rendered-and-disabled.

---

## 2. ROLES AND LANDING

| Role | Lands on | Sees | Cannot |
|---|---|---|---|
| **Director** | Exposure Overview | Everything | — |
| **Deployment Coordinator** | Deployments | People, Clients, Assign | Override a block; view finance |
| **Lead Auditor** | Review queue | Audits (all), People (read) | Training ops; finance |
| **Auditor** | My audits | Own assigned audits only | Others' audits; sign off |
| **Training Administrator** | Submissions board | Training (all), Trainees, Clients (read) | Audits; deployments |
| **Trainer** | Today's runs | Own runs, attendance, assessment | Enrolment changes; submissions |
| **QEHS Consultant** | My engagements | Consulting, Clients, Audits (read) | Training ops; deployments |
| **Finance** | Claims | Claims, invoices, contracts | Audit findings; personal data unmasked |
| **Deployed Officer** | My profile | Own certifications, own timesheets | Everything else |
| **Client User** | Client portal | Own organisation only | All internal views |

### 2.1 Permission model

Three layers, all enforced server-side:

1. **Role** — what the function permits.
2. **Scope** — which records the person owns or is assigned to (an Auditor sees assigned audits, not all audits).
3. **Field** — national identifiers masked for every role by default; unmasking is a distinct, reason-required, logged permission held only by Training Administrator and Director.

Client users are tenant-isolated at the database row level. A defect in application logic must not be able to leak cross-tenant data.

---

## 3. FLOW F1 — ASSIGN AN OFFICER TO A CLIENT SITE

**The signature flow.** Everything the product stands for is visible in these ten seconds.

**Actor:** Deployment Coordinator · **Trigger:** client requests an officer · **Frequency:** daily

```
  Deployments ──▶ [Assign officer]
                        │
                        ▼
              ┌─────────────────────┐
              │ 1. Select client    │  search or pick from active contracts
              │    and site         │
              └─────────┬───────────┘
                        ▼
              ┌─────────────────────┐
              │ 2. Select role      │  WSHO · FSM · ECO · CSSA · LSS · SSS …
              │    required         │  → resolves certification requirement
              └─────────┬───────────┘
                        ▼
              ┌─────────────────────┐
              │ 3. Set period       │  start and end date
              └─────────┬───────────┘
                        ▼
              ┌─────────────────────┐
              │ 4. Choose officer   │  list is PRE-FILTERED and pre-sorted:
              │                     │    ✓ certified & available
              │                     │    ▲ certified, expires within period
              │                     │    ✕ not eligible (shown, greyed, reason inline)
              └─────────┬───────────┘
                        ▼
                 ┌──────────────┐
                 │  VALIDATE    │  live check against certification ledger
                 └──────┬───────┘
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
      BLOCKED      CONDITIONAL     CONFIRMED
```

> **Correction (2026-08-11, ratified — see `docs/DECISIONS.md` ADR-0010).** The
> ineligibility reason for a greyed officer is shown **inline** in the row, never
> on hover. Hover-only fails WCAG (UXS §9) and does not exist on field tablets.
> The earlier "reason on hover" wording above was wrong; UXS §5.3 and §9 are
> correct and govern.

### 3.1 Outcome logic

| Condition | Outcome | System behaviour |
|---|---|---|
| No certification of required type | **Blocked** | Save disabled. States what they hold instead |
| Certification lapsed | **Blocked** | States days lapsed, registration number, exposure if it proceeded |
| Certification expires before deployment end | **Conditional** | Save enabled. Renewal task created and dated. Client notification prompted |
| Officer already deployed, overlapping dates | **Blocked** | Shows conflicting deployment, offers to view it |
| Valid throughout | **Confirmed** | Saved. Client and officer notified |

### 3.2 The override path

Blocked is **not** a soft warning. Save is disabled, not merely discouraged.

```
BLOCKED ──▶ [Request Director override]
                     │
                     ▼
        Director receives immediate notification
                     │
                     ▼
        Director must type a justification — no dropdown of
        canned reasons, no single-click approve
                     │
                     ▼
        Override recorded permanently in the activity log
                     │
                     ▼
        Deployment flagged on Director Overview until resolved
```

**Design intent:** overrides should feel heavy, because they are. If they become routine, the certification requirement model is wrong and should be corrected — not routed around. Override frequency is itself a monitored metric.

---

## 4. FLOW F2 — CERTIFICATION EXPIRY CASCADE

**System-initiated. No human trigger. This is the flow that eliminates the risk.**

```
        Nightly job evaluates every active certification
                            │
        ┌───────────┬───────┼────────┬──────────┬─────────┐
        ▼           ▼       ▼        ▼          ▼         ▼
      90d         60d      30d       7d      EXPIRY   POST-EXPIRY
        │           │       │        │          │         │
     holder      + line   + account + DIRECTORS │      daily digest
     notified    manager    owner   named cover │      to Directors
        │           │       │       required   │      until cleared
        ▼           ▼       ▼        ▼          ▼
   renewal task  escalate  client   cover     ┌──────────────────┐
   created;      to        informed  officer  │ HARD BLOCK       │
   internal      manager   if on     assigned │ removed from all │
   course run    queue     deployment         │ eligible pools   │
   proposed                                   │ active deploy-   │
                                              │ ment flagged RED │
                                              └──────────────────┘
```

### 4.1 Rules

- Renewal is closed only by uploading a new certificate with a later expiry date — never by a user marking it "done." Evidence closes the loop, not assertion.
- Each stage fires once. Notification fatigue destroys the value of the alert.
- Where an internal Greensafe course exists that satisfies the renewal, the 90-day task links directly to the next available run with capacity. **This is a genuine advantage: they run the training that renews their own people.**
- Officers see their own expiry countdown on their profile from 120 days out.
- The Director Overview always displays a single number above everything else: **certifications lapsed among currently deployed personnel.** Target state is permanently zero.

---

## 5. FLOW F3 — COURSE RUN TO CLAIM

**Actor:** Training Administrator, Trainer · **The revenue-protection flow**

```
 SCHEDULE ──▶ ENROL ──▶ DELIVER ──▶ ASSESS ──▶ SUBMIT ──▶ RECONCILE
```

### 5.1 Schedule

Select course → date → venue and room → **language** → trainer.

Trainer selection is gated by F1 logic: a trainer without current certification for that course does not appear. Room and trainer conflicts are detected before save, not after.

### 5.2 Enrol — three channels

```
 A. Administrator entry      one trainee at a time
 B. Client bulk upload       client HR uploads a roster; validated on upload
 C. Self-service             public booking
                    │
                    ▼
        ┌───────────────────────────────┐
        │ VALIDATE AT ENTRY, NOT LATER  │
        │  · ID type and format          │
        │  · duplicate detection         │
        │  · mandatory contact fields    │
        │  · funding eligibility         │
        └───────────────────────────────┘
                    │
         invalid ───┴─── valid ──▶ enrolled
             │
             ▼
   rejected at the point of entry,
   with the specific field named
```

**This is the core insight of the module.** Today an error is discovered weeks later, at submission, when the claim is already lost. Here it is caught by the person typing it, in the moment they can still fix it.

### 5.3 Deliver and assess

Trainer opens the run on a tablet. Marks attendance by scan or tap. Works offline; syncs when back on network. Enters assessment results at source. No paper. No second entry.

### 5.4 Submit

```
 Run ends ──▶ submission window opens ──▶ COUNTDOWN VISIBLE
                                              │
        ┌──────────┬──────────┬───────────────┤
        ▼          ▼          ▼               ▼
   day 1-3     day 4-7    day 8-10      FINAL WINDOW
   normal      amber      red banner    Directors notified
                                              │
                                              ▼
                                     ┌────────────────┐
                                     │ SUBMIT         │
                                     └────────┬───────┘
                          ┌──────────────────┴──────────────────┐
                          ▼                                     ▼
                      ACCEPTED                              REJECTED
                          │                                     │
                          ▼                                     ▼
                   claim → pending              reason code → actionable task
                                                with named owner and re-submit
                                                deadline. NEVER a silent log entry.
```

**Absolute rule:** no course run may pass its deadline without a Director alert having fired. A missed window is unrecoverable revenue — the system's job is to make it impossible to reach silently.

### 5.5 Reconcile

Claims board: expected → submitted → accepted → paid. Any run stuck at a stage beyond its expected duration is surfaced with the variance quantified in dollars.

---

## 6. FLOW F4 — AUDIT LIFECYCLE

**Actors:** Auditor (field), Lead Auditor (review) · **Environment:** frequently no connectivity

```
 PREPARE ──▶ CAPTURE ──▶ SYNC ──▶ REVIEW ──▶ SIGN ──▶ ISSUE ──▶ SUBMIT ──▶ TRACK
  online     OFFLINE     auto     online    online   auto     online    ongoing
```

### 6.1 Prepare (online, before leaving)

Auditor opens the assigned audit. System downloads for offline use: the instrument at its current version, the site record, prior audit findings for verification of closure, and the client's open corrective actions. A clear indicator confirms **"Ready for offline use — downloaded [time]."**

### 6.2 Capture (offline)

```
   Element ──▶ Clause ──▶ Observation ──▶ Evidence ──▶ Severity ──▶ Recommendation
                              │              │
                          voice-to-text   photo: hashed at capture,
                          supported       bound to timestamp + GPS + auditor
```

- Score is computed continuously by the system. **Manual score entry is not offered anywhere in the interface.**
- Progress indicator shows elements complete against total.
- Prior findings for the same clause are shown inline, so closure is verified rather than remembered.
- Everything persists locally and immediately. Closing the app mid-audit loses nothing.

### 6.3 Sync

```
   Connectivity restored
            │
            ▼
   Queued findings and evidence upload
            │
   ┌────────┴────────┐
   ▼                 ▼
 SUCCESS          CONFLICT
   │                 │
   ▼                 ▼
 confirmation   both versions shown side by side;
 with counts    auditor chooses. NEVER auto-resolved,
                NEVER silently discarded.
```

Sync status is permanently visible during an audit: pending item count, last successful sync time. A field auditor must never have to wonder whether their work is safe.

### 6.4 Review and sign

Lead Auditor queue. Can amend a finding — **the original is retained with attribution, never overwritten.** Can return a finding to the auditor with a comment. On sign-off: the report is cryptographically signed, the evidence chain root is written, and the audit becomes immutable.

### 6.5 Issue, submit, track

Report generates in the required template within seconds. Submission package assembled for the MOM ConSASS eService; submission status recorded against the audit. Findings above the severity threshold become tracked corrective actions automatically.

---

## 7. FLOW F5 — CORRECTIVE ACTION TO CLOSURE

```
 Finding (severity ≥ threshold)
        │
        ▼
 Corrective action created automatically
   owner · due date · evidence-of-closure requirement
        │
        ▼
 Client notified via portal + email
        │
   ┌────┴────┬─────────┬──────────┐
   ▼         ▼         ▼          ▼
 T-7      due date   overdue   overdue+14
 remind   remind     escalate  Director + account owner
                     to client
        │
        ▼
 Client submits evidence ──▶ Greensafe verifies ──▶ CLOSED
                                      │
                                  rejected ──▶ reopened, new due date
```

Open corrective actions carry forward into the next audit at the same site and appear inline against the relevant clause. **Nothing quietly disappears between audit cycles.**

---

## 8. FLOWS F6–F8 — SUPPORTING

### F6 — Onboard a person

Personal details → languages → role → upload each certification (type, authority, registration number, issue and expiry dates, scanned certificate) → system computes eligibility → person enters the assignable pool. Expiry monitoring begins immediately on save.

### F7 — Renewal to opportunity

```
 System scans forward-dated obligations
   · bizSAFE renewals        · ISO surveillance cycles
   · annual ConSASS          · competency re-certification
            │
            ▼
 Opportunity generated at T-120 days, assigned to account owner
            │
            ▼
 Quote ──▶ Contract ──▶ Job ──▶ (resourced via F1) ──▶ Invoice
```

Converts a forgetting problem into a pipeline. No manual monitoring.

### F8 — Client portal (Phase 5)

Client user logs in and sees only their organisation: certificates held by their staff, enrolment history, audit findings with closure status, deployed officers with validity, upcoming renewals. Actions available: bulk-enrol staff, submit corrective action evidence, download certificates and reports, request a quote.

**Reduces inbound queries and is the foundation of any future licensed product.**

---

## 9. CROSS-CUTTING FLOW RULES

**Nothing fails silently.** Every failed submission, sync, notification or validation produces a visible, owned, actionable item. A log entry is not a notification.

**Blocks are blocks.** Where the system prevents an action, the primary control is disabled — not enabled-with-a-warning. The reason is stated in the same view, at the same moment. No modal-dismiss-and-proceed.

**Evidence closes loops, not assertion.** Renewals close on an uploaded certificate. Corrective actions close on verified evidence. No status is advanced by someone ticking a box.

**Every state change is attributable.** Actor, timestamp, and — for overrides and amendments — a typed reason. Written to an append-only log.

**Offline is a first-class state, not an error.** Where offline capability exists, the interface says so plainly and shows what is pending. Where it does not, the interface says that too, before the user leaves connectivity.

**One entry, one time.** No datum entered by a human is ever re-entered by a human. If it appears twice in a flow, the flow is wrong.

---

*Document UXF v1.0 · Screen-level specification in UXS v1.0*
