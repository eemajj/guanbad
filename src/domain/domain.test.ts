import { describe, expect, it } from "vitest";
import { History, orderQueue, pickMatch, planMatches, type QueueEntry } from "./matchmaking";
import { computeFees, hoursBetween, roundUpToBaht } from "./fees";
import { crc16, normalizePromptpayId, promptpayPayload } from "./promptpay";

const q = (id: string, rank: number, queuedAt: number, games = 0): QueueEntry => ({ id, rank, queuedAt, games });

describe("matchmaking", () => {
  it("orders by wait time, then fewer games", () => {
    const ordered = orderQueue([q("c", 3, 20), q("a", 3, 10, 2), q("b", 3, 10, 1)]);
    expect(ordered.map((p) => p.id)).toEqual(["b", "a", "c"]);
  });

  it("returns null with fewer than 4 waiting", () => {
    expect(pickMatch([q("a", 3, 1), q("b", 3, 2), q("c", 3, 3)], new History())).toBeNull();
  });

  it("always includes the head of the queue", () => {
    const queue = orderQueue([q("head", 1, 0), q("b", 7, 1), q("c", 7, 2), q("d", 7, 3), q("e", 1, 4), q("f", 1, 5), q("g", 1, 6)]);
    const m = pickMatch(queue, new History())!;
    expect([...m.teamA, ...m.teamB]).toContain("head");
  });

  it("balances teams by level", () => {
    // P + BG vs S + S is fairer than P + S vs BG + S
    const queue = [q("p", 7, 0), q("s1", 5, 1), q("s2", 5, 2), q("bg", 1, 3)];
    const m = pickMatch(queue, new History())!;
    const sum = (t: string[]) => t.reduce((s, id) => s + queue.find((x) => x.id === id)!.rank, 0);
    expect(Math.abs(sum(m.teamA) - sum(m.teamB))).toBe(2);
  });

  it("avoids repeating the same partners", () => {
    const queue = [q("a", 3, 0), q("b", 3, 1), q("c", 3, 2), q("d", 3, 3)];
    const history = new History([{ teamA: ["a", "b"], teamB: ["c", "d"] }]);
    const m = pickMatch(queue, history)!;
    expect(m.teamA.includes("a") && m.teamA.includes("b")).toBe(false);
  });

  it("does not reuse a player across courts", () => {
    const queue = Array.from({ length: 9 }, (_, i) => q(`p${i}`, 3, i));
    const plans = planMatches(queue, new History(), 3);
    expect(plans).toHaveLength(2);
    const ids = plans.flatMap((p) => [...p.teamA, ...p.teamB]);
    expect(new Set(ids).size).toBe(8);
  });
});

describe("fees", () => {
  it("computes hours across the hour and midnight", () => {
    expect(hoursBetween("19:00", "21:30")).toBe(2.5);
    expect(hoursBetween("23:00", "01:00")).toBe(2);
  });

  it("rounds up to whole baht", () => {
    expect(roundUpToBaht(14401)).toBe(14500);
    expect(roundUpToBaht(14400)).toBe(14400);
  });

  it("splits court cost evenly and shuttles per game", () => {
    const r = computeFees({
      courtCount: 2,
      hours: 2,
      courtRate: 18000,
      shuttlePrice: 8500,
      feeMode: "SPLIT",
      flatFee: 0,
      memberIds: ["a", "b", "c", "d", "e"],
      matches: [{ playerIds: ["a", "b", "c", "d"], shuttles: 2 }],
    });
    expect(r.courtCost).toBe(72000);
    expect(r.shuttleCost).toBe(17000);
    const a = r.members.find((m) => m.memberId === "a")!;
    expect(a.courtFee).toBe(14400);
    expect(a.shuttleFee).toBe(4250);
    expect(a.total).toBe(18700); // 144 + 42.5 = 186.5 → 187
    const e = r.members.find((m) => m.memberId === "e")!;
    expect(e.total).toBe(14400);
  });

  it("uses the flat fee per head", () => {
    const r = computeFees({
      courtCount: 1,
      hours: 2,
      courtRate: 20000,
      shuttlePrice: 8000,
      feeMode: "FLAT",
      flatFee: 10000,
      memberIds: ["a"],
      matches: [],
    });
    expect(r.members[0].total).toBe(10000);
  });
});

describe("promptpay", () => {
  it("crc16 matches CCITT-FALSE check value", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("recognises phone and national id", () => {
    expect(normalizePromptpayId("081-234-5678")?.type).toBe("phone");
    expect(normalizePromptpayId("1234567890123")?.type).toBe("nationalId");
    expect(normalizePromptpayId("12345")).toBeNull();
  });

  it("builds a payload with amount and a valid checksum", () => {
    const p = promptpayPayload("0812345678", 187)!;
    expect(p).toContain("0113" + "0066812345678");
    expect(p).toContain("5406187.00");
    const body = p.slice(0, -4);
    expect(p.slice(-4)).toBe(crc16(body));
  });

  it("checksum agrees with a published reference payload", () => {
    // From the open-source promptpay-qr library README: 000-000-0000, amount 4.22
    const ref = "00020101021229370016A000000677010111011300660000000005802TH530376454044.226304E469";
    expect(crc16(ref.slice(0, -4))).toBe(ref.slice(-4));
    // Same fields as ours (field order differs, which EMVCo allows)
    const ours = promptpayPayload("000-000-0000", 4.22)!;
    for (const field of ["0016A000000677010111", "01130066000000000", "5802TH", "5303764", "54044.22"]) expect(ours).toContain(field);
  });
});
