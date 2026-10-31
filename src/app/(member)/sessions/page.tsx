import { paths } from "@/lib/paths";
import { requireMemberPage } from "@/server/viewer";
import { listSessions } from "@/features/sessions/queries";
import { SessionRow } from "@/features/sessions/components/session-row";
import { Card, CardHeader } from "@/ui/card";
import { EmptyState } from "@/ui/empty";
import { LinkButton } from "@/ui/button";
import { PageHeader } from "@/ui/page-header";
import { TabLinks } from "@/ui/tabs";

export const metadata = { title: "รอบตี" };

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const viewer = await requireMemberPage();
  const { show } = await searchParams;
  const past = show === "past";
  const sessions = await listSessions(past, viewer.member?.id);

  return (
    <>
      <PageHeader
        title="รอบตี"
        description="ทุกรอบของก๊วน กดเข้าไปเพื่อลงชื่อ ดูคิว หรือดูค่าใช้จ่าย"
        actions={
          viewer.isAdmin && (
            <LinkButton href={paths.newSession} variant="primary">
              + เปิดรอบใหม่
            </LinkButton>
          )
        }
      />
      <TabLinks
        current={past ? "past" : "upcoming"}
        tabs={[
          { key: "upcoming", label: "กำลังจะมา", href: "/sessions" },
          { key: "past", label: "ที่ผ่านมา", href: "/sessions?show=past" },
        ]}
      />
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
            action={
              viewer.isAdmin &&
              !past && (
                <LinkButton href={paths.newSession} variant="primary">
                  + เปิดรอบใหม่
                </LinkButton>
              )
            }
          />
        )}
      </Card>
    </>
  );
}
