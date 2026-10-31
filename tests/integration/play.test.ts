import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { cancelMatch, fillCourts, finishMatch, undoFinishMatch, updateMatchResult } from "@/features/play/actions";
import { setChargeStatus, undoChargeStatus } from "@/features/billing/actions";
import { closeSession, startSession } from "@/features/sessions/actions";
import { actAs, makeMembers, makeSession, makeUser, playingMatches } from "./factory";
import { form } from "./helpers";

let admin: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  admin = await makeUser("ADMIN");
  actAs(admin);
});

async function liveSessionWithGame(players = 4, courts = 1) {
  const members = await makeMembers(players);
  const s = await makeSession(
    members.map((m) => m.id),
    { courts },
  );
  expect(await startSession(s.id)).toMatchObject({ ok: true });
  const [m] = await playingMatches(s.id);
  return { s, m, members };
}

describe("cancelMatch", () => {
  it("cancels a game that is still on court", async () => {
    const { m } = await liveSessionWithGame();
    expect(await cancelMatch(m.id)).toMatchObject({ ok: true });
    expect((await prisma.match.findUnique({ where: { id: m.id } }))?.status).toBe("CANCELLED");
  });

  it("refuses to cancel a finished game (it already counts for bills and stats)", async () => {
    const { m } = await liveSessionWithGame();
    await finishMatch(m.id, form({ winner: "A", scoreA: "", scoreB: "", shuttles: "2" }));
    const r = await cancelMatch(m.id);
    expect(r).toMatchObject({ ok: false });
    expect((await prisma.match.findUnique({ where: { id: m.id } }))?.status).toBe("DONE");
  });

  it("is organiser-only", async () => {
    const { m } = await liveSessionWithGame();
    actAs(await makeUser("MEMBER"));
    expect(await cancelMatch(m.id)).toEqual({ ok: false, error: "เฉพาะหัวก๊วนเท่านั้น" });
  });
});

describe("updateMatchResult", () => {
  it("can fix the result after bills are issued but not the shuttle count", async () => {
    const { s, m } = await liveSessionWithGame();
    await finishMatch(m.id, form({ winner: "", scoreA: "", scoreB: "", shuttles: "2" }));
    await closeSession(s.id);

    expect(await updateMatchResult(m.id, form({ winner: "", scoreA: "21", scoreB: "18", shuttles: "2" }))).toMatchObject({ ok: true });
    expect(await prisma.match.findUnique({ where: { id: m.id } })).toMatchObject({ winner: "A", scoreA: 21, scoreB: 18 });

    expect(await updateMatchResult(m.id, form({ winner: "", scoreA: "21", scoreB: "18", shuttles: "5" }))).toMatchObject({ ok: false });
    expect((await prisma.match.findUnique({ where: { id: m.id } }))?.shuttles).toBe(2);
  });
});

describe("fillCourts concurrency", () => {
  it("never puts a player on two courts when organisers click at the same time", async () => {
    const members = await makeMembers(12);
    const s = await makeSession(
      members.map((m) => m.id),
      { courts: 3, status: "LIVE" },
    );
    await Promise.all([fillCourts(s.id), fillCourts(s.id), fillCourts(s.id)]);
    const games = await playingMatches(s.id);
    const onCourt = games.flatMap((g) => g.players.map((p) => p.memberId));
    expect(games).toHaveLength(3);
    expect(new Set(onCourt).size).toBe(onCourt.length);
    expect(new Set(games.map((g) => g.courtId)).size).toBe(3);
  });
});

describe("undoFinishMatch", () => {
  it("puts the game back on court, clears the result and restores the queue", async () => {
    const { s, m } = await liveSessionWithGame(5, 1);
    const queueBefore = await prisma.participant.findMany({ where: { sessionId: s.id }, orderBy: { memberId: "asc" } });
    await finishMatch(m.id, form({ winner: "", scoreA: "21", scoreB: "19", shuttles: "2" }));

    expect(await undoFinishMatch(m.id)).toMatchObject({ ok: true });
    const after = await prisma.match.findUniqueOrThrow({ where: { id: m.id } });
    expect(after).toMatchObject({ status: "PLAYING", winner: null, scoreA: null, shuttles: 0, endedAt: null });
    const queueAfter = await prisma.participant.findMany({ where: { sessionId: s.id }, orderBy: { memberId: "asc" } });
    expect(queueAfter.map((p) => p.queuedAt.getTime())).toEqual(queueBefore.map((p) => p.queuedAt.getTime()));
  });

  it("also cancels the next game the system put on the same court", async () => {
    const { s, m } = await liveSessionWithGame(8, 1);
    await finishMatch(m.id, form({ winner: "A", scoreA: "", scoreB: "", shuttles: "1" }));
    const [next] = await playingMatches(s.id);
    expect(next.id).not.toBe(m.id);
    expect(await undoFinishMatch(m.id)).toMatchObject({ ok: true });
    expect(await prisma.match.count({ where: { id: next.id } })).toBe(0);
    expect((await playingMatches(s.id)).map((g) => g.id)).toEqual([m.id]);
  });

  it("is refused once the next game has also finished", async () => {
    const { s, m } = await liveSessionWithGame(8, 1);
    await finishMatch(m.id, form({ winner: "A", scoreA: "", scoreB: "", shuttles: "1" }));
    const [next] = await playingMatches(s.id);
    await finishMatch(next.id, form({ winner: "B", scoreA: "", scoreB: "", shuttles: "1" }));
    expect(await undoFinishMatch(m.id)).toMatchObject({ ok: false });
  });
});

describe("undoChargeStatus", () => {
  it("returns a bill to its previous status", async () => {
    const payer = await makeUser("MEMBER");
    const s = await makeSession([payer.member!.id]);
    const c = await prisma.charge.create({
      data: { sessionId: s.id, memberId: payer.member!.id, courtFee: 100, shuttleFee: 0, shuttleCount: 0, total: 100, status: "REPORTED" },
    });
    await setChargeStatus(c.id, "PAID");
    expect(await undoChargeStatus(c.id)).toMatchObject({ ok: true });
    expect((await prisma.charge.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("REPORTED");
  });
});
