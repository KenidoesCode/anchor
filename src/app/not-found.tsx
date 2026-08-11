import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-6 pt-20 text-center">
      <h1 className="mb-2 font-display text-2xl text-gs-navy">Page not found</h1>
      <p className="mb-6 text-ink-muted">
        That page does not exist, or you do not have access to it.
      </p>
      <Link href="/people" className="font-semibold text-state-info hover:underline">
        Back to the register
      </Link>
    </main>
  );
}
