import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HARD_LOCK_AFTER, IP_FAILED_NAMES_PER_HOUR, IP_FAILURES_PER_HOUR, LOCK_MINUTES, SOFT_LOCK_AFTER, lockState } from "@/domain/pin";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/** "scrypt$<salt>$<hash>" — never store or log the PIN itself. */
export async function hashPin(pin: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, 32);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function pinMatches(pin: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(pin, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Data to write when a PIN is set or reset: also unlocks the account and signs out every device. */
export async function newPinData(pin: string): Promise<Prisma.MemberUpdateInput> {
  return { pinHash: await hashPin(pin), pinLength: pin.length, pinVersion: { increment: 1 }, pinFailures: 0, pinLockedUntil: null };
}

export type PinCheck =
  | { ok: true; pinVersion: number }
  | { ok: false; reason: "wrong" | "locked" | "hard_locked" | "no_pin" | "inactive" | "too_many" };

/** Vercel (and most proxies) set x-real-ip themselves; behind no proxy Next fills x-forwarded-for from the socket. */
export function clientIp(headers: Headers) {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

const hourAgo = () => new Date(Date.now() - 3_600_000);

/** Too many attempts from this IP in the last hour (distinct names, or in total), counting the current one. */
export async function ipBlocked(ip: string) {
  const since = hourAgo();
  const [total, names] = await Promise.all([
    prisma.loginFailure.count({ where: { ip, createdAt: { gt: since } } }),
    prisma.loginFailure.findMany({ where: { ip, createdAt: { gt: since } }, distinct: ["memberId"], select: { memberId: true } }),
  ]);
  return total > IP_FAILURES_PER_HOUR || names.length > IP_FAILED_NAMES_PER_HOUR;
}

/** Counted before the check (see callers); returns the row id so a success can take it back. */
export async function recordIpFailure(ip: string, memberId: string | null) {
  const row = await prisma.loginFailure.create({ data: { ip, memberId } });
  await prisma.loginFailure.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
  return row.id;
}

export async function clearIpFailure(id: string | null) {
  if (id) await prisma.loginFailure.deleteMany({ where: { id } });
}

/**
 * Check a member's PIN with lockout. Each attempt is counted as a failure *before* the PIN is
 * compared, in one conditional UPDATE, so a burst of parallel guesses can't all slip past the
 * lock; a correct PIN then clears the count. `ip` adds the per-IP limit for the public login
 * form; pass null for a signed-in member confirming their own PIN.
 */
export async function checkMemberPin(memberId: string, pin: string, ip: string | null): Promise<PinCheck> {
  // Per-IP: count this attempt first, so a burst of parallel guesses all hit the limit.
  const ipAttempt = ip ? await recordIpFailure(ip, memberId) : null;
  if (ip && (await ipBlocked(ip))) return { ok: false, reason: "too_many" };

  const reserved = await prisma.$queryRaw<{ pinHash: string; pinVersion: number; pinFailures: number }[]>`
    UPDATE "Member"
    SET "pinFailures" = "pinFailures" + 1,
        "pinLockedUntil" = CASE
          WHEN "pinFailures" + 1 >= ${SOFT_LOCK_AFTER} AND "pinFailures" + 1 < ${HARD_LOCK_AFTER}
          THEN now() + make_interval(mins => ${LOCK_MINUTES}::int) ELSE "pinLockedUntil" END
    WHERE id = ${memberId} AND active AND "pinHash" IS NOT NULL
      AND "pinFailures" < ${HARD_LOCK_AFTER}
      AND ("pinLockedUntil" IS NULL OR "pinLockedUntil" <= now())
    RETURNING "pinHash", "pinVersion", "pinFailures"`;

  const attempt = reserved[0];
  if (!attempt) {
    // Not reserved: say why, without counting it as another try.
    await clearIpFailure(ipAttempt);
    const m = await prisma.member.findUnique({ where: { id: memberId } });
    if (!m?.pinHash) return { ok: false, reason: "no_pin" };
    if (!m.active) return { ok: false, reason: "inactive" };
    return { ok: false, reason: lockState(m.pinFailures, m.pinLockedUntil, new Date()).kind === "hard" ? "hard_locked" : "locked" };
  }

  if (await pinMatches(pin, attempt.pinHash)) {
    await prisma.member.update({ where: { id: memberId }, data: { pinFailures: 0, pinLockedUntil: null } });
    await clearIpFailure(ipAttempt);
    return { ok: true, pinVersion: attempt.pinVersion };
  }
  if (attempt.pinFailures >= HARD_LOCK_AFTER) return { ok: false, reason: "hard_locked" };
  return { ok: false, reason: attempt.pinFailures >= SOFT_LOCK_AFTER ? "locked" : "wrong" };
}
