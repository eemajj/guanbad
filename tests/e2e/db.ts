/**
 * Each E2E run gets its own new, empty database (never wipes an existing one).
 * E2E_DATABASE_URL names a base database; the run uses "<base>_<run id>" on the same server.
 * The base name must contain "test" or "e2e" so a production URL can never be used by mistake.
 */
export function e2eDatabaseUrl() {
  const base = process.env.E2E_DATABASE_URL;
  if (!base) throw new Error("Set E2E_DATABASE_URL, e.g. postgresql://user:pass@localhost:5432/guan_e2e");
  const url = new URL(base);
  const baseName = url.pathname.slice(1);
  if (!/test|e2e/i.test(baseName)) throw new Error(`E2E database name "${baseName}" must contain "test" or "e2e"`);
  process.env.E2E_RUN_ID ??= Date.now().toString(36);
  url.pathname = `/${baseName}_${process.env.E2E_RUN_ID}`;
  return { base, url: url.toString(), name: url.pathname.slice(1) };
}
