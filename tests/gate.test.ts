import { describe, expect, it } from "vitest";
import {
  daysBetween,
  evaluateGate,
  type GateInput,
  type HeldCertification,
  type RequirementNode,
} from "@/domain/gate";

/** A single-item requirement: the role needs one certification of the given type. */
function requires(code: string): RequirementNode {
  return {
    kind: "item",
    certificationTypeId: `type-${code}`,
    certificationTypeCode: code,
    certificationTypeName: code,
  };
}

function cert(code: string, expiryDate: string, issueDate = "2020-01-01"): HeldCertification {
  return {
    certificationTypeId: `type-${code}`,
    certificationTypeCode: code,
    registrationNumber: `${code}/24/00001`,
    issueDate,
    expiryDate,
  };
}

const base: GateInput = {
  now: "2026-08-11",
  deploymentStart: "2026-09-01",
  deploymentEnd: "2026-12-31",
  requirement: requires("WSHO"),
  requirementVersionId: "rv-1",
  heldCertifications: [],
  overlappingDeployments: [],
};

describe("evaluateGate — single-type requirement", () => {
  it("BLOCKS when the required certification is not held at all", () => {
    const r = evaluateGate({ ...base, heldCertifications: [cert("FSM", "2028-01-01")] });
    expect(r.outcome).toBe("blocked");
    expect(r.reasons[0]?.code).toBe("missing");
    expect(r.reasons[0]?.message).toContain("No WSHO certification");
  });

  it("BLOCKS when the required certification is lapsed, and states days lapsed", () => {
    const r = evaluateGate({ ...base, heldCertifications: [cert("WSHO", "2026-07-31")] });
    expect(r.outcome).toBe("blocked");
    expect(r.reasons[0]?.code).toBe("lapsed");
    // 2026-07-31 → 2026-08-11 is 11 days (mirrors UXS §5.3 copy).
    expect(r.reasons[0]?.daysLapsed).toBe(11);
    expect(r.reasons[0]?.message).toContain("lapsed 11 days ago");
  });

  it("is CONDITIONAL when valid at start but expiring before the deployment ends", () => {
    const r = evaluateGate({ ...base, heldCertifications: [cert("WSHO", "2026-10-15")] });
    expect(r.outcome).toBe("conditional");
    expect(r.reasons[0]?.code).toBe("expires_before_end");
    expect(r.monitored).toBe(false);
  });

  it("CONFIRMS when valid throughout the deployment", () => {
    const r = evaluateGate({ ...base, heldCertifications: [cert("WSHO", "2028-02-28")] });
    expect(r.outcome).toBe("confirmed");
    expect(r.reasons[0]?.code).toBe("covered");
    expect(r.monitored).toBe(false);
  });

  it("treats expiry exactly on the deployment end date as covered (>= boundary)", () => {
    const r = evaluateGate({ ...base, heldCertifications: [cert("WSHO", "2026-12-31")] });
    expect(r.outcome).toBe("confirmed");
  });

  it("CONFIRMS-with-monitoring for an open-ended deployment with a currently-valid cert (ADR-0005)", () => {
    const r = evaluateGate({
      ...base,
      deploymentEnd: null,
      heldCertifications: [cert("WSHO", "2027-01-01")],
    });
    expect(r.outcome).toBe("confirmed");
    expect(r.monitored).toBe(true);
  });

  it("BLOCKS an open-ended deployment when the only cert is already lapsed", () => {
    const r = evaluateGate({
      ...base,
      deploymentEnd: null,
      heldCertifications: [cert("WSHO", "2026-01-01")],
    });
    expect(r.outcome).toBe("blocked");
    expect(r.reasons[0]?.code).toBe("lapsed");
  });
});

describe("evaluateGate — AND / OR composition (ADR-0003)", () => {
  const all: RequirementNode = {
    kind: "group",
    combinator: "all_of",
    children: [requires("WSHO"), requires("FIRSTAID")],
  };
  const any: RequirementNode = {
    kind: "group",
    combinator: "any_of",
    children: [requires("FIRSTAID"), requires("ADVFIRSTAID")],
  };

  it("all_of BLOCKS when one required member is missing", () => {
    const r = evaluateGate({
      ...base,
      requirement: all,
      heldCertifications: [cert("WSHO", "2028-01-01")],
    });
    expect(r.outcome).toBe("blocked");
    expect(r.reasons.some((x) => x.certificationTypeCode === "FIRSTAID")).toBe(true);
  });

  it("all_of CONFIRMS when every member is covered", () => {
    const r = evaluateGate({
      ...base,
      requirement: all,
      heldCertifications: [cert("WSHO", "2028-01-01"), cert("FIRSTAID", "2028-01-01")],
    });
    expect(r.outcome).toBe("confirmed");
  });

  it("any_of CONFIRMS when at least one option is covered", () => {
    const r = evaluateGate({
      ...base,
      requirement: any,
      heldCertifications: [cert("ADVFIRSTAID", "2028-01-01")],
    });
    expect(r.outcome).toBe("confirmed");
  });

  it("any_of BLOCKS when no option is held", () => {
    const r = evaluateGate({
      ...base,
      requirement: any,
      heldCertifications: [cert("WSHO", "2028-01-01")],
    });
    expect(r.outcome).toBe("blocked");
  });

  it("any_of prefers a covered option over an expiring one (Confirmed, not Conditional)", () => {
    const r = evaluateGate({
      ...base,
      requirement: any,
      heldCertifications: [cert("FIRSTAID", "2026-10-01"), cert("ADVFIRSTAID", "2028-01-01")],
    });
    expect(r.outcome).toBe("confirmed");
  });
});

describe("evaluateGate — overlap", () => {
  it("BLOCKS on an overlapping deployment regardless of certification validity", () => {
    const r = evaluateGate({
      ...base,
      heldCertifications: [cert("WSHO", "2028-02-28")],
      overlappingDeployments: [
        { siteName: "Changi T5", roleCode: "WSHO", startDate: "2026-08-01", endDate: "2026-11-30" },
      ],
    });
    expect(r.outcome).toBe("blocked");
    expect(r.reasons[0]?.code).toBe("overlap");
  });
});

describe("daysBetween", () => {
  it("counts whole days and sign", () => {
    expect(daysBetween("2026-07-31", "2026-08-11")).toBe(11);
    expect(daysBetween("2026-08-11", "2026-07-31")).toBe(-11);
    expect(daysBetween("2026-08-11", "2026-08-11")).toBe(0);
  });
});
