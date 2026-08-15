import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Bundle the SQL migration files so the bootstrap route (Node runtime) can
  // read them at runtime on the server.
  outputFileTracingIncludes: {
    "/api/bootstrap": ["./drizzle/**/*"],
  },
};

export default nextConfig;
