import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./tests/e2e/db";

/**
 * End-to-end tests run against a real production build and a throw-away database.
 * Each run creates its own new database next to E2E_DATABASE_URL (see tests/e2e/db.ts); nothing is wiped.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const db = process.env.E2E_DATABASE_URL ? e2eDatabaseUrl().url : "";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    port: PORT,
    // Always start a fresh server so it points at this run's database.
    reuseExistingServer: false,
    env: {
      DATABASE_URL: db,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret-not-for-production",
      AUTH_URL: `http://localhost:${PORT}`,
      ALLOW_DEV_LOGIN: "true",
    },
  },
});
