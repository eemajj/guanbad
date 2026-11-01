import { requireAdminPage } from "@/lib/viewer";
import { createMember } from "@/server/actions/members";
import { MemberForm } from "@/components/member-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "เพิ่มสมาชิก" };

export default async function NewMemberPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="เพิ่มสมาชิก" back={{ href: "/members", label: "สมาชิก" }} description="เพิ่มแล้วตั้ง PIN ให้ในหน้าของสมาชิก เขาจะเลือกชื่อตัวเองแล้วใส่ PIN เพื่อเข้าระบบได้" />
      <Card><CardBody><MemberForm action={createMember} showNote submitLabel="เพิ่มสมาชิก" /></CardBody></Card>
    </>
  );
}
