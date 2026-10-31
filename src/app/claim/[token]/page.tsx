import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { claimMember } from "@/server/actions/members";
import { ActionButton } from "@/components/action";
import { LinkButton } from "@/components/ui/button";

export const metadata = { title: "ผูกบัญชี" };

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/claim/${token}`);
  const member = await prisma.member.findUnique({ where: { claimToken: token } });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10 text-center">
      {!member || member.userId || !member.claimExpiresAt || member.claimExpiresAt < new Date() ? (
        <>
          <h1 className="text-xl font-bold">ลิงก์นี้ใช้ไม่ได้แล้ว</h1>
          <p className="text-sm text-muted">ลิงก์อาจถูกใช้ไปแล้ว ขอลิงก์ใหม่จากหัวก๊วน</p>
          <LinkButton href="/">ไปหน้าแรก</LinkButton>
        </>
      ) : viewer.member ? (
        <>
          <h1 className="text-xl font-bold">บัญชีนี้เป็น “{viewer.member.nickname}” อยู่แล้ว</h1>
          <p className="text-sm text-muted">ถ้าลิงก์นี้ส่งมาผิดคน แจ้งหัวก๊วนได้เลย</p>
          <LinkButton href="/">ไปหน้าแรก</LinkButton>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">คุณคือ “{member.nickname}” ใช่ไหม?</h1>
          <p className="text-sm text-muted">ผูกชื่อนี้กับบัญชี LINE ของคุณ แล้วคุณจะลงชื่อ ขอพัก และจ่ายเงินเองได้ ประวัติเดิมยังอยู่ครบ</p>
          <ActionButton action={claimMember.bind(null, token)} variant="primary" size="lg">
            ใช่ นี่คือฉัน
          </ActionButton>
        </>
      )}
    </main>
  );
}
