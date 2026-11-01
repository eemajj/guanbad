/** PIN rules and lockout policy. Pure functions — hashing and storage live in src/server/pin.ts. */

export const MEMBER_PIN_MIN = 4;
/** Organisers can change the PromptPay number and confirm payments, so their PIN is longer. */
export const ADMIN_PIN_MIN = 6;
export const PIN_MAX = 8;

/** After this many wrong PINs in a row the account waits LOCK_MINUTES before the next try. */
export const SOFT_LOCK_AFTER = 5;
export const LOCK_MINUTES = 15;
/** After this many wrong PINs in a row only an organiser can unlock it (by setting a new PIN). */
export const HARD_LOCK_AFTER = 10;
/**
 * Per IP per hour. Counted by distinct names so one person fumbling their own PIN at the venue
 * (where everyone shares one Wi-Fi IP) doesn't block everybody, while sweeping the list does.
 */
export const IP_FAILED_NAMES_PER_HOUR = 8;
export const IP_FAILURES_PER_HOUR = 100;

export const minPinLength = (isAdmin: boolean) => (isAdmin ? ADMIN_PIN_MIN : MEMBER_PIN_MIN);

/** Same digit repeated or a straight run (1234, 9876, 123456) — the first things anyone tries. */
export function isWeakPin(pin: string) {
  if (/^(\d)\1+$/.test(pin)) return true;
  const steps = new Set([...pin].slice(1).map((c, i) => (Number(c) - Number(pin[i]) + 10) % 10));
  return steps.size === 1 && (steps.has(1) || steps.has(9));
}

/** Returns an error message, or null when the PIN is acceptable. */
export function checkNewPin(pin: string, isAdmin: boolean): string | null {
  const min = minPinLength(isAdmin);
  if (!/^\d+$/.test(pin)) return "PIN ต้องเป็นตัวเลขเท่านั้น";
  if (pin.length < min || pin.length > PIN_MAX) {
    return isAdmin ? `PIN ของหัวก๊วนต้องมี ${min}–${PIN_MAX} หลัก` : `PIN ต้องมี ${min}–${PIN_MAX} หลัก`;
  }
  if (isWeakPin(pin)) return "PIN เดาง่ายเกินไป (เลขซ้ำหรือเรียงกัน) เลือกใหม่";
  return null;
}

export type PinLock = { kind: "none" } | { kind: "wait"; until: Date } | { kind: "hard" };

export function lockState(failures: number, lockedUntil: Date | null, now: Date): PinLock {
  if (failures >= HARD_LOCK_AFTER) return { kind: "hard" };
  if (lockedUntil && lockedUntil > now) return { kind: "wait", until: lockedUntil };
  return { kind: "none" };
}
