import { requireAdminPage } from "@/server/viewer";
import { getSettings } from "@/features/settings/queries";
import { createSession } from "@/features/sessions/actions";
import { SessionForm } from "@/features/sessions/components/session-form";
import { PageHeader } from "@/ui/page-header";

export const metadata = { title: "เปิดรอบใหม่" };

export default async function NewSessionPage() {
  await requireAdminPage();
  const s = await getSettings();
  return (
    <>
      <PageHeader
        title="เปิดรอบใหม่"
        back={{ href: "/sessions", label: "รอบตีทั้งหมด" }}
        description="ค่าเริ่มต้นมาจากรอบล่าสุด แก้ทีหลังได้จนกว่าจะจบรอบ"
      />
      <SessionForm
        action={createSession}
        defaults={{ venue: s.defaultVenue, courtRate: s.defaultCourtRate, shuttlePrice: s.defaultShuttlePrice }}
        submitLabel="เปิดรอบ"
      />
    </>
  );
}
