import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;

/**
 * The signed-in member, read from the database on every request: a demoted admin loses admin
 * rights on their next click, and setting a new PIN or moving someone to "ไม่ได้มาแล้ว" signs
 * them out on every device.
 */
export const getViewer = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id }, include: { member: true } });
  const member = user?.member;
  if (!user || !member?.pinHash || !member.active) return null;
  if (session.pinVersion !== member.pinVersion) return null;
  return { user, member, isAdmin: user.role === "ADMIN" };
});

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) {
    // Set by src/middleware.ts; the login page only follows same-site paths.
    const path = (await headers()).get("x-pathname");
    redirect(path && path !== "/" ? `/login?next=${encodeURIComponent(path)}` : "/login");
  }
  return viewer;
}

/** Kept as the page-level guard name; every signed-in viewer now has a member profile. */
export const requireMemberPage = requireViewer;

export async function requireAdminPage() {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) redirect("/");
  return viewer;
}

export class ActionError extends Error {}

export async function requireAdminAction() {
  const viewer = await getViewer();
  if (!viewer) throw new ActionError("กรุณาเข้าสู่ระบบ");
  if (!viewer.isAdmin) throw new ActionError("เฉพาะหัวก๊วนเท่านั้น");
  return viewer;
}

export async function requireViewerAction() {
  const viewer = await getViewer();
  if (!viewer) throw new ActionError("กรุณาเข้าสู่ระบบ");
  return viewer;
}
