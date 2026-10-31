import { randomBytes } from "node:crypto";

/**
 * Structured error log: one JSON line per error, easy to search in Vercel / any log viewer.
 * Returns a short reference shown to the user, so "it said error ab12cd" can be found in the logs.
 */
export function logError(scope: string, error: unknown, context: Record<string, unknown> = {}) {
  const ref = randomBytes(3).toString("hex");
  const err = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) };
  console.error(JSON.stringify({ level: "error", at: new Date().toISOString(), ref, scope, ...context, error: err }));
  return ref;
}
