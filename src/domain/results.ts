/**
 * ผลการแข่งและสถิติ
 *
 * ผลของแต่ละเกม "ไม่บังคับ" เพราะในสนามจริงมักลืมกด จึงมี 3 ระดับ:
 *   1. ไม่ได้บันทึก        → นับเป็นเกมที่เล่น แต่ไม่นับชนะ/แพ้ และไม่นับแต้ม
 *   2. บันทึกแค่ทีมที่ชนะ   → นับชนะ/แพ้ ไม่นับแต้ม
 *   3. บันทึกแต้ม          → นับทั้งชนะ/แพ้และแต้ม (ทีมที่ชนะคิดจากแต้มเอง)
 * อัตราชนะจึงหารด้วย "เกมที่รู้ผล" เท่านั้น ไม่ใช่เกมทั้งหมด
 */

export type Side = "A" | "B";

export type MatchResult = { winner: Side | null; scoreA: number | null; scoreB: number | null };

export const MAX_POINTS = 50;

/** Validate a result typed by the organiser. Returns a clean result or a message to show. */
export function normalizeResult(input: {
  winner?: Side | null;
  scoreA?: number | null;
  scoreB?: number | null;
}): { ok: true; value: MatchResult } | { ok: false; error: string } {
  const a = input.scoreA ?? null;
  const b = input.scoreB ?? null;
  const winner = input.winner ?? null;

  if ((a === null) !== (b === null)) return { ok: false, error: "ใส่แต้มให้ครบทั้งสองฝั่ง หรือเว้นว่างทั้งคู่" };
  if (a === null || b === null) return { ok: true, value: { winner, scoreA: null, scoreB: null } };

  for (const v of [a, b]) {
    if (!Number.isInteger(v) || v < 0 || v > MAX_POINTS) return { ok: false, error: `แต้มต้องเป็นจำนวนเต็ม 0–${MAX_POINTS}` };
  }
  if (a === b) return { ok: false, error: "แต้มเท่ากันไม่ได้ ต้องมีทีมที่ชนะ" };
  const byScore: Side = a > b ? "A" : "B";
  if (winner && winner !== byScore) return { ok: false, error: "แต้มขัดกับทีมที่เลือกว่าชนะ ตรวจอีกครั้ง" };
  return { ok: true, value: { winner: byScore, scoreA: a, scoreB: b } };
}

export type ResultMatch = MatchResult & { teamA: string[]; teamB: string[] };

export type PlayerRecord = {
  games: number;
  wins: number;
  losses: number;
  /** เล่นแต่ไม่ได้บันทึกว่าใครชนะ */
  unrecorded: number;
  /** เกมที่มีแต้ม */
  scoredGames: number;
  pointsFor: number;
  pointsAgainst: number;
};

export const emptyRecord = (): PlayerRecord => ({
  games: 0,
  wins: 0,
  losses: 0,
  unrecorded: 0,
  scoredGames: 0,
  pointsFor: 0,
  pointsAgainst: 0,
});

export function playerRecords(matches: ResultMatch[]): Map<string, PlayerRecord> {
  const out = new Map<string, PlayerRecord>();
  const get = (id: string) => out.get(id) ?? (out.set(id, emptyRecord()), out.get(id)!);
  for (const m of matches) {
    for (const side of ["A", "B"] as const) {
      const team = side === "A" ? m.teamA : m.teamB;
      const mine = side === "A" ? m.scoreA : m.scoreB;
      const theirs = side === "A" ? m.scoreB : m.scoreA;
      for (const id of team) {
        const r = get(id);
        r.games++;
        if (!m.winner) r.unrecorded++;
        else if (m.winner === side) r.wins++;
        else r.losses++;
        if (mine !== null && theirs !== null) {
          r.scoredGames++;
          r.pointsFor += mine;
          r.pointsAgainst += theirs;
        }
      }
    }
  }
  return out;
}

/** อัตราชนะจากเกมที่รู้ผล (null = ยังไม่มีเกมที่รู้ผล) */
export const winRate = (r: PlayerRecord) => (r.wins + r.losses ? r.wins / (r.wins + r.losses) : null);
/** แต้มได้-เสียเฉลี่ยต่อเกม จากเกมที่มีแต้ม */
export const avgPointDiff = (r: PlayerRecord) => (r.scoredGames ? (r.pointsFor - r.pointsAgainst) / r.scoredGames : null);
/** สัดส่วนเกมที่รู้ผล */
export const coverage = (r: PlayerRecord) => (r.games ? (r.wins + r.losses) / r.games : 0);

export const formatRate = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);
export const formatDiff = (v: number | null) => (v === null ? "–" : `${v > 0 ? "+" : ""}${v.toFixed(1)}`);

/** สถิติเมื่อจับคู่กับแต่ละคน */
export function partnerRecords(matches: ResultMatch[], memberId: string) {
  const out = new Map<string, { games: number; wins: number; losses: number }>();
  for (const m of matches) {
    const side: Side | null = m.teamA.includes(memberId) ? "A" : m.teamB.includes(memberId) ? "B" : null;
    if (!side) continue;
    const partner = (side === "A" ? m.teamA : m.teamB).find((id) => id !== memberId);
    if (!partner) continue;
    const r = out.get(partner) ?? { games: 0, wins: 0, losses: 0 };
    r.games++;
    if (m.winner === side) r.wins++;
    else if (m.winner) r.losses++;
    out.set(partner, r);
  }
  return out;
}

/** ภาพรวมความครบของข้อมูล */
export function recordCoverage(matches: MatchResult[]) {
  return {
    total: matches.length,
    withWinner: matches.filter((m) => m.winner).length,
    withScore: matches.filter((m) => m.scoreA !== null && m.scoreB !== null).length,
  };
}

export type RankRow = { memberId: string; record: PlayerRecord };

/**
 * จัดอันดับ: ต้องมีเกมที่รู้ผลอย่างน้อย minDecided เกมถึงจะติดอันดับ
 * (กันคนที่เล่น 1 เกมชนะ 1 ขึ้นอันดับ 1) เรียงตาม อัตราชนะ → แต้มได้เสียเฉลี่ย → จำนวนเกมที่ชนะ
 */
export function rankPlayers(rows: RankRow[], minDecided: number) {
  const decided = (r: PlayerRecord) => r.wins + r.losses;
  const ranked = rows
    .filter((r) => decided(r.record) >= minDecided)
    .sort(
      (x, y) =>
        (winRate(y.record) ?? 0) - (winRate(x.record) ?? 0) ||
        (avgPointDiff(y.record) ?? -999) - (avgPointDiff(x.record) ?? -999) ||
        y.record.wins - x.record.wins,
    );
  const unranked = rows.filter((r) => decided(r.record) < minDecided).sort((x, y) => y.record.games - x.record.games);
  return { ranked, unranked };
}

/** สถิติของแต่ละคู่ (คีย์ = id สองคนเรียงตามตัวอักษร คั่นด้วย |) */
export function pairRecords(matches: ResultMatch[]) {
  const out = new Map<string, { ids: [string, string]; games: number; wins: number; losses: number }>();
  for (const m of matches) {
    for (const side of ["A", "B"] as const) {
      const team = side === "A" ? m.teamA : m.teamB;
      if (team.length !== 2) continue;
      const ids = [...team].sort() as [string, string];
      const key = ids.join("|");
      const r = out.get(key) ?? { ids, games: 0, wins: 0, losses: 0 };
      r.games++;
      if (m.winner === side) r.wins++;
      else if (m.winner) r.losses++;
      out.set(key, r);
    }
  }
  return out;
}
