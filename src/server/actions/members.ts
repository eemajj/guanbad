"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Level, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { run } from "@/lib/action";
import { ActionError, requireAdminAction, requireViewerAction } from "@/lib/viewer";
import { isLevel } from "@/domain/levels";
import { ADMIN_PIN_MIN, checkNewPin } from "@/domain/pin";
import { checkMemberPin, newPinData } from "@/server/pin";
import { usableAdminWhere } from "@/server/setup";

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
    if (active) {
      const m = await prisma.member.findUnique({ where: { id } });
      if (m) await assertUniqueNickname(m.nickname, id); // two identical names on the login screen would be ambiguous
    }
    await prisma.$transaction(async (tx) => {
      await lockRoles(tx);
      if (!active && (await usableAdmins(tx, id)) === 0) throw new ActionError("ต้องมีหัวก๊วนที่เข้าระบบได้อย่างน้อย 1 คน");
      await tx.member.update({ where: { id }, data: { active } });
    });
    revalidatePath(`/members/${id}`);
    revalidatePath("/members");
    return { ok: true, message: active ? "เปิดใช้งานสมาชิกแล้ว" : "ย้ายไปสมาชิกที่ไม่ได้มาแล้ว" };
  });
}

type Tx = Prisma.TransactionClient;

/** Serialise role and PIN changes, so two organisers acting at once can't leave the club with no usable admin. */
const lockRoles = (tx: Tx) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('user-roles'))`;

const usableAdmins = (tx: Tx, exceptMemberId?: string) => tx.user.count({ where: usableAdminWhere(exceptMemberId) });

/** หัวก๊วนตั้ง PIN ให้สมาชิก (ครั้งแรก หรือเมื่อลืม/ถูกล็อก) ทุกเครื่องที่ล็อกอินค้างไว้จะหลุด */
export async function setMemberPin(memberId: string, form: FormData) {
  return run(async () => {
    const viewer = await requireAdminAction();
    if (memberId === viewer.member.id) throw new ActionError("เปลี่ยน PIN ของตัวเองที่หน้า “ของฉัน”");
    const pin = String(form.get("pin") ?? "").trim();
    const data = await newPinData(pin);
    const nickname = await prisma.$transaction(async (tx) => {
      await lockRoles(tx); // so a promotion can't slip in between the length check and the write
      const m = await tx.member.findUnique({ where: { id: memberId }, include: { user: true } });
      if (!m) throw new ActionError("ไม่พบสมาชิก");
      const problem = checkNewPin(pin, m.user?.role === "ADMIN");
      if (problem) throw new ActionError(problem);
      await tx.member.update({ where: { id: memberId }, data });
      return m.nickname;
    });
    revalidatePath(`/members/${memberId}`);
    return { ok: true, message: `ตั้ง PIN ให้ ${nickname} แล้ว ส่งให้เขาทางแชทส่วนตัว` };
  });
}

/** สมาชิกเปลี่ยน PIN ของตัวเอง ต้องใส่ PIN เดิมก่อน แล้วเข้าระบบใหม่ด้วย PIN ใหม่ */
export async function changeMyPin(form: FormData) {
  return run(async () => {
    const viewer = await requireViewerAction();
    const current = String(form.get("current") ?? "");
    const pin = String(form.get("pin") ?? "").trim();
    if (pin !== String(form.get("confirm") ?? "").trim()) throw new ActionError("PIN ใหม่สองช่องไม่ตรงกัน");
    const check = await checkMemberPin(viewer.member.id, current, null);
    if (!check.ok) throw new ActionError(check.reason === "wrong" ? "PIN เดิมไม่ถูกต้อง" : "PIN ถูกล็อกชั่วคราว ลองใหม่ภายหลัง หรือให้หัวก๊วนตั้งให้");
    const data = await newPinData(pin);
    await prisma.$transaction(async (tx) => {
      await lockRoles(tx); // re-read the role under the lock, so a promotion can't leave an admin with a short PIN
      const me = await tx.user.findUniqueOrThrow({ where: { id: viewer.user.id } });
      const problem = checkNewPin(pin, me.role === "ADMIN");
      if (problem) throw new ActionError(problem);
      await tx.member.update({ where: { id: viewer.member.id }, data });
    });
    return { ok: true, message: "เปลี่ยน PIN แล้ว เข้าสู่ระบบใหม่ด้วย PIN ใหม่", redirect: "/login" };
  });
}

export async function setMemberRole(memberId: string, role: "ADMIN" | "MEMBER") {
  return run(async () => {
    await requireAdminAction();
    await prisma.$transaction(async (tx) => {
      await lockRoles(tx);
      const m = await tx.member.findUnique({ where: { id: memberId }, include: { user: true } });
      if (!m) throw new ActionError("ไม่พบสมาชิก");
      if (role === "ADMIN") {
        if (!m.pinHash || (m.pinLength ?? 0) < ADMIN_PIN_MIN) throw new ActionError(`ตั้ง PIN ${ADMIN_PIN_MIN} หลักขึ้นไปให้ ${m.nickname} ก่อน แล้วค่อยตั้งเป็นหัวก๊วน`);
        const userId = m.userId ?? (await tx.user.create({ data: { name: m.nickname } })).id;
        await tx.user.update({ where: { id: userId }, data: { role } });
        if (!m.userId) await tx.member.update({ where: { id: m.id }, data: { userId } });
        return;
      }
      if (!m.user) return;
      if (m.user.role === "ADMIN" && (await usableAdmins(tx, m.id)) === 0) throw new ActionError("ต้องมีหัวก๊วนที่เข้าระบบได้อย่างน้อย 1 คน");
      await tx.user.update({ where: { id: m.user.id }, data: { role } });
    });
    revalidatePath("/settings");
    revalidatePath("/members");
    revalidatePath(`/members/${memberId}`);
    return { ok: true, message: role === "ADMIN" ? "ตั้งเป็นหัวก๊วนแล้ว" : "ตั้งเป็นสมาชิกแล้ว" };
  });
}
