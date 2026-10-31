/**
 * คิดค่าใช้จ่ายของรอบ (หน่วยสตางค์ทั้งหมด)
 *
 * - ค่าคอร์ท: จำนวนคอร์ท × ชั่วโมง × ค่าคอร์ทต่อชั่วโมง
 *     SPLIT = หารเท่ากันทุกคนที่มาร่วมรอบ (รวมคนที่กลับก่อน)
 *     FLAT  = เก็บคนละเท่ากันตามที่ตั้งไว้
 * - ค่าลูก: แต่ละเกมใช้กี่ลูก × ราคาลูก ÷ 4 คนในเกมนั้น
 * - ยอดของแต่ละคนปัดขึ้นเป็นบาทเต็ม
 */

export type FeeInput = {
  courtCount: number;
  hours: number;
  courtRate: number;
  shuttlePrice: number;
  feeMode: "SPLIT" | "FLAT";
  flatFee: number;
  memberIds: string[];
  matches: { playerIds: string[]; shuttles: number }[];
};

export type MemberFee = {
  memberId: string;
  courtFee: number;
  shuttleFee: number;
  shuttleCount: number;
  total: number;
};

export type FeeResult = {
  courtCost: number;
  shuttleCost: number;
  shuttlesUsed: number;
  billed: number;
  members: MemberFee[];
};

export function hoursBetween(start: string, end: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  let d = toMin(end) - toMin(start);
  if (d <= 0) d += 24 * 60;
  return Math.round((d / 60) * 100) / 100;
}

export const roundUpToBaht = (satang: number) => Math.ceil(Math.round(satang) / 100) * 100;

export function computeFees(input: FeeInput): FeeResult {
  const courtCost = Math.round(input.courtCount * input.hours * input.courtRate);
  const shuttlesUsed = input.matches.reduce((sum, m) => sum + m.shuttles, 0);
  const shuttleCost = shuttlesUsed * input.shuttlePrice;

  const shuttleShare = new Map<string, number>();
  for (const m of input.matches) {
    if (!m.playerIds.length) continue;
    const each = m.shuttles / m.playerIds.length;
    for (const id of m.playerIds) shuttleShare.set(id, (shuttleShare.get(id) ?? 0) + each);
  }

  const n = input.memberIds.length;
  const members = input.memberIds.map((memberId) => {
    const courtFee = input.feeMode === "FLAT" ? input.flatFee : n ? courtCost / n : 0;
    const shuttleCount = shuttleShare.get(memberId) ?? 0;
    const shuttleFee = shuttleCount * input.shuttlePrice;
    return {
      memberId,
      courtFee: Math.round(courtFee),
      shuttleFee: Math.round(shuttleFee),
      shuttleCount: Math.round(shuttleCount * 100) / 100,
      total: roundUpToBaht(courtFee + shuttleFee),
    };
  });

  return {
    courtCost,
    shuttleCost,
    shuttlesUsed,
    billed: members.reduce((s, m) => s + m.total, 0),
    members,
  };
}
