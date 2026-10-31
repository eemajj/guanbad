/**
 * ข้อมูลตัวอย่างสำหรับลองระบบในเครื่อง (ห้ามรันบนฐานข้อมูลจริง)
 *   npm run db:seed
 * สร้างสมาชิกตัวอย่าง 12 คน, รอบที่จบแล้ว 1 รอบ (มีบิล) และรอบที่เปิดรับชื่อ 1 รอบ
 */
import { PrismaClient, type Level } from "@prisma/client";

const prisma = new PrismaClient();

const SAMPLE: [string, Level][] = [
  ["ต้น", "S"], ["เอ", "NS"], ["บีม", "P_MINUS"], ["ฝน", "N_MINUS"], ["กอล์ฟ", "NS"], ["มิ้นท์", "N"],
  ["โอ๊ต", "S"], ["แพร", "N"], ["เจ", "NS"], ["นุ่น", "BG"], ["บอล", "S"], ["ปุ้ย", "N"],
];

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("ห้ามรัน seed บน production");
  if (await prisma.member.count()) {
    console.log("มีข้อมูลอยู่แล้ว ข้าม seed");
    return;
  }
  await prisma.setting.upsert({ where: { id: "main" }, create: { id: "main", groupName: "ก๊วนแบดตัวอย่าง", defaultVenue: "สนามแบดบ้านสวน" }, update: {} });
  const members = await Promise.all(SAMPLE.map(([nickname, level]) => prisma.member.create({ data: { nickname, level } })));

  const day = (offset: number) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + offset);
    return d;
  };

  // A finished session with games and bills
  const past = await prisma.session.create({
    data: {
      venue: "สนามแบดบ้านสวน", date: day(-3), startTime: "19:00", endTime: "21:00", courtRate: 18000, shuttlePrice: 8500,
      status: "CLOSED", startedAt: day(-3), closedAt: day(-3),
      courts: { create: [{ name: "5", position: 0 }, { name: "6", position: 1 }] },
      participants: { create: members.slice(0, 8).map((m, i) => ({ memberId: m.id, joinedAt: new Date(day(-3).getTime() + i), queuedAt: day(-3) })) },
    },
    include: { courts: true },
  });
  const games: [number[], number[], "A" | "B", number][] = [
    [[0, 3], [1, 7], "A", 2], [[2, 5], [4, 6], "B", 3], [[0, 1], [6, 7], "A", 2], [[2, 3], [4, 5], "A", 2],
  ];
  for (const [i, [a, b, winner, shuttles]] of games.entries()) {
    await prisma.match.create({
      data: {
        sessionId: past.id, courtId: past.courts[i % 2].id, status: "DONE", winner, shuttles, endedAt: day(-3),
        players: { create: [...a.map((x) => ({ memberId: members[x].id, team: "A" as const })), ...b.map((x) => ({ memberId: members[x].id, team: "B" as const }))] },
      },
    });
  }
  // Bills: 720 court / 8 = 90 each + shuttles (85 per shuttle / 4)
  const share = new Map<number, number>();
  for (const [a, b, , sh] of games) for (const x of [...a, ...b]) share.set(x, (share.get(x) ?? 0) + sh / 4);
  for (let i = 0; i < 8; i++) {
    const shuttleCount = share.get(i) ?? 0;
    const shuttleFee = Math.round(shuttleCount * 8500);
    const total = Math.ceil((9000 + shuttleFee) / 100) * 100;
    await prisma.charge.create({
      data: { sessionId: past.id, memberId: members[i].id, courtFee: 9000, shuttleFee, shuttleCount, total, status: i < 4 ? "PAID" : i === 4 ? "REPORTED" : "UNPAID", paidAt: i < 4 ? day(-2) : null },
    });
  }
  await prisma.expense.createMany({
    data: [
      { sessionId: past.id, category: "COURT", amount: 72000, spentAt: day(-3), note: "2 คอร์ท" },
      { sessionId: past.id, category: "SHUTTLE", amount: 9 * 8500, spentAt: day(-3), note: "9 ลูก" },
    ],
  });

  // An upcoming session with sign-ups
  await prisma.session.create({
    data: {
      venue: "สนามแบดบ้านสวน", date: day(2), startTime: "19:00", endTime: "22:00", courtRate: 18000, shuttlePrice: 8500, maxPlayers: 16,
      courts: { create: [{ name: "5", position: 0 }, { name: "6", position: 1 }] },
      participants: { create: members.slice(0, 9).map((m, i) => ({ memberId: m.id, source: i % 3 ? "ADMIN" : "SELF", joinedAt: new Date(Date.now() + i), queuedAt: new Date(Date.now() + i) })) },
    },
  });
  console.log("สร้างข้อมูลตัวอย่างแล้ว");
}

main().finally(() => prisma.$disconnect());
