import { AssignScreen } from "./assign-screen";

export const dynamic = "force-dynamic";

export default function AssignPage() {
  return (
    <main className="content">
      <div className="breadcrumb">People › Assign</div>
      <h1>Assign an officer</h1>
      <p className="subtitle">
        The assignment is validated live against the certification ledger. A blocked
        assignment cannot be saved.
      </p>
      <AssignScreen />
    </main>
  );
}
