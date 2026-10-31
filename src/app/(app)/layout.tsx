import Link from "next/link";
import { signOut } from "@/auth";
import { requireMemberPage } from "@/lib/viewer";
import { getSettings } from "@/server/settings";
import { SideNav, TabBar, type NavItem } from "@/components/nav";
import { Avatar } from "@/components/ui/avatar";
import { IconShuttle } from "@/components/icons";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireMemberPage();
  const settings = await getSettings();
  const name = viewer.member?.nickname ?? viewer.user.name;

  const items: NavItem[] = viewer.isAdmin
    ? [
        { href: "/", label: "หน้าแรก", icon: "home" },
        { href: "/sessions", label: "รอบตี", icon: "court" },
        { href: "/stats", label: "สถิติ", icon: "chart" },
        { href: "/members", label: "สมาชิก", icon: "users" },
        { href: "/finance", label: "การเงิน", icon: "wallet" },
        { href: "/settings", label: "ตั้งค่า", icon: "settings", desktopOnly: true },
      ]
    : [
        { href: "/", label: "หน้าแรก", icon: "home" },
        { href: "/sessions", label: "รอบตี", icon: "court" },
        { href: "/stats", label: "สถิติ", icon: "chart" },
        { href: "/me", label: "ของฉัน", icon: "user" },
      ];

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col justify-between bg-brand-deep px-4 py-5 text-white lg:flex">
        <div className="flex flex-col gap-6">
          <Link href="/" className="flex items-center gap-2 px-2 font-display text-xl font-bold">
            <IconShuttle width={26} height={26} />
            {settings.groupName}
          </Link>
          <SideNav items={items} />
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
          <Avatar name={name} image={viewer.user.image} />
          <div className="min-w-0 flex-1">
            <Link href="/me" className="block truncate text-sm font-semibold hover:underline">
              {name}
            </Link>
            <div className="text-xs text-white/70">{viewer.isAdmin ? "หัวก๊วน" : "สมาชิก"}</div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="rounded-md px-2 py-1 text-xs text-white/80 hover:bg-white/10 hover:text-white">ออก</button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between bg-brand-deep px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white lg:hidden">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <IconShuttle width={22} height={22} />
          {settings.groupName}
        </Link>
        <Link href="/me" className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{viewer.isAdmin ? "หัวก๊วน" : "สมาชิก"}</span>
          <Avatar name={name} image={viewer.user.image} size={30} />
        </Link>
      </header>

      <div className="lg:pl-64">
        <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 pb-28 lg:px-8 lg:pb-12">{children}</main>
      </div>
      <TabBar items={items} />
    </div>
  );
}
