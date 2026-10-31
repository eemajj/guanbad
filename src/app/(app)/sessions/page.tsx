import { prisma } from "@/lib/db";
import { requireMemberPage } from "@/lib/viewer";
import { dateFromISO, todayISO } from "@/lib/format";
import { SessionRow } from "@/components/session/session-row";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";

export const metadata = { title: "รอบตี" };

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const viewer = await requireMemberPage();
  const { show } = await searchParams;
  const past = show === "past";
  const today = dateFromISO(todayISO());
  const sessions = await prisma.session.findMany({
    where: past ? { OR: [{ status: "CLOSED" }, { date: { lt: today }, status: "OPEN" }] } : { status: { not: "CLOSED" }, OR: [{ date: { gte: today } }, { status: "LIVE" }] },
    orderBy: [{ date: past ? "desc" : "asc" }, { startTime: "asc" }],
    take: past ? 60 : undefined,
    include: { courts: true, _count: { select: { participants: true } }, participants: viewer.member ? { where: { memberId: viewer.member.id }, select: { id: true } } : false },
  });

  return (
    <>
      <PageHeader title="รอบตี" description="ทุกรอบของก๊วน กดเข้าไปเพื่อลงชื่อ ดูคิว หรือดูค่าใช้จ่าย" actions={viewer.isAdmin && <LinkButton href="/sessions/new" variant="primary">+ เปิดรอบใหม่</LinkButton>} />
      <TabLinks current={past ? "past" : "upcoming"} tabs={[{ key: "upcoming", label: "กำลังจะมา", href: "/sessions" }, { key: "past", label: "ที่ผ่านมา", href: "/sessions?show=past" }]} />
      <Card>
        <CardHeader title={past ? "รอบที่ผ่านมา" : "รอบที่เปิดอยู่และกำลังจะมา"} description={`${sessions.length} รอบ`} />
        {sessions.length ? (
          <ul className="divide-y divide-line">
            {sessions.map((s) => (
              <SessionRow key={s.id} s={s} count={s._count.participants} joined={Boolean(s.participants?.length)} />
            ))}
          </ul>
        ) : (
          <EmptyState
            title={past ? "ยังไม่มีรอบที่ผ่านมา" : "ยังไม่มีรอบที่เปิดอยู่"}
            description={viewer.isAdmin ? "เปิดรอบใหม่ แล้วส่งลิงก์ให้สมาชิกลงชื่อในกลุ่ม LINE" : "รอหัวก๊วนเปิดรอบ แล้วกลับมาลงชื่อที่นี่"}
            action={viewer.isAdmin && !past && <LinkButton href="/sessions/new" variant="primary">+ เปิดรอบใหม่</LinkButton>}
          />
        )}
      </Card>
    </>
  );
}
