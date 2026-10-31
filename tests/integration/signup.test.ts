import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { fillCourts, finishMatch } from "@/features/play/actions";
import { startSession } from "@/features/sessions/actions";
import { joinSession, removeParticipant, setParticipantStatus } from "@/features/sessions/signup-actions";
import { actAs, makeMembers, makeSession, makeUser, playingMatches } from "./factory";
import { form } from "./helpers";

let admin: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  admin = await makeUser("ADMIN");
});

describe("joinSession", () => {
  it("lets a member sign up once", async () => {
    const s = await makeSession([]);
    const m = await makeUser("MEMBER");
    actAs(m);
    expect(await joinSession(s.id)).toMatchObject({ ok: true });
    expect(await joinSession(s.id)).toEqual({ ok: false, error: "คุณลงชื่อไว้แล้ว" });
  });

  it("refuses when the session is full", async () => {
    const others = await makeMembers(4);
    const s = await makeSession(others.map((o) => o.id));
    await prisma.session.update({ where: { id: s.id }, data: { maxPlayers: 4 } });
    actAs(await makeUser("MEMBER"));
    expect(await joinSession(s.id)).toEqual({ ok: false, error: "รอบนี้เต็มแล้ว (4 คน)" });
  });

  it("refuses when the organiser adds everyone themself", async () => {
    const s = await makeSession([]);
    await prisma.session.update({ where: { id: s.id }, data: { selfSignup: false } });
    actAs(await makeUser("MEMBER"));
    expect(await joinSession(s.id)).toEqual({ ok: false, error: "รอบนี้หัวก๊วนเป็นคนเพิ่มชื่อให้" });
  });

  it("refuses a user without a member profile", async () => {
    const s = await makeSession([]);
    actAs(await makeUser("MEMBER", false));
    expect(await joinSession(s.id)).toEqual({ ok: false, error: "กรุณาสร้างโปรไฟล์ก่อน" });
  });
});

describe("removeParticipant", () => {
  it("is refused once the person has played (use 'went home' instead)", async () => {
    const members = await makeMembers(4);
    const s = await makeSession(members.map((m) => m.id));
    actAs(admin);
    await startSession(s.id);
    const [game] = await playingMatches(s.id);
    await finishMatch(game.id, form({ winner: "", scoreA: "", scoreB: "", shuttles: "1" }));
    const p = await prisma.participant.findFirstOrThrow({ where: { sessionId: s.id, memberId: game.players[0].memberId } });
    expect(await removeParticipant(p.id)).toEqual({ ok: false, error: "ลงเล่นไปแล้ว ใช้ “กลับบ้านแล้ว” แทน" });
  });
});

describe("resting players", () => {
  it("are not put on court", async () => {
    const members = await makeMembers(5);
    const s = await makeSession(members.map((m) => m.id));
    actAs(admin);
    const resting = await prisma.participant.findFirstOrThrow({ where: { sessionId: s.id, memberId: members[0].id } });
    await setParticipantStatus(resting.id, "RESTING");
    await startSession(s.id);
    const [game] = await playingMatches(s.id);
    expect(game.players.map((p) => p.memberId)).not.toContain(members[0].id);
    expect(await fillCourts(s.id)).toMatchObject({ ok: false }); // no free court
  });
});
