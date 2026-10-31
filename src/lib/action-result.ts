/** What every server action returns. Shared by server actions and the client components that call them. */
export type ActionResult = { ok: true; message?: string; redirect?: string } | { ok: false; error: string };
