import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/viewer";
import { thaiDate } from "@/lib/format";
import { createClaimLink, setMemberActive, setUserRole, updateMember } from "@/server/actions/members";
import { ActionButton } from "@/components/action";
import { CopyButton } from "@/components/copy-button";
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
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

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
            <CardHeader title="บัญชี LINE" />
            <CardBody className="flex flex-col gap-3 text-sm">
              {m.user ? (
                <>
                  <p>ผูกกับบัญชี <b>{m.user.name}</b> แล้ว · {m.user.role === "ADMIN" ? "หัวก๊วน" : "สมาชิก"}</p>
                  {m.user.id !== viewer.user.id &&
                    (m.user.role === "ADMIN" ? (
                      <ActionButton action={setUserRole.bind(null, m.user.id, "MEMBER")} confirm="ยืนยันถอดสิทธิ์หัวก๊วน">ถอดสิทธิ์หัวก๊วน</ActionButton>
                    ) : (
                      <ActionButton action={setUserRole.bind(null, m.user.id, "ADMIN")} confirm="ยืนยันให้เป็นหัวก๊วน">ตั้งเป็นหัวก๊วนร่วม</ActionButton>
                    ))}
                </>
              ) : m.claimToken ? (
                <>
                  <p className="text-muted">ส่งลิงก์นี้ให้ {m.nickname} ทาง LINE เปิดแล้วล็อกอิน ระบบจะผูกชื่อนี้กับบัญชีของเขา ประวัติและยอดค้างย้ายตามไปด้วย</p>
                  <code className="break-all rounded-lg bg-surface-2 px-3 py-2 text-xs">{`${origin}/claim/${m.claimToken}`}</code>
                  <CopyButton text={`${origin}/claim/${m.claimToken}`} label="คัดลอกลิงก์" />
                </>
              ) : (
                <>
                  <p className="text-muted">ยังไม่ได้ผูกบัญชี {m.nickname} จะลงชื่อหรือแจ้งโอนเองไม่ได้ จนกว่าจะผูกบัญชี</p>
                  <ActionButton action={createClaimLink.bind(null, m.id)} variant="primary">สร้างลิงก์ผูกบัญชี</ActionButton>
                </>
              )}
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
