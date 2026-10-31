import Link from "next/link";
import { requireAdminPage } from "@/lib/viewer";
import { baht, thaiDate, thaiMonth, todayISO } from "@/lib/format";
import { financeMonth, outstandingCharges } from "@/server/queries";
import { addExpense, deleteExpense, setChargeStatus } from "@/server/actions/money";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action";
import { Dialog } from "@/components/dialog";
import { ChargeStatusBadge } from "@/components/session/status";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, Select } from "@/components/ui/field";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";

export const metadata = { title: "การเงิน" };

const CATEGORY = { COURT: "ค่าคอร์ท", SHUTTLE: "ค่าลูก", OTHER: "อื่นๆ" } as const;

function shiftMonth(ym: string, by: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireAdminPage();
  const { m } = await searchParams;
  const current = todayISO().slice(0, 7);
  const ym = m && /^\d{4}-\d{2}$/.test(m) ? m : current;
  const [month, owed] = await Promise.all([financeMonth(ym), outstandingCharges()]);
  const net = month.received - month.expenseTotal;
  const owedTotal = owed.reduce((s, c) => s + c.total, 0);

  return (
    <>
      <PageHeader
        title="การเงิน"
        description="รายรับนับตามวันที่ยืนยันรับเงิน รายจ่ายค่าคอร์ทและค่าลูกบันทึกให้อัตโนมัติเมื่อจบรอบ"
        actions={
          <Dialog trigger="+ บันทึกรายจ่าย" variant="primary" title="บันทึกรายจ่าย" description="เช่น ซื้อลูกเป็นหลอด ค่าน้ำ ค่าอุปกรณ์">
            <ActionForm action={addExpense} closeDialog resetOnSuccess className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="หมวด">
                  <Select name="category" defaultValue="OTHER">
                    <option value="SHUTTLE">ค่าลูก</option>
                    <option value="COURT">ค่าคอร์ท</option>
                    <option value="OTHER">อื่นๆ</option>
                  </Select>
                </Field>
                <Field label="วันที่">
                  <Input name="spentAt" type="date" defaultValue={todayISO()} required />
                </Field>
              </div>
              <Field label="จำนวนเงิน (บาท)">
                <Input name="amount" type="number" inputMode="decimal" min={0} step="any" required />
              </Field>
              <Field label="รายละเอียด">
                <Input name="note" required maxLength={200} placeholder="เช่น ลูก RSL 2 หลอด" />
              </Field>
              <SubmitButton>บันทึก</SubmitButton>
            </ActionForm>
          </Dialog>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <LinkButton href={`?m=${shiftMonth(ym, -1)}`} variant="ghost" size="sm">
          ← เดือนก่อน
        </LinkButton>
        <h2 className="text-lg font-semibold">{thaiMonth(ym)}</h2>
        {ym < current ? (
          <LinkButton href={`?m=${shiftMonth(ym, 1)}`} variant="ghost" size="sm">
            เดือนถัดไป →
          </LinkButton>
        ) : (
          <span className="w-24" />
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="รับเงินแล้ว" value={baht(month.received)} sub={`${month.paidCount} บิล`} tone="ok" />
        <Stat
          label="รายจ่าย"
          value={baht(month.expenseTotal)}
          sub={`คอร์ท ${baht(month.byCategory.COURT)} · ลูก ${baht(month.byCategory.SHUTTLE)}`}
        />
        <Stat label="คงเหลือ" value={baht(net)} sub="รับเงินแล้ว − รายจ่าย" tone={net < 0 ? "danger" : undefined} />
        <Stat
          label="ยอดค้างทั้งหมด"
          value={baht(owedTotal)}
          sub={`${owed.length} บิล (ทุกเดือน)`}
          tone={owedTotal ? "danger" : undefined}
        />
      </section>

      <Card>
        <CardHeader title="ยอดค้างชำระ" description="รายการที่แจ้งโอนแล้วขึ้นก่อน ตรวจในแอปธนาคารแล้วกดยืนยัน" />
        {owed.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-semibold sm:px-5">ชื่อ</th>
                  <th className="hidden px-2 py-2 font-semibold sm:table-cell">รอบ</th>
                  <th className="hidden px-2 py-2 font-semibold sm:table-cell">สถานะ</th>
                  <th className="px-2 py-2 text-right font-semibold">ยอด</th>
                  <th className="px-5 py-2">
                    <span className="sr-only">จัดการ</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {owed.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5 sm:px-5">
                      <Link href={`/members/${c.memberId}`} className="font-semibold hover:underline">
                        {c.member.nickname}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted sm:hidden">
                        <ChargeStatusBadge status={c.status} />
                        {thaiDate(c.session.date)}
                      </div>
                    </td>
                    <td className="hidden px-2 py-2.5 sm:table-cell">
                      <Link href={`/sessions/${c.sessionId}?tab=bills`} className="hover:underline">
                        {c.session.venue}
                      </Link>{" "}
                      <span className="text-muted">· {thaiDate(c.session.date)}</span>
                    </td>
                    <td className="hidden px-2 py-2.5 sm:table-cell">
                      <ChargeStatusBadge status={c.status} />
                    </td>
                    <td className="num px-2 py-2.5 text-right font-bold">{baht(c.total)}</td>
                    <td className="px-4 py-2.5 sm:px-5">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Link href={`/pay/${c.id}`} className={buttonClass("ghost", "sm")}>
                          QR
                        </Link>
                        <ActionButton
                          action={setChargeStatus.bind(null, c.id, "PAID")}
                          size="sm"
                          variant={c.status === "REPORTED" ? "primary" : "secondary"}
                        >
                          รับเงินแล้ว
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="ไม่มียอดค้าง" description="ทุกคนจ่ายครบแล้ว" />
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="สรุปรายรอบ" description={`รอบที่จบแล้วใน${thaiMonth(ym)}`} />
          {month.sessionRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="px-5 py-2 font-semibold">รอบ</th>
                    <th className="px-2 py-2 text-right font-semibold">ต้นทุน</th>
                    <th className="px-2 py-2 text-right font-semibold">เรียกเก็บ</th>
                    <th className="px-5 py-2 text-right font-semibold">ได้รับ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {month.sessionRows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-2.5">
                        <Link href={`/sessions/${r.id}?tab=bills`} className="font-medium hover:underline">
                          {thaiDate(r.date)}
                        </Link>{" "}
                        <span className="text-muted">· {r.players} คน</span>
                      </td>
                      <td className="num px-2 py-2.5 text-right">{baht(r.cost)}</td>
                      <td className="num px-2 py-2.5 text-right">{baht(r.billed)}</td>
                      <td className={`num px-5 py-2.5 text-right font-semibold ${r.received >= r.billed ? "text-ok" : ""}`}>
                        {baht(r.received)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="ยังไม่มีรอบที่จบในเดือนนี้" />
          )}
        </Card>

        <Card>
          <CardHeader title="รายจ่าย" description={`${month.expenses.length} รายการ`} />
          {month.expenses.length ? (
            <ul className="divide-y divide-line">
              {month.expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge>{CATEGORY[e.category]}</Badge>
                      <span className="truncate">{e.note}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {thaiDate(e.spentAt)}
                      {e.session ? ` · จากรอบ ${e.session.venue}` : " · บันทึกเอง"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="num font-semibold">{baht(e.amount)}</span>
                    {!e.sessionId && (
                      <ActionButton action={deleteExpense.bind(null, e.id)} size="sm" variant="ghost" confirm="ลบ">
                        ลบ
                      </ActionButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="text-sm text-muted">ยังไม่มีรายจ่ายในเดือนนี้</CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
