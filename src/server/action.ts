import { ZodError } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { ActionError, requireAdminAction, requireViewerAction, type Viewer } from "@/server/viewer";

/**
 * Every server action body runs through one of these. They:
 *  1. check who is calling (asAdmin: organisers only, asUser: anyone signed in),
 *  2. turn expected failures (ActionError, invalid input) into a message for the UI,
 *  3. log anything unexpected and show a generic message instead of leaking details.
 *
 *   export async function doThing(id: string) {
 *     return asAdmin(async (viewer) => { ... return { ok: true, message: "..." }; });
 *   }
 */
export function asAdmin(fn: (viewer: Viewer) => Promise<ActionResult | void>) {
  return run(async () => fn(await requireAdminAction()));
}

export function asUser(fn: (viewer: Viewer) => Promise<ActionResult | void>) {
  return run(async () => fn(await requireViewerAction()));
}

async function run(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, error: e.message };
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    console.error("[action] unexpected error", e);
    return { ok: false, error: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" };
  }
}

/** Parse a FormData with a zod schema (empty strings stay as-is; schemas decide what "empty" means). */
export const formObject = (form: FormData) => Object.fromEntries(form);
