"use server";

import { asAdmin } from "@/server/action";
import { inMatchLock, inSessionLock } from "@/server/lock";
import { refresh } from "@/server/revalidate";
import { ActionError } from "@/server/viewer";
import { assignCourts } from "@/features/sessions/engine";
import { deriveState, loadSession } from "@/features/sessions/state";
import { parseResultForm } from "./result-schema";

export async function fillCourts(sessionId: string, courtId?: string) {
  return asAdmin(async () => {
    const made = await inSessionLock(sessionId, (tx) => assignCourts(tx, sessionId, courtId ? [courtId] : undefined));
    refresh.session(sessionId);
    if (!made) throw new ActionError("คนรอคิวไม่พอ ต้องมีอย่างน้อย 4 คน");
    return { ok: true, message: `จัดคู่แล้ว ${made} คอร์ท` };
  });
}

/** จบเกม: บันทึกผล (ไม่บังคับ) แล้วจัดเกมถัดไปลงคอร์ทเดิมทันที */
export async function finishMatch(matchId: string, form: FormData) {
  return asAdmin(async () => {
    const d = parseResultForm(form);
    const out = await inMatchLock(matchId, async (tx, sessionId) => {
      const m = await tx.match.findUnique({ where: { id: matchId }, include: { players: true, court: true } });
      if (m?.status !== "PLAYING") throw new ActionError("เกมนี้บันทึกไปแล้ว");
      const endedAt = new Date();
      await tx.match.update({
        where: { id: matchId },
        data: { status: "DONE", winner: d.winner, scoreA: d.scoreA, scoreB: d.scoreB, shuttles: d.shuttles, endedAt },
      });
      // The four players go to the back of the queue.
      await tx.participant.updateMany({
        where: { sessionId, memberId: { in: m.players.map((p) => p.memberId) } },
        data: { queuedAt: endedAt },
      });
      const made = await assignCourts(tx, sessionId, [m.courtId]);
      return { sessionId, court: m.court.name, made };
    });
    refresh.session(out.sessionId);
    refresh.results();
    return { ok: true, message: out.made ? `บันทึกแล้ว · เกมใหม่ลงคอร์ท ${out.court}` : "บันทึกแล้ว · คนรอไม่พอจัดเกมใหม่" };
  });
}

/** แก้ผลเกมที่จบแล้ว (เช่น ลืมใส่แต้ม) ค่าลูกแก้ได้เฉพาะก่อนออกบิล */
export async function updateMatchResult(matchId: string, form: FormData) {
  return asAdmin(async () => {
    const d = parseResultForm(form);
    const sessionId = await inMatchLock(matchId, async (tx, sessionId) => {
      const m = await tx.match.findUnique({ where: { id: matchId }, include: { session: { select: { status: true } } } });
      if (m?.status !== "DONE") throw new ActionError("แก้ได้เฉพาะเกมที่จบแล้ว");
      if (m.session.status === "CLOSED" && d.shuttles !== m.shuttles) {
        throw new ActionError("ออกบิลแล้ว แก้จำนวนลูกไม่ได้ (แก้ได้แค่ผลการแข่ง) ถ้าจำเป็นให้เปิดรอบอีกครั้งก่อน");
      }
      await tx.match.update({
        where: { id: matchId },
        data: { winner: d.winner, scoreA: d.scoreA, scoreB: d.scoreB, shuttles: d.shuttles },
      });
      return sessionId;
    });
    refresh.session(sessionId);
    refresh.results();
    return { ok: true, message: d.winner ? "บันทึกผลแล้ว" : "บันทึกแล้ว (ยังไม่มีผล)" };
  });
}

/** ยกเลิกได้เฉพาะเกมที่ยังอยู่บนคอร์ท เกมที่จบแล้วนับในบิลและสถิติไปแล้ว */
export async function cancelMatch(matchId: string) {
  return asAdmin(async () => {
    const sessionId = await inMatchLock(matchId, async (tx, sessionId) => {
      const m = await tx.match.findUnique({ where: { id: matchId }, include: { session: { select: { status: true } } } });
      if (m?.status !== "PLAYING") throw new ActionError("ยกเลิกได้เฉพาะเกมที่กำลังเล่นอยู่ ถ้าผลผิดให้ใช้ “แก้ผล”");
      if (m.session.status !== "LIVE") throw new ActionError("รอบนี้ไม่ได้กำลังตีอยู่");
      await tx.match.update({ where: { id: matchId }, data: { status: "CANCELLED", endedAt: new Date() } });
      return sessionId;
    });
    refresh.session(sessionId);
    return { ok: true, message: "ยกเลิกเกมแล้ว (ไม่นับ ไม่คิดค่าลูก)" };
  });
}

/** เปลี่ยนตัว: คนหัวคิวลงแทน แล้วคนที่ออกถูกตั้งเป็นพัก */
export async function substitutePlayer(matchId: string, memberId: string) {
  return asAdmin(async () => {
    const out = await inMatchLock(matchId, async (tx, sessionId) => {
      const m = await tx.match.findUnique({ where: { id: matchId }, include: { players: true } });
      if (m?.status !== "PLAYING") throw new ActionError("เกมนี้จบไปแล้ว");
      const leaving = m.players.find((p) => p.memberId === memberId);
      if (!leaving) throw new ActionError("คนนี้ไม่ได้อยู่ในเกมนี้");
      const { queue, memberName } = deriveState((await loadSession(sessionId, tx))!);
      const sub = queue[0];
      if (!sub) throw new ActionError("ไม่มีคนรอคิวลงแทน");
      await tx.matchPlayer.delete({ where: { matchId_memberId: { matchId, memberId } } });
      await tx.matchPlayer.create({ data: { matchId, memberId: sub.id, team: leaving.team } });
      await tx.participant.update({ where: { sessionId_memberId: { sessionId, memberId } }, data: { status: "RESTING" } });
      return { sessionId, text: `${memberName.get(sub.id)} ลงแทน ${memberName.get(memberId)}` };
    });
    refresh.session(out.sessionId);
    return { ok: true, message: out.text };
  });
}
