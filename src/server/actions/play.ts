"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Level, ParticipantStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { run } from "@/lib/action";
import { ActionError, requireAdminAction, requireViewerAction } from "@/lib/viewer";
import { deriveState, loadSession } from "@/server/session-state";
import { assignCourts, lockSession } from "@/server/match-engine";
import { isLevel } from "@/domain/levels";

const refresh = (sessionId: string) => revalidatePath(`/sessions/${sessionId}`);

/* ---------- sign-up ---------- */

export async function addParticipants(sessionId: string, memberIds: string[]) {
  return run(async () => {
    await requireAdminAction();
    if (!memberIds.length) throw new ActionError("เลือกอย่างน้อย 1 คน");
    const added = await prisma.$transaction(async (tx) => {
      await lockSession(tx, sessionId);
      const s = await loadSession(sessionId, tx);
      if (!s) throw new ActionError("ไม่พบรอบนี้");
      if (s.status === "CLOSED") throw new ActionError("รอบนี้ปิดแล้ว");
      const have = new Set(s.participants.map((p) => p.memberId));
      const fresh = memberIds.filter((id) => !have.has(id));
      const now = Date.now();
      // Stagger queue times so the order they were picked is kept.
      await tx.participant.createMany({
        data: fresh.map((memberId, i) => ({ sessionId, memberId, source: "ADMIN" as const, joinedAt: new Date(now + i), queuedAt: new Date(now + i) })),
      });
      if (s.status === "LIVE") await assignCourts(tx, sessionId);
      return fresh.length;
    });
    refresh(sessionId);
    return { ok: true, message: added ? `เพิ่ม ${added} คนแล้ว` : "ทุกคนอยู่ในรอบแล้ว" };
  });
}

const newMemberSchema = z.object({
  nickname: z.string().trim().min(1, "กรุณาใส่ชื่อเล่น").max(30),
  level: z.string().refine(isLevel, "เลือกระดับมือ"),
});

/** หัวก๊วนเพิ่มคนใหม่ที่ยังไม่อยู่ในทะเบียน — สร้างสมาชิกแล้วใส่เข้ารอบทันที */
export async function addNewMemberToSession(sessionId: string, form: FormData) {
  return run(async () => {
    await requireAdminAction();
    const d = newMemberSchema.parse(Object.fromEntries(form));
    const dupe = await prisma.member.findFirst({ where: { nickname: { equals: d.nickname, mode: "insensitive" }, active: true } });
    if (dupe) throw new ActionError(`มี “${dupe.nickname}” ในทะเบียนแล้ว เลือกจากรายชื่อแทน`);
    const member = await prisma.member.create({ data: { nickname: d.nickname, level: d.level as Level } });
    return addParticipants(sessionId, [member.id]).then((r) => (r.ok ? { ok: true as const, message: `เพิ่ม ${d.nickname} แล้ว` } : r));
  });
}

/** สมาชิกลงชื่อเอง */
export async function joinSession(sessionId: string) {
  return run(async () => {
    const viewer = await requireViewerAction();
    if (!viewer.member) throw new ActionError("กรุณาสร้างโปรไฟล์ก่อน");
    const memberId = viewer.member.id;
    await prisma.$transaction(async (tx) => {
      await lockSession(tx, sessionId);
      const s = await loadSession(sessionId, tx);
      if (!s) throw new ActionError("ไม่พบรอบนี้");
      if (s.status === "CLOSED") throw new ActionError("รอบนี้ปิดแล้ว");
      if (!s.selfSignup && !viewer.isAdmin) throw new ActionError("รอบนี้หัวก๊วนเป็นคนเพิ่มชื่อให้");
      if (s.participants.some((p) => p.memberId === memberId)) throw new ActionError("คุณลงชื่อไว้แล้ว");
      if (s.maxPlayers && s.participants.length >= s.maxPlayers) throw new ActionError(`รอบนี้เต็มแล้ว (${s.maxPlayers} คน)`);
      await tx.participant.create({ data: { sessionId, memberId, source: "SELF" } });
      if (s.status === "LIVE") await assignCourts(tx, sessionId);
    });
    refresh(sessionId);
    revalidatePath("/");
    return { ok: true, message: "ลงชื่อแล้ว" };
  });
}

/** ถอนชื่อ (ตัวเอง) หรือลบออกจากรอบ (หัวก๊วน) — ได้เฉพาะคนที่ยังไม่ได้ลงเล่น */
export async function removeParticipant(participantId: string) {
  return run(async () => {
    const viewer = await requireViewerAction();
    const p = await prisma.participant.findUnique({ where: { id: participantId } });
    if (!p) throw new ActionError("ไม่พบรายชื่อนี้");
    if (!viewer.isAdmin && p.memberId !== viewer.member?.id) throw new ActionError("ทำรายการนี้ไม่ได้");
    await prisma.$transaction(async (tx) => {
      await lockSession(tx, p.sessionId);
      const played = await tx.matchPlayer.count({ where: { memberId: p.memberId, match: { sessionId: p.sessionId, status: { not: "CANCELLED" } } } });
      if (played) throw new ActionError("ลงเล่นไปแล้ว ใช้ “กลับบ้านแล้ว” แทน");
      const charge = await tx.charge.findUnique({ where: { sessionId_memberId: { sessionId: p.sessionId, memberId: p.memberId } } });
      if (charge) throw new ActionError("ออกบิลแล้ว ลบไม่ได้");
      await tx.participant.delete({ where: { id: participantId } });
    });
    refresh(p.sessionId);
    revalidatePath("/");
    return { ok: true, message: viewer.isAdmin && p.memberId !== viewer.member?.id ? "ลบออกจากรอบแล้ว" : "ถอนชื่อแล้ว" };
  });
}

/** พัก / กลับมาเล่น / กลับบ้านแล้ว — หัวก๊วนทำให้ทุกคนได้ สมาชิกทำได้เฉพาะของตัวเอง */
export async function setParticipantStatus(participantId: string, status: ParticipantStatus) {
  return run(async () => {
    const viewer = await requireViewerAction();
    const p = await prisma.participant.findUnique({ where: { id: participantId }, include: { member: true } });
    if (!p) throw new ActionError("ไม่พบรายชื่อนี้");
    if (!viewer.isAdmin && p.memberId !== viewer.member?.id) throw new ActionError("ทำรายการนี้ไม่ได้");
    await prisma.$transaction(async (tx) => {
      await lockSession(tx, p.sessionId);
      await tx.participant.update({
        where: { id: participantId },
        data: { status, ...(status === "ACTIVE" && p.status !== "ACTIVE" ? { queuedAt: new Date() } : {}) },
      });
      if (status === "ACTIVE") await assignCourts(tx, p.sessionId);
    });
    refresh(p.sessionId);
    const label = { ACTIVE: "กลับเข้าคิวแล้ว", RESTING: "พักแล้ว (ถ้ากำลังเล่นอยู่ จะพักหลังจบเกมนี้)", LEFT: "บันทึกว่ากลับบ้านแล้ว" }[status];
    return { ok: true, message: `${p.member.nickname} ${label}` };
  });
}

/* ---------- courts ---------- */

export async function fillCourts(sessionId: string, courtId?: string) {
  return run(async () => {
    await requireAdminAction();
    const made = await prisma.$transaction(async (tx) => {
      await lockSession(tx, sessionId);
      return assignCourts(tx, sessionId, courtId ? [courtId] : undefined);
    });
    refresh(sessionId);
    if (!made) throw new ActionError("คนรอคิวไม่พอ ต้องมีอย่างน้อย 4 คน");
    return { ok: true, message: `จัดคู่แล้ว ${made} คอร์ท` };
  });
}

const finishSchema = z.object({
  winner: z.enum(["A", "B", ""]).transform((v) => (v === "" ? null : v)),
  shuttles: z.coerce.number().int().min(0, "จำนวนลูกต้องไม่ติดลบ").max(30),
});

export async function finishMatch(matchId: string, form: FormData) {
  return run(async () => {
    await requireAdminAction();
    const d = finishSchema.parse(Object.fromEntries(form));
    const result = await prisma.$transaction(async (tx) => {
      const m = await tx.match.findUnique({ where: { id: matchId }, include: { players: true, court: true } });
      if (!m) throw new ActionError("ไม่พบเกมนี้");
      await lockSession(tx, m.sessionId);
      const fresh = await tx.match.findUnique({ where: { id: matchId } });
      if (fresh?.status !== "PLAYING") throw new ActionError("เกมนี้บันทึกไปแล้ว");
      const endedAt = new Date();
      await tx.match.update({ where: { id: matchId }, data: { status: "DONE", winner: d.winner, shuttles: d.shuttles, endedAt } });
      // The four players go to the back of the queue.
      await tx.participant.updateMany({
        where: { sessionId: m.sessionId, memberId: { in: m.players.map((p) => p.memberId) } },
        data: { queuedAt: endedAt },
      });
      const made = await assignCourts(tx, m.sessionId, [m.courtId]);
      return { sessionId: m.sessionId, court: m.court.name, made };
    });
    refresh(result.sessionId);
    return { ok: true, message: result.made ? `บันทึกแล้ว · เกมใหม่ลงคอร์ท ${result.court}` : "บันทึกแล้ว · คนรอไม่พอจัดเกมใหม่" };
  });
}

export async function cancelMatch(matchId: string) {
  return run(async () => {
    await requireAdminAction();
    const m = await prisma.match.findUnique({ where: { id: matchId } });
    if (!m) throw new ActionError("ไม่พบเกมนี้");
    await prisma.match.update({ where: { id: matchId }, data: { status: "CANCELLED", endedAt: new Date() } });
    refresh(m.sessionId);
    return { ok: true, message: "ยกเลิกเกมแล้ว (ไม่นับ ไม่คิดค่าลูก)" };
  });
}

/** เปลี่ยนตัว: คนหัวคิวลงแทน แล้วคนที่ออกถูกตั้งเป็นพัก */
export async function substitutePlayer(matchId: string, memberId: string) {
  return run(async () => {
    await requireAdminAction();
    const out = await prisma.$transaction(async (tx) => {
      const m = await tx.match.findUnique({ where: { id: matchId }, include: { players: true } });
      if (!m || m.status !== "PLAYING") throw new ActionError("เกมนี้จบไปแล้ว");
      await lockSession(tx, m.sessionId);
      const s = (await loadSession(m.sessionId, tx))!;
      const { queue, memberName } = deriveState(s);
      const sub = queue[0];
      if (!sub) throw new ActionError("ไม่มีคนรอคิวลงแทน");
      const leaving = m.players.find((p) => p.memberId === memberId);
      if (!leaving) throw new ActionError("คนนี้ไม่ได้อยู่ในเกมนี้");
      await tx.matchPlayer.delete({ where: { matchId_memberId: { matchId, memberId } } });
      await tx.matchPlayer.create({ data: { matchId, memberId: sub.id, team: leaving.team } });
      await tx.participant.update({ where: { sessionId_memberId: { sessionId: m.sessionId, memberId } }, data: { status: "RESTING" } });
      return { sessionId: m.sessionId, text: `${memberName.get(sub.id)} ลงแทน ${memberName.get(memberId)}` };
    });
    refresh(out.sessionId);
    return { ok: true, message: out.text };
  });
}

/** Form version of addParticipants: reads every checked `memberId`. */
export async function addParticipantsForm(sessionId: string, form: FormData) {
  return addParticipants(sessionId, form.getAll("memberId").map(String));
}
