"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ChargeStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { run } from "@/lib/action";
import { ActionError, requireAdminAction, requireViewerAction } from "@/lib/viewer";
import { dateFromISO, toSatang } from "@/lib/format";
import { normalizePromptpayId } from "@/domain/promptpay";

function refreshMoney(sessionId?: string) {
  revalidatePath("/");
  revalidatePath("/finance");
  revalidatePath("/me");
  if (sessionId) revalidatePath(`/sessions/${sessionId}`);
}

/** สมาชิกแจ้งว่าโอนแล้ว */
export async function reportPaid(chargeId: string) {
  return run(async () => {
    const viewer = await requireViewerAction();
    const c = await prisma.charge.findUnique({ where: { id: chargeId } });
    if (!c) throw new ActionError("ไม่พบบิลนี้");
    if (!viewer.isAdmin && c.memberId !== viewer.member?.id) throw new ActionError("แจ้งโอนได้เฉพาะบิลของตัวเอง");
    if (c.status !== "UNPAID") throw new ActionError("บิลนี้แจ้งโอนหรือชำระแล้ว");
    await prisma.charge.update({ where: { id: chargeId }, data: { status: "REPORTED", reportedAt: new Date() } });
    refreshMoney(c.sessionId);
    revalidatePath(`/pay/${chargeId}`);
    return { ok: true, message: "แจ้งโอนแล้ว รอหัวก๊วนยืนยัน" };
  });
}

/** หัวก๊วนเปลี่ยนสถานะบิล: ยืนยันรับเงิน / ยกเว้น / แก้กลับเป็นยังไม่จ่าย */
export async function setChargeStatus(chargeId: string, status: ChargeStatus) {
  return run(async () => {
    const viewer = await requireAdminAction();
    const c = await prisma.charge.findUnique({ where: { id: chargeId } });
    if (!c) throw new ActionError("ไม่พบบิลนี้");
    await prisma.charge.update({
      where: { id: chargeId },
      data: {
        status,
        paidAt: status === "PAID" ? new Date() : null,
        reportedAt: status === "UNPAID" ? null : c.reportedAt,
        confirmedById: status === "PAID" || status === "WAIVED" ? viewer.user.id : null,
      },
    });
    refreshMoney(c.sessionId);
    revalidatePath(`/pay/${chargeId}`);
    const label = { PAID: "บันทึกว่าได้รับเงินแล้ว", WAIVED: "ยกเว้นบิลนี้แล้ว", UNPAID: "แก้เป็นยังไม่จ่ายแล้ว", REPORTED: "บันทึกแล้ว" }[
      status
    ];
    return { ok: true, message: label };
  });
}

const expenseSchema = z.object({
  category: z.enum(["COURT", "SHUTTLE", "OTHER"]),
  amount: z.coerce.number({ invalid_type_error: "จำนวนเงินต้องเป็นตัวเลข" }).positive("จำนวนเงินต้องมากกว่า 0").max(1_000_000),
  spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "เลือกวันที่"),
  note: z.string().trim().min(1, "ใส่รายละเอียด เช่น ซื้อลูก 2 หลอด").max(200),
});

export async function addExpense(form: FormData) {
  return run(async () => {
    await requireAdminAction();
    const d = expenseSchema.parse(Object.fromEntries(form));
    await prisma.expense.create({
      data: { category: d.category, amount: toSatang(d.amount), spentAt: dateFromISO(d.spentAt), note: d.note },
    });
    refreshMoney();
    return { ok: true, message: "บันทึกรายจ่ายแล้ว" };
  });
}

export async function deleteExpense(id: string) {
  return run(async () => {
    await requireAdminAction();
    const e = await prisma.expense.findUnique({ where: { id } });
    if (!e) throw new ActionError("ไม่พบรายการนี้");
    if (e.sessionId) throw new ActionError("รายจ่ายนี้มาจากการจบรอบ แก้ที่รอบนั้นแทน");
    await prisma.expense.delete({ where: { id } });
    refreshMoney();
    return { ok: true, message: "ลบรายการแล้ว" };
  });
}

const settingsSchema = z.object({
  groupName: z.string().trim().min(1, "ใส่ชื่อก๊วน").max(60),
  promptpayId: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || normalizePromptpayId(v), "พร้อมเพย์ใช้เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก"),
  accountName: z.string().trim().max(80).optional(),
});

export async function updateSettings(form: FormData) {
  return run(async () => {
    await requireAdminAction();
    const d = settingsSchema.parse(Object.fromEntries(form));
    const data = {
      groupName: d.groupName,
      promptpayId: d.promptpayId ? normalizePromptpayId(d.promptpayId)!.value : null,
      accountName: d.accountName || null,
    };
    await prisma.setting.upsert({ where: { id: "main" }, create: { id: "main", ...data }, update: data });
    revalidatePath("/", "layout");
    return { ok: true, message: "บันทึกการตั้งค่าแล้ว" };
  });
}
