import { paths } from "@/lib/paths";
import Link from "next/link";
import { EXPENSE_CATEGORY } from "@/domain/labels";
import { baht, thaiDate, thaiMonth } from "@/lib/format";
import type { financeMonth } from "@/features/finance/queries";
import { deleteExpense } from "@/features/finance/actions";
import { ActionButton } from "@/ui/action";
import { Badge } from "@/ui/badge";
import { cn } from "@/lib/cn";
import { Table, TBody, THead, Td, Th } from "@/ui/table";
import { Card, CardBody, CardHeader } from "@/ui/card";
import { EmptyState } from "@/ui/empty";

type Month = Awaited<ReturnType<typeof financeMonth>>;

/** Per-session summary and the expense ledger for one month. */
export function MonthDetails({ month, ym }: { month: Month; ym: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="สรุปรายรอบ" description={`รอบที่จบแล้วใน${thaiMonth(ym)}`} />
        {month.sessionRows.length ? (
          <Table>
            <THead>
              <Th>รอบ</Th>
              <Th align="right">ต้นทุน</Th>
              <Th align="right">เรียกเก็บ</Th>
              <Th align="right">ได้รับ</Th>
            </THead>
            <TBody>
              {month.sessionRows.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <Link href={paths.session(r.id, "bills")} className="font-medium hover:underline">
                      {thaiDate(r.date)}
                    </Link>{" "}
                    <span className="text-muted">· {r.players} คน</span>
                  </Td>
                  <Td align="right" num>
                    {baht(r.cost)}
                  </Td>
                  <Td align="right" num>
                    {baht(r.billed)}
                  </Td>
                  <Td num align="right" className={cn("font-semibold", r.received >= r.billed && "text-ok")}>
                    {baht(r.received)}
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
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
                    <Badge>{EXPENSE_CATEGORY[e.category]}</Badge>
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
  );
}
