import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { getSettings } from "@/server/settings";
import { claimAdmin, needsSetup, setupBlocked, setupCodeRequired, type SetupError } from "@/server/setup";
import { clientIp } from "@/server/pin";
import { ADMIN_PIN_MIN, PIN_MAX } from "@/domain/pin";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { IconShuttle } from "@/components/icons";

export const metadata = { title: "เข้าสู่ระบบ" };

/** Only allow same-site paths: "//evil.com" and "/\evil.com" start with "/" but leave the site. */
function safeNext(next: string | undefined) {
  if (!next?.startsWith("/")) return "/";
  const base = "http://local.invalid";
  const url = new URL(next, base);
  const path = url.pathname + url.search + url.hash;
  // "/.//evil.com" normalises to "//evil.com", which a browser treats as another site.
  return url.origin === base && !path.startsWith("//") ? path : "/";
}

const PIN_ERRORS: Record<string, string> = {
  wrong: "PIN ไม่ถูกต้อง",
  locked: "ใส่ PIN ผิดหลายครั้ง รอ 15 นาทีแล้วลองใหม่",
  hard_locked: "ใส่ PIN ผิดหลายครั้งเกินไป ให้หัวก๊วนตั้ง PIN ใหม่ให้",
  no_pin: "ชื่อนี้ยังไม่มี PIN ขอหัวก๊วนตั้งให้",
  inactive: "ชื่อนี้ถูกปิดไว้ ติดต่อหัวก๊วน",
  too_many: "มีการใส่ PIN ผิดจากเครือข่ายนี้หลายครั้ง รอสักครู่ หรือลองสลับไปใช้เน็ตมือถือ",
};

const SETUP_ERRORS: Record<SetupError, string> = {
  code: "รหัสตั้งค่าไม่ถูกต้อง",
  name: "ใส่ชื่อเล่น",
  pin: `PIN ของหัวก๊วนต้องเป็นตัวเลข ${ADMIN_PIN_MIN}–${PIN_MAX} หลัก`,
  weak: "PIN เดาง่ายเกินไป (เลขซ้ำหรือเรียงกัน) เลือกใหม่",
  mismatch: "PIN สองช่องไม่ตรงกัน",
  done: "มีหัวก๊วนแล้ว เข้าสู่ระบบด้วยชื่อของคุณ",
  notadmin: "ไม่พบหัวก๊วนชื่อนี้ (ใส่ชื่อเล่นให้ตรงกับในระบบ)",
  too_many: "ใส่รหัสผิดหลายครั้ง รอสักครู่แล้วลองใหม่",
};

type Search = { next?: string; m?: string; error?: string; setup?: string; recover?: string };

/** Login URL that keeps the page the visitor was heading to. */
const loginUrl = (next: string | undefined, params: Record<string, string> = {}) =>
  `/login?${new URLSearchParams({ ...(next ? { next } : {}), ...params })}`;

export default async function LoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { next, m, error, setup, recover } = await searchParams;
  const to = safeNext(next);
  // getViewer, not auth(): a stale session (old PIN, removed member) must see the form, not loop back.
  if (await getViewer()) redirect(to);
  const [settings, firstRun] = await Promise.all([getSettings(), needsSetup()]);
  const keep = next ? to : undefined;

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
        {firstRun || recover ? <AdminForm mode={firstRun ? "setup" : "recover"} error={setup} /> : m ? <PinForm memberId={m} error={error} to={to} keep={keep} /> : <NamePicker keep={keep} />}
      </div>
    </main>
  );
}

async function NamePicker({ keep }: { keep?: string }) {
  const members = (await prisma.member.findMany({ where: { active: true, pinHash: { not: null } }, select: { id: true, nickname: true } }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, "th"));
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold">คุณคือใคร?</h2>
      <div className="flex flex-wrap gap-2">
        {members.map((mem) => (
          <Link key={mem.id} href={loginUrl(keep, { m: mem.id })} className={buttonClass("secondary", "md")}>{mem.nickname}</Link>
        ))}
      </div>
      <p className="text-xs text-muted">ไม่เจอชื่อ? ขอหัวก๊วนเพิ่มชื่อและตั้ง PIN ให้</p>
      <Link href="/login?recover=1" className="text-xs text-muted underline hover:text-ink">หัวก๊วนลืม PIN</Link>
    </div>
  );
}

async function PinForm({ memberId, error, to, keep }: { memberId: string; error?: string; to: string; keep?: string }) {
  const member = await prisma.member.findFirst({ where: { id: memberId, active: true, pinHash: { not: null } }, select: { id: true, nickname: true } });
  if (!member) redirect(loginUrl(keep));

  async function login(fd: FormData) {
    "use server";
    try {
      await signIn("pin", { memberId, pin: String(fd.get("pin") ?? ""), redirectTo: to });
    } catch (e) {
      if (e instanceof CredentialsSignin) redirect(loginUrl(keep, { m: memberId, error: e.code }));
      throw e; // includes Next's own redirect on success
    }
  }

  return (
    <form action={login} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">PIN ของ “{member.nickname}”</h2>
        <Link href={loginUrl(keep)} className="text-sm text-muted hover:text-ink">เปลี่ยนชื่อ</Link>
      </div>
      {/* Lets the browser's password manager remember the PIN per name. */}
      <input type="text" name="username" autoComplete="username" value={member.nickname} readOnly hidden />
      <Input name="pin" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="current-password" maxLength={PIN_MAX} required autoFocus aria-label="PIN" className="text-center text-2xl tracking-[0.5em]" />
      {error && <p role="alert" className="rounded-lg bg-warn-soft p-2.5 text-sm text-warn">{PIN_ERRORS[error] ?? PIN_ERRORS.wrong}</p>}
      <Button type="submit" variant="primary" size="lg">เข้าสู่ระบบ</Button>
      <p className="text-center text-xs text-muted">ลืม PIN? ขอหัวก๊วนตั้งให้ใหม่</p>
    </form>
  );
}

function AdminForm({ mode, error }: { mode: "setup" | "recover"; error?: string }) {
  async function submit(fd: FormData) {
    "use server";
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const r = await claimAdmin(mode, { code: get("code"), nickname: get("nickname"), pin: get("pin"), confirm: get("confirm"), ip: clientIp(await headers()) });
    if ("error" in r) redirect(`/login?${mode === "recover" ? "recover=1&" : ""}setup=${r.error}`);
    try {
      await signIn("pin", { memberId: r.memberId, pin: get("pin"), redirectTo: mode === "setup" ? "/settings" : "/" });
    } catch (e) {
      if (e instanceof CredentialsSignin) redirect(loginUrl(undefined, { m: r.memberId, error: e.code }));
      throw e;
    }
  }

  if (setupBlocked) {
    return <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">ต้องตั้งค่า <code>SETUP_CODE</code> ใน Environment Variables ของเว็บก่อน แล้วเปิดหน้านี้ใหม่ (ดู README)</p>;
  }
  return (
    <form action={submit} className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">{mode === "setup" ? "ตั้งหัวก๊วนคนแรก" : "หัวก๊วนลืม PIN"}</h2>
        <p className="text-sm text-muted">
          {mode === "setup"
            ? "ทำครั้งเดียวตอนเริ่มใช้ หลังจากนี้หัวก๊วนเพิ่มสมาชิกและตั้ง PIN ให้คนอื่นได้"
            : "ใช้รหัสตั้งค่าของเว็บ (SETUP_CODE) เพื่อตั้ง PIN ใหม่ให้หัวก๊วน สมาชิกทั่วไปให้หัวก๊วนตั้งให้"}
        </p>
      </div>
      {setupCodeRequired && <Field label="รหัสตั้งค่า (SETUP_CODE)"><Input name="code" required autoComplete="off" /></Field>}
      <Field label={mode === "setup" ? "ชื่อเล่นของคุณ" : "ชื่อเล่นของหัวก๊วน"}><Input name="nickname" required maxLength={30} autoComplete="username" /></Field>
      <Field label={`PIN ใหม่ ${ADMIN_PIN_MIN}–${PIN_MAX} หลัก`} hint="ห้ามเลขซ้ำหรือเรียงกัน เช่น 111111, 123456">
        <Input name="pin" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" minLength={ADMIN_PIN_MIN} maxLength={PIN_MAX} required />
      </Field>
      <Field label="ใส่ PIN อีกครั้ง">
        <Input name="confirm" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" minLength={ADMIN_PIN_MIN} maxLength={PIN_MAX} required />
      </Field>
      {error && <p role="alert" className="rounded-lg bg-warn-soft p-2.5 text-sm text-warn">{SETUP_ERRORS[error as SetupError] ?? SETUP_ERRORS.code}</p>}
      <Button type="submit" variant="primary" size="lg">{mode === "setup" ? "เริ่มใช้งาน" : "ตั้ง PIN ใหม่"}</Button>
      {mode === "recover" && <Link href="/login" className="text-center text-sm text-muted hover:text-ink">กลับ</Link>}
    </form>
  );
}
