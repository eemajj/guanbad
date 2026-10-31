import { requireAdminPage } from "@/server/viewer";
import { getSettings, listAdmins } from "@/features/settings/queries";
import { updateSettings } from "@/features/settings/actions";
import { promptpayPayload } from "@/domain/promptpay";
import { LEVELS, LEVEL_ORDER } from "@/domain/levels";
import { ActionForm, SubmitButton } from "@/ui/action";
import { QrCode } from "@/ui/qr";
import { Card, CardBody, CardHeader } from "@/ui/card";
import { Field, Input } from "@/ui/field";
import { PageHeader } from "@/ui/page-header";

export const metadata = { title: "ตั้งค่า" };

export default async function SettingsPage() {
  await requireAdminPage();
  const [s, admins] = await Promise.all([getSettings(), listAdmins()]);
  const sample = s.promptpayId ? promptpayPayload(s.promptpayId) : null;

  return (
    <>
      <PageHeader title="ตั้งค่าก๊วน" />
      <Card>
        <CardHeader
          title="ข้อมูลก๊วนและการรับเงิน"
          description="ใส่พร้อมเพย์ แล้วทุกบิลจะมี QR ที่ใส่ยอดของแต่ละคนไว้ให้ สมาชิกสแกนจ่ายได้ทันที"
        />
        <CardBody className="grid gap-6 lg:grid-cols-[1fr_auto]">
          <ActionForm action={updateSettings} className="flex flex-col gap-4">
            <Field label="ชื่อก๊วน">
              <Input name="groupName" required maxLength={60} defaultValue={s.groupName} />
            </Field>
            <Field label="พร้อมเพย์ (เบอร์มือถือ หรือเลขบัตรประชาชน)">
              <Input name="promptpayId" inputMode="numeric" defaultValue={s.promptpayId ?? ""} placeholder="08x-xxx-xxxx" />
            </Field>
            <Field label="ชื่อบัญชี" hint="แสดงใต้ QR ให้สมาชิกเห็นว่าโอนให้ใคร">
              <Input name="accountName" maxLength={80} defaultValue={s.accountName ?? ""} />
            </Field>
            <div>
              <SubmitButton>บันทึก</SubmitButton>
            </div>
          </ActionForm>
          {sample && (
            <div className="flex flex-col items-center gap-2 self-start rounded-xl bg-white p-4 text-[#0b1a13]">
              <QrCode text={sample} size={160} label="ตัวอย่าง QR พร้อมเพย์" />
              <span className="text-xs">ตัวอย่าง (ไม่ใส่ยอด) ลองสแกนเช็คชื่อบัญชี</span>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="หัวก๊วน" description="หัวก๊วนจัดการได้ทุกอย่าง ตั้งหัวก๊วนร่วมได้จากหน้าสมาชิก (ต้องผูกบัญชี LINE แล้ว)" />
        <ul className="divide-y divide-line">
          {admins.map((a) => (
            <li key={a.id} className="px-5 py-2.5 text-sm">
              <b>{a.member?.nickname ?? a.name}</b> <span className="text-muted">· LINE: {a.name}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="เกณฑ์ประเมินมือ" description="ใช้แบ่งทีมให้สูสี ระบบเลี่ยงจับระดับที่ห่างกันมากลงเกมเดียวกัน" />
        <ul className="divide-y divide-line">
          {LEVEL_ORDER.map((l) => (
            <li key={l} className="grid grid-cols-[48px_1fr] gap-3 px-5 py-2.5 text-sm">
              <span className="font-display text-base font-bold text-brand">{LEVELS[l].code}</span>
              <span>
                <b>{LEVELS[l].name}</b>
                <span className="block text-muted">{LEVELS[l].description}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
