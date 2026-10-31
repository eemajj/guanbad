import "server-only";
import { monthRange } from "@/lib/format";
import { prisma } from "@/server/db";

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
    prisma.expense.findMany({
      where: { spentAt: { gte: from, lt: to } },
      include: { session: { select: { venue: true } } },
      orderBy: { spentAt: "desc" },
    }),
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

/** Organiser dashboard numbers for one month (YYYY-MM). */
export async function monthOverview(ym: string) {
  const { from, to } = monthRange(ym);
  const played = { date: { gte: from, lt: to }, status: { not: "OPEN" as const } };
  const [sessions, players, collected, owed] = await Promise.all([
    prisma.session.count({ where: played }),
    prisma.participant.findMany({ where: { session: played }, distinct: ["memberId"], select: { memberId: true } }),
    prisma.charge.aggregate({ where: { status: "PAID", paidAt: { gte: from, lt: to } }, _sum: { total: true } }),
    prisma.charge.aggregate({ where: { status: { in: ["UNPAID", "REPORTED"] } }, _sum: { total: true }, _count: true }),
  ]);
  return { sessions, players: players.length, collected: collected._sum.total ?? 0, owed: owed._sum.total ?? 0, owedCount: owed._count };
}
