import { redirect } from "next/navigation";
import { auth, devLoginEnabled, lineLoginEnabled, signIn } from "@/auth";
import { getSettings } from "@/server/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { IconShuttle } from "@/components/icons";

export const metadata = { title: "เข้าสู่ระบบ" };

/** Only allow same-site paths: "//evil.com" and "/\evil.com" start with "/" but leave the site. */
function safeNext(next: string | undefined) {
  if (!next?.startsWith("/")) return "/";
  const base = "http://local.invalid";
  const url = new URL(next, base);
  return url.origin === base ? url.pathname + url.search + url.hash : "/";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const to = safeNext(next);
  if ((await auth())?.user) redirect(to);
  const settings = await getSettings();

  return (
    <main className="grid min-h-dvh place-items-center bg-brand-deep px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-7 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white">
            <IconShuttle width={30} height={30} />
          </span>
          <h1 className="text-2xl font-bold">{settings.groupName}</h1>
          <p className="text-sm text-muted">ลงชื่อรอบตี ดูคิว และจ่ายค่าคอร์ทได้ในที่เดียว</p>
        </div>

        {lineLoginEnabled && (
          <form action={async () => { "use server"; await signIn("line", { redirectTo: to }); }}>
            <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#06C755] font-semibold text-white hover:brightness-95">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="currentColor"><path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.6 7.2 8.4 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5 1-.4 5.6-3.3 7.7-5.7C21.2 14.6 22 12.9 22 11c0-4.4-4.5-8-10-8z"/></svg>
              เข้าสู่ระบบด้วย LINE
            </button>
          </form>
        )}

        {devLoginEnabled && (
          <form
            className="mt-4 flex flex-col gap-2 rounded-xl border border-dashed border-line p-3"
            action={async (fd) => { "use server"; await signIn("dev", { name: String(fd.get("name") ?? ""), redirectTo: to }); }}
          >
            <span className="text-xs font-semibold text-muted">ล็อกอินทดสอบ (ปิดบนเว็บจริง)</span>
            <Input name="name" placeholder="ชื่อผู้ใช้ทดสอบ" required aria-label="ชื่อผู้ใช้ทดสอบ" />
            <Button type="submit" variant="secondary">เข้าสู่ระบบ</Button>
          </form>
        )}

        {!lineLoginEnabled && !devLoginEnabled && (
          <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">ยังไม่ได้ตั้งค่า LINE Login ดูวิธีตั้งค่าใน README</p>
        )}
      </div>
    </main>
  );
}
