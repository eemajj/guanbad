import { paths } from "@/lib/paths";
import Link from "next/link";
import { baht, thaiDate } from "@/lib/format";
import type { outstandingCharges } from "@/features/billing/queries";
import { setChargeStatus } from "@/features/billing/actions";
import { ActionButton } from "@/ui/action";
import { ChargeStatusBadge } from "@/features/billing/components/charge-status";
import { Table, TBody, THead, Td, Th } from "@/ui/table";
import { Card, CardHeader } from "@/ui/card";
import { EmptyState } from "@/ui/empty";
import { buttonClass } from "@/ui/button";

type Owed = Awaited<ReturnType<typeof outstandingCharges>>;

/** Every unpaid or reported bill across all sessions, reported ones first. */
export function OutstandingCard({ owed }: { owed: Owed }) {
  return (
    <Card>
      <CardHeader title="ยอดค้างชำระ" description="รายการที่แจ้งโอนแล้วขึ้นก่อน ตรวจในแอปธนาคารแล้วกดยืนยัน" />
      {owed.length ? (
        <Table>
          <THead>
            <Th>ชื่อ</Th>
            <Th hide="sm">รอบ</Th>
            <Th hide="sm">สถานะ</Th>
            <Th align="right">ยอด</Th>
            <Th>
              <span className="sr-only">จัดการ</span>
            </Th>
          </THead>
          <TBody>
            {owed.map((c) => (
              <tr key={c.id}>
                <Td>
                  <Link href={paths.member(c.memberId)} className="font-semibold hover:underline">
                    {c.member.nickname}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted sm:hidden">
                    <ChargeStatusBadge status={c.status} />
                    {thaiDate(c.session.date)}
                  </div>
                </Td>
                <Td hide="sm">
                  <Link href={paths.session(c.sessionId, "bills")} className="hover:underline">
                    {c.session.venue}
                  </Link>{" "}
                  <span className="text-muted">· {thaiDate(c.session.date)}</span>
                </Td>
                <Td hide="sm">
                  <ChargeStatusBadge status={c.status} />
                </Td>
                <Td align="right" num className="font-bold">
                  {baht(c.total)}
                </Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Link href={paths.pay(c.id)} className={buttonClass("ghost", "sm")}>
                      QR
                    </Link>
                    <ActionButton
                      action={setChargeStatus.bind(null, c.id, "PAID")}
                      optimistic="✓ ได้รับแล้ว"
                      size="sm"
                      variant={c.status === "REPORTED" ? "primary" : "secondary"}
                    >
                      รับเงินแล้ว
                    </ActionButton>
                  </div>
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      ) : (
        <EmptyState title="ไม่มียอดค้าง" description="ทุกคนจ่ายครบแล้ว" />
      )}
    </Card>
  );
}
