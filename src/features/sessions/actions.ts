"use server";

import { paths } from "@/lib/paths";
import { thaiDate } from "@/lib/format";
import { asAdmin } from "@/server/action";
import { audit } from "@/server/activity";
import { prisma } from "@/server/db";
import { inSessionLock } from "@/server/lock";
import { refresh } from "@/server/revalidate";
import { ActionError } from "@/server/viewer";
import { assignCourts } from "./engine";
import { parseSessionForm } from "./schema";
import { deriveState, loadSession } from "./state";

export async function createSession(form: FormData) {
  return asAdmin(async (viewer) => {
    const { courtNames, data } = parseSessionForm(form);
    const s = await prisma.session.create({
      data: { ...data, courts: { create: courtNames.map((name, position) => ({ name, position })) } },
    });
    // Next time, the form starts from what was used last.
    const defaults = { defaultVenue: data.venue, defaultCourtRate: data.courtRate, defaultShuttlePrice: data.shuttlePrice };
    await prisma.setting.upsert({ where: { id: "main" }, create: { id: "main", ...defaults }, update: defaults });
    await audit(viewer, { type: "session.create", sessionId: s.id, summary: `เปิดรอบ ${data.venue} ${thaiDate(data.date)}` });
    refresh.session(s.id);
    return { ok: true, message: "เปิดรอบแล้ว", redirect: paths.session(s.id) };
  });
}

export async function updateSession(id: string, form: FormData) {
  return asAdmin(async (viewer) => {
    const { courtNames, data } = parseSessionForm(form);
    await inSessionLock(id, async (tx) => {
      const s = await loadSession(id, tx);
      if (!s) throw new ActionError("ไม่พบรอบนี้");
      if (s.status === "CLOSED") throw new ActionError("รอบนี้ปิดแล้ว เปิดรอบอีกครั้งก่อนแก้ไข");
      // Keep existing courts (they hold game history): rename, add, or remove empty ones.
      for (let i = 0; i < Math.max(courtNames.length, s.courts.length); i++) {
        const court = s.courts[i];
        if (court && i < courtNames.length) {
          if (court.name !== courtNames[i]) await tx.court.update({ where: { id: court.id }, data: { name: courtNames[i] } });
        } else if (!court) {
          await tx.court.create({ data: { sessionId: id, name: courtNames[i], position: i } });
        } else {
          if (s.matches.some((m) => m.courtId === court.id)) throw new ActionError(`คอร์ท ${court.name} มีเกมแล้ว ลบออกไม่ได้`);
          await tx.court.delete({ where: { id: court.id } });
        }
      }
      await tx.session.update({ where: { id }, data });
      const money = (x: { courtRate: number; shuttlePrice: number; feeMode: string; flatFee: number }) => ({
        courtRate: x.courtRate,
        shuttlePrice: x.shuttlePrice,
        feeMode: x.feeMode,
        flatFee: x.flatFee,
      });
      await audit(
        viewer,
        {
          type: "session.update",
          sessionId: id,
          summary: "แก้ไขรายละเอียดรอบ",
          data: { before: { ...money(s), courts: s.courts.map((c) => c.name) }, after: { ...money(data), courts: courtNames } },
        },
        tx,
      );
    });
    refresh.session(id);
    return { ok: true, message: "บันทึกแล้ว", redirect: paths.session(id) };
  });
}

export async function startSession(id: string) {
  return asAdmin(async (viewer) => {
    const made = await inSessionLock(id, async (tx) => {
      const s = await loadSession(id, tx);
      if (!s) throw new ActionError("ไม่พบรอบนี้");
      if (s.status !== "OPEN") throw new ActionError("รอบนี้เริ่มไปแล้ว");
      await tx.session.update({ where: { id }, data: { status: "LIVE", startedAt: new Date() } });
      await audit(viewer, { type: "session.start", sessionId: id, summary: `เริ่มตี (${s.participants.length} คน)` }, tx);
      return (await assignCourts(tx, id)).length; // everyone starts in the queue in sign-up order
    });
    refresh.session(id);
    return { ok: true, message: made ? `เริ่มแล้ว จัดคู่ลง ${made} คอร์ท` : "เริ่มแล้ว รอคนครบ 4 คน" };
  });
}

/** จบรอบ: ยกเลิกเกมที่ค้าง ออกบิลให้ทุกคน และบันทึกรายจ่ายค่าคอร์ท/ค่าลูก */
export async function closeSession(id: string) {
  return asAdmin(async (viewer) => {
    await inSessionLock(id, async (tx) => {
      const before = await loadSession(id, tx);
      if (!before) throw new ActionError("ไม่พบรอบนี้");
      if (before.status === "CLOSED") throw new ActionError("รอบนี้ปิดไปแล้ว");
      await tx.match.updateMany({ where: { sessionId: id, status: "PLAYING" }, data: { status: "CANCELLED", endedAt: new Date() } });

      const s = (await loadSession(id, tx))!;
      const { fees } = deriveState(s);
      const existing = new Map(s.charges.map((c) => [c.memberId, c]));
      for (const f of fees.members) {
        const prev = existing.get(f.memberId);
        const amounts = { courtFee: f.courtFee, shuttleFee: f.shuttleFee, shuttleCount: f.shuttleCount, total: f.total };
        // Never change a bill someone has already paid or reported.
        if (prev) await tx.charge.update({ where: { id: prev.id }, data: prev.status === "UNPAID" ? amounts : {} });
        else await tx.charge.create({ data: { ...amounts, sessionId: id, memberId: f.memberId } });
      }

      await tx.expense.deleteMany({ where: { sessionId: id, category: { in: ["COURT", "SHUTTLE"] } } });
      await tx.expense.createMany({
        data: [
          { sessionId: id, category: "COURT", amount: fees.courtCost, spentAt: s.date, note: `${s.courts.length} คอร์ท` },
          ...(fees.shuttleCost
            ? [{ sessionId: id, category: "SHUTTLE" as const, amount: fees.shuttleCost, spentAt: s.date, note: `${fees.shuttlesUsed} ลูก` }]
            : []),
        ],
      });
      await tx.session.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } });
      await audit(
        viewer,
        {
          type: "session.close",
          sessionId: id,
          summary: `จบรอบ ออกบิล ${fees.members.length} คน รวม ฿${Math.round(fees.billed / 100)}`,
          data: { billed: fees.billed, courtCost: fees.courtCost, shuttleCost: fees.shuttleCost, shuttlesUsed: fees.shuttlesUsed },
        },
        tx,
      );
    });
    refresh.session(id);
    refresh.money();
    return { ok: true, message: "จบรอบแล้ว ออกบิลให้ทุกคนแล้ว" };
  });
}

export async function reopenSession(id: string) {
  return asAdmin(async (viewer) => {
    await inSessionLock(id, async (tx) => {
      const paid = await tx.charge.count({ where: { sessionId: id, status: { in: ["PAID", "REPORTED"] } } });
      if (paid) throw new ActionError("มีคนจ่ายหรือแจ้งโอนแล้ว เปิดรอบใหม่ไม่ได้ ให้แก้ทีละบิลแทน");
      await tx.charge.deleteMany({ where: { sessionId: id } });
      await tx.expense.deleteMany({ where: { sessionId: id, category: { in: ["COURT", "SHUTTLE"] } } });
      await tx.session.update({ where: { id }, data: { status: "LIVE", closedAt: null } });
      await audit(viewer, { type: "session.reopen", sessionId: id, summary: "เปิดรอบอีกครั้ง (ลบบิลที่ยังไม่จ่ายออก)" }, tx);
    });
    refresh.session(id);
    refresh.money();
    return { ok: true, message: "เปิดรอบอีกครั้งแล้ว" };
  });
}

export async function deleteSession(id: string) {
  return asAdmin(async (viewer) => {
    const paid = await prisma.charge.count({ where: { sessionId: id, status: "PAID" } });
    if (paid) throw new ActionError("รอบนี้มีการรับเงินแล้ว ลบไม่ได้ (เพื่อให้บัญชีตรง)");
    const s = await prisma.session.findUnique({ where: { id }, include: { _count: { select: { participants: true, matches: true } } } });
    if (!s) throw new ActionError("ไม่พบรอบนี้");
    // Not linked to the session (that row is about to go); keep what was deleted in data.
    await audit(viewer, {
      type: "session.delete",
      summary: `ลบรอบ ${s.venue} ${thaiDate(s.date)}`,
      data: { sessionId: id, venue: s.venue, date: s.date.toISOString(), players: s._count.participants, games: s._count.matches },
    });
    await prisma.$transaction([
      prisma.matchPlayer.deleteMany({ where: { match: { sessionId: id } } }),
      prisma.charge.deleteMany({ where: { sessionId: id } }),
      prisma.session.delete({ where: { id } }),
    ]);
    refresh.session(id);
    refresh.money();
    return { ok: true, message: "ลบรอบแล้ว", redirect: paths.sessions };
  });
}
