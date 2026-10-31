import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { reportPaid, setChargeStatus } from "@/features/billing/actions";
import { addExpense } from "@/features/finance/actions";
import { createMember, setUserRole, updateMember } from "@/features/members/actions";
import { fillCourts } from "@/features/play/actions";
import { closeSession, deleteSession, startSession } from "@/features/sessions/actions";
import { removeParticipant, setParticipantStatus } from "@/features/sessions/signup-actions";
import { updateSettings } from "@/features/settings/actions";
import { actAs, makeMembers, makeSession, makeUser } from "./factory";
import { DENIED_ADMIN, DENIED_LOGIN, form } from "./helpers";

/**
 * Who may do what. Every organiser-only action must refuse members and signed-out callers,
 * and members may only change things that are their own.
 */
let sessionId: string;
let chargeId: string;
let member: Awaited<ReturnType<typeof makeUser>>;
let other: Awaited<ReturnType<typeof makeUser>>;

beforeAll(async () => {
  member = await makeUser("MEMBER");
  other = await makeUser("MEMBER");
  const extra = await makeMembers(3);
  const s = await makeSession([member.member!.id, other.member!.id, ...extra.map((m) => m.id)]);
  sessionId = s.id;
  const c = await prisma.charge.create({
    data: { sessionId, memberId: other.member!.id, courtFee: 100, shuttleFee: 0, shuttleCount: 0, total: 100 },
  });
  chargeId = c.id;
});

const organiserOnly: [string, () => Promise<unknown>][] = [
  ["startSession", () => startSession(sessionId)],
  ["closeSession", () => closeSession(sessionId)],
  ["deleteSession", () => deleteSession(sessionId)],
  ["fillCourts", () => fillCourts(sessionId)],
  ["setChargeStatus", () => setChargeStatus(chargeId, "PAID")],
  ["addExpense", () => addExpense(form({ category: "OTHER", amount: "50", spentAt: "2026-10-31", note: "x" }))],
  ["updateSettings", () => updateSettings(form({ groupName: "แฮก", promptpayId: "0899999999" }))],
  ["setUserRole", () => setUserRole(member.id, "ADMIN")],
  ["createMember", () => createMember(form({ nickname: "ผี", level: "N" }))],
];

describe.each(organiserOnly)("%s", (_name, call) => {
  it("refuses a member", async () => {
    actAs(member);
    expect(await call()).toEqual(DENIED_ADMIN);
  });
  it("refuses a signed-out visitor", async () => {
    actAs(null);
    expect(await call()).toEqual(DENIED_LOGIN);
  });
});

describe("members act only on their own records", () => {
  it("cannot rest someone else, can rest themself", async () => {
    const parts = await prisma.participant.findMany({ where: { sessionId } });
    const mine = parts.find((p) => p.memberId === member.member!.id)!;
    const theirs = parts.find((p) => p.memberId === other.member!.id)!;
    actAs(member);
    expect(await setParticipantStatus(theirs.id, "RESTING")).toMatchObject({ ok: false });
    expect(await setParticipantStatus(mine.id, "RESTING")).toMatchObject({ ok: true });
  });

  it("cannot report payment for someone else's bill", async () => {
    actAs(member);
    expect(await reportPaid(chargeId)).toEqual({ ok: false, error: "แจ้งโอนได้เฉพาะบิลของตัวเอง" });
    actAs(other);
    expect(await reportPaid(chargeId)).toMatchObject({ ok: true });
  });

  it("cannot edit another member's profile", async () => {
    actAs(member);
    expect(await updateMember(other.member!.id, form({ nickname: "เปลี่ยนชื่อ", level: "P" }))).toMatchObject({ ok: false });
  });

  it("cannot remove someone else from a session", async () => {
    const theirs = await prisma.participant.findFirstOrThrow({ where: { sessionId, memberId: other.member!.id } });
    actAs(member);
    expect(await removeParticipant(theirs.id)).toMatchObject({ ok: false, error: "ทำรายการนี้ไม่ได้" });
  });

  it("settings were not changed by any refused call", async () => {
    expect((await prisma.setting.findUnique({ where: { id: "main" } }))?.promptpayId ?? null).not.toBe("0899999999");
  });
});
