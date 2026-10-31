"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Level } from "@prisma/client";
import { prisma } from "@/lib/db";
import { run } from "@/lib/action";
import { ActionError, requireAdminAction, requireViewerAction } from "@/lib/viewer";
import { isLevel } from "@/domain/levels";

const memberSchema = z.object({
  nickname: z.string().trim().min(1, "กรุณาใส่ชื่อเล่น").max(30, "ชื่อเล่นยาวเกินไป"),
  fullName: z.string().trim().max(80).optional(),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .refine((v) => !v || /^[0-9+\-\s]{9,20}$/.test(v), "เบอร์โทรไม่ถูกต้อง"),
  level: z.string().refine(isLevel, "เลือกระดับมือ"),
  note: z.string().trim().max(300).optional(),
});

function parse(form: FormData) {
  const d = memberSchema.parse(Object.fromEntries(form));
  return { nickname: d.nickname, fullName: d.fullName || null, phone: d.phone || null, level: d.level as Level, note: d.note || null };
}

async function assertUniqueNickname(nickname: string, exceptId?: string) {
  const dupe = await prisma.member.findFirst({
    where: { nickname: { equals: nickname, mode: "insensitive" }, active: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
  if (dupe) throw new ActionError(`มีสมาชิกชื่อ “${dupe.nickname}” แล้ว ลองเติมตัวอักษรให้ต่างกัน`);
}

/** ลิงก์ผูกบัญชีใช้ได้ 7 วัน กันลิงก์หลุดไปแล้วคนอื่นใช้ */
const CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createMember(form: FormData) {
  return run(async () => {
    await requireAdminAction();
    const data = parse(form);
    await assertUniqueNickname(data.nickname);
    const m = await prisma.member.create({ data });
    revalidatePath("/members");
    return { ok: true, message: `เพิ่ม ${m.nickname} แล้ว`, redirect: `/members/${m.id}` };
  });
}

export async function updateMember(id: string, form: FormData) {
  return run(async () => {
    const viewer = await requireViewerAction();
    if (!viewer.isAdmin && viewer.member?.id !== id) throw new ActionError("แก้ได้เฉพาะโปรไฟล์ของตัวเอง");
    const data = parse(form);
    await assertUniqueNickname(data.nickname, id);
    // Members may not edit the organiser's private note about them.
    await prisma.member.update({ where: { id }, data: viewer.isAdmin ? data : { ...data, note: undefined } });
    revalidatePath(`/members/${id}`);
    revalidatePath("/me");
    return { ok: true, message: "บันทึกแล้ว" };
  });
}

export async function setMemberActive(id: string, active: boolean) {
  return run(async () => {
    await requireAdminAction();
    await prisma.member.update({ where: { id }, data: { active } });
    revalidatePath(`/members/${id}`);
    revalidatePath("/members");
    return { ok: true, message: active ? "เปิดใช้งานสมาชิกแล้ว" : "ย้ายไปสมาชิกที่ไม่ได้มาแล้ว" };
  });
}

/** สร้างลิงก์ให้สมาชิกที่หัวก๊วนเพิ่มไว้ มาผูกกับบัญชี LINE ของตัวเอง */
export async function createClaimLink(id: string) {
  return run(async () => {
    await requireAdminAction();
    const m = await prisma.member.findUnique({ where: { id } });
    if (!m) throw new ActionError("ไม่พบสมาชิก");
    if (m.userId) throw new ActionError("สมาชิกคนนี้ผูกบัญชีแล้ว");
    await prisma.member.update({
      where: { id },
      data: { claimToken: randomBytes(12).toString("base64url"), claimExpiresAt: new Date(Date.now() + CLAIM_TTL_MS) },
    });
    revalidatePath(`/members/${id}`);
    return { ok: true, message: "สร้างลิงก์แล้ว" };
  });
}

export async function claimMember(token: string) {
  return run(async () => {
    const viewer = await requireViewerAction();
    if (viewer.member) throw new ActionError(`บัญชีนี้เป็น “${viewer.member.nickname}” อยู่แล้ว`);
    const m = await prisma.member.findUnique({ where: { claimToken: token } });
    if (!m || m.userId || !m.claimExpiresAt || m.claimExpiresAt < new Date())
      throw new ActionError("ลิงก์นี้ใช้ไม่ได้แล้ว ขอลิงก์ใหม่จากหัวก๊วน");
    await prisma.member.update({ where: { id: m.id }, data: { userId: viewer.user.id, claimToken: null, claimExpiresAt: null } });
    revalidatePath("/");
    return { ok: true, message: `ยินดีต้อนรับ ${m.nickname}`, redirect: "/" };
  });
}

/** ผู้ใช้ใหม่ที่ล็อกอินครั้งแรก สร้างโปรไฟล์สมาชิกของตัวเอง */
export async function createMyProfile(form: FormData) {
  return run(async () => {
    const viewer = await requireViewerAction();
    if (viewer.member) return { ok: true, redirect: "/" };
    const data = parse(form);
    await assertUniqueNickname(data.nickname);
    await prisma.member.create({ data: { ...data, note: null, userId: viewer.user.id } });
    revalidatePath("/");
    return { ok: true, message: `ยินดีต้อนรับ ${data.nickname}`, redirect: "/" };
  });
}

export async function setUserRole(userId: string, role: "ADMIN" | "MEMBER") {
  return run(async () => {
    const viewer = await requireAdminAction();
    if (userId === viewer.user.id && role === "MEMBER") {
      const admins = await prisma.user.count({ where: { role: "ADMIN" } });
      if (admins <= 1) throw new ActionError("ต้องมีหัวก๊วนอย่างน้อย 1 คน");
    }
    await prisma.user.update({ where: { id: userId }, data: { role } });
    revalidatePath("/settings");
    revalidatePath("/members");
    return { ok: true, message: role === "ADMIN" ? "ตั้งเป็นหัวก๊วนแล้ว" : "ตั้งเป็นสมาชิกแล้ว" };
  });
}
