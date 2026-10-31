import { defineConfig } from "vitest/config";
import path from "node:path";

/** Server actions against a real PostgreSQL database (a new database per run, see tests/integration/global-setup.ts). */
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      // Server actions and the helpers they run through. Page-only helpers (redirects) are covered by E2E.
      include: [
        "src/features/*/actions.ts",
        "src/features/*/signup-actions.ts",
        "src/features/sessions/engine.ts",
        "src/server/{action,activity,lock,log}.ts",
      ],
      reporter: ["text-summary", "text"],
      thresholds: { lines: 80, statements: 80 },
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
