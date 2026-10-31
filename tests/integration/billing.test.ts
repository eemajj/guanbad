import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { reportPaid, setChargeStatus } from "@/features/billing/actions";
import { finishMatch } from "@/features/play/actions";
import { closeSession, reopenSession, startSession } from "@/features/sessions/actions";
import { actAs, makeMembers, makeSession, makeUser, playingMatches } from "./factory";
import { form } from "./helpers";

let admin: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  admin = await makeUser("ADMIN");
  actAs(admin);
});

/** 5 people, 1 court, 19:00–21:00 at ฿180/h, ฿85 per shuttle, one game using 2 shuttles. */
async function playedSession() {
  const members = await makeMembers(5);
  const s = await makeSession(members.map((m) => m.id));
  await startSession(s.id);
  const [game] = await playingMatches(s.id);
  await finishMatch(game.id, form({ winner: "A", scoreA: "", scoreB: "", shuttles: "2" }));
  const players = new Set(game.players.map((p) => p.memberId));
  const benched = members.find((m) => !players.has(m.id))!;
  return { s, members, players, benched };
}

describe("closeSession", () => {
  it("bills everyone: court split five ways, shuttles split among the four who played", async () => {
    const { s, players, benched } = await playedSession();
    expect(await closeSession(s.id)).toMatchObject({ ok: true });

    const charges = await prisma.charge.findMany({ where: { sessionId: s.id } });
    expect(charges).toHaveLength(5);
    for (const c of charges) {
      expect(c.courtFee).toBe(7200); // 1 × 2h × ฿180 = ฿360 / 5
      if (players.has(c.memberId)) {
        expect(c.shuttleFee).toBe(4250); // 2 × ฿85 / 4
        expect(c.total).toBe(11500); // ฿114.50 rounded up to ฿115
      }
    }
    expect(charges.find((c) => c.memberId === benched.id)).toMatchObject({ shuttleFee: 0, total: 7200 });

    const expenses = await prisma.expense.findMany({ where: { sessionId: s.id }, orderBy: { category: "asc" } });
    expect(expenses.map((e) => [e.category, e.amount])).toEqual([
      ["COURT", 36000],
      ["SHUTTLE", 17000],
    ]);
    expect(await prisma.activity.count({ where: { sessionId: s.id, type: "session.close" } })).toBe(1);
  });

  it("cannot be closed twice", async () => {
    const { s } = await playedSession();
    await closeSession(s.id);
    expect(await closeSession(s.id)).toEqual({ ok: false, error: "รอบนี้ปิดไปแล้ว" });
  });
});

describe("reopenSession", () => {
  it("removes unpaid bills and session expenses so they can be recalculated", async () => {
    const { s } = await playedSession();
    await closeSession(s.id);
    expect(await reopenSession(s.id)).toMatchObject({ ok: true });
    expect(await prisma.charge.count({ where: { sessionId: s.id } })).toBe(0);
    expect(await prisma.expense.count({ where: { sessionId: s.id } })).toBe(0);
  });

  it("is refused once anyone has paid or reported a transfer", async () => {
    const { s } = await playedSession();
    await closeSession(s.id);
    const c = await prisma.charge.findFirstOrThrow({ where: { sessionId: s.id } });
    await setChargeStatus(c.id, "PAID");
    expect(await reopenSession(s.id)).toMatchObject({ ok: false });
    expect(await prisma.charge.count({ where: { sessionId: s.id } })).toBe(5);
  });
});

describe("payment status", () => {
  it("member reports, organiser confirms, and both steps are in the history", async () => {
    const payer = await makeUser("MEMBER");
    const s = await makeSession([payer.member!.id]);
    const c = await prisma.charge.create({
      data: { sessionId: s.id, memberId: payer.member!.id, courtFee: 9000, shuttleFee: 0, shuttleCount: 0, total: 9000 },
    });

    actAs(payer);
    expect(await reportPaid(c.id)).toMatchObject({ ok: true });
    expect(await reportPaid(c.id)).toMatchObject({ ok: false }); // only once

    actAs(admin);
    expect(await setChargeStatus(c.id, "PAID")).toMatchObject({ ok: true });
    const after = await prisma.charge.findUniqueOrThrow({ where: { id: c.id } });
    expect(after).toMatchObject({ status: "PAID", confirmedById: admin.id });
    expect(after.paidAt).toBeInstanceOf(Date);

    const history = await prisma.activity.findMany({ where: { sessionId: s.id }, orderBy: { at: "asc" } });
    expect(history.map((h) => [h.type, h.actorId])).toEqual([
      ["charge.reported", payer.id],
      ["charge.paid", admin.id],
    ]);
    expect(history[1].data).toMatchObject({ before: "REPORTED", after: "PAID" });
  });
});
