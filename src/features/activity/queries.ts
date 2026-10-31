import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

/** History filters, by the prefix of the activity type. */
export const ACTIVITY_GROUPS = {
  all: { label: "ทั้งหมด", prefixes: [] as string[] },
  money: { label: "เงิน", prefixes: ["charge.", "expense.", "session.close", "session.reopen", "settings."] },
  games: { label: "ผลการแข่ง", prefixes: ["match."] },
  sessions: { label: "รอบตี", prefixes: ["session.", "participant."] },
  members: { label: "สมาชิก", prefixes: ["member.", "user."] },
} as const;
export type ActivityGroup = keyof typeof ACTIVITY_GROUPS;
export const isActivityGroup = (g: unknown): g is ActivityGroup => typeof g === "string" && g in ACTIVITY_GROUPS;

export async function listActivity(opts: { sessionId?: string; group?: ActivityGroup; take?: number } = {}) {
  const prefixes = ACTIVITY_GROUPS[opts.group ?? "all"].prefixes;
  const where: Prisma.ActivityWhereInput = {
    ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
    ...(prefixes.length ? { OR: prefixes.map((p) => ({ type: { startsWith: p } })) } : {}),
  };
  return prisma.activity.findMany({
    where,
    orderBy: { at: "desc" },
    take: opts.take ?? 100,
    include: {
      actor: { select: { name: true, member: { select: { nickname: true } } } },
      session: { select: { id: true, venue: true, date: true } },
    },
  });
}

export type ActivityRow = Awaited<ReturnType<typeof listActivity>>[number];
