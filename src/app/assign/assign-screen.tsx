"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/react";
import { OfficerSelector } from "./officer-selector";
import { ValidationPanel } from "./validation-panel";

const fieldLabel = "mb-1.5 block text-[13px] font-semibold";
const control =
  "h-10 w-full rounded-sm border border-rule bg-surface px-2.5 text-ink";

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
  const me = trpc.session.me.useQuery(undefined, { retry: false });
  const override = trpc.override.approve.useMutation();
  const [justification, setJustification] = useState("");

  const selectedName = officers.data?.find((o) => o.personId === personId)?.fullName;
  const outcome = validation.data?.outcome;
  const canSave =
    input !== null && (outcome === "confirmed" || outcome === "conditional") && !create.isPending;

  function pickRole(id: string) {
    setRoleId(id);
    setPersonId(undefined);
    create.reset();
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
      {/* ---- left: the form ---- */}
      <div className="rounded-sm border border-rule bg-surface p-5">
        <div className="mb-4">
          <label htmlFor="role" className={fieldLabel}>
            Role required
          </label>
          <select id="role" className={control} value={roleId} onChange={(e) => pickRole(e.target.value)}>
            <option value="">Select a role…</option>
            {roles.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="site" className={fieldLabel}>
            Client and site
          </label>
          <select
            id="site"
            className={control}
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

        <div className="mb-4 flex gap-3">
          <div className="flex-1">
            <label htmlFor="start" className={fieldLabel}>
              Start date
            </label>
            <input
              id="start"
              type="date"
              className={cn(control, "font-mono")}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="end" className={fieldLabel}>
              End date
            </label>
            <input
              id="end"
              type="date"
              className={cn(control, "font-mono")}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-muted">Leave blank for an open-ended posting.</p>
          </div>
        </div>

        <div className="mb-4">
          <span className={fieldLabel}>Officer</span>
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
            <p className="text-xs text-ink-muted">
              Choose a role and start date to see eligible officers.
            </p>
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

        <div className="mt-4 flex items-center gap-3">
          <Button disabled={!canSave} onClick={() => input && create.mutate(input)}>
            {create.isSuccess ? "Saved" : "Save assignment"}
          </Button>
          {outcome === "blocked" && (
            <span className="text-[13px] font-semibold text-state-critical">Blocked — see panel</span>
          )}
          {create.isSuccess && (
            <span className="text-[13px] font-semibold text-state-ok">
              Assignment saved
              {create.data?.result.outcome === "conditional" ? " — renewal task created" : ""}.
            </span>
          )}
        </div>

        {/* Override path (F1 §3.2): Director-only, typed justification. */}
        {outcome === "blocked" && input && !override.isSuccess && (
          <div className="mt-4 rounded-sm border border-l-4 border-rule border-l-state-critical bg-surface p-4">
            {me.data?.role === "director" ? (
              <>
                <p className="mb-2 text-[13px] font-semibold">Request Director override</p>
                <textarea
                  className="mb-2 w-full rounded-sm border border-rule bg-surface p-2 text-sm"
                  rows={2}
                  placeholder="Type a justification (recorded permanently on the activity log)…"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                />
                <Button
                  disabled={justification.trim().length < 10 || override.isPending}
                  onClick={() => override.mutate({ assignment: input, justification })}
                >
                  Approve override
                </Button>
                {override.isError && (
                  <span className="ml-2 text-[13px] font-semibold text-state-critical">{override.error.message}</span>
                )}
              </>
            ) : (
              <p className="text-[13px] text-ink-muted">
                Blocked. A Director override is required — sign in as a Director to record a justification.
              </p>
            )}
          </div>
        )}
        {override.isSuccess && (
          <p className="mt-4 text-[13px] font-semibold text-state-critical">
            Override recorded. Deployment saved and flagged on the Director Overview until resolved.
          </p>
        )}
      </div>
    </div>
  );
}
