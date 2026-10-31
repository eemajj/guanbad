/**
 * การจัดคู่แบบไดนามิก
 *
 * 1. คิว: คนที่รอนานที่สุดได้ลงก่อน (queuedAt = เวลามาถึง / จบเกมล่าสุด / กลับจากพัก)
 *    ถ้าเวลาเท่ากัน คนที่เล่นน้อยกว่าได้ก่อน
 * 2. คนหัวคิวได้ลงแน่นอน ส่วนอีก 3 คนเลือกจาก 6 คนถัดไป
 * 3. เลือกชุด 4 คน + วิธีแบ่งทีมที่ "ต้นทุน" ต่ำสุด:
 *    - ข้ามคิวไปไกล (ไม่ยุติธรรมกับคนรอ)
 *    - ผลรวมระดับมือสองฝั่งต่างกัน (เกมไม่สูสี)
 *    - ระดับมือในเกมห่างกันมาก (BG เจอ P)
 *    - เคยเป็นคู่กันแล้ว / เคยเจอกันแล้ว (อยากให้หมุนคู่)
 */

export type QueueEntry = {
  id: string;
  /** 1 (BG) – 7 (P) */
  rank: number;
  queuedAt: number;
  games: number;
};

export type PastMatch = { teamA: string[]; teamB: string[] };

export type Pairing = { teamA: [string, string]; teamB: [string, string]; cost: number };

export const WEIGHTS = {
  skipInQueue: 3,
  teamDiff: 2.5,
  levelSpread: 1.2,
  repeatPartner: 4,
  repeatOpponent: 1,
};

const POOL_SIZE = 7;

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export class History {
  private partners = new Map<string, number>();
  private opponents = new Map<string, number>();

  constructor(matches: PastMatch[] = []) {
    for (const m of matches) this.add(m);
  }

  add({ teamA, teamB }: PastMatch) {
    for (const team of [teamA, teamB]) {
      if (team.length === 2) this.bump(this.partners, pairKey(team[0], team[1]));
    }
    for (const a of teamA) for (const b of teamB) this.bump(this.opponents, pairKey(a, b));
  }

  partnered(a: string, b: string) {
    return this.partners.get(pairKey(a, b)) ?? 0;
  }

  faced(a: string, b: string) {
    return this.opponents.get(pairKey(a, b)) ?? 0;
  }

  private bump(map: Map<string, number>, key: string) {
    map.set(key, (map.get(key) ?? 0) + 1);
  }
}

export function orderQueue<T extends QueueEntry>(entries: T[]): T[] {
  return [...entries].sort((x, y) => x.queuedAt - y.queuedAt || x.games - y.games || x.id.localeCompare(y.id));
}

const SPLITS: [number[], number[]][] = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

/** เลือก 4 คนจากคิวที่เรียงแล้ว (index 0 = หัวคิว) */
export function pickMatch(queue: QueueEntry[], history: History): Pairing | null {
  if (queue.length < 4) return null;
  const pool = queue.slice(0, POOL_SIZE);
  let best: Pairing | null = null;

  for (let j = 1; j < pool.length; j++)
    for (let k = j + 1; k < pool.length; k++)
      for (let l = k + 1; l < pool.length; l++) {
        const four = [pool[0], pool[j], pool[k], pool[l]];
        const skipped = j + k + l - 6;
        const ranks = four.map((p) => p.rank);
        const spread = Math.max(...ranks) - Math.min(...ranks);

        for (const [ia, ib] of SPLITS) {
          const a = ia.map((i) => four[i]);
          const b = ib.map((i) => four[i]);
          const diff = Math.abs(a[0].rank + a[1].rank - b[0].rank - b[1].rank);
          const partners = history.partnered(a[0].id, a[1].id) + history.partnered(b[0].id, b[1].id);
          let opponents = 0;
          for (const x of a) for (const y of b) opponents += history.faced(x.id, y.id);

          const cost =
            skipped * WEIGHTS.skipInQueue +
            diff * WEIGHTS.teamDiff +
            spread * WEIGHTS.levelSpread +
            partners * WEIGHTS.repeatPartner +
            opponents * WEIGHTS.repeatOpponent;

          if (!best || cost < best.cost) {
            best = { teamA: [a[0].id, a[1].id], teamB: [b[0].id, b[1].id], cost };
          }
        }
      }
  return best;
}

/** จัดคู่ลงหลายคอร์ทพร้อมกัน โดยไม่ใช้คนซ้ำ */
export function planMatches(queue: QueueEntry[], history: History, courts: number): Pairing[] {
  const remaining = orderQueue(queue);
  const plans: Pairing[] = [];
  for (let c = 0; c < courts; c++) {
    const pick = pickMatch(remaining, history);
    if (!pick) break;
    plans.push(pick);
    const used = new Set([...pick.teamA, ...pick.teamB]);
    for (let i = remaining.length - 1; i >= 0; i--) if (used.has(remaining[i].id)) remaining.splice(i, 1);
  }
  return plans;
}
