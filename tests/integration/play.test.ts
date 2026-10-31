import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { cancelMatch, fillCourts, finishMatch, updateMatchResult } from "@/features/play/actions";
import { closeSession, startSession } from "@/features/sessions/actions";
import { actAs, makeMembers, makeSession, makeUser, playingMatches } from "./factory";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

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
