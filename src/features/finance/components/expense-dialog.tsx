import { todayISO } from "@/lib/format";
import { addExpense } from "@/features/finance/actions";
import { ActionForm, SubmitButton } from "@/ui/action";
import { Dialog } from "@/ui/dialog";
import { Field, Input, Select } from "@/ui/field";

/** Organiser records a one-off expense (shuttle tubes, water, equipment). */
export function ExpenseDialog() {
  return (
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
  );
}
