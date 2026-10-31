import { paths } from "@/lib/paths";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/viewer";
import { claimMember } from "@/features/members/actions";
import { getMemberByClaimToken } from "@/features/members/queries";
import { ActionButton } from "@/ui/action";
import { LinkButton } from "@/ui/button";

export const metadata = { title: "ผูกบัญชี" };

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(paths.login(paths.claim(token)));
  const member = await getMemberByClaimToken(token);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10 text-center">
      {!member || member.userId || !member.claimExpiresAt || member.claimExpiresAt < new Date() ? (
        <>
          <h1 className="text-xl font-bold">ลิงก์นี้ใช้ไม่ได้แล้ว</h1>
          <p className="text-sm text-muted">ลิงก์อาจถูกใช้ไปแล้ว ขอลิงก์ใหม่จากหัวก๊วน</p>
          <LinkButton href={paths.home}>ไปหน้าแรก</LinkButton>
        </>
      ) : viewer.member ? (
        <>
          <h1 className="text-xl font-bold">บัญชีนี้เป็น “{viewer.member.nickname}” อยู่แล้ว</h1>
          <p className="text-sm text-muted">ถ้าลิงก์นี้ส่งมาผิดคน แจ้งหัวก๊วนได้เลย</p>
          <LinkButton href={paths.home}>ไปหน้าแรก</LinkButton>
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
