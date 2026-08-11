# Greensafe Assure — UI/UX Specification

**Companion to PRD v1.0 and UXF v1.0 · Document UXS v1.0 · Commercial in confidence**

---

## 1. DESIGN PRINCIPLES

**Density over comfort.** Users work with hundreds of records daily. Generous whitespace that halves rows-per-screen makes the product worse, not calmer.

**State is never colour alone.** Every status carries colour, icon and text label. Required for accessibility, for colour-blind users, for printed reports, and for monochrome regulatory submissions.

**Risk sits at the top.** On every screen with an exposure dimension, the exposure is the first thing rendered — never below the fold, never behind a tab.

**The interface refuses.** Where the system prevents an action, the control is disabled and the reason is stated in place. No optimistic UI that later reverses.

**Numbers align.** Tabular numerals everywhere. Registration numbers, dates and scores set in mono so they compare vertically down a column.

**Unfashionable on purpose.** This is regulated tooling. Restraint reads as trustworthy; personality reads as unserious.

---

## 2. LAYOUT SHELL

```
┌──────────────────────────────────────────────────────────────────┐
│ ▪▪▪ GREENSAFE ASSURE      [ / search ]      ⚠ 3    KK ▾          │ 56px
├────────────┬─────────────────────────────────────────────────────┤
│            │  People › Register › R. Sundaram                    │ 44px
│  Overview  ├─────────────────────────────────────────────────────┤
│            │                                                     │
│  PEOPLE    │                                                     │
│  Register  │              CONTENT                                │
│  Certs     │              max 1440px                             │
│  Deploy    │              24px gutter                            │
│  Assign    │                                                     │
│            │                                                     │
│  TRAINING  │                                                     │
│  …         │                                                     │
│            │                                                     │
│  248px     │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

- Sidebar 248px, fixed, collapses to 64px icon rail below 1280px, becomes a drawer below 900px.
- Top bar: brand mark (the three-square Greensafe device), global search, alert bell with unread count, user menu.
- Content max-width 1440px; tables span full width within it.
- Breadcrumb bar on all detail views.
- Field app (audits, classroom attendance) uses a separate full-bleed mobile shell — see §8.

---

## 3. STATUS SYSTEM

The single most important visual convention in the product.

| State | Colour | Icon | Label | Used for |
|---|---|---|---|---|
| Critical | `#B3261E` | ✕ filled circle | **Lapsed** / **Blocked** / **Failed** | Expired certification, blocked assignment, failed submission |
| Warning | `#B26B00` | ▲ triangle | **Expiring** / **Due** | Within 90 days, deadline approaching |
| OK | `#1E6B45` | ✓ circle | **Valid** / **Submitted** | Current, accepted, confirmed |
| Info | `#1F5FA8` | ● dot | **In progress** / **Pending** | Under review, awaiting response |
| Neutral | `#5A6672` | ○ ring | **Draft** / **Inactive** | Not yet active |

**These are deliberately not Greensafe's brand green and red.** Brand green `#00A551` and brand red `#D9342B` are reserved for identity — headings, the mark, section emphasis. If brand green also meant "valid," a green heading and a green status chip would be visually equivalent, and in a system whose purpose is signalling risk that ambiguity is a defect. Status colours are darker and deliberately less saturated than the brand palette.

### 3.1 Status chip

```
┌──────────────┐
│ ✕  Lapsed    │   28px tall · 2px radius · 12px label, 600 weight
└──────────────┘   background at 8% of the state colour
                   1px border at 40% · text at full state colour
```

### 3.2 Exposure banner

Reserved for the highest-severity condition on a screen. Full width, above content, `#B3261E` left rule at 4px, never dismissible while the condition holds.

---

## 4. COMPONENT INVENTORY

| Component | Specification |
|---|---|
| **Data table** | Sticky header, 44px rows, sortable columns, saved filter views, row-click to detail, bulk select, CSV export always present, virtualised beyond 200 rows |
| **Status chip** | §3.1 |
| **Person cell** | Avatar initials, name, role beneath, worst-status chip on the right — used consistently in every list where a person appears |
| **Certification row** | Type · authority · registration number (mono) · expiry date (mono) · days remaining · status chip |
| **Countdown** | Days remaining with escalating treatment: neutral → amber → red with pulse under 48h |
| **Validation panel** | The assignment gate outcome. §5.3 |
| **Timeline** | Vertical, for escalation history and audit revisions. Actor, timestamp, action, reason |
| **Evidence thumbnail** | Photo with capture time, GPS pin, integrity ✓, click to full view |
| **Score meter** | ConSASS element maturity — horizontal segments, no gradient, exact value in mono alongside |
| **Sync indicator** | Field app only. Pending count + last sync time. Persistent. |
| **Confirm dialog** | Destructive and override actions require typing a specific word, never a single click |
| **Filter bar** | Above every table. Chips for active filters, each individually removable, "Clear all" when two or more |

**Forms.** Labels above fields, always. Placeholder text is never a label. Validation on blur, not on keystroke. Errors below the field, in words, naming the field. Required fields marked; optional fields left unmarked. Never disable a submit button without stating why beside it.

---

## 5. SCREEN SPECIFICATIONS

### 5.1 Director Overview

**Purpose:** the answer to "is anything exposed right now?" in under three seconds.

```
┌──────────────────────────────────────────────────────────────┐
│ ⚠  2 officers are deployed under lapsed certification        │  exposure banner
│    Shimizu — Changi T5 · Obayashi — Marina South   [Review]  │  only when > 0
├──────────────────────────────────────────────────────────────┤
│  EXPOSURE                                                    │
│  ┌──────────┬──────────┬──────────┬──────────┐               │
│  │    2     │    7     │    1     │    0     │               │
│  │ lapsed   │ expiring │ deadline │ override │               │
│  │ deployed │ ≤90 days │ ≤48 hrs  │ open     │               │
│  └──────────┴──────────┴──────────┴──────────┘               │
├──────────────────────────────────────────────────────────────┤
│  SUBMISSION DEADLINES        │  AUDITS AWAITING SIGN-OFF     │
│  next 14 days, by urgency    │  lead auditor queue depth     │
├──────────────────────────────┼───────────────────────────────┤
│  CLAIMS                      │  CORRECTIVE ACTIONS OVERDUE   │
│  expected · submitted · paid │  by client, by days overdue   │
└──────────────────────────────────────────────────────────────┘
```

The four exposure figures are 40px, mono, in state colour. Each is a link to the filtered list. **When all four read zero, the screen should feel quiet — that is the product working.**

### 5.2 People — Register

Table: Name · Roles held · Worst status · Next expiry · Currently deployed at · Actions.

Default sort: worst status first, then soonest expiry. **Not alphabetical.** The register is a risk instrument, not a phone book.

Filters: status, role, certification type, deployed / available, language, issuing authority.

Empty state: *"No one matches these filters."* with a Clear all action. Not an illustration.

### 5.3 Assign (F1) — the signature screen

Two panes. Left: the form. Right: the live validation panel, updating on every field change.

**Officer selector** is pre-filtered and pre-sorted:

```
  ✓  Ng Siew Ling          WSHO · valid to 28 Feb 2028      available
  ✓  K. Rajendran          WSHO · valid to 14 Nov 2027      available
  ▲  Mohamed Faizal        WSHO · expires in 17 days        deployed
  ✕  Tan Boon Hock         no WSHO certification            greyed
  ✕  R. Sundaram           WSHO lapsed 11 days ago          greyed
```

Ineligible officers are shown, greyed, with the reason inline — **not hidden.** The coordinator must be able to see that they were considered and why they fail, or they will phone someone to ask.

**Validation panel — three states:**

```
BLOCKED                                        border #B3261E
┌─────────────────────────────────────────────┐
│ ✕  Assignment blocked                       │
│                                             │
│ R. Sundaram's WSHO registration             │
│ WSHO/24/08812 lapsed 11 days ago.           │
│                                             │
│ Shimizu — Changi T5 would be operating      │
│ without a valid WSHO, and would not know.   │
├─────────────────────────────────────────────┤
│ [ Request Director override ]               │
└─────────────────────────────────────────────┘
  primary Save button is DISABLED, with
  "Blocked — see panel" beside it

CONDITIONAL                                    border #B26B00
┌─────────────────────────────────────────────┐
│ ▲  Allowed — renewal required first          │
│                                             │
│ Mohamed Faizal is certified, but WSHO       │
│ WSHO/24/07330 expires 28 Aug 2026 —         │
│ 17 days — before this deployment ends.      │
│                                             │
│ Renewal task will be created on save.       │
│ Next internal run: 19 Aug, Pioneer Junction │
└─────────────────────────────────────────────┘

CONFIRMED                                      border #1E6B45
┌─────────────────────────────────────────────┐
│ ✓  Assignment confirmed                     │
│                                             │
│ Ng Siew Ling · WSHO/26/01204                │
│ Valid to 28 Feb 2028, covering the full     │
│ deployment period.                          │
└─────────────────────────────────────────────┘
```

No animation beyond a 160ms opacity transition on state change. This screen must feel like a machine returning a determination, not an app being pleased with itself.

### 5.4 Certifications — expiry board

Grouped columns: **Lapsed · ≤7 days · ≤30 days · ≤90 days · Valid.**

Each card: person, certification type, registration number, expiry date, deployment status, renewal task state. Cards for people currently on deployment carry a site badge — this is the population that matters most.

Bulk action: create renewal tasks for a selected group, assigning to the next internal course run with capacity.

### 5.5 Training — Submissions board

Kanban by lifecycle stage: **Awaiting submission · Submitted · Accepted · Rejected · Paid.**

Every card in "Awaiting submission" shows a countdown. Under 48 hours, the card turns critical and the run is escalated to the Director Overview.

Rejected cards show the reason code translated into plain language plus the specific field at fault, with a **Fix and resubmit** action that opens directly at that field. Never a raw error code alone.

### 5.6 Course run detail

Tabs: Details · Enrolments · Attendance · Assessment · Submission · Claim.

The submission tab shows the full attempt history with timestamps and responses. Nothing is hidden in a log the user cannot reach.

### 5.7 Audit — field capture (mobile)

See §8.

### 5.8 Audit — review queue

Split view. Left: findings list with severity and element. Right: selected finding with evidence, prior-cycle history, and amendment controls.

Amendment retains the original, shown collapsed beneath the current version with attribution — **"Amended by [name], [timestamp]. View original."**

Sign-off requires every element to be complete and every returned finding to be resolved. The Sign and issue button states what is outstanding when disabled.

### 5.9 Audit — insights

Cross-audit analytics. Findings by element across all audits; by sector; by client; over time. Filterable by date range, instrument version, sector, auditor.

**This is the screen to show a client in a renewal conversation.** It should look authoritative and print cleanly.

### 5.10 Client organisation record

Header: name, sector, sites, active contracts, account owner.

Tabs: Overview · Training history · Audits · Deployed officers · Corrective actions · Renewals · Documents · Contacts.

Overview surfaces cross-sell explicitly: *"This client has trained 214 workers and has never commissioned an audit."* Stated as a fact, not styled as a marketing prompt.

---

## 6. NOTIFICATIONS

| Channel | Used for |
|---|---|
| In-app | Everything. Bell with unread count; grouped by module |
| Email | Escalations from 60 days, submission deadlines, sign-off requests, override requests |
| SMS | 7-day certification escalation and submission deadlines under 48 hours only |
| WhatsApp | Deployed officer renewals and timesheet reminders (Phase 3) |

**Rules.** Each escalation stage fires once. Digest rather than individual sends where more than three items are pending for one recipient. Every notification contains the specific record and a direct link — never "you have updates." Users control channel preference; they cannot switch off critical certification and submission alerts.

---

## 7. WRITING

Plain, active, specific. British English throughout, consistent with Singapore regulatory convention. Sentence case for all labels, headings and buttons.

| Situation | Write | Never |
|---|---|---|
| Blocked assignment | "Assignment blocked — WSHO registration lapsed 11 days ago" | "An error occurred" |
| Empty table | "No certifications expiring in the next 90 days." | "Nothing here yet!" |
| Empty because filtered | "No one matches these filters. **Clear all**" | "No results found" |
| Failed submission | "TPGateway rejected this submission: trainee ID type does not match the ID format. **Fix and resubmit**" | "Submission failed. Please try again" |
| Offline | "Working offline. 14 findings saved on this device, pending sync." | "Connection lost" |
| Sync complete | "Synced. 14 findings and 31 photographs uploaded." | "Success!" |
| Destructive confirm | "Type DELETE to remove this course run and its 28 enrolments." | "Are you sure?" |

Buttons keep the same verb through the whole flow: *Submit to TPGateway* → *Submitted to TPGateway*. *Sign and issue* → *Signed and issued*.

Errors do not apologise and are never vague about what happened. Empty states are an invitation to act, not a mood.

---

## 8. FIELD APP UX

Audits happen in shipyards, tunnels, basements and process plants. Design for that reality, not for a desk.

**Physical conditions**

- One-handed operation. Primary controls in the lower third of the screen.
- Minimum 48px touch targets — users wear gloves.
- High contrast mode default; screens are read in direct sun.
- No hover states. Nothing is reachable only by hover.
- Text minimum 16px. Users are frequently over 45 and wearing safety glasses.

**Offline behaviour**

- Persistent sync bar at the top: *"Offline · 14 pending · last synced 10:42."* Never hidden, never a transient toast.
- Every capture writes to local storage immediately and confirms visibly.
- Closing or crashing the app loses nothing.
- Before leaving connectivity, a clear pre-flight state: *"Ready for offline use — instrument, site record and 41 prior findings downloaded 08:15."*
- Conflicts on sync are presented side by side for the auditor to resolve. **Never auto-merged, never silently discarded.**

**Capture flow**

- Element list with progress; tap into clause; observation, evidence, severity, recommendation.
- Camera opens in-app; photo is hashed, stamped and attached to the specific clause without leaving the flow.
- Voice-to-text available on every observation field.
- Prior findings for the same clause shown inline for closure verification.
- Running score always visible, always system-computed.

---

## 9. ACCESSIBILITY

- WCAG 2.2 AA throughout. 4.5:1 for body text, 3:1 for large text and interface components.
- Brand green `#00A551` is used for display sizes and fills only. Green text below 24px uses `#00753A`.
- Full keyboard operability. Visible focus ring, 2px, `#1F5FA8`, offset 2px. No focus trap outside modals.
- Semantic HTML; ARIA only where semantics do not exist. Tables are tables.
- Status announced to screen readers as text, never inferred from colour.
- `prefers-reduced-motion` honoured. All motion under 200ms; none of it load-bearing.
- Form errors linked to their field with `aria-describedby` and announced on validation.
- Target size minimum 24px on desktop, 48px in the field app.

---

## 10. PRINT AND EXPORT

Audit reports, certificates and register extracts are printed and submitted to regulators. Print is a first-class output.

- Dedicated print stylesheet. No sidebar, no navigation, no interactive affordance.
- **Status must survive monochrome** — icon and text label carry the meaning; colour is supplementary.
- Every page: report reference, client, site, audit date, page x of y.
- Evidence identifiers and the signature block printed on the final page, so a printed report remains independently verifiable.
- Registration numbers, dates and scores in mono for column alignment.

---

## 11. WHAT STILL NEEDS RESEARCH

Stated rather than assumed:

1. **Actual registration number formats** for MOM, SCDF and NEA credentials. The examples throughout these documents are illustrative and must be replaced with verified formats before build.
2. **The published TPGateway submission schema** and its exact rejection reason codes, obtainable on SSG onboarding.
3. **ConSASS instrument structure at the current version** — element and clause hierarchy, scoring model.
4. **Field device reality** — what auditors actually carry, and their true connectivity conditions.
5. **Existing systems** and their interfaces. Everything here assumes greenfield; that assumption may be wrong and should be tested first.
6. **Client-imposed vendor conditions** from government and enterprise accounts.

**Screens should be validated with two auditors and one training administrator before any build begins.** Designing regulated field tooling without watching the work being done is how good specifications produce unused software.

---

*Document UXS v1.0 · Design tokens defined in PRD v1.0 §11 · Flows in UXF v1.0*
