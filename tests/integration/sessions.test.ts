import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { setChargeStatus } from "@/features/billing/actions";
import { addExpense, deleteExpense } from "@/features/finance/actions";
import { substitutePlayer } from "@/features/play/actions";
import { closeSession, createSession, deleteSession, startSession, updateSession } from "@/features/sessions/actions";
import { addNewMemberToSession, addParticipantsForm } from "@/features/sessions/signup-actions";
import { updateSettings } from "@/features/settings/actions";
import { actAs, makeMembers, makeSession, makeUser, playingMatches } from "./factory";
import { form } from "./helpers";

const sessionForm = (o: Record<string, string> = {}) =>
  form({
    venue: "สนามทดสอบ",
    date: "2026-11-05",
    startTime: "19:00",
    endTime: "21:00",
    courts: "5, 6",
    courtRate: "180",
    shuttlePrice: "85",
    feeMode: "SPLIT",
    flatFee: "0",
    maxPlayers: "",
    selfSignup: "on",
    ...o,
  });

beforeEach(async () => actAs(await makeUser("ADMIN")));

describe("session lifecycle", () => {
  it("creates a session with courts and money in satang", async () => {
    const r = await createSession(sessionForm());
    expect(r).toMatchObject({ ok: true });
    const id = (r as { redirect: string }).redirect.split("/").pop()!;
    const s = await prisma.session.findUniqueOrThrow({ where: { id }, include: { courts: { orderBy: { position: "asc" } } } });
    expect(s).toMatchObject({ courtRate: 18000, shuttlePrice: 8500, selfSignup: true });
    expect(s.courts.map((c) => c.name)).toEqual(["5", "6"]);
  });

  it("explains invalid input", async () => {
    expect(await createSession(sessionForm({ venue: "" }))).toEqual({ ok: false, error: "กรุณาใส่ชื่อสนาม" });
    expect(await createSession(sessionForm({ courts: "" }))).toEqual({ ok: false, error: "ต้องมีอย่างน้อย 1 คอร์ท" });
  });

  it("renames, adds and removes empty courts, but keeps courts that have games", async () => {
    const members = await makeMembers(4);
    const s = await makeSession(
      members.map((m) => m.id),
      { courts: 2 },
    );
    await startSession(s.id); // a game now sits on court "1"
    expect(await updateSession(s.id, sessionForm({ courts: "A" }))).toMatchObject({ ok: true }); // court 2 (empty) removed, 1 renamed
    expect((await prisma.court.findMany({ where: { sessionId: s.id } })).map((c) => c.name)).toEqual(["A"]);
    expect(await updateSession(s.id, sessionForm({ courts: "" }))).toMatchObject({ ok: false });
  });

  it("deletes an unpaid session but not one with money received", async () => {
    const members = await makeMembers(4);
    const a = await makeSession(members.map((m) => m.id));
    expect(await deleteSession(a.id)).toMatchObject({ ok: true });
    expect(await prisma.session.count({ where: { id: a.id } })).toBe(0);
    expect(await prisma.activity.count({ where: { type: "session.delete", summary: { contains: "ลบรอบ" } } })).toBeGreaterThan(0);

    const b = await makeSession(members.map((m) => m.id));
    await startSession(b.id);
    await closeSession(b.id);
    const c = await prisma.charge.findFirstOrThrow({ where: { sessionId: b.id } });
    await setChargeStatus(c.id, "PAID");
    expect(await deleteSession(b.id)).toMatchObject({ ok: false });
  });
});

describe("adding players", () => {
  it("adds registered members in the order picked, skipping ones already in", async () => {
    const members = await makeMembers(3);
    const s = await makeSession([members[0].id]);
    const f = new FormData();
    for (const m of members) f.append("memberId", m.id);
    expect(await addParticipantsForm(s.id, f)).toEqual({ ok: true, message: "เพิ่ม 2 คนแล้ว" });
  });

  it("creates a brand-new member straight into the session, refusing duplicates", async () => {
    const s = await makeSession([]);
    const name = `ใหม่${Date.now().toString(36)}`;
    expect(await addNewMemberToSession(s.id, form({ nickname: name, level: "BG" }))).toEqual({ ok: true, message: `เพิ่ม ${name} แล้ว` });
    expect(await addNewMemberToSession(s.id, form({ nickname: name, level: "BG" }))).toMatchObject({ ok: false });
  });
});

describe("substitution", () => {
  it("puts the head of the queue in and rests the person who left", async () => {
    const members = await makeMembers(5);
    const s = await makeSession(members.map((m) => m.id));
    await startSession(s.id);
    const [game] = await playingMatches(s.id);
    const out = game.players[0].memberId;
    const onCourt = new Set(game.players.map((p) => p.memberId));
    const waiting = members.find((m) => !onCourt.has(m.id))!;
    expect(await substitutePlayer(game.id, out)).toMatchObject({ ok: true });
    const [after] = await playingMatches(s.id);
    expect(after.players.map((p) => p.memberId)).toContain(waiting.id);
    expect((await prisma.participant.findFirstOrThrow({ where: { sessionId: s.id, memberId: out } })).status).toBe("RESTING");
  });
});

describe("finance and settings", () => {
  it("adds and deletes a manual expense; session expenses cannot be deleted by hand", async () => {
    expect(await addExpense(form({ category: "SHUTTLE", amount: "950", spentAt: "2026-10-30", note: "ลูก 1 หลอด" }))).toMatchObject({
      ok: true,
    });
    const e = await prisma.expense.findFirstOrThrow({ where: { note: "ลูก 1 หลอด" } });
    expect(e.amount).toBe(95000);
    expect(await deleteExpense(e.id)).toMatchObject({ ok: true });
    expect(await addExpense(form({ category: "OTHER", amount: "-5", spentAt: "2026-10-30", note: "x" }))).toEqual({
      ok: false,
      error: "จำนวนเงินต้องมากกว่า 0",
    });

    const members = await makeMembers(4);
    const s = await makeSession(members.map((m) => m.id));
    await startSession(s.id);
    await closeSession(s.id);
    const auto = await prisma.expense.findFirstOrThrow({ where: { sessionId: s.id } });
    expect(await deleteExpense(auto.id)).toMatchObject({ ok: false });
  });

  it("stores PromptPay digits only and records the change", async () => {
    expect(await updateSettings(form({ groupName: "ก๊วนทดสอบ", promptpayId: "081-234-5678", accountName: "ทดสอบ" }))).toMatchObject({
      ok: true,
    });
    expect((await prisma.setting.findUniqueOrThrow({ where: { id: "main" } })).promptpayId).toBe("0812345678");
    expect(await prisma.activity.count({ where: { type: "settings.update", summary: { contains: "0812345678" } } })).toBeGreaterThan(0);
    expect(await updateSettings(form({ groupName: "x", promptpayId: "123" }))).toMatchObject({ ok: false });
  });
});
