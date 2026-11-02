import { describe, expect, it } from "vitest";
import { HARD_LOCK_AFTER, SOFT_LOCK_AFTER, checkNewPin, isWeakPin, lockState } from "./pin";

describe("pin rules", () => {
  it("rejects repeated digits and straight runs", () => {
    for (const p of ["1111", "000000", "1234", "4321", "123456", "987654", "7890", "8901"]) expect(isWeakPin(p)).toBe(true);
    for (const p of ["1357", "2580", "1123", "482915"]) expect(isWeakPin(p)).toBe(false);
  });

  it("members need 4–8 digits, organisers at least 6", () => {
    expect(checkNewPin("2580", false)).toBeNull();
    expect(checkNewPin("258", false)).toMatch("4–8");
    expect(checkNewPin("2580", true)).toMatch("หัวก๊วน");
    expect(checkNewPin("258013", true)).toBeNull();
    expect(checkNewPin("25801395", false)).toBeNull();
    expect(checkNewPin("258013957", false)).toMatch("4–8");
    expect(checkNewPin("25a0", false)).toMatch("ตัวเลข");
    expect(checkNewPin("1234", false)).toMatch("เดาง่าย");
  });
});

describe("pin lockout", () => {
  const now = new Date("2026-11-01T12:00:00Z");

  it("after too many misses only an organiser can unlock", () => {
    expect(lockState(HARD_LOCK_AFTER - 1, null, now)).toEqual({ kind: "none" });
    expect(lockState(HARD_LOCK_AFTER, null, now)).toEqual({ kind: "hard" });
  });

  it("a soft lock expires on its own", () => {
    const until = new Date(now.getTime() + 60_000);
    expect(lockState(SOFT_LOCK_AFTER, until, now)).toEqual({ kind: "wait", until });
    expect(lockState(SOFT_LOCK_AFTER, until, new Date(until.getTime() + 1))).toEqual({ kind: "none" });
  });
});
