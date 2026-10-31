import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { levelRank } from "@/domain/levels";
import { History, orderQueue, pickMatch, type Pairing, type QueueEntry } from "@/domain/matchmaking";
import { computeFees, hoursBetween } from "@/domain/fees";
import { emptyRecord, playerRecords, recordCoverage, type PlayerRecord, type ResultMatch } from "@/domain/results";

export const sessionInclude = {
  courts: { orderBy: { position: "asc" } },
  participants: { include: { member: true }, orderBy: { joinedAt: "asc" } },
  matches: { include: { players: true }, orderBy: { startedAt: "asc" } },
  charges: true,
} satisfies Prisma.SessionInclude;

export type SessionDetail = Prisma.SessionGetPayload<{ include: typeof sessionInclude }>;
export type MatchWithPlayers = SessionDetail["matches"][number];

export async function loadSession(id: string, tx: Prisma.TransactionClient = prisma) {
  return tx.session.findUnique({ where: { id }, include: sessionInclude });
}

export const teamOf = (m: MatchWithPlayers, team: "A" | "B") => m.players.filter((p) => p.team === team).map((p) => p.memberId);

export type PlayerStat = PlayerRecord & { shuttles: number; playing: MatchWithPlayers | null };

export const toResultMatch = (m: MatchWithPlayers): ResultMatch => ({
  teamA: teamOf(m, "A"),
  teamB: teamOf(m, "B"),
  winner: m.winner,
  scoreA: m.scoreA,
  scoreB: m.scoreB,
});

/** Everything the session screens need, derived from one loaded session. */
export function deriveState(s: SessionDetail) {
  const done = s.matches.filter((m) => m.status === "DONE");
  const records = playerRecords(done.map(toResultMatch));
  const stats = new Map<string, PlayerStat>();
  for (const p of s.participants) stats.set(p.memberId, { ...(records.get(p.memberId) ?? emptyRecord()), shuttles: 0, playing: null });

  const counted = s.matches.filter((m) => m.status !== "CANCELLED");
  const history = new History(counted.map((m) => ({ teamA: teamOf(m, "A"), teamB: teamOf(m, "B") })));

  for (const m of counted) {
    for (const mp of m.players) {
      const st = stats.get(mp.memberId);
      if (!st) continue;
      if (m.status === "PLAYING") st.playing = m;
      if (m.status === "DONE") st.shuttles += m.shuttles / 4;
    }
  }

  const queueEntries: (QueueEntry & { participantId: string })[] = s.participants
    .filter((p) => p.status === "ACTIVE" && !stats.get(p.memberId)?.playing)
    .map((p) => ({
      id: p.memberId,
      participantId: p.id,
      rank: levelRank(p.member.level),
      queuedAt: p.queuedAt.getTime(),
      games: stats.get(p.memberId)?.games ?? 0,
    }));
  const queue = orderQueue(queueEntries);

  const playingByCourt = new Map<string, MatchWithPlayers>();
  for (const m of s.matches) if (m.status === "PLAYING") playingByCourt.set(m.courtId, m);
  const freeCourts = s.courts.filter((c) => !playingByCourt.has(c.id));

  const next: Pairing | null = s.status === "CLOSED" ? null : pickMatch(queue, history);

  const fees = computeFees({
    courtCount: s.courts.length,
    hours: hoursBetween(s.startTime, s.endTime),
    courtRate: s.courtRate,
    shuttlePrice: s.shuttlePrice,
    feeMode: s.feeMode,
    flatFee: s.flatFee,
    memberIds: s.participants.map((p) => p.memberId),
    matches: s.matches
      .filter((m) => m.status === "DONE")
      .map((m) => ({ playerIds: m.players.map((p) => p.memberId), shuttles: m.shuttles })),
  });

  const memberName = new Map(s.participants.map((p) => [p.memberId, p.member.nickname]));

  const results = recordCoverage(done);

  return {
    stats,
    results,
    history,
    queue,
    playingByCourt,
    freeCourts,
    next,
    fees,
    memberName,
    hours: hoursBetween(s.startTime, s.endTime),
  };
}

export type SessionState = ReturnType<typeof deriveState>;
