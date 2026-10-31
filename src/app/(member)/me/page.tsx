import { paths } from "@/lib/paths";
import { signOut } from "@/server/auth";
import { requireMemberPage } from "@/server/viewer";
import { createMyProfile, updateMember } from "@/features/members/actions";
import { LevelBadge } from "@/ui/level";
import { MemberForm } from "@/features/members/components/member-form";
import { MemberHistory } from "@/features/members/components/member-history";
import { Avatar } from "@/ui/avatar";
import { Button, LinkButton } from "@/ui/button";
import { Card, CardBody, CardHeader } from "@/ui/card";
import { PageHeader } from "@/ui/page-header";

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
            {viewer.isAdmin && <LinkButton href={paths.settings}>ตั้งค่าก๊วน</LinkButton>}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="ghost">
                ออกจากระบบ
              </Button>
            </form>
          </>
        }
      />
      {m ? (
        <>
          <MemberHistory memberId={m.id} payLinks />
          <Card>
            <CardHeader title="แก้ไขโปรไฟล์" description="ระดับมือใช้แบ่งทีมให้สูสี เลือกตามเกณฑ์ของก๊วน" />
            <CardBody>
              <MemberForm action={updateMember.bind(null, m.id)} member={m} showNote={false} submitLabel="บันทึก" />
            </CardBody>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader title="สร้างโปรไฟล์ผู้เล่น" description="หัวก๊วนที่ลงเล่นด้วย สร้างโปรไฟล์เพื่อให้ถูกจัดคู่และคิดเงินเหมือนสมาชิก" />
          <CardBody>
            <MemberForm action={createMyProfile} showNote={false} submitLabel="สร้างโปรไฟล์" />
          </CardBody>
        </Card>
      )}
    </>
  );
}
