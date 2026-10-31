import { ZodError } from "zod";
import { ActionError } from "@/lib/viewer";

export type ActionResult = { ok: true; message?: string; redirect?: string } | { ok: false; error: string };

/** Runs a server action body and converts known failures into a message the UI can show. */
export async function run(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, error: e.message };
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    console.error(e);
    return { ok: false, error: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" };
  }
}
