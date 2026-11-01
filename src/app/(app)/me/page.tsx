import { signOut } from "@/auth";
import { requireMemberPage } from "@/lib/viewer";
import { changeMyPin, updateMember } from "@/server/actions/members";
import { PIN_MAX, minPinLength } from "@/domain/pin";
import { ActionForm, SubmitButton } from "@/components/action";
import { Field, Input } from "@/components/ui/field";
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
  const pinMin = minPinLength(viewer.isAdmin);
  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={m.nickname} image={viewer.user.image} size={44} />
            {m.nickname} <LevelBadge level={m.level} />
          </span>
        }
        description={viewer.isAdmin ? "หัวก๊วน" : "สมาชิก"}
        actions={
          <>
            {viewer.isAdmin && <LinkButton href="/settings">ตั้งค่าก๊วน</LinkButton>}
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <Button type="submit" variant="ghost">ออกจากระบบ</Button>
            </form>
          </>
        }
      />
      <MemberHistory memberId={m.id} payLinks />
      <Card>
        <CardHeader title="แก้ไขโปรไฟล์" description="ระดับมือใช้แบ่งทีมให้สูสี เลือกตามเกณฑ์ของก๊วน" />
        <CardBody><MemberForm action={updateMember.bind(null, m.id)} member={m} showNote={false} submitLabel="บันทึก" /></CardBody>
      </Card>
      <Card>
        <CardHeader title="เปลี่ยน PIN" description="เปลี่ยนแล้วต้องเข้าระบบใหม่ทุกเครื่อง" />
        <CardBody>
          <ActionForm action={changeMyPin} resetOnSuccess className="grid gap-3 sm:grid-cols-3">
            <Field label="PIN เดิม"><Input name="current" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="current-password" maxLength={PIN_MAX} required /></Field>
            <Field label={`PIN ใหม่ (${pinMin}–${PIN_MAX} หลัก)`} hint="ห้ามเลขซ้ำหรือเรียงกัน"><Input name="pin" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" minLength={pinMin} maxLength={PIN_MAX} required /></Field>
            <Field label="ใส่ PIN ใหม่อีกครั้ง"><Input name="confirm" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" minLength={pinMin} maxLength={PIN_MAX} required /></Field>
            <div className="sm:col-span-3"><SubmitButton>เปลี่ยน PIN</SubmitButton></div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
