"use server";

import { z } from "zod";
import { EXPENSE_CATEGORY } from "@/domain/labels";
import { baht, dateFromISO, toSatang } from "@/lib/format";
import { asAdmin } from "@/server/action";
import { audit } from "@/server/activity";
import { prisma } from "@/server/db";
import { refresh } from "@/server/revalidate";
import { ActionError } from "@/server/viewer";

const expenseSchema = z.object({
  category: z.enum(["COURT", "SHUTTLE", "OTHER"]),
  amount: z.coerce.number({ invalid_type_error: "จำนวนเงินต้องเป็นตัวเลข" }).positive("จำนวนเงินต้องมากกว่า 0").max(1_000_000),
  spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "เลือกวันที่"),
  note: z.string().trim().min(1, "ใส่รายละเอียด เช่น ซื้อลูก 2 หลอด").max(200),
});

export async function addExpense(form: FormData) {
  return asAdmin(async (viewer) => {
    const d = expenseSchema.parse(Object.fromEntries(form));
    const e = await prisma.expense.create({
      data: { category: d.category, amount: toSatang(d.amount), spentAt: dateFromISO(d.spentAt), note: d.note },
    });
    await audit(viewer, {
      type: "expense.add",
      summary: `บันทึกรายจ่าย ${EXPENSE_CATEGORY[e.category]} ${baht(e.amount)}: ${e.note}`,
      data: { expenseId: e.id },
    });
    refresh.money();
    return { ok: true, message: "บันทึกรายจ่ายแล้ว" };
  });
}

export async function deleteExpense(id: string) {
  return asAdmin(async (viewer) => {
    const e = await prisma.expense.findUnique({ where: { id } });
    if (!e) throw new ActionError("ไม่พบรายการนี้");
    if (e.sessionId) throw new ActionError("รายจ่ายนี้มาจากการจบรอบ แก้ที่รอบนั้นแทน");
    await prisma.expense.delete({ where: { id } });
    await audit(viewer, {
      type: "expense.delete",
      summary: `ลบรายจ่าย ${EXPENSE_CATEGORY[e.category]} ${baht(e.amount)}: ${e.note ?? ""}`,
      data: { category: e.category, amount: e.amount, note: e.note, spentAt: e.spentAt.toISOString() },
    });
    refresh.money();
    return { ok: true, message: "ลบรายการแล้ว" };
  });
}
