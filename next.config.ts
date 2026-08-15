import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the in-memory Postgres engine (and its WASM) out of the bundle — it is
  // required from node_modules at runtime instead, which keeps its assets intact.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Bundle the SQL migration files so the server can migrate at runtime
  // (in-memory boot seed, and the /api/bootstrap route).
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*"],
  },
};

export default nextConfig;
