import { requireAdminPage } from "@/lib/viewer";
import { getSettings } from "@/server/settings";
import { createSession } from "@/server/actions/sessions";
import { SessionForm } from "@/components/session/session-form";
import { PageHeader } from "@/components/ui/page-header";

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
