"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { run } from "@/lib/action";
import { ActionError, requireAdminAction } from "@/lib/viewer";
import { dateFromISO, toSatang } from "@/lib/format";
import { deriveState, loadSession } from "@/server/session-state";
import { assignCourts, lockSession } from "@/server/match-engine";

const time = z.string().regex(/^\d{2}:\d{2}$/, "เวลาไม่ถูกต้อง");
const money = (label: string) => z.coerce.number({ invalid_type_error: `${label}ต้องเป็นตัวเลข` }).min(0, `${label}ต้องไม่ติดลบ`).max(100000);

const sessionSchema = z.object({
  venue: z.string().trim().min(1, "กรุณาใส่ชื่อสนาม").max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาเลือกวันที่"),
  startTime: time,
  endTime: time,
  courts: z
    .string()
    .transform((v) => v.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(10)).min(1, "ต้องมีอย่างน้อย 1 คอร์ท").max(12, "สูงสุด 12 คอร์ท")),
  courtRate: money("ค่าคอร์ท"),
  shuttlePrice: money("ราคาลูก"),
  feeMode: z.enum(["SPLIT", "FLAT"]),
  flatFee: money("ค่าคอร์ทต่อหัว").default(0),
  maxPlayers: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(4, "รับขั้นต่ำ 4 คน").max(200).nullable()),
  selfSignup: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  note: z.string().trim().max(500).optional(),
});

function parse(form: FormData) {
  const d = sessionSchema.parse(Object.fromEntries(form));
  return {
    venue: d.venue,
    date: dateFromISO(d.date),
    startTime: d.startTime,
    endTime: d.endTime,
    courtRate: toSatang(d.courtRate),
    shuttlePrice: toSatang(d.shuttlePrice),
    feeMode: d.feeMode,
    flatFee: toSatang(d.flatFee ?? 0),
    maxPlayers: d.maxPlayers,
    selfSignup: d.selfSignup,
    note: d.note || null,
    courtNames: d.courts,
  };
}

export async function createSession(form: FormData) {
  return run(async () => {
    await requireAdminAction();
    const { courtNames, ...data } = parse(form);
    const s = await prisma.session.create({
      data: { ...data, courts: { create: courtNames.map((name, position) => ({ name, position })) } },
    });
    await prisma.setting.upsert({
      where: { id: "main" },
      create: { id: "main", defaultVenue: data.venue, defaultCourtRate: data.courtRate, defaultShuttlePrice: data.shuttlePrice },
      update: { defaultVenue: data.venue, defaultCourtRate: data.courtRate, defaultShuttlePrice: data.shuttlePrice },
    });
    revalidatePath("/sessions");
    return { ok: true, message: "เปิดรอบแล้ว", redirect: `/sessions/${s.id}` };
  });
}

export async function updateSession(id: string, form: FormData) {
  return run(async () => {
    await requireAdminAction();
    const { courtNames, ...data } = parse(form);
    await prisma.$transaction(async (tx) => {
      await lockSession(tx, id);
      const s = await loadSession(id, tx);
      if (!s) throw new ActionError("ไม่พบรอบนี้");
      if (s.status === "CLOSED") throw new ActionError("รอบนี้ปิดแล้ว เปิดรอบอีกครั้งก่อนแก้ไข");
      // Keep existing courts (they hold match history); rename, add, or remove empty ones.
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
    });
    revalidatePath(`/sessions/${id}`);
    return { ok: true, message: "บันทึกแล้ว", redirect: `/sessions/${id}` };
  });
}

export async function startSession(id: string) {
  return run(async () => {
    await requireAdminAction();
    const made = await prisma.$transaction(async (tx) => {
      await lockSession(tx, id);
      const s = await loadSession(id, tx);
      if (!s) throw new ActionError("ไม่พบรอบนี้");
      if (s.status !== "OPEN") throw new ActionError("รอบนี้เริ่มไปแล้ว");
      await tx.session.update({ where: { id }, data: { status: "LIVE", startedAt: new Date() } });
      // Everyone starts in the queue in sign-up order.
      return assignCourts(tx, id);
    });
    revalidatePath(`/sessions/${id}`);
    return { ok: true, message: made ? `เริ่มแล้ว จัดคู่ลง ${made} คอร์ท` : "เริ่มแล้ว รอคนครบ 4 คน" };
  });
}

/** จบรอบ: ยกเลิกเกมที่ค้าง แล้วออกบิลให้ทุกคน + บันทึกรายจ่ายค่าคอร์ท/ค่าลูก */
export async function closeSession(id: string) {
  return run(async () => {
    await requireAdminAction();
    await prisma.$transaction(async (tx) => {
      await lockSession(tx, id);
      const before = await loadSession(id, tx);
      if (!before) throw new ActionError("ไม่พบรอบนี้");
      if (before.status === "CLOSED") throw new ActionError("รอบนี้ปิดไปแล้ว");
      await tx.match.updateMany({ where: { sessionId: id, status: "PLAYING" }, data: { status: "CANCELLED", endedAt: new Date() } });
      const s = (await loadSession(id, tx))!;
      const { fees } = deriveState(s);

      const existing = new Map(s.charges.map((c) => [c.memberId, c]));
      for (const f of fees.members) {
        const prev = existing.get(f.memberId);
        const data = { courtFee: f.courtFee, shuttleFee: f.shuttleFee, shuttleCount: f.shuttleCount, total: f.total };
        if (prev) await tx.charge.update({ where: { id: prev.id }, data: prev.status === "UNPAID" ? data : {} });
        else await tx.charge.create({ data: { ...data, sessionId: id, memberId: f.memberId } });
      }
      await tx.expense.deleteMany({ where: { sessionId: id, category: { in: ["COURT", "SHUTTLE"] } } });
      await tx.expense.createMany({
        data: [
          { sessionId: id, category: "COURT", amount: fees.courtCost, spentAt: s.date, note: `${s.courts.length} คอร์ท` },
          ...(fees.shuttleCost ? [{ sessionId: id, category: "SHUTTLE" as const, amount: fees.shuttleCost, spentAt: s.date, note: `${fees.shuttlesUsed} ลูก` }] : []),
        ],
      });
      await tx.session.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } });
    });
    revalidatePath(`/sessions/${id}`);
    revalidatePath("/");
    return { ok: true, message: "จบรอบแล้ว ออกบิลให้ทุกคนแล้ว" };
  });
}

export async function reopenSession(id: string) {
  return run(async () => {
    await requireAdminAction();
    await prisma.$transaction(async (tx) => {
      await lockSession(tx, id);
      const paid = await tx.charge.count({ where: { sessionId: id, status: { in: ["PAID", "REPORTED"] } } });
      if (paid) throw new ActionError("มีคนจ่ายหรือแจ้งโอนแล้ว เปิดรอบใหม่ไม่ได้ ให้แก้ทีละบิลแทน");
      await tx.charge.deleteMany({ where: { sessionId: id } });
      await tx.expense.deleteMany({ where: { sessionId: id, category: { in: ["COURT", "SHUTTLE"] } } });
      await tx.session.update({ where: { id }, data: { status: "LIVE", closedAt: null } });
    });
    revalidatePath(`/sessions/${id}`);
    return { ok: true, message: "เปิดรอบอีกครั้งแล้ว" };
  });
}

export async function deleteSession(id: string) {
  return run(async () => {
    await requireAdminAction();
    const paid = await prisma.charge.count({ where: { sessionId: id, status: "PAID" } });
    if (paid) throw new ActionError("รอบนี้มีการรับเงินแล้ว ลบไม่ได้ (เพื่อให้บัญชีตรง)");
    await prisma.$transaction([
      prisma.matchPlayer.deleteMany({ where: { match: { sessionId: id } } }),
      prisma.charge.deleteMany({ where: { sessionId: id } }),
      prisma.session.delete({ where: { id } }),
    ]);
    revalidatePath("/sessions");
    return { ok: true, message: "ลบรอบแล้ว", redirect: "/sessions" };
  });
}
