/**
 * The assignment gate — the founding requirement (CLAUDE.md, PRD §5.1, UXF §3).
 *
 * A pure, deterministic function: given a candidate's certification ledger, the
 * pinned requirement version (ADR-0002), the deployment period and any
 * overlapping postings, it returns exactly one determination —
 * Blocked | Conditional | Confirmed — with structured, human-readable reasons.
 *
 * Pure by design: `now` is passed in, never read from the clock, so the outcome
 * is reproducible and unit-testable without a database or a wall clock.
 *
 * This module is the control. The disabled Save button is presentation; the
 * server re-runs this and rejects Blocked (see server/routers/assignment.ts).
 */

export type Combinator = "all_of" | "any_of";

/** A resolved requirement node from a pinned role_requirement_version (ADR-0003). */
export type RequirementNode =
  | {
      kind: "item";
      certificationTypeId: string;
      certificationTypeCode: string;
      certificationTypeName: string;
    }
  | { kind: "group"; combinator: Combinator; children: RequirementNode[] };

/** A certification the person holds (active, non-deleted). Dates are ISO 'YYYY-MM-DD'. */
export interface HeldCertification {
  certificationTypeId: string;
  certificationTypeCode: string;
  registrationNumber: string;
  issueDate: string;
  expiryDate: string;
}

export interface OverlappingDeployment {
  siteName: string;
  roleCode: string;
  startDate: string;
  endDate: string | null;
}

export interface GateInput {
  /** Reference date 'YYYY-MM-DD'. Injected, never read from the clock. */
  now: string;
  deploymentStart: string;
  /** null = open-ended posting (ADR-0005). */
  deploymentEnd: string | null;
  requirement: RequirementNode;
  requirementVersionId: string;
  heldCertifications: HeldCertification[];
  overlappingDeployments: OverlappingDeployment[];
}

export type GateOutcome = "blocked" | "conditional" | "confirmed";

export type GateReasonCode =
  | "missing"
  | "lapsed"
  | "expires_before_end"
  | "covered"
  | "overlap";

export interface GateReason {
  code: GateReasonCode;
  /** Plain, active, specific message — British English (UXS §7). */
  message: string;
  certificationTypeCode?: string;
  registrationNumber?: string;
  expiryDate?: string;
  daysLapsed?: number;
}

export interface GateResult {
  outcome: GateOutcome;
  /** Confirmed only because the posting is open-ended; the cascade owns the future expiry (ADR-0005). */
  monitored: boolean;
  requirementVersionId: string;
  reasons: GateReason[];
}

/* --------------------------------------------------------------- dates ---- */

/** Whole days from `from` to `to` (ISO date strings). Positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const mi = Number(m) - 1;
  return `${Number(d)} ${months[mi] ?? m} ${y}`;
}

/* ----------------------------------------------------- node evaluation ---- */

type Coverage = "covered" | "expires_early" | "missing";

interface NodeResult {
  coverage: Coverage;
  reasons: GateReason[];
}

const rank: Record<Coverage, number> = { covered: 2, expires_early: 1, missing: 0 };

function evaluateItem(
  node: Extract<RequirementNode, { kind: "item" }>,
  input: GateInput,
): NodeResult {
  const { now, deploymentStart, deploymentEnd } = input;
  const held = input.heldCertifications.filter(
    (c) => c.certificationTypeId === node.certificationTypeId,
  );

  if (held.length === 0) {
    return {
      coverage: "missing",
      reasons: [
        {
          code: "missing",
          certificationTypeCode: node.certificationTypeCode,
          message: `No ${node.certificationTypeCode} certification.`,
        },
      ],
    };
  }

  // Best cert wins: covers-through-end > valid-at-start-but-expiring > lapsed.
  const validAtStart = (c: HeldCertification) =>
    c.issueDate <= deploymentStart && c.expiryDate >= deploymentStart;
  // ASSUMPTION — UNRATIFIED — pending Q-P1-7 (ADR-0005): an open-ended posting
  // (deploymentEnd === null) with a currently-valid cert is treated as fully
  // COVERED (⇒ Confirmed-with-monitoring), not Conditional. Greensafe has not
  // confirmed that open-ended postings exist or that this is the right rule.
  const coversThroughEnd = (c: HeldCertification) =>
    validAtStart(c) && (deploymentEnd === null || c.expiryDate >= deploymentEnd);

  const covering = held.find(coversThroughEnd);
  if (covering) {
    const tail =
      deploymentEnd === null
        ? "covering the deployment (open-ended — expiry monitored)."
        : "covering the full deployment period.";
    return {
      coverage: "covered",
      reasons: [
        {
          code: "covered",
          certificationTypeCode: covering.certificationTypeCode,
          registrationNumber: covering.registrationNumber,
          expiryDate: covering.expiryDate,
          message: `${covering.certificationTypeCode} · ${covering.registrationNumber} valid to ${formatDate(
            covering.expiryDate,
          )}, ${tail}`,
        },
      ],
    };
  }

  const expiringEarly = held.find(validAtStart);
  if (expiringEarly && deploymentEnd !== null) {
    const daysUntil = daysBetween(now, expiringEarly.expiryDate);
    return {
      coverage: "expires_early",
      reasons: [
        {
          code: "expires_before_end",
          certificationTypeCode: expiringEarly.certificationTypeCode,
          registrationNumber: expiringEarly.registrationNumber,
          expiryDate: expiringEarly.expiryDate,
          message: `${expiringEarly.certificationTypeCode} ${expiringEarly.registrationNumber} expires ${formatDate(
            expiringEarly.expiryDate,
          )} — ${daysUntil} days — before this deployment ends.`,
        },
      ],
    };
  }

  // Held but not valid at start → lapsed. Report the most recently expired.
  const mostRecent = [...held].sort((a, b) => (a.expiryDate < b.expiryDate ? 1 : -1))[0]!;
  const daysLapsed = daysBetween(mostRecent.expiryDate, now);
  return {
    coverage: "missing",
    reasons: [
      {
        code: "lapsed",
        certificationTypeCode: mostRecent.certificationTypeCode,
        registrationNumber: mostRecent.registrationNumber,
        expiryDate: mostRecent.expiryDate,
        daysLapsed,
        message: `${mostRecent.certificationTypeCode} registration ${mostRecent.registrationNumber} lapsed ${daysLapsed} days ago.`,
      },
    ],
  };
}

function evaluateNode(node: RequirementNode, input: GateInput): NodeResult {
  if (node.kind === "item") return evaluateItem(node, input);

  const results = node.children.map((child) => evaluateNode(child, input));

  if (node.combinator === "all_of") {
    const missing = results.filter((r) => r.coverage === "missing");
    if (missing.length > 0) {
      return { coverage: "missing", reasons: missing.flatMap((r) => r.reasons) };
    }
    const early = results.filter((r) => r.coverage === "expires_early");
    if (early.length > 0) {
      return { coverage: "expires_early", reasons: early.flatMap((r) => r.reasons) };
    }
    return { coverage: "covered", reasons: results.flatMap((r) => r.reasons) };
  }

  // any_of: the best child decides.
  const best = results.reduce((a, b) => (rank[b.coverage] > rank[a.coverage] ? b : a));
  if (best.coverage === "missing") {
    // Nothing satisfied it — surface every option that failed.
    return { coverage: "missing", reasons: results.flatMap((r) => r.reasons) };
  }
  return { coverage: best.coverage, reasons: best.reasons };
}

/* ------------------------------------------------------------- the gate --- */

export function evaluateGate(input: GateInput): GateResult {
  // RATIFIED (KK, 2026-08-14) — pending Greensafe domain confirmation Q-P1-8:
  // ANY date overlap with an existing deployment is an unconditional block
  // (UXF §3.1), and intervals are inclusive (touching endpoints overlap). Kept
  // as a domain fact for Greensafe to confirm — concurrent postings may be real.
  const overlaps = input.overlappingDeployments.map<GateReason>((d) => ({
    code: "overlap",
    message: `Already deployed to ${d.siteName} as ${d.roleCode} (${formatDate(
      d.startDate,
    )} – ${d.endDate ? formatDate(d.endDate) : "open-ended"}), overlapping these dates.`,
  }));
  if (overlaps.length > 0) {
    return {
      outcome: "blocked",
      monitored: false,
      requirementVersionId: input.requirementVersionId,
      reasons: overlaps,
    };
  }

  const { coverage, reasons } = evaluateNode(input.requirement, input);
  const outcome: GateOutcome =
    coverage === "missing" ? "blocked" : coverage === "expires_early" ? "conditional" : "confirmed";

  return {
    outcome,
    // ASSUMPTION — UNRATIFIED — pending Q-P1-7 (ADR-0005): `monitored` is set
    // purely from the open-ended-posting assumption above. If Greensafe rejects
    // that rule, this flag and the "Confirmed-with-monitoring" path change.
    monitored: coverage === "covered" && input.deploymentEnd === null,
    requirementVersionId: input.requirementVersionId,
    reasons,
  };
}
