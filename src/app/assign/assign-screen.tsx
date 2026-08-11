"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/trpc/react";
import { OfficerSelector } from "./officer-selector";
import { ValidationPanel } from "./validation-panel";

/**
 * The signature screen (F1 / UXS §5.3). Two panes: the form on the left, the
 * live validation panel on the right, updating on every field change. The
 * server is the control — Save is presentation.
 */
export function AssignScreen() {
  const roles = trpc.catalogue.roles.useQuery();
  const sites = trpc.catalogue.sites.useQuery();

  const [roleId, setRoleId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [startDate, setStartDate] = useState("2026-09-01");
  const [endDate, setEndDate] = useState("2026-12-31");
  const [personId, setPersonId] = useState<string>();

  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  const end = endDate === "" ? null : endDate;
  const site = sites.data?.find((s) => s.id === siteId);

  const officers = trpc.officers.forAssignment.useQuery(
    { roleId, startDate, endDate: end },
    { enabled: Boolean(roleId) && validStart },
  );

  // Full assignment input for the live panel + the control.
  const input = useMemo(() => {
    if (!roleId || !site || !validStart || !personId) return null;
    return {
      personId,
      roleId,
      organisationId: site.organisationId,
      siteId: site.id,
      startDate,
      endDate: end,
    };
  }, [roleId, site, validStart, personId, startDate, end]);

  const validation = trpc.assignment.validate.useQuery(input!, { enabled: input !== null });
  const create = trpc.assignment.create.useMutation();

  const selectedName = officers.data?.find((o) => o.personId === personId)?.fullName;
  const outcome = validation.data?.outcome;
  const canSave =
    input !== null && (outcome === "confirmed" || outcome === "conditional") && !create.isPending;

  // Reset any prior selection when the role/period changes the candidate set.
  function pickRole(id: string) {
    setRoleId(id);
    setPersonId(undefined);
    create.reset();
  }

  return (
    <div className="assign-grid">
      {/* ---- left: the form ---- */}
      <div className="card">
        <div className="field">
          <label htmlFor="role">Role required</label>
          <select id="role" value={roleId} onChange={(e) => pickRole(e.target.value)}>
            <option value="">Select a role…</option>
            {roles.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="site">Client and site</label>
          <select
            id="site"
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              create.reset();
            }}
          >
            <option value="">Select a site…</option>
            {sites.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.organisationName} — {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="start">Start date</label>
            <input
              id="start"
              className="num"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="end">End date</label>
            <input
              id="end"
              className="num"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <div className="hint">Leave blank for an open-ended posting.</div>
          </div>
        </div>

        <div className="field">
          <label>Officer</label>
          {roleId && validStart ? (
            <OfficerSelector
              officers={officers.data ?? []}
              selectedId={personId}
              onSelect={(id) => {
                setPersonId(id);
                create.reset();
              }}
            />
          ) : (
            <p className="hint">Choose a role and start date to see eligible officers.</p>
          )}
        </div>
      </div>

      {/* ---- right: the live determination ---- */}
      <div>
        <ValidationPanel
          result={validation.data}
          loading={validation.isFetching}
          officerName={selectedName}
        />

        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={!canSave}
            onClick={() => input && create.mutate(input)}
          >
            {create.isSuccess ? "Saved" : "Save assignment"}
          </button>
          {outcome === "blocked" && <span className="btn-note">Blocked — see panel</span>}
          {create.isSuccess && (
            <span style={{ color: "var(--state-ok)", fontWeight: 600 }}>
              Assignment saved{create.data?.result.outcome === "conditional" ? " — renewal task created" : ""}.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
