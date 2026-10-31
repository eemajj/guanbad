import type { Session, Court } from "@prisma/client";
import type { ActionResult } from "@/lib/action";
import { isoFromDate, todayISO } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/action";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";

type Defaults = { venue?: string | null; courtRate: number; shuttlePrice: number };

export function SessionForm({
  action,
  session,
  defaults,
  submitLabel,
}: {
  action: (form: FormData) => Promise<ActionResult>;
  session?: Session & { courts: Court[] };
  defaults: Defaults;
  submitLabel: string;
}) {
  const s = session;
  return (
    <ActionForm action={action} className="flex flex-col gap-5">
      <Card>
        <CardHeader title="สนามและเวลา" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="สนาม" className="sm:col-span-2">
            <Input name="venue" required maxLength={80} placeholder="เช่น สนามแบด ส.บุญมี" defaultValue={s?.venue ?? defaults.venue ?? ""} />
          </Field>
          <Field label="วันที่">
            <Input name="date" type="date" required defaultValue={s ? isoFromDate(s.date) : todayISO()} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="เริ่ม">
              <Input name="startTime" type="time" required defaultValue={s?.startTime ?? "19:00"} />
            </Field>
            <Field label="เลิก">
              <Input name="endTime" type="time" required defaultValue={s?.endTime ?? "21:00"} />
            </Field>
          </div>
          <Field label="หมายเลขคอร์ท" hint="คั่นด้วยเครื่องหมายจุลภาค เช่น 5, 6" className="sm:col-span-2">
            <Input name="courts" required defaultValue={s ? s.courts.map((c) => c.name).join(", ") : "1, 2"} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="ค่าใช้จ่าย" description="ค่าลูกคิดตามจริง: ทุกเกมกดใส่ว่าใช้กี่ลูก แล้วหาร 4 คนในเกมนั้น" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="ค่าคอร์ท ต่อคอร์ทต่อชั่วโมง (บาท)">
            <Input name="courtRate" type="number" inputMode="decimal" min={0} step="any" required defaultValue={(s?.courtRate ?? defaults.courtRate) / 100} />
          </Field>
          <Field label="ราคาลูก ต่อลูก (บาท)">
            <Input name="shuttlePrice" type="number" inputMode="decimal" min={0} step="any" required defaultValue={(s?.shuttlePrice ?? defaults.shuttlePrice) / 100} />
          </Field>
          <Field label="แบ่งค่าคอร์ทยังไง">
            <Select name="feeMode" defaultValue={s?.feeMode ?? "SPLIT"}>
              <option value="SPLIT">หารเท่ากันทุกคนที่มา</option>
              <option value="FLAT">เก็บคนละเท่ากัน (ตามช่องถัดไป)</option>
            </Select>
          </Field>
          <Field label="ค่าคอร์ทคนละ (บาท)" hint="ใช้เมื่อเลือก “เก็บคนละเท่ากัน”">
            <Input name="flatFee" type="number" inputMode="decimal" min={0} step="any" defaultValue={(s?.flatFee ?? 10000) / 100} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="การลงชื่อ" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="รับสูงสุด (คน)" hint="เว้นว่าง = ไม่จำกัด">
            <Input name="maxPlayers" type="number" min={4} max={200} defaultValue={s?.maxPlayers ?? ""} />
          </Field>
          <div className="flex items-end">
            <Checkbox name="selfSignup" defaultChecked={s?.selfSignup ?? true} label="ให้สมาชิกลงชื่อเองได้" hint="ปิดไว้ถ้าหัวก๊วนจะเพิ่มชื่อให้ทุกคนเอง" />
          </div>
          <Field label="หมายเหตุถึงสมาชิก (ไม่บังคับ)" className="sm:col-span-2">
            <Textarea name="note" maxLength={500} placeholder="เช่น ใส่รองเท้าพื้นยาง จอดรถด้านหลังสนาม" defaultValue={s?.note ?? ""} />
          </Field>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
