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
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
