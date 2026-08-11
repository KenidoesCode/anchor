import { defineConfig } from "drizzle-kit";

// Migrations are reviewable as SQL (PRD §12.2). Generated into ./drizzle.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/greensafe",
  },
  strict: true,
  verbose: true,
});
