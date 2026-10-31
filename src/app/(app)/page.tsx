import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireMemberPage } from "@/lib/viewer";
import { baht, monthRange, thaiDate, todayISO } from "@/lib/format";
import { memberStats, outstandingCharges, upcomingSessions } from "@/server/queries";
import { setChargeStatus } from "@/server/actions/money";
import { ActionButton } from "@/components/action";
import { SessionRow } from "@/components/session/session-row";
import { ChargeStatusBadge } from "@/components/session/status";
import { LevelBadge } from "@/components/level";
import { formatRate, winRate } from "@/domain/results";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";

export const metadata = { title: "หน้าแรก" };

export default async function Dashboard() {
  const viewer = await requireMemberPage();
  const me = viewer.member;
  const name = me?.nickname ?? viewer.user.name;

  const [upcoming, myBills, myStats] = await Promise.all([
    upcomingSessions(me?.id),
    me ? outstandingCharges(me.id) : Promise.resolve([]),
    me ? memberStats([me.id]).then((s) => s.get(me.id)) : Promise.resolve(null),
  ]);

  return (
    <>
      <header>
        <p className="text-sm text-muted">สวัสดี</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          {name} {me && <LevelBadge level={me.level} />}
        </h1>
      </header>

      {viewer.isAdmin && <AdminOverview />}

      {!!myBills.length && (
        <Card className="border-accent">
          <CardHeader
            title={`ยอดค้างของคุณ ${baht(myBills.reduce((s, c) => s + c.total, 0))}`}
            description="สแกน QR พร้อมเพย์ ยอดเงินใส่ไว้ให้แล้ว"
          />
          <ul className="divide-y divide-line">
            {myBills.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <div className="font-semibold">{c.session.venue}</div>
                  <div className="text-sm text-muted">{thaiDate(c.session.date)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="num text-lg font-bold">{baht(c.total)}</span>
                  <Link href={`/pay/${c.id}`} className={buttonClass(c.status === "REPORTED" ? "secondary" : "accent", "sm")}>
                    {c.status === "REPORTED" ? "แจ้งโอนแล้ว" : "จ่าย"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="รอบที่กำลังจะมา"
          action={
            <LinkButton href="/sessions" size="sm" variant="ghost">
              ดูทั้งหมด
            </LinkButton>
          }
        />
        {upcoming.length ? (
          <ul className="divide-y divide-line">
            {upcoming.map((s) => (
              <SessionRow key={s.id} s={s} count={s._count.participants} joined={Boolean(s.participants?.length)} />
            ))}
          </ul>
        ) : (
          <EmptyState
            title="ยังไม่มีรอบเปิด"
            description={viewer.isAdmin ? "เปิดรอบใหม่ แล้วส่งลิงก์ให้สมาชิกลงชื่อ" : "รอหัวก๊วนเปิดรอบ"}
            action={
              viewer.isAdmin && (
                <LinkButton href="/sessions/new" variant="primary">
                  + เปิดรอบใหม่
                </LinkButton>
              )
            }
          />
        )}
      </Card>

      {myStats && (
        <section className="grid grid-cols-3 gap-3">
          <Stat label="มาตีแล้ว" value={myStats.sessions} sub="รอบ" />
          <Stat label="เล่นทั้งหมด" value={myStats.games} sub="เกม" />
          <Stat label="อัตราชนะ" value={formatRate(winRate(myStats))} sub={`ชนะ ${myStats.wins} แพ้ ${myStats.losses}`} />
        </section>
      )}
    </>
  );
}

async function AdminOverview() {
  const ym = todayISO().slice(0, 7);
  const { from, to } = monthRange(ym);
  const [sessionsThisMonth, playersThisMonth, collected, owed, reported] = await Promise.all([
    prisma.session.count({ where: { date: { gte: from, lt: to }, status: { not: "OPEN" } } }),
    prisma.participant.findMany({
      where: { session: { date: { gte: from, lt: to }, status: { not: "OPEN" } } },
      distinct: ["memberId"],
      select: { memberId: true },
    }),
    prisma.charge.aggregate({ where: { status: "PAID", paidAt: { gte: from, lt: to } }, _sum: { total: true } }),
    prisma.charge.aggregate({ where: { status: { in: ["UNPAID", "REPORTED"] } }, _sum: { total: true }, _count: true }),
    prisma.charge.findMany({ where: { status: "REPORTED" }, include: { member: true, session: true }, orderBy: { reportedAt: "asc" } }),
  ]);

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="รอบเดือนนี้" value={sessionsThisMonth} sub="รอบที่เริ่มตีแล้ว" />
        <Stat label="คนมาตีเดือนนี้" value={playersThisMonth.length} sub="คน (ไม่นับซ้ำ)" />
        <Stat label="รับเงินเดือนนี้" value={baht(collected._sum.total ?? 0)} tone="ok" />
        <Stat
          label="ยอดค้างทั้งหมด"
          value={baht(owed._sum.total ?? 0)}
          sub={`${owed._count} บิล`}
          tone={owed._count ? "danger" : undefined}
        />
      </section>
      {!!reported.length && (
        <Card className="border-accent">
          <CardHeader
            title={`รอยืนยันการโอน ${reported.length} รายการ`}
            description="สมาชิกแจ้งว่าโอนแล้ว ตรวจในแอปธนาคารแล้วกดยืนยัน"
            action={
              <LinkButton href="/finance" size="sm" variant="ghost">
                ไปหน้าการเงิน
              </LinkButton>
            }
          />
          <ul className="divide-y divide-line">
            {reported.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <div className="font-semibold">
                    {c.member.nickname} <ChargeStatusBadge status={c.status} />
                  </div>
                  <div className="text-sm text-muted">
                    {c.session.venue} · {thaiDate(c.session.date)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="num text-lg font-bold">{baht(c.total)}</span>
                  <ActionButton action={setChargeStatus.bind(null, c.id, "PAID")} variant="primary" size="sm">
                    ยืนยันรับเงิน
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
