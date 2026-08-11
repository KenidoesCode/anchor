/**
 * Greensafe Assure — database schema (Phase 1 / M1 Competency & Deployment Register).
 *
 * Implements the ratified schema decisions in docs/DECISIONS.md:
 *  - ADR-0002 effective-dated, versioned role requirements
 *  - ADR-0003 Role entity + AND/OR requirement composition
 *  - ADR-0004 escalation ledger (present; behaviour is Slice 5)
 *  - ADR-0007 Assignment (validated transaction) vs Deployment (posting), 1:1
 *  - ADR-0008 RenewalTask closes only on evidence (present; behaviour Slice 5)
 *  - ADR-0009 line_manager / account_owner, nullable, Director fallback
 *
 * Every table carries audit columns from this first migration (CLAUDE.md).
 * Soft delete only: deleted_at, never a hard delete inside retention (Q-P1-13).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** Fixed system actor id, seeded first so audit columns are always populated. */
export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Audit columns present on every table (CLAUDE.md non-negotiable rule).
 * `by` columns reference the acting user's id; not FK-constrained to person to
 * avoid a bootstrap cycle (the system actor and first person are self-referential).
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

/* ------------------------------------------------------------- people ----- */

export const person = pgTable("person", {
  id: pk(),
  fullName: text("full_name").notNull(),
  employmentStatus: employmentStatus("employment_status").notNull().default("employed"),
  homeBase: text("home_base"),
  languages: text("languages").array().notNull().default(sql`ARRAY[]::text[]`),
  // ADR-0009: escalation 60-day recipient; nullable, Director fallback.
  lineManagerId: uuid("line_manager_id"),
  // National identifier: envelope-encrypted + masked by default (PRD §10.2).
  // Slice 3 owns encryption/masking; Slice 1 never populates or returns this.
  nationalIdCiphertext: text("national_id_ciphertext"),
  ...audit,
});

export const organisation = pgTable("organisation", {
  id: pk(),
  name: text("name").notNull(),
  sector: text("sector"),
  // ADR-0009: escalation 30-day recipient; nullable, Director fallback.
  accountOwnerId: uuid("account_owner_id"),
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
  // ADR-0008: a renewal supersedes; the old row is retained (soft-deleted).
  supersedesCertificationId: uuid("supersedes_certification_id"),
  ...audit,
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

/* ADR-0002: effective-dated requirement versions; deployments pin one. */
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
  (t) => [unique("role_requirement_version_role_no").on(t.roleId, t.versionNo)],
);

export const requirementGroup = pgTable("requirement_group", {
  id: pk(),
  requirementVersionId: uuid("requirement_version_id")
    .notNull()
    .references(() => roleRequirementVersion.id),
  combinator: combinator("combinator").notNull(),
  // null = the version's root group; otherwise nests under a parent group.
  parentGroupId: uuid("parent_group_id"),
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
    recipientId: uuid("recipient_id"),
    recipientRole: text("recipient_role"),
    channel: notificationChannel("channel").notNull(),
    deliveryOutcome: deliveryOutcome("delivery_outcome").notNull().default("pending"),
    ...audit,
  },
  // ADR-0004: "fires once" is a DB constraint, not application logic.
  (t) => [unique("escalation_event_cert_stage").on(t.certificationId, t.stage)],
);

export const renewalTask = pgTable("renewal_task", {
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
  // ADR-0008: closes ONLY when a later-dated certificate is uploaded.
  closedByCertificationId: uuid("closed_by_certification_id"),
  ...audit,
});

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
