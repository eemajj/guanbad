import { getSessionVersion } from "@/features/sessions/queries";

export const dynamic = "force-dynamic";

/**
 * Tiny endpoint polled by open session screens: `{"v":42}`.
 * The page reloads its data only when this number changes. It reveals nothing but a counter.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await getSessionVersion((await params).id);
  return Response.json(v === null ? { error: "not_found" } : { v }, {
    status: v === null ? 404 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
