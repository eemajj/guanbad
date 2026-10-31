import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/viewer";
import { createMyProfile } from "@/server/actions/members";
import { ActionForm, SubmitButton } from "@/components/action";
import { Field, Input } from "@/components/ui/field";
import { LevelPicker } from "@/components/level";

export const metadata = { title: "สร้างโปรไฟล์" };

export default async function WelcomePage() {
  const viewer = await requireViewer();
  if (viewer.member) redirect("/");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">ยินดีต้อนรับเข้าก๊วน</h1>
        <p className="mt-1 text-sm text-muted">บอกชื่อเล่นและระดับมือของคุณ ใช้สำหรับลงชื่อและจัดคู่ หัวก๊วนปรับระดับให้ทีหลังได้</p>
      </div>
      <p className="rounded-lg bg-accent-soft p-3 text-sm">ถ้าหัวก๊วนเคยเพิ่มชื่อคุณไว้แล้ว ให้ขอ “ลิงก์ผูกบัญชี” จากหัวก๊วนแทน ประวัติการเล่นและยอดค้างจะได้อยู่ที่เดียวกัน</p>
      <ActionForm action={createMyProfile} className="flex flex-col gap-4">
        <Field label="ชื่อเล่น (ชื่อที่เพื่อนในก๊วนเรียก)">
          <Input name="nickname" defaultValue={viewer.user.name} required maxLength={30} />
        </Field>
        <Field label="เบอร์โทร (ไม่บังคับ)">
          <Input name="phone" inputMode="tel" placeholder="08x-xxx-xxxx" />
        </Field>
        <LevelPicker />
        <SubmitButton size="lg">เริ่มใช้งาน</SubmitButton>
      </ActionForm>
    </main>
  );
}
