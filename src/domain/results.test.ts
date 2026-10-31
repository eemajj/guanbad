import { describe, expect, it } from "vitest";
import { avgPointDiff, normalizeResult, pairRecords, partnerRecords, playerRecords, rankPlayers, recordCoverage, winRate, type ResultMatch } from "./results";

describe("normalizeResult", () => {
  it("accepts an empty result (organiser forgot)", () => {
    expect(normalizeResult({})).toEqual({ ok: true, value: { winner: null, scoreA: null, scoreB: null } });
  });

  it("accepts a winner without points", () => {
    expect(normalizeResult({ winner: "B" })).toEqual({ ok: true, value: { winner: "B", scoreA: null, scoreB: null } });
  });

  it("derives the winner from points", () => {
    expect(normalizeResult({ scoreA: 21, scoreB: 17 })).toEqual({ ok: true, value: { winner: "A", scoreA: 21, scoreB: 17 } });
  });

  it("rejects half-filled points, ties, contradictions and out-of-range", () => {
    expect(normalizeResult({ scoreA: 21 }).ok).toBe(false);
    expect(normalizeResult({ scoreA: 20, scoreB: 20 }).ok).toBe(false);
    expect(normalizeResult({ winner: "B", scoreA: 21, scoreB: 15 }).ok).toBe(false);
    expect(normalizeResult({ scoreA: 99, scoreB: 1 }).ok).toBe(false);
    expect(normalizeResult({ scoreA: 2.5, scoreB: 1 }).ok).toBe(false);
  });
});

const m = (teamA: string[], teamB: string[], winner: "A" | "B" | null, scoreA: number | null = null, scoreB: number | null = null): ResultMatch => ({ teamA, teamB, winner, scoreA, scoreB });

describe("player records", () => {
  const matches = [
    m(["a", "b"], ["c", "d"], "A", 21, 15), // a,b win by 6
    m(["a", "c"], ["b", "d"], "B"), // winner only
    m(["a", "d"], ["b", "c"], null), // forgot
  ];
  const rec = playerRecords(matches);

  it("does not count unrecorded games as losses", () => {
    const a = rec.get("a")!;
    expect(a).toMatchObject({ games: 3, wins: 1, losses: 1, unrecorded: 1 });
    expect(winRate(a)).toBe(0.5); // not 1/3
  });

  it("averages points only over games that have points", () => {
    const a = rec.get("a")!;
    expect(a.scoredGames).toBe(1);
    expect(avgPointDiff(a)).toBe(6);
    expect(avgPointDiff(rec.get("c")!)).toBe(-6);
  });

  it("has no win rate when nothing was recorded", () => {
    const r = playerRecords([m(["a", "b"], ["c", "d"], null)]).get("a")!;
    expect(winRate(r)).toBeNull();
    expect(avgPointDiff(r)).toBeNull();
  });

  it("tracks partners", () => {
    const p = partnerRecords(matches, "a");
    expect(p.get("b")).toEqual({ games: 1, wins: 1, losses: 0 });
    expect(p.get("c")).toEqual({ games: 1, wins: 0, losses: 1 });
    expect(p.get("d")).toEqual({ games: 1, wins: 0, losses: 0 });
  });

  it("reports coverage", () => {
    expect(recordCoverage(matches)).toEqual({ total: 3, withWinner: 2, withScore: 1 });
  });
});

describe("ranking", () => {
  it("needs a minimum of decided games and orders by win rate then point diff", () => {
    const r = (wins: number, losses: number, pf = 0, pa = 0, scored = 0) => ({ games: wins + losses, wins, losses, unrecorded: 0, scoredGames: scored, pointsFor: pf, pointsAgainst: pa });
    const { ranked, unranked } = rankPlayers(
      [
        { memberId: "lucky", record: r(1, 0) },
        { memberId: "x", record: r(3, 1, 80, 60, 4) },
        { memberId: "y", record: r(3, 1, 80, 70, 4) },
        { memberId: "z", record: r(1, 3) },
      ],
      3,
    );
    expect(ranked.map((x) => x.memberId)).toEqual(["x", "y", "z"]);
    expect(unranked.map((x) => x.memberId)).toEqual(["lucky"]);
  });
});

describe("pairs", () => {
  it("counts each pair regardless of order or side", () => {
    const pairs = pairRecords([m(["a", "b"], ["c", "d"], "A"), m(["c", "d"], ["b", "a"], "A"), m(["a", "b"], ["c", "d"], null)]);
    expect(pairs.get("a|b")).toEqual({ ids: ["a", "b"], games: 3, wins: 1, losses: 1 });
    expect(pairs.get("c|d")).toEqual({ ids: ["c", "d"], games: 3, wins: 1, losses: 1 });
  });
});
