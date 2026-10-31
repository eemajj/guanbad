import { paths } from "@/lib/paths";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/server/viewer";
import { baht, bahtExact, thaiDate } from "@/lib/format";
import { getSettings } from "@/features/settings/queries";
import { reportPaid, setChargeStatus } from "@/features/billing/actions";
import { promptpayPayload } from "@/domain/promptpay";
import { ActionButton } from "@/ui/action";
import { ChargeStatusBadge } from "@/features/billing/components/charge-status";
import { getCharge } from "@/features/billing/queries";
import { QrCode } from "@/ui/qr";
import { CopyButton } from "@/ui/copy-button";

export const metadata = { title: "จ่ายค่าคอร์ท", robots: { index: false } };

/** Public by unguessable link, so members without an account can still pay. */
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const charge = await getCharge(id);
  if (!charge) notFound();
  const [settings, viewer] = await Promise.all([getSettings(), getViewer()]);
  const mine = viewer?.member?.id === charge.memberId;
  const payload = settings.promptpayId ? promptpayPayload(settings.promptpayId, charge.total / 100) : null;
  const open = charge.status === "UNPAID" || charge.status === "REPORTED";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8">
      <div className="text-center">
        <div className="text-sm text-muted">{settings.groupName}</div>
        <h1 className="text-xl font-bold">ค่าตีแบด · {charge.member.nickname}</h1>
        <div className="text-sm text-muted">
          {charge.session.venue} · {thaiDate(charge.session.date)}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 text-center">
        <div className="num text-5xl font-bold">{baht(charge.total)}</div>
        <div className="mt-1 text-sm text-muted">
          คอร์ท {bahtExact(charge.courtFee)} + ลูก {charge.shuttleCount} ลูก {bahtExact(charge.shuttleFee)}
        </div>
        <div className="mt-3">
          <ChargeStatusBadge status={charge.status} />
        </div>
      </div>

      {open &&
        (payload ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-5 text-[#0b1a13]">
            <div className="font-display text-lg font-bold tracking-wide">PromptPay</div>
            <QrCode text={payload} label={`QR พร้อมเพย์ ยอด ${charge.total / 100} บาท`} />
            <div className="text-sm">{settings.accountName ?? ""}</div>
            <div className="text-xs text-[#5c6c63]">สแกนด้วยแอปธนาคาร ยอดเงินใส่ไว้ให้แล้ว</div>
          </div>
        ) : (
          <p className="rounded-lg bg-warn-soft p-3 text-center text-sm text-warn">
            หัวก๊วนยังไม่ได้ตั้งค่าพร้อมเพย์ ติดต่อหัวก๊วนเพื่อชำระเงิน
          </p>
        ))}
      {open && settings.promptpayId && <CopyButton text={settings.promptpayId} label="คัดลอกเลขพร้อมเพย์" />}

      {charge.status === "UNPAID" && mine && (
        <ActionButton action={reportPaid.bind(null, charge.id)} variant="primary" size="lg">
          โอนแล้ว แจ้งหัวก๊วน
        </ActionButton>
      )}
      {charge.status === "REPORTED" && <p className="text-center text-sm text-muted">แจ้งโอนแล้ว รอหัวก๊วนยืนยัน</p>}
      {viewer?.isAdmin && (
        <div className="flex flex-wrap justify-center gap-2 border-t border-line pt-4">
          {open && (
            <ActionButton action={setChargeStatus.bind(null, charge.id, "PAID")} optimistic="✓ ได้รับแล้ว" variant="primary">
              ได้รับเงินแล้ว
            </ActionButton>
          )}
          {open && (
            <ActionButton action={setChargeStatus.bind(null, charge.id, "WAIVED")} variant="ghost" confirm="ยืนยันยกเว้นบิลนี้">
              ยกเว้นไม่เก็บ
            </ActionButton>
          )}
          {!open && (
            <ActionButton action={setChargeStatus.bind(null, charge.id, "UNPAID")} variant="ghost" confirm="แก้เป็นยังไม่จ่าย">
              แก้เป็นยังไม่จ่าย
            </ActionButton>
          )}
        </div>
      )}
      {viewer && (
        <Link href={paths.session(charge.sessionId, "bills")} className="text-center text-sm text-muted hover:text-ink">
          ← กลับไปที่รอบ
        </Link>
      )}
    </main>
  );
}
