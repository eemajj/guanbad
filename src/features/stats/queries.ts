import "server-only";
import { dateFromISO, monthRange, todayISO } from "@/lib/format";
import { pairRecords, playerRecords, rankPlayers, recordCoverage } from "@/domain/results";
import { prisma } from "@/server/db";

/** Finished games (with teams and results), optionally limited to some members and/or a date range. */
export async function loadResults(opts: { memberIds?: string[]; from?: Date; to?: Date } = {}) {
  const matches = await prisma.match.findMany({
    where: {
      status: "DONE",
      ...(opts.memberIds ? { players: { some: { memberId: { in: opts.memberIds } } } } : {}),
      ...(opts.from || opts.to
        ? { session: { date: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lt: opts.to } : {}) } } }
        : {}),
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

/** Leaderboard periods and the minimum number of decided games needed to be ranked. */
export const PERIODS = {
  month: { label: "เดือนนี้", min: 4 },
  quarter: { label: "3 เดือน", min: 8 },
  all: { label: "ทั้งหมด", min: 10 },
} as const;
export type Period = keyof typeof PERIODS;
export const isPeriod = (p: unknown): p is Period => typeof p === "string" && p in PERIODS;

function periodStart(period: Period) {
  if (period === "all") return undefined;
  if (period === "month") return monthRange(todayISO().slice(0, 7)).from;
  const d = dateFromISO(todayISO());
  d.setUTCMonth(d.getUTCMonth() - 3);
  return d;
}

/** Everything the stats page shows for one period. `withMissing` adds sessions that still lack results (organiser view). */
export async function getLeaderboard(period: Period, withMissing: boolean) {
  const results = await loadResults({ from: periodStart(period) });
  const records = playerRecords(results);
  const ids = [...records.keys()];
  const members = new Map(
    (await prisma.member.findMany({ where: { id: { in: ids } }, select: { id: true, nickname: true, level: true } })).map((m) => [m.id, m]),
  );
  const rows = ids.map((memberId) => ({ memberId, record: records.get(memberId)! }));
  const { ranked, unranked } = rankPlayers(rows, PERIODS[period].min);

  const pairs = [...pairRecords(results).values()]
    .filter((x) => x.wins + x.losses >= 3)
    .sort((a, b) => b.wins / (b.wins + b.losses) - a.wins / (a.wins + a.losses) || b.wins - a.wins)
    .slice(0, 5);
  const mostGames = [...rows].sort((a, b) => b.record.games - a.record.games)[0] ?? null;

  const missingBySession = new Map<string, number>();
  for (const r of results) if (!r.winner) missingBySession.set(r.sessionId, (missingBySession.get(r.sessionId) ?? 0) + 1);
  const missingSessions =
    withMissing && missingBySession.size
      ? (
          await prisma.session.findMany({
            where: { id: { in: [...missingBySession.keys()] } },
            select: { id: true, venue: true, date: true },
            orderBy: { date: "desc" },
          })
        ).map((s) => ({ ...s, missing: missingBySession.get(s.id)! }))
      : [];

  return { coverage: recordCoverage(results), players: ids.length, members, ranked, unranked, pairs, mostGames, missingSessions };
}
