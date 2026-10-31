import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/viewer";
import { getSettings } from "@/server/settings";
import { deleteSession, updateSession } from "@/server/actions/sessions";
import { SessionForm } from "@/components/session/session-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionButton } from "@/components/action";

export const metadata = { title: "แก้ไขรอบ" };

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const session = await prisma.session.findUnique({ where: { id }, include: { courts: { orderBy: { position: "asc" } } } });
  if (!session) notFound();
  const s = await getSettings();
  return (
    <>
      <PageHeader title="แก้ไขรอบ" back={{ href: `/sessions/${id}`, label: session.venue }} />
      {session.status === "CLOSED" ? (
        <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">รอบนี้จบแล้ว ถ้าต้องแก้ ให้กด “เปิดรอบอีกครั้ง” ที่หน้ารอบก่อน</p>
      ) : (
        <SessionForm
          action={updateSession.bind(null, id)}
          session={session}
          defaults={{ courtRate: s.defaultCourtRate, shuttlePrice: s.defaultShuttlePrice }}
          submitLabel="บันทึก"
        />
      )}
      <Card className="border-danger/30">
        <CardHeader title="ลบรอบนี้" description="ลบได้เฉพาะรอบที่ยังไม่มีการรับเงิน ประวัติเกมและบิลของรอบนี้จะหายทั้งหมด" />
        <CardBody>
          <ActionButton action={deleteSession.bind(null, id)} variant="danger" confirm="ยืนยันลบรอบนี้ถาวร">
            ลบรอบ
          </ActionButton>
        </CardBody>
      </Card>
    </>
  );
}
