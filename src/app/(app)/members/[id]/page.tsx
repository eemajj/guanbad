import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/viewer";
import { TZ, thaiDate } from "@/lib/format";
import { setMemberActive, setMemberPin, setMemberRole, updateMember } from "@/server/actions/members";
import { ADMIN_PIN_MIN, PIN_MAX, lockState, minPinLength } from "@/domain/pin";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action";
import { Field, Input } from "@/components/ui/field";
import { LevelBadge } from "@/components/level";
import { MemberForm } from "@/components/member-form";
import { MemberHistory } from "@/components/member-history";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdminPage();
  const { id } = await params;
  const m = await prisma.member.findUnique({ where: { id }, include: { user: true } });
  if (!m) notFound();
  const isAdmin = m.user?.role === "ADMIN";
  const pinMin = minPinLength(isAdmin);
  const lock = lockState(m.pinFailures, m.pinLockedUntil, new Date());

  return (
    <>
      <PageHeader
        back={{ href: "/members", label: "สมาชิก" }}
        title={<span className="flex items-center gap-2">{m.nickname} <LevelBadge level={m.level} /> {!m.active && <Badge tone="outline">ไม่ได้มาแล้ว</Badge>}</span>}
        description={`${m.fullName ?? ""}${m.fullName && m.phone ? " · " : ""}${m.phone ?? ""}${m.fullName || m.phone ? " · " : ""}อยู่ในทะเบียนตั้งแต่ ${thaiDate(m.createdAt)}`}
      />
      <MemberHistory memberId={m.id} payLinks />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="ข้อมูลสมาชิก" />
          <CardBody>
            <MemberForm action={updateMember.bind(null, m.id)} member={m} showNote submitLabel="บันทึก" />
          </CardBody>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="PIN เข้าระบบ" description={`${m.nickname} เลือกชื่อตัวเองที่หน้าเข้าสู่ระบบ แล้วใส่ PIN นี้`} />
            <CardBody className="flex flex-col gap-3 text-sm">
              <p>
                {!m.pinHash ? (
                  <Badge tone="warn">ยังไม่ได้ตั้ง PIN · เข้าระบบไม่ได้</Badge>
                ) : lock.kind === "hard" ? (
                  <Badge tone="danger">ถูกล็อก (ใส่ผิดหลายครั้ง) · ตั้ง PIN ใหม่เพื่อปลดล็อก</Badge>
                ) : lock.kind === "wait" ? (
                  <Badge tone="warn">ล็อกชั่วคราวถึง {lock.until.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: TZ })} น.</Badge>
                ) : (
                  <Badge tone="ok">ตั้ง PIN แล้ว ({m.pinLength} หลัก)</Badge>
                )}
              </p>
              {m.id === viewer.member.id ? (
                <Link href="/me" className="text-brand underline">เปลี่ยน PIN ของตัวเองที่หน้า “ของฉัน”</Link>
              ) : (
              <ActionForm action={setMemberPin.bind(null, m.id)} resetOnSuccess className="flex items-end gap-2">
                <Field label={m.pinHash ? "ตั้ง PIN ใหม่" : "ตั้ง PIN"} hint={`${pinMin}–${PIN_MAX} หลัก ห้ามเลขซ้ำ/เรียงกัน · ทุกเครื่องที่ล็อกอินค้างจะหลุด`} className="flex-1">
                  <Input name="pin" inputMode="numeric" pattern="[0-9]*" autoComplete="off" minLength={pinMin} maxLength={PIN_MAX} required />
                </Field>
                <SubmitButton>บันทึก PIN</SubmitButton>
              </ActionForm>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <span>{isAdmin ? "หัวก๊วน" : "สมาชิก"}</span>
                {m.id !== viewer.member.id &&
                  (isAdmin ? (
                    <ActionButton action={setMemberRole.bind(null, m.id, "MEMBER")} confirm="ยืนยันถอดสิทธิ์หัวก๊วน">ถอดสิทธิ์หัวก๊วน</ActionButton>
                  ) : (
                    <ActionButton action={setMemberRole.bind(null, m.id, "ADMIN")} confirm="ยืนยันให้เป็นหัวก๊วน">ตั้งเป็นหัวก๊วนร่วม</ActionButton>
                  ))}
              </div>
              {!isAdmin && <p className="text-xs text-muted">หัวก๊วนต้องมี PIN {ADMIN_PIN_MIN} หลักขึ้นไป ตั้ง PIN ให้ก่อนแล้วค่อยกดตั้งเป็นหัวก๊วน</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="สถานะในทะเบียน" />
            <CardBody className="text-sm">
              {m.active ? (
                <ActionButton action={setMemberActive.bind(null, m.id, false)} variant="ghost" confirm="ยืนยันย้ายไป “ไม่ได้มาแล้ว”">ย้ายไป “ไม่ได้มาแล้ว”</ActionButton>
              ) : (
                <ActionButton action={setMemberActive.bind(null, m.id, true)}>กลับมาเป็นสมาชิก</ActionButton>
              )}
              <p className="mt-2 text-muted">ประวัติและบิลยังอยู่ครบ แค่ไม่แสดงตอนเพิ่มคนเข้ารอบ</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
