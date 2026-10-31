"use server";

import { z } from "zod";
import type { Level, ParticipantStatus } from "@prisma/client";
import { isLevel } from "@/domain/levels";
import { asAdmin, asUser } from "@/server/action";
import { prisma } from "@/server/db";
import { inSessionLock } from "@/server/lock";
import { refresh } from "@/server/revalidate";
import { ActionError } from "@/server/viewer";
import { assignCourts } from "./engine";
import { loadSession } from "./state";

/** หัวก๊วนเพิ่มสมาชิกจากทะเบียนเข้ารอบ (เรียงตามลำดับที่เลือก) */
export async function addParticipants(sessionId: string, memberIds: string[]) {
  return asAdmin(async () => {
    if (!memberIds.length) throw new ActionError("เลือกอย่างน้อย 1 คน");
    const added = await inSessionLock(sessionId, async (tx) => {
      const s = await loadSession(sessionId, tx);
      if (!s) throw new ActionError("ไม่พบรอบนี้");
      if (s.status === "CLOSED") throw new ActionError("รอบนี้ปิดแล้ว");
      const have = new Set(s.participants.map((p) => p.memberId));
      const fresh = memberIds.filter((id) => !have.has(id));
      const now = Date.now();
      // Stagger queue times by 1 ms so the picked order is kept.
      await tx.participant.createMany({
        data: fresh.map((memberId, i) => ({
          sessionId,
          memberId,
          source: "ADMIN" as const,
          joinedAt: new Date(now + i),
          queuedAt: new Date(now + i),
        })),
      });
      if (s.status === "LIVE") await assignCourts(tx, sessionId);
      return fresh.length;
    });
    refresh.session(sessionId);
    return { ok: true, message: added ? `เพิ่ม ${added} คนแล้ว` : "ทุกคนอยู่ในรอบแล้ว" };
  });
}

/** Form version of addParticipants: reads every checked `memberId`. */
export async function addParticipantsForm(sessionId: string, form: FormData) {
  return addParticipants(sessionId, form.getAll("memberId").map(String));
}

const newMemberSchema = z.object({
  nickname: z.string().trim().min(1, "กรุณาใส่ชื่อเล่น").max(30),
  level: z.string().refine(isLevel, "เลือกระดับมือ"),
});

/** หัวก๊วนเพิ่มคนใหม่ที่ยังไม่อยู่ในทะเบียน: สร้างสมาชิกแล้วใส่เข้ารอบทันที */
export async function addNewMemberToSession(sessionId: string, form: FormData) {
  return asAdmin(async () => {
    const d = newMemberSchema.parse(Object.fromEntries(form));
    const dupe = await prisma.member.findFirst({ where: { nickname: { equals: d.nickname, mode: "insensitive" }, active: true } });
    if (dupe) throw new ActionError(`มี “${dupe.nickname}” ในทะเบียนแล้ว เลือกจากรายชื่อแทน`);
    const member = await prisma.member.create({ data: { nickname: d.nickname, level: d.level as Level } });
    const r = await addParticipants(sessionId, [member.id]);
    return r.ok ? { ok: true, message: `เพิ่ม ${d.nickname} แล้ว` } : r;
  });
}

/** สมาชิกลงชื่อเอง */
export async function joinSession(sessionId: string) {
  return asUser(async (viewer) => {
    if (!viewer.member) throw new ActionError("กรุณาสร้างโปรไฟล์ก่อน");
    const memberId = viewer.member.id;
    await inSessionLock(sessionId, async (tx) => {
      const s = await loadSession(sessionId, tx);
      if (!s) throw new ActionError("ไม่พบรอบนี้");
      if (s.status === "CLOSED") throw new ActionError("รอบนี้ปิดแล้ว");
      if (!s.selfSignup && !viewer.isAdmin) throw new ActionError("รอบนี้หัวก๊วนเป็นคนเพิ่มชื่อให้");
      if (s.participants.some((p) => p.memberId === memberId)) throw new ActionError("คุณลงชื่อไว้แล้ว");
      if (s.maxPlayers && s.participants.length >= s.maxPlayers) throw new ActionError(`รอบนี้เต็มแล้ว (${s.maxPlayers} คน)`);
      await tx.participant.create({ data: { sessionId, memberId, source: "SELF" } });
      if (s.status === "LIVE") await assignCourts(tx, sessionId);
    });
    refresh.session(sessionId);
    return { ok: true, message: "ลงชื่อแล้ว" };
  });
}

/** Load a participant and check the caller may change it (organiser, or the person themself). */
async function ownParticipant(participantId: string, viewer: { isAdmin: boolean; member: { id: string } | null }) {
  const p = await prisma.participant.findUnique({ where: { id: participantId }, include: { member: true } });
  if (!p) throw new ActionError("ไม่พบรายชื่อนี้");
  if (!viewer.isAdmin && p.memberId !== viewer.member?.id) throw new ActionError("ทำรายการนี้ไม่ได้");
  return p;
}

/** ถอนชื่อ (ตัวเอง) หรือลบออกจากรอบ (หัวก๊วน) ได้เฉพาะคนที่ยังไม่ได้ลงเล่น */
export async function removeParticipant(participantId: string) {
  return asUser(async (viewer) => {
    const p = await ownParticipant(participantId, viewer);
    await inSessionLock(p.sessionId, async (tx) => {
      const played = await tx.matchPlayer.count({
        where: { memberId: p.memberId, match: { sessionId: p.sessionId, status: { not: "CANCELLED" } } },
      });
      if (played) throw new ActionError("ลงเล่นไปแล้ว ใช้ “กลับบ้านแล้ว” แทน");
      const charge = await tx.charge.findUnique({ where: { sessionId_memberId: { sessionId: p.sessionId, memberId: p.memberId } } });
      if (charge) throw new ActionError("ออกบิลแล้ว ลบไม่ได้");
      await tx.participant.delete({ where: { id: participantId } });
    });
    refresh.session(p.sessionId);
    return { ok: true, message: p.memberId === viewer.member?.id ? "ถอนชื่อแล้ว" : "ลบออกจากรอบแล้ว" };
  });
}

const STATUS_MESSAGE: Record<ParticipantStatus, string> = {
  ACTIVE: "กลับเข้าคิวแล้ว",
  RESTING: "พักแล้ว (ถ้ากำลังเล่นอยู่ จะพักหลังจบเกมนี้)",
  LEFT: "บันทึกว่ากลับบ้านแล้ว",
};

/** พัก / กลับมาเล่น / กลับบ้านแล้ว: หัวก๊วนทำให้ทุกคนได้ สมาชิกทำได้เฉพาะของตัวเอง */
export async function setParticipantStatus(participantId: string, status: ParticipantStatus) {
  return asUser(async (viewer) => {
    const p = await ownParticipant(participantId, viewer);
    await inSessionLock(p.sessionId, async (tx) => {
      const backInQueue = status === "ACTIVE" && p.status !== "ACTIVE";
      await tx.participant.update({ where: { id: participantId }, data: { status, ...(backInQueue ? { queuedAt: new Date() } : {}) } });
      if (status === "ACTIVE") await assignCourts(tx, p.sessionId);
    });
    refresh.session(p.sessionId);
    return { ok: true, message: `${p.member.nickname} ${STATUS_MESSAGE[status]}` };
  });
}
