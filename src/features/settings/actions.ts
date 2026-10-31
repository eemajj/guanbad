"use server";

import { z } from "zod";
import { normalizePromptpayId } from "@/domain/promptpay";
import { asAdmin } from "@/server/action";
import { prisma } from "@/server/db";
import { refresh } from "@/server/revalidate";

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
  return asAdmin(async () => {
    const d = settingsSchema.parse(Object.fromEntries(form));
    const data = {
      groupName: d.groupName,
      promptpayId: d.promptpayId ? normalizePromptpayId(d.promptpayId)!.value : null,
      accountName: d.accountName || null,
    };
    await prisma.setting.upsert({ where: { id: "main" }, create: { id: "main", ...data }, update: data });
    refresh.everything();
    return { ok: true, message: "บันทึกการตั้งค่าแล้ว" };
  });
}
