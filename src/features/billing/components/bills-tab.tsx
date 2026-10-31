import { paths } from "@/lib/paths";
import Link from "next/link";
import type { SessionDetail, SessionState } from "@/features/sessions/state";
import { setChargeStatus } from "@/features/billing/actions";
import { baht, bahtExact } from "@/lib/format";
import { ActionButton } from "@/ui/action";
import { ChargeStatusBadge } from "./charge-status";
import { Table, TBody, THead, Td, Th } from "@/ui/table";
import { Card, CardBody, CardHeader } from "@/ui/card";
import { Stat } from "@/ui/stat";
import { buttonClass } from "@/ui/button";

export function BillsTab({ s, st, isAdmin, myMemberId }: { s: SessionDetail; st: SessionState; isAdmin: boolean; myMemberId?: string }) {
  const closed = s.status === "CLOSED";
  const charges = new Map(s.charges.map((c) => [c.memberId, c]));
  const rows = st.fees.members
    .map((f) => ({ fee: f, member: s.participants.find((p) => p.memberId === f.memberId)!.member, charge: charges.get(f.memberId) }))
    .sort((a, b) => a.member.nickname.localeCompare(b.member.nickname, "th"));

  const billed = closed ? s.charges.reduce((sum, c) => sum + (c.status === "WAIVED" ? 0 : c.total), 0) : st.fees.billed;
  const received = s.charges.filter((c) => c.status === "PAID").reduce((sum, c) => sum + c.total, 0);
  const pct = billed ? Math.round((received / billed) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {!closed && (
        <p className="rounded-lg bg-accent-soft px-4 py-3 text-sm">
          ยอดด้านล่างเป็นยอดประมาณการ ค่าลูกเพิ่มขึ้นทุกเกม บิลจริงจะออกเมื่อหัวก๊วนกด “จบรอบ”
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="ค่าคอร์ท (จ่ายสนาม)"
          value={baht(st.fees.courtCost)}
          sub={`${s.courts.length} คอร์ท × ${st.hours} ชม. × ${baht(s.courtRate)}`}
        />
        <Stat label="ค่าลูก" value={baht(st.fees.shuttleCost)} sub={`${st.fees.shuttlesUsed} ลูก × ${baht(s.shuttlePrice)}`} />
        <Stat label={closed ? "เรียกเก็บ" : "เรียกเก็บ (ประมาณ)"} value={baht(billed)} sub={`${rows.length} คน · ปัดขึ้นเป็นบาท`} />
        <Stat
          label="ได้รับแล้ว"
          value={baht(received)}
          sub={`${pct}% ของยอดเรียกเก็บ`}
          tone={closed && received >= billed && billed > 0 ? "ok" : undefined}
        />
      </div>
      {s.feeMode === "FLAT" && billed < st.fees.courtCost + st.fees.shuttleCost && (
        <p className="text-sm text-danger">
          เก็บคนละ {baht(s.flatFee)} ได้น้อยกว่าที่จ่ายจริง {baht(st.fees.courtCost + st.fees.shuttleCost - billed)}
        </p>
      )}

      <Card>
        <CardHeader
          title="ยอดของแต่ละคน"
          description={
            s.feeMode === "SPLIT"
              ? `ค่าคอร์ทหารเท่ากัน ${rows.length} คน + ค่าลูกตามเกมที่เล่น`
              : `ค่าคอร์ทคนละ ${baht(s.flatFee)} + ค่าลูกตามเกมที่เล่น`
          }
        />
        <Table>
          <THead>
            <Th>ชื่อ</Th>
            <Th hide="sm" align="right">
              ค่าคอร์ท
            </Th>
            <Th hide="sm" align="right">
              ค่าลูก
            </Th>
            <Th align="right">รวม</Th>
            <Th hide="sm">สถานะ</Th>
            <Th>
              <span className="sr-only">จัดการ</span>
            </Th>
          </THead>
          <TBody>
            {rows.map(({ fee, member, charge }) => {
              const mine = member.id === myMemberId;
              return (
                <tr key={member.id} className={mine ? "bg-brand-soft/40" : ""}>
                  <Td>
                    <div className="font-semibold">
                      {member.nickname}
                      {mine && " (คุณ)"}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted sm:hidden">
                      {charge ? <ChargeStatusBadge status={charge.status} /> : null}
                      คอร์ท {bahtExact(charge?.courtFee ?? fee.courtFee)} + ลูก {bahtExact(charge?.shuttleFee ?? fee.shuttleFee)}
                    </div>
                  </Td>
                  <Td hide="sm" align="right" num>
                    {bahtExact(charge?.courtFee ?? fee.courtFee)}
                  </Td>
                  <Td hide="sm" align="right" num>
                    {bahtExact(charge?.shuttleFee ?? fee.shuttleFee)}
                    <div className="text-[11px] text-muted">{charge?.shuttleCount ?? fee.shuttleCount} ลูก</div>
                  </Td>
                  <Td align="right" num className="text-base font-bold">
                    {baht(charge?.total ?? fee.total)}
                  </Td>
                  <Td hide="sm">
                    {charge ? <ChargeStatusBadge status={charge.status} /> : <span className="text-xs text-muted">ยังไม่ออกบิล</span>}
                  </Td>
                  <Td>
                    {charge && (
                      <div className="flex flex-wrap justify-end gap-1">
                        {(mine || isAdmin) && charge.status !== "PAID" && charge.status !== "WAIVED" && (
                          <Link href={paths.pay(charge.id)} className={buttonClass(mine ? "accent" : "secondary", "sm")}>
                            {mine ? "จ่ายเงิน" : "QR"}
                          </Link>
                        )}
                        {isAdmin && (charge.status === "UNPAID" || charge.status === "REPORTED") && (
                          <ActionButton
                            action={setChargeStatus.bind(null, charge.id, "PAID")}
                            size="sm"
                            variant={charge.status === "REPORTED" ? "primary" : "secondary"}
                          >
                            รับเงินแล้ว
                          </ActionButton>
                        )}
                        {isAdmin && (charge.status === "PAID" || charge.status === "WAIVED") && (
                          <ActionButton
                            action={setChargeStatus.bind(null, charge.id, "UNPAID")}
                            size="sm"
                            variant="ghost"
                            confirm="แก้เป็นยังไม่จ่าย"
                          >
                            แก้กลับ
                          </ActionButton>
                        )}
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </TBody>
        </Table>
        {!rows.length && <CardBody className="text-sm text-muted">ยังไม่มีผู้เล่น</CardBody>}
      </Card>
    </div>
  );
}
