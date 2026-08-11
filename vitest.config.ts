import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Integration tests spin up an in-process Postgres (pglite); give them room.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
