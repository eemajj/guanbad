import type { Member } from "@prisma/client";
import type { ActionResult } from "@/lib/action";
import { ActionForm, SubmitButton } from "@/components/action";
import { LevelPicker } from "@/components/level";
import { Field, Input, Textarea } from "@/components/ui/field";

export function MemberForm({
  action,
  member,
  showNote,
  submitLabel,
}: {
  action: (f: FormData) => Promise<ActionResult>;
  member?: Member;
  showNote: boolean;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ชื่อเล่น">
          <Input name="nickname" required maxLength={30} defaultValue={member?.nickname} />
        </Field>
        <Field label="ชื่อจริง (ไม่บังคับ)">
          <Input name="fullName" maxLength={80} defaultValue={member?.fullName ?? ""} />
        </Field>
        <Field label="เบอร์โทร (ไม่บังคับ)">
          <Input name="phone" inputMode="tel" maxLength={20} defaultValue={member?.phone ?? ""} />
        </Field>
      </div>
      <LevelPicker defaultValue={member?.level} />
      {showNote && (
        <Field label="บันทึกของหัวก๊วน" hint="สมาชิกไม่เห็นข้อความนี้">
          <Textarea name="note" maxLength={300} defaultValue={member?.note ?? ""} />
        </Field>
      )}
      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
