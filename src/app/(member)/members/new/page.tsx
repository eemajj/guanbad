import { requireAdminPage } from "@/server/viewer";
import { createMember } from "@/features/members/actions";
import { MemberForm } from "@/features/members/components/member-form";
import { Card, CardBody } from "@/ui/card";
import { PageHeader } from "@/ui/page-header";

export const metadata = { title: "เพิ่มสมาชิก" };

export default async function NewMemberPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader
        title="เพิ่มสมาชิก"
        back={{ href: "/members", label: "สมาชิก" }}
        description="สำหรับคนที่ยังไม่มีบัญชี เพิ่มแล้วส่ง “ลิงก์ผูกบัญชี” ให้เขาผูกกับ LINE ภายหลังได้"
      />
      <Card>
        <CardBody>
          <MemberForm action={createMember} showNote submitLabel="เพิ่มสมาชิก" />
        </CardBody>
      </Card>
    </>
  );
}
