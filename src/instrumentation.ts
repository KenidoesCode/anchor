/**
 * Runs once at server boot (not at build). Fails LOUDLY rather than warning if
 * the development encryption key would run in production (per the final-pass
 * brief). KMS is not wired; the dev key must never protect real data.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

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
