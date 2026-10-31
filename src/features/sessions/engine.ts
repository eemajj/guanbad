import { planMatches } from "@/domain/matchmaking";
import type { Tx } from "@/server/lock";
import { deriveState, loadSession } from "./state";

/**
 * Fill free courts (or only the given ones) from the queue. Returns the ids of the games created.
 * Call inside inSessionLock() so two organisers can't assign the same player twice.
 */
export async function assignCourts(tx: Tx, sessionId: string, onlyCourtIds?: string[]) {
  const s = await loadSession(sessionId, tx);
  if (!s || s.status !== "LIVE") return [];
  const state = deriveState(s);
  const courts = state.freeCourts.filter((c) => !onlyCourtIds || onlyCourtIds.includes(c.id));
  if (!courts.length) return [];

  const plans = planMatches(state.queue, state.history, courts.length);
  const created: string[] = [];
  for (const [i, p] of plans.entries()) {
    const match = await tx.match.create({
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
    created.push(match.id);
  }
  return created;
}
