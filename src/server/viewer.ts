import { paths } from "@/lib/paths";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;

/** The signed-in user with their member profile. Role is read from the database on every request. */
export const getViewer = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id }, include: { member: true } });
  if (!user) return null;
  return { user, member: user.member, isAdmin: user.role === "ADMIN" };
});

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect(paths.login());
  return viewer;
}

/** For pages: members without a profile are sent to onboarding first. */
export async function requireMemberPage() {
  const viewer = await requireViewer();
  if (!viewer.member && !viewer.isAdmin) redirect(paths.welcome);
  return viewer;
}

export async function requireAdminPage() {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) redirect(paths.home);
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
