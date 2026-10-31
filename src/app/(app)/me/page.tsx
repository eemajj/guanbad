import { signOut } from "@/auth";
import { requireMemberPage } from "@/lib/viewer";
import { createMyProfile, updateMember } from "@/server/actions/members";
import { LevelBadge } from "@/components/level";
import { MemberForm } from "@/components/member-form";
import { MemberHistory } from "@/components/member-history";
import { Avatar } from "@/components/ui/avatar";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "ของฉัน" };

export default async function MePage() {
  const viewer = await requireMemberPage();
  const m = viewer.member;
  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={m?.nickname ?? viewer.user.name} image={viewer.user.image} size={44} />
            {m?.nickname ?? viewer.user.name} {m && <LevelBadge level={m.level} />}
          </span>
        }
        description={`ล็อกอินด้วย ${viewer.user.name} · ${viewer.isAdmin ? "หัวก๊วน" : "สมาชิก"}`}
        actions={
          <>
            {viewer.isAdmin && <LinkButton href="/settings">ตั้งค่าก๊วน</LinkButton>}
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <Button type="submit" variant="ghost">ออกจากระบบ</Button>
            </form>
          </>
        }
      />
      {m ? (
        <>
          <MemberHistory memberId={m.id} payLinks />
          <Card>
            <CardHeader title="แก้ไขโปรไฟล์" description="ระดับมือใช้แบ่งทีมให้สูสี เลือกตามเกณฑ์ของก๊วน" />
            <CardBody><MemberForm action={updateMember.bind(null, m.id)} member={m} showNote={false} submitLabel="บันทึก" /></CardBody>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader title="สร้างโปรไฟล์ผู้เล่น" description="หัวก๊วนที่ลงเล่นด้วย สร้างโปรไฟล์เพื่อให้ถูกจัดคู่และคิดเงินเหมือนสมาชิก" />
          <CardBody><MemberForm action={createMyProfile} showNote={false} submitLabel="สร้างโปรไฟล์" /></CardBody>
        </Card>
      )}
    </>
  );
}
