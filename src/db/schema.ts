/**
 * Greensafe Assure — database schema (Phase 1 / M1 Competency & Deployment Register).
 *
 * Ratified schema decisions in docs/DECISIONS.md:
 *  - ADR-0002 effective-dated, versioned role requirements (+ DB invariants: one
 *    current version per role, non-overlapping ranges, content immutable once pinned)
 *  - ADR-0003 Role entity + AND/OR requirement composition
 *  - ADR-0004 escalation ledger (unique cert+stage; behaviour is Slice 5)
 *  - ADR-0007 Assignment (validated transaction) vs Deployment (posting), 1:1
 *  - ADR-0008 RenewalTask closes only on evidence (CHECK + procedure; Slice 5)
 *  - ADR-0009 line_manager / account_owner, nullable, Director fallback
 *  - ADR-0013 temporal (system-versioned) certification history
 *
 * Every referential column is a real FK (no plain-uuid dangling holes in a
 * compliance schema). Every table carries audit columns from migration one.
 * Soft delete only: deleted_at, never a hard delete inside retention (Q-P1-13).
 *
 * Triggers that cannot be expressed in Drizzle (system-versioned history,
 * non-overlapping validity, immutability-once-pinned) live in the custom SQL
 * migration alongside the generated one; see drizzle/ and DECISIONS ADR-0002/0013.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Fixed system actor id, seeded first so audit columns are always populated. */
export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Audit columns present on every table (CLAUDE.md non-negotiable rule).
 * `created_by`/`updated_by` reference the acting user; they are intentionally
 * NOT FK-constrained to person — the bootstrap system actor and the first person
 * are self-referential, and a hard FK there would create an unresolvable insert
 * cycle. This is the one deliberate non-FK, and it is defaulted, never dangling.
 */
const audit = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by").notNull().default(SYSTEM_ACTOR_ID),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").notNull().default(SYSTEM_ACTOR_ID),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

const pk = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);

/* ---------------------------------------------------------------- enums --- */

export const employmentStatus = pgEnum("employment_status", [
  "employed",
  "associate",
  "inactive",
]);
export const combinator = pgEnum("requirement_combinator", ["all_of", "any_of"]);
export const assignmentOutcome = pgEnum("assignment_outcome", [
  "confirmed",
  "conditional",
  "overridden",
]);
export const deploymentStatus = pgEnum("deployment_status", ["active", "ended"]);
export const escalationStage = pgEnum("escalation_stage", [
  "d90",
  "d60",
  "d30",
  "d7",
  "expiry",
]);
export const notificationChannel = pgEnum("notification_channel", [
  "in_app",
  "email",
  "sms",
]);
export const deliveryOutcome = pgEnum("delivery_outcome", ["pending", "sent", "failed"]);
export const renewalSource = pgEnum("renewal_source", [
  "cascade_90d",
  "conditional_assignment",
]);
export const renewalStatus = pgEnum("renewal_status", ["open", "closed"]);
export const overrideStatus = pgEnum("override_status", ["open", "resolved"]);
export const historyOperation = pgEnum("history_operation", ["insert", "update", "delete"]);

/** Roles enforced server-side (UXF §2). */
export const userRole = pgEnum("user_role", [
  "director",
  "deployment_coordinator",
  "lead_auditor",
  "auditor",
  "training_admin",
  "trainer",
  "qehs_consultant",
  "finance",
  "deployed_officer",
  "client_user",
]);
/** Who an escalation stage notifies (config-driven, ADR-0017). */
export const notifyTarget = pgEnum("notify_target", [
  "holder",
  "line_manager",
  "account_owner",
  "director",
]);

/* ------------------------------------------------------------- people ----- */

export const person = pgTable("person", {
  id: pk(),
  fullName: text("full_name").notNull(),
  employmentStatus: employmentStatus("employment_status").notNull().default("employed"),
  homeBase: text("home_base"),
  languages: text("languages").array().notNull().default(sql`ARRAY[]::text[]`),
  // ADR-0009: escalation 60-day recipient; nullable, Director fallback. Real FK.
  lineManagerId: uuid("line_manager_id").references((): AnyPgColumn => person.id),
  // National identifier: envelope-encrypted + masked by default (PRD §10.2).
  // Ciphertext never leaves the server; `nationalIdLast4` backs the masked
  // display (e.g. "S••••567A"). Unmasking is a separate, logged procedure.
  nationalIdCiphertext: text("national_id_ciphertext"),
  nationalIdLast4: text("national_id_last4"),
  ...audit,
});

export const organisation = pgTable("organisation", {
  id: pk(),
  name: text("name").notNull(),
  sector: text("sector"),
  // ADR-0009: escalation 30-day recipient; nullable, Director fallback. Real FK.
  accountOwnerId: uuid("account_owner_id").references((): AnyPgColumn => person.id),
  ...audit,
});

export const site = pgTable("site", {
  id: pk(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisation.id),
  name: text("name").notNull(),
  ...audit,
});

/* ------------------------------------------------ certification ledger ---- */

export const authority = pgTable("authority", {
  id: pk(),
  code: text("code").notNull().unique(), // MOM, NEA, SCDF, NRC, SSG, SAC
  name: text("name").notNull(),
  ...audit,
});

export const certificationType = pgTable("certification_type", {
  id: pk(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  authorityId: uuid("authority_id")
    .notNull()
    .references(() => authority.id),
  // Real registration-number formats are unverified (Q-P1-5). Placeholder-only:
  // never a hardcoded guess. Null = no format validation yet.
  validationPattern: text("validation_pattern"),
  // ADR-0008 stub: which internal course renews this credential (M2). Null in Phase 1.
  renewsViaCourseId: uuid("renews_via_course_id"),
  ...audit,
});

export const certification = pgTable("certification", {
  id: pk(),
  personId: uuid("person_id")
    .notNull()
    .references(() => person.id),
  certificationTypeId: uuid("certification_type_id")
    .notNull()
    .references(() => certificationType.id),
  registrationNumber: text("registration_number").notNull(),
  issueDate: date("issue_date", { mode: "string" }).notNull(),
  expiryDate: date("expiry_date", { mode: "string" }).notNull(),
  scopeLimitations: text("scope_limitations"),
  // Scanned certificate (AC1.3). Object-storage key + original filename.
  documentKey: text("document_key"),
  documentFilename: text("document_filename"),
  // ADR-0008: a renewal supersedes; the old row is retained (soft-deleted). Real FK.
  supersedesCertificationId: uuid("supersedes_certification_id").references(
    (): AnyPgColumn => certification.id,
  ),
  ...audit,
});

/**
 * ADR-0013: system-versioned (transaction-time) history of every certification
 * mutation. An in-place expiry correction closes the current row and opens a new
 * one — it never rewrites the past. The past-date exposure figure is
 * reconstructed from here (src/server/reporting.ts), so it is defensible for any
 * date and stable under later corrections. Populated by a trigger (custom migration).
 */
export const certificationHistory = pgTable("certification_history", {
  historyId: uuid("history_id").primaryKey().default(sql`gen_random_uuid()`),
  certificationId: uuid("certification_id")
    .notNull()
    .references(() => certification.id),
  personId: uuid("person_id").notNull(),
  certificationTypeId: uuid("certification_type_id").notNull(),
  registrationNumber: text("registration_number").notNull(),
  issueDate: date("issue_date", { mode: "string" }).notNull(),
  expiryDate: date("expiry_date", { mode: "string" }).notNull(),
  scopeLimitations: text("scope_limitations"),
  supersedesCertificationId: uuid("supersedes_certification_id"),
  certDeletedAt: timestamp("cert_deleted_at", { withTimezone: true }),
  operation: historyOperation("operation").notNull(),
  // Transaction-time validity of this snapshot. sys_to null = current belief.
  sysFrom: timestamp("sys_from", { withTimezone: true }).notNull(),
  sysTo: timestamp("sys_to", { withTimezone: true }),
});

/* ----------------------------------------- roles & requirement grammar ---- */
/* ADR-0003: Role entity; requirements are an AND/OR composable set.          */

export const role = pgTable("role", {
  id: pk(),
  code: text("code").notNull().unique(), // WSHO, FSM, ECO, CSSA, LSS, SSS, …
  name: text("name").notNull(),
  description: text("description"),
  ...audit,
});

/* ADR-0002: effective-dated requirement versions; deployments pin one.
 * DB invariants (custom migration): exactly one current version per role
 * (partial unique index below) and non-overlapping validity ranges (trigger). */
export const roleRequirementVersion = pgTable(
  "role_requirement_version",
  {
    id: pk(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => role.id),
    versionNo: integer("version_no").notNull(),
    validFrom: date("valid_from", { mode: "string" }).notNull(),
    validTo: date("valid_to", { mode: "string" }), // null = current
    ...audit,
  },
  (t) => [
    unique("role_requirement_version_role_no").on(t.roleId, t.versionNo),
    // Exactly one current (open-ended, live) version per role.
    uniqueIndex("rrv_one_current_per_role")
      .on(t.roleId)
      .where(sql`${t.validTo} is null and ${t.deletedAt} is null`),
  ],
);

export const requirementGroup = pgTable("requirement_group", {
  id: pk(),
  requirementVersionId: uuid("requirement_version_id")
    .notNull()
    .references(() => roleRequirementVersion.id),
  combinator: combinator("combinator").notNull(),
  // null = the version's root group; otherwise nests under a parent group. Real FK.
  parentGroupId: uuid("parent_group_id").references((): AnyPgColumn => requirementGroup.id),
  sort: integer("sort").notNull().default(0),
  ...audit,
});

export const requirementItem = pgTable("requirement_item", {
  id: pk(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => requirementGroup.id),
  certificationTypeId: uuid("certification_type_id")
    .notNull()
    .references(() => certificationType.id),
  sort: integer("sort").notNull().default(0),
  ...audit,
});

/* ---------------------------------------- assignment & deployment (F1) ---- */
/* ADR-0007: distinct entities; an Assignment produces a Deployment, 1:1.     */

export const overrideRecord = pgTable("override_record", {
  id: pk(),
  requestedBy: uuid("requested_by").notNull(),
  approvedBy: uuid("approved_by"), // Director; null while open
  justification: text("justification").notNull(),
  status: overrideStatus("status").notNull().default("open"),
  ...audit,
});

export const assignment = pgTable("assignment", {
  id: pk(),
  personId: uuid("person_id")
    .notNull()
    .references(() => person.id),
  roleId: uuid("role_id")
    .notNull()
    .references(() => role.id),
  // ADR-0002: the requirement version this determination was made against.
  requirementVersionId: uuid("requirement_version_id")
    .notNull()
    .references(() => roleRequirementVersion.id),
  outcome: assignmentOutcome("outcome").notNull(),
  overrideId: uuid("override_id").references(() => overrideRecord.id),
  validatedAt: timestamp("validated_at", { withTimezone: true }).notNull().defaultNow(),
  validatedBy: uuid("validated_by").notNull(),
  ...audit,
});

export const deployment = pgTable("deployment", {
  id: pk(),
  // ADR-0007: a Deployment never exists without an Assignment (1:1).
  assignmentId: uuid("assignment_id")
    .notNull()
    .unique()
    .references(() => assignment.id),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisation.id),
  siteId: uuid("site_id")
    .notNull()
    .references(() => site.id),
  roleId: uuid("role_id")
    .notNull()
    .references(() => role.id),
  chargeRate: numeric("charge_rate", { precision: 10, scale: 2 }),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }), // null = open-ended (ADR-0005)
  status: deploymentStatus("status").notNull().default("active"),
  ...audit,
});

/* ------------------------------------ escalation & renewal (Slice 5) ------ */

export const escalationEvent = pgTable(
  "escalation_event",
  {
    id: pk(),
    certificationId: uuid("certification_id")
      .notNull()
      .references(() => certification.id),
    stage: escalationStage("stage").notNull(),
    firedAt: timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
    // ADR-0009: named recipient (else recipient_role carries the Director fallback). Real FK.
    recipientId: uuid("recipient_id").references((): AnyPgColumn => person.id),
    recipientRole: text("recipient_role"),
    channel: notificationChannel("channel").notNull(),
    deliveryOutcome: deliveryOutcome("delivery_outcome").notNull().default("pending"),
    ...audit,
  },
  // ADR-0004: "fires once" is a DB constraint, not application logic.
  (t) => [unique("escalation_event_cert_stage").on(t.certificationId, t.stage)],
);

export const renewalTask = pgTable(
  "renewal_task",
  {
    id: pk(),
    certificationId: uuid("certification_id")
      .notNull()
      .references(() => certification.id),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id),
    ownerId: uuid("owner_id"),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    source: renewalSource("source").notNull(),
    status: renewalStatus("status").notNull().default("open"),
    // ADR-0008: closes ONLY when a later-dated certificate is uploaded. Real FK.
    closedByCertificationId: uuid("closed_by_certification_id").references(
      () => certification.id,
    ),
    ...audit,
  },
  // ADR-0008: a closed task must carry its closing certificate. The
  // expiry-must-be-later rule stays in the closing procedure (Slice 5).
  (t) => [
    check(
      "renewal_task_closed_requires_cert",
      sql`${t.status} <> 'closed' or ${t.closedByCertificationId} is not null`,
    ),
  ],
);

/* --------------------------------------------------------- append log ----- */
/* PRD §10.5 append-only event log. Full coverage is Slice 2; the table       */
/* exists from migration one so nothing has to be retrofitted.                */

export const eventLog = pgTable("event_log", {
  id: pk(),
  actorId: uuid("actor_id").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  detail: text("detail"),
  reason: text("reason"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  // Append-only: no updated/deleted columns by design.
  immutable: boolean("immutable").notNull().default(true),
});

/* --------------------------------------------------- identity (Slice 2) --- */

export const appUser = pgTable("app_user", {
  id: pk(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: userRole("role").notNull(),
  // Staff users may be linked to their personnel record.
  personId: uuid("person_id").references(() => person.id),
  // Dev credential only. Real auth (Corppass/Singpass or email+MFA) is Q-P1-11.
  passwordHash: text("password_hash"),
  active: boolean("active").notNull().default(true),
  ...audit,
});

export const session = pgTable("session", {
  id: text("id").primaryKey(), // opaque random token, stored in an httpOnly cookie
  userId: uuid("user_id")
    .notNull()
    .references(() => appUser.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------- configuration (ADR-0017) ---- */
/* Group-B rules live here as DATA, not constants: thresholds, recipients,     */
/* and scalar rule switches. Changing a number is an UPDATE, not a deploy.     */

export const appSetting = pgTable("app_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  ...audit,
});

export const escalationStageConfig = pgTable("escalation_stage_config", {
  id: pk(),
  stageKey: text("stage_key").notNull().unique(), // maps to escalation_stage enum
  daysBefore: integer("days_before").notNull(), // 90, 60, 30, 7, 0 (expiry)
  notifyTarget: notifyTarget("notify_target").notNull(),
  channel: notificationChannel("channel").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...audit,
});

/* --------------------------------------------- notification outbox -------- */
/* Dispatch is adapter-based; Slice 5 ships a console/log adapter only.        */

export const notification = pgTable("notification", {
  id: pk(),
  recipientId: uuid("recipient_id").references(() => person.id),
  recipientRole: text("recipient_role"),
  channel: notificationChannel("channel").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  relatedEntity: text("related_entity"),
  relatedId: uuid("related_id"),
  status: deliveryOutcome("status").notNull().default("pending"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  ...audit,
});
