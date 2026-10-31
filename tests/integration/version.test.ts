import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { finishMatch, substitutePlayer } from "@/features/play/actions";
import { startSession } from "@/features/sessions/actions";
import { setParticipantStatus } from "@/features/sessions/signup-actions";
import { actAs, makeMembers, makeSession, makeUser, playingMatches } from "./factory";
import { form } from "./helpers";

/** Open screens reload only when Session.version moves, so every kind of change must move it. */
const version = async (id: string) => (await prisma.session.findUniqueOrThrow({ where: { id }, select: { version: true } })).version;

beforeEach(async () => actAs(await makeUser("ADMIN")));

describe("session version", () => {
  it("goes up for every change a phone would need to see", async () => {
    const members = await makeMembers(5);
    const s = await makeSession(members.map((m) => m.id));
    let v = await version(s.id);
    const moved = async () => {
      const now = await version(s.id);
      const ok = now > v;
      v = now;
      return ok;
    };

    await startSession(s.id);
    expect(await moved()).toBe(true); // status + new game

    const [game] = await playingMatches(s.id);
    await substitutePlayer(game.id, game.players[0].memberId);
    expect(await moved()).toBe(true); // only MatchPlayer rows changed

    const p = await prisma.participant.findFirstOrThrow({ where: { sessionId: s.id, status: "ACTIVE" } });
    await setParticipantStatus(p.id, "RESTING");
    expect(await moved()).toBe(true);

    await finishMatch(game.id, form({ winner: "A", scoreA: "", scoreB: "", shuttles: "1" }));
    expect(await moved()).toBe(true);

    await prisma.member.update({ where: { id: members[4].id }, data: { level: "P" } });
    expect(await moved()).toBe(true); // level shown on court
  });

  it("does not move for unrelated sessions", async () => {
    const a = await makeSession((await makeMembers(4)).map((m) => m.id));
    const b = await makeSession((await makeMembers(4)).map((m) => m.id));
    const before = await version(b.id);
    await startSession(a.id);
    expect(await version(b.id)).toBe(before);
  });
});
