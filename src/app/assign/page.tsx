import { AssignScreen } from "./assign-screen";

export const dynamic = "force-dynamic";

export default function AssignPage() {
  return (
    <main className="mx-auto max-w-[1440px] p-6">
      <div className="mb-4 text-[13px] text-ink-muted">People › Assign</div>
      <h1 className="mb-1 font-display text-2xl text-gs-navy">Assign an officer</h1>
      <p className="mb-5 text-ink-muted">
        The assignment is validated live against the certification ledger. A blocked
        assignment cannot be saved.
      </p>
      <AssignScreen />
    </main>
  );
}
