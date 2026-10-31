import { paths } from "@/lib/paths";
import { requireAdminPage } from "@/server/viewer";
import { ExpenseDialog } from "@/features/finance/components/expense-dialog";
import { MonthDetails } from "@/features/finance/components/month-details";
import { OutstandingCard } from "@/features/billing/components/outstanding-card";
import { baht, thaiMonth, todayISO } from "@/lib/format";
import { financeMonth } from "@/features/finance/queries";
import { outstandingCharges } from "@/features/billing/queries";
import { LinkButton } from "@/ui/button";
import { PageHeader } from "@/ui/page-header";
import { Stat } from "@/ui/stat";

export const metadata = { title: "การเงิน" };

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
          <>
            <LinkButton href={paths.activity("money")}>ประวัติการเงิน</LinkButton>
            <ExpenseDialog />
          </>
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

      <OutstandingCard owed={owed} />

      <MonthDetails month={month} ym={ym} />
    </>
  );
}
