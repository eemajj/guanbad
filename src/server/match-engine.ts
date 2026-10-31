import type { Prisma } from "@prisma/client";
import { planMatches } from "@/domain/matchmaking";
import { deriveState, loadSession } from "@/server/session-state";

type Tx = Prisma.TransactionClient;

/** Serialise all changes to one session so two organisers can't double-book a player or a court. */
export async function lockSession(tx: Tx, sessionId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))`;
}

/** Fill free courts (or the given ones) from the queue. Returns how many matches were created. */
export async function assignCourts(tx: Tx, sessionId: string, onlyCourtIds?: string[]) {
  const s = await loadSession(sessionId, tx);
  if (!s || s.status !== "LIVE") return 0;
  const state = deriveState(s);
  const courts = state.freeCourts.filter((c) => !onlyCourtIds || onlyCourtIds.includes(c.id));
  if (!courts.length) return 0;

  const plans = planMatches(state.queue, state.history, courts.length);
  for (let i = 0; i < plans.length; i++) {
    const p = plans[i];
    await tx.match.create({
      data: {
        sessionId,
        courtId: courts[i].id,
        players: {
          create: [
            ...p.teamA.map((memberId) => ({ memberId, team: "A" as const })),
            ...p.teamB.map((memberId) => ({ memberId, team: "B" as const })),
          ],
        },
      },
    });
  }
  return plans.length;
}
