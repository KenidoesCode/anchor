/**
 * Runs once at server boot (not at build). Fails LOUDLY rather than warning if
 * the development encryption key would run in production. KMS is not wired; the
 * dev key must never protect real data.
 *
 * DB migrate/seed is NOT done here (the Edge instrumentation build can't take
 * node-postgres) — use the Node-runtime route /api/bootstrap instead.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // In-memory demo mode (no DATABASE_URL) holds only fictional data, so the dev
  // key is acceptable and the guard is skipped — this is what lets the Vercel
  // deploy run with zero configuration. The guard only bites a real database.
  if (!process.env.DATABASE_URL) return;

  const DEV_KEY = "dev-insecure-key-do-not-ship";
  const isProd = process.env.NODE_ENV === "production";
  const key = process.env.GS_DATA_KEY;

  if (isProd && (!key || key === DEV_KEY)) {
    throw new Error(
      "Refusing to start: GS_DATA_KEY is unset or is the development key. " +
        "Production requires a real key (KMS). This build is DEMO-only.",
    );
  }
  if (isProd && !process.env.GS_SESSION_SECRET) {
    throw new Error("Refusing to start: GS_SESSION_SECRET is required in production.");
  }
}
