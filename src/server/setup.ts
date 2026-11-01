import { createHash, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HARD_LOCK_AFTER, checkNewPin } from "@/domain/pin";
import { clearIpFailure, ipBlocked, newPinData, recordIpFailure } from "@/server/pin";

/** Admins who can actually sign in: active, with a PIN, not locked out for good. */
export const usableAdminWhere = (exceptMemberId?: string): Prisma.UserWhereInput => ({
  role: "ADMIN",
  member: { active: true, pinHash: { not: null }, pinFailures: { lt: HARD_LOCK_AFTER }, ...(exceptMemberId ? { id: { not: exceptMemberId } } : {}) },
});

/** Any organiser with a PIN, locked or not. */
const adminWithPin: Prisma.UserWhereInput = { role: "ADMIN", member: { active: true, pinHash: { not: null } } };

/**
 * First-run setup shows only while no organiser has a PIN. Locked-out organisers don't reopen it
 * (or a prankster could lock the admin and swap everyone's login screen for the setup form);
 * they use "หัวก๊วนลืม PIN" instead. On a live site both need SETUP_CODE from the host's env.
 */
export async function needsSetup() {
  return (await prisma.user.count({ where: adminWithPin })) === 0;
}

/** Long enough that guessing it over the network is hopeless (openssl rand -hex 8 gives 16). */
const SETUP_CODE_MIN = 12;
export const setupCodeRequired = process.env.NODE_ENV === "production" || Boolean(process.env.SETUP_CODE);
export const setupBlocked = process.env.NODE_ENV === "production" && (process.env.SETUP_CODE ?? "").length < SETUP_CODE_MIN;

function setupCodeOk(code: string) {
  const expected = process.env.SETUP_CODE;
  if (!expected) return !setupCodeRequired;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(code.trim()), digest(expected));
}

export type SetupError = "code" | "name" | "pin" | "weak" | "mismatch" | "done" | "notadmin" | "too_many";

/**
 * "setup": make the first organiser (creating the member, or taking over the active member with
 * that name). "recover": set a new PIN for an existing organiser. Both reset the PIN and lockout.
 */
export async function claimAdmin(
  mode: "setup" | "recover",
  input: { code: string; nickname: string; pin: string; confirm: string; ip: string },
): Promise<{ memberId: string } | { error: SetupError }> {
  if (setupBlocked) return { error: "code" };
  // Count the attempt before checking it, so parallel guesses all hit the limit.
  const attempt = await recordIpFailure(input.ip, null);
  if (await ipBlocked(input.ip)) return { error: "too_many" };
  if (!setupCodeOk(input.code)) return { error: "code" };
  await clearIpFailure(attempt);
  const nickname = input.nickname.trim().slice(0, 30);
  if (!nickname) return { error: "name" };
  if (input.pin !== input.confirm) return { error: "mismatch" };
  const problem = checkNewPin(input.pin, true);
  if (problem) return { error: problem.includes("เดาง่าย") ? "weak" : "pin" };

  const pinData = await newPinData(input.pin);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('user-roles'))`;
    if (mode === "setup" && (await tx.user.count({ where: adminWithPin })) > 0) return { error: "done" as const };
    const existing = await tx.member.findFirst({
      where: { nickname: { equals: nickname, mode: "insensitive" }, active: true },
      include: { user: true },
    });
    if (mode === "recover" && existing?.user?.role !== "ADMIN") return { error: "notadmin" as const };

    const member = existing
      ? await tx.member.update({ where: { id: existing.id }, data: pinData })
      : await tx.member.create({ data: { nickname, pinHash: pinData.pinHash as string, pinLength: input.pin.length } });
    if (member.userId) await tx.user.update({ where: { id: member.userId }, data: { role: "ADMIN" } });
    else {
      const user = await tx.user.create({ data: { name: member.nickname, role: "ADMIN" } });
      await tx.member.update({ where: { id: member.id }, data: { userId: user.id } });
    }
    return { memberId: member.id };
  });
}
