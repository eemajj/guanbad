import "server-only";
import { dateFromISO, todayISO } from "@/lib/format";
import { prisma } from "@/server/db";

export async function upcomingSessions(memberId?: string) {
  const today = dateFromISO(todayISO());
  return prisma.session.findMany({
    where: { status: { not: "CLOSED" }, OR: [{ date: { gte: today } }, { status: "LIVE" }] },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 6,
    include: {
      courts: true,
      _count: { select: { participants: true } },
      participants: memberId ? { where: { memberId }, select: { id: true } } : false,
    },
  });
}

/** Sessions list: upcoming (not closed, today or later, or live) or past (closed, or open but in the past). */
export function listSessions(past: boolean, memberId?: string) {
  const today = dateFromISO(todayISO());
  return prisma.session.findMany({
    where: past
      ? { OR: [{ status: "CLOSED" }, { date: { lt: today }, status: "OPEN" }] }
      : { status: { not: "CLOSED" }, OR: [{ date: { gte: today } }, { status: "LIVE" }] },
    orderBy: [{ date: past ? "desc" : "asc" }, { startTime: "asc" }],
    take: past ? 60 : undefined,
    include: {
      courts: true,
      _count: { select: { participants: true } },
      participants: memberId ? { where: { memberId }, select: { id: true } } : false,
    },
  });
}

export const getSessionVenue = (id: string) => prisma.session.findUnique({ where: { id }, select: { venue: true } });

export const getSessionWithCourts = (id: string) =>
  prisma.session.findUnique({ where: { id }, include: { courts: { orderBy: { position: "asc" } } } });
