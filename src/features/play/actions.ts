"use server";

import { asAdmin } from "@/server/action";
import { audit } from "@/server/activity";
import { inMatchLock, inSessionLock, type Tx } from "@/server/lock";
import { refresh } from "@/server/revalidate";
import { ActionError } from "@/server/viewer";
import { assignCourts } from "@/features/sessions/engine";
import { deriveState, loadSession } from "@/features/sessions/state";
import { parseResultForm } from "./result-schema";

export async function fillCourts(sessionId: string, courtId?: string) {
  return asAdmin(async () => {
    const created = await inSessionLock(sessionId, (tx) => assignCourts(tx, sessionId, courtId ? [courtId] : undefined));
    refresh.session(sessionId);
    if (!created.length) throw new ActionError("คนรอคิวไม่พอ ต้องมีอย่างน้อย 4 คน");
    return { ok: true, message: `จัดคู่แล้ว ${created.length} คอร์ท` };
  });
}

/** จบเกม: บันทึกผล (ไม่บังคับ) แล้วจัดเกมถัดไปลงคอร์ทเดิมทันที */
export async function finishMatch(matchId: string, form: FormData) {
  return asAdmin(async (viewer) => {
    const d = parseResultForm(form);
    const out = await inMatchLock(matchId, async (tx, sessionId) => {
      const m = await tx.match.findUnique({ where: { id: matchId }, include: { players: true, court: true } });
      if (m?.status !== "PLAYING") throw new ActionError("เกมนี้บันทึกไปแล้ว");
      const endedAt = new Date();
      const playerIds = m.players.map((p) => p.memberId);
      const queuedBefore = await tx.participant.findMany({
        where: { sessionId, memberId: { in: playerIds } },
        select: { memberId: true, queuedAt: true },
      });

      await tx.match.update({
        where: { id: matchId },
        data: { status: "DONE", winner: d.winner, scoreA: d.scoreA, scoreB: d.scoreB, shuttles: d.shuttles, endedAt },
      });
      // The four players go to the back of the queue.
      await tx.participant.updateMany({ where: { sessionId, memberId: { in: playerIds } }, data: { queuedAt: endedAt } });
      const nextMatchIds = await assignCourts(tx, sessionId, [m.courtId]);

      await audit(
        viewer,
        {
          type: "match.finish",
          sessionId,
          summary: `จบเกมคอร์ท ${m.court.name}: ${await describeGame(tx, matchId)}`,
          // Enough to undo: where each player was in the queue, and which game was started next.
          data: {
            matchId,
            queuedBefore: queuedBefore.map((q) => ({ memberId: q.memberId, queuedAt: q.queuedAt.toISOString() })),
            nextMatchIds,
          },
        },
        tx,
      );
      return { sessionId, court: m.court.name, made: nextMatchIds.length };
    });
    refresh.session(out.sessionId);
    refresh.results();
    return { ok: true, message: out.made ? `บันทึกแล้ว · เกมใหม่ลงคอร์ท ${out.court}` : "บันทึกแล้ว · คนรอไม่พอจัดเกมใหม่" };
  });
}

/** แก้ผลเกมที่จบแล้ว (เช่น ลืมใส่แต้ม) ค่าลูกแก้ได้เฉพาะก่อนออกบิล */
export async function updateMatchResult(matchId: string, form: FormData) {
  return asAdmin(async (viewer) => {
    const d = parseResultForm(form);
    const sessionId = await inMatchLock(matchId, async (tx, sessionId) => {
      const m = await tx.match.findUnique({ where: { id: matchId }, include: { session: { select: { status: true } } } });
      if (m?.status !== "DONE") throw new ActionError("แก้ได้เฉพาะเกมที่จบแล้ว");
      if (m.session.status === "CLOSED" && d.shuttles !== m.shuttles) {
        throw new ActionError("ออกบิลแล้ว แก้จำนวนลูกไม่ได้ (แก้ได้แค่ผลการแข่ง) ถ้าจำเป็นให้เปิดรอบอีกครั้งก่อน");
      }
      const after = { winner: d.winner, scoreA: d.scoreA, scoreB: d.scoreB, shuttles: d.shuttles };
      await tx.match.update({ where: { id: matchId }, data: after });
      await audit(
        viewer,
        {
          type: "match.result",
          sessionId,
          summary: `แก้ผลเกม: ${await describeGame(tx, matchId)}`,
          data: { matchId, before: { winner: m.winner, scoreA: m.scoreA, scoreB: m.scoreB, shuttles: m.shuttles }, after },
        },
        tx,
      );
      return sessionId;
    });
    refresh.session(sessionId);
    refresh.results();
    return { ok: true, message: d.winner ? "บันทึกผลแล้ว" : "บันทึกแล้ว (ยังไม่มีผล)" };
  });
}

/** ยกเลิกได้เฉพาะเกมที่ยังอยู่บนคอร์ท เกมที่จบแล้วนับในบิลและสถิติไปแล้ว */
export async function cancelMatch(matchId: string) {
  return asAdmin(async (viewer) => {
    const sessionId = await inMatchLock(matchId, async (tx, sessionId) => {
      const m = await tx.match.findUnique({ where: { id: matchId }, include: { session: { select: { status: true } } } });
      if (m?.status !== "PLAYING") throw new ActionError("ยกเลิกได้เฉพาะเกมที่กำลังเล่นอยู่ ถ้าผลผิดให้ใช้ “แก้ผล”");
      if (m.session.status !== "LIVE") throw new ActionError("รอบนี้ไม่ได้กำลังตีอยู่");
      await tx.match.update({ where: { id: matchId }, data: { status: "CANCELLED", endedAt: new Date() } });
      await audit(
        viewer,
        { type: "match.cancel", sessionId, summary: `ยกเลิกเกม: ${await describeGame(tx, matchId)}`, data: { matchId } },
        tx,
      );
      return sessionId;
    });
    refresh.session(sessionId);
    return { ok: true, message: "ยกเลิกเกมแล้ว (ไม่นับ ไม่คิดค่าลูก)" };
  });
}

/** เปลี่ยนตัว: คนหัวคิวลงแทน แล้วคนที่ออกถูกตั้งเป็นพัก */
export async function substitutePlayer(matchId: string, memberId: string) {
  return asAdmin(async (viewer) => {
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
      const text = `${memberName.get(sub.id)} ลงแทน ${memberName.get(memberId)}`;
      await audit(
        viewer,
        { type: "match.substitute", sessionId, summary: `เปลี่ยนตัว: ${text}`, data: { matchId, out: memberId, in: sub.id } },
        tx,
      );
      return { sessionId, text };
    });
    refresh.session(out.sessionId);
    return { ok: true, message: out.text };
  });
}

/** "ต้น + เอ vs บีม + ฝน 21–17 · 2 ลูก" for history entries. */
async function describeGame(tx: Tx, matchId: string) {
  const m = await tx.match.findUnique({
    where: { id: matchId },
    include: { players: { include: { member: { select: { nickname: true } } } } },
  });
  if (!m) return "";
  const team = (t: "A" | "B") =>
    m.players
      .filter((p) => p.team === t)
      .map((p) => p.member.nickname)
      .join(" + ");
  const result =
    m.scoreA !== null && m.scoreB !== null ? ` ${m.scoreA}–${m.scoreB}` : m.winner ? ` (${team(m.winner)} ชนะ)` : " (ไม่ได้บันทึกผล)";
  return `${team("A")} vs ${team("B")}${result} · ${m.shuttles} ลูก`;
}

/** How long after "จบเกม" the organiser can still take it back. */
const UNDO_WINDOW_MS = 10 * 60 * 1000;

type FinishRecord = { matchId: string; queuedBefore: { memberId: string; queuedAt: string }[]; nextMatchIds: string[] };

/**
 * ย้อนการจบเกม (กดพลาด): เกมกลับไปอยู่บนคอร์ท ผลถูกล้าง คิวกลับเหมือนเดิม
 * และเกมถัดไปที่ระบบเพิ่งจัดลงคอร์ทเดียวกันถูกยกเลิก ทำได้เฉพาะถ้ายังไม่มีอะไรเปลี่ยนต่อจากนั้น
 */
export async function undoFinishMatch(matchId: string) {
  return asAdmin(async (viewer) => {
    const sessionId = await inMatchLock(matchId, async (tx, sessionId) => {
      const m = await tx.match.findUnique({ where: { id: matchId }, include: { session: { select: { status: true } } } });
      if (m?.status !== "DONE" || !m.endedAt) throw new ActionError("เกมนี้ไม่ได้อยู่ในสถานะจบแล้ว");
      if (m.session.status !== "LIVE") throw new ActionError("รอบนี้ไม่ได้กำลังตีอยู่ ใช้ “แก้ผล” แทน");
      if (Date.now() - m.endedAt.getTime() > UNDO_WINDOW_MS) throw new ActionError("เกินเวลาย้อนกลับแล้ว ใช้ “แก้ผล” แทน");

      const finish = await tx.activity.findFirst({ where: { type: "match.finish", sessionId }, orderBy: { at: "desc" } });
      const record = finish?.data as FinishRecord | null;
      if (record?.matchId !== matchId) throw new ActionError("มีการจบเกมอื่นต่อจากนี้แล้ว ย้อนกลับไม่ได้ ใช้ “แก้ผล” แทน");

      // The game started automatically afterwards must still be untouched on court.
      const next = await tx.match.findMany({ where: { id: { in: record.nextMatchIds } } });
      if (next.some((n) => n.status !== "PLAYING")) throw new ActionError("เกมถัดไปเล่นจบไปแล้ว ย้อนกลับไม่ได้ ใช้ “แก้ผล” แทน");
      await tx.match.deleteMany({ where: { id: { in: record.nextMatchIds } } });

      for (const q of record.queuedBefore) {
        await tx.participant.updateMany({ where: { sessionId, memberId: q.memberId }, data: { queuedAt: new Date(q.queuedAt) } });
      }
      await tx.match.update({
        where: { id: matchId },
        data: { status: "PLAYING", endedAt: null, winner: null, scoreA: null, scoreB: null, shuttles: 0 },
      });
      await audit(
        viewer,
        { type: "match.undo", sessionId, summary: `ย้อนการจบเกม: ${await describeGame(tx, matchId)}`, data: { matchId } },
        tx,
      );
      return sessionId;
    });
    refresh.session(sessionId);
    refresh.results();
    return { ok: true, message: "ย้อนกลับแล้ว เกมกลับมาอยู่บนคอร์ท" };
  });
}
