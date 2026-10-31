import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dateFromISO, monthRange, todayISO } from "@/lib/format";
import { emptyRecord, playerRecords, type PlayerRecord } from "@/domain/results";

export type MemberStats = PlayerRecord & { sessions: number; outstanding: number; lastSession: Date | null };

const emptyStats = (): MemberStats => ({ ...emptyRecord(), sessions: 0, outstanding: 0, lastSession: null });

/** Finished games (with teams and results), optionally limited to some members and/or a date range. */
export async function loadResults(opts: { memberIds?: string[]; from?: Date; to?: Date } = {}) {
  const matches = await prisma.match.findMany({
    where: {
      status: "DONE",
      ...(opts.memberIds ? { players: { some: { memberId: { in: opts.memberIds } } } } : {}),
      ...(opts.from || opts.to ? { session: { date: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lt: opts.to } : {}) } } } : {}),
    },
    select: { winner: true, scoreA: true, scoreB: true, sessionId: true, players: { select: { memberId: true, team: true } } },
  });
  return matches.map((m) => ({
    sessionId: m.sessionId,
    winner: m.winner,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    teamA: m.players.filter((p) => p.team === "A").map((p) => p.memberId),
    teamB: m.players.filter((p) => p.team === "B").map((p) => p.memberId),
  }));
}

/** Lifetime stats for members: game record via domain/results, plus sessions attended and money owed. */
export async function memberStats(memberIds?: string[]) {
  const ids = memberIds ? (memberIds.length ? memberIds : [""]) : undefined;
  const [results, sessions, owed] = await Promise.all([
    loadResults({ memberIds: ids }),
    prisma.$queryRaw<{ memberId: string; sessions: bigint; last: Date }[]>`
      SELECT p."memberId", COUNT(*) AS sessions, MAX(s.date) AS last
      FROM "Participant" p JOIN "Session" s ON s.id = p."sessionId"
      WHERE s.status <> 'OPEN' ${ids ? Prisma.sql`AND p."memberId" IN (${Prisma.join(ids)})` : Prisma.empty}
      GROUP BY p."memberId"`,
    prisma.charge.groupBy({
      by: ["memberId"],
      where: { status: { in: ["UNPAID", "REPORTED"] }, ...(ids ? { memberId: { in: ids } } : {}) },
      _sum: { total: true },
    }),
  ]);
  const records = playerRecords(results);
  const map = new Map<string, MemberStats>();
  const get = (id: string) => map.get(id) ?? (map.set(id, { ...emptyStats(), ...(records.get(id) ?? {}) }), map.get(id)!);
  for (const id of records.keys()) get(id);
  for (const s of sessions) Object.assign(get(s.memberId), { sessions: Number(s.sessions), lastSession: s.last });
  for (const o of owed) get(o.memberId).outstanding = o._sum.total ?? 0;
  return { get: (id: string) => map.get(id) ?? emptyStats() };
}

export async function upcomingSessions(memberId?: string) {
  const today = dateFromISO(todayISO());
  return prisma.session.findMany({
    where: { status: { not: "CLOSED" }, OR: [{ date: { gte: today } }, { status: "LIVE" }] },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 6,
    include: { courts: true, _count: { select: { participants: true } }, participants: memberId ? { where: { memberId }, select: { id: true } } : false },
  });
}

export async function outstandingCharges(memberId?: string) {
  return prisma.charge.findMany({
    where: { status: { in: ["UNPAID", "REPORTED"] }, ...(memberId ? { memberId } : {}) },
    include: { member: true, session: true },
    orderBy: [{ status: "desc" }, { session: { date: "asc" } }],
  });
}

/** Everything for the finance page for one calendar month (YYYY-MM). */
export async function financeMonth(ym: string) {
  const { from, to } = monthRange(ym);
  const [paid, sessions, expenses] = await Promise.all([
    prisma.charge.aggregate({ where: { status: "PAID", paidAt: { gte: from, lt: to } }, _sum: { total: true }, _count: true }),
    prisma.session.findMany({
      where: { date: { gte: from, lt: to }, status: "CLOSED" },
      orderBy: { date: "asc" },
      include: { charges: true, expenses: true, _count: { select: { participants: true } } },
    }),
    prisma.expense.findMany({ where: { spentAt: { gte: from, lt: to } }, include: { session: { select: { venue: true } } }, orderBy: { spentAt: "desc" } }),
  ]);

  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = { COURT: 0, SHUTTLE: 0, OTHER: 0 };
  for (const e of expenses) byCategory[e.category] += e.amount;

  const sessionRows = sessions.map((s) => {
    const billed = s.charges.filter((c) => c.status !== "WAIVED").reduce((a, c) => a + c.total, 0);
    const received = s.charges.filter((c) => c.status === "PAID").reduce((a, c) => a + c.total, 0);
    const cost = s.expenses.reduce((a, e) => a + e.amount, 0);
    return { id: s.id, venue: s.venue, date: s.date, players: s._count.participants, billed, received, cost };
  });

  return {
    received: paid._sum.total ?? 0,
    paidCount: paid._count,
    expenseTotal,
    byCategory,
    expenses,
    sessionRows,
    billed: sessionRows.reduce((a, r) => a + r.billed, 0),
  };
}
