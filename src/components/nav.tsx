"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { IconCourt, IconHome, IconSettings, IconUser, IconUsers, IconWallet } from "@/components/icons";

const ICONS = { home: IconHome, court: IconCourt, users: IconUsers, wallet: IconWallet, settings: IconSettings, user: IconUser };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

export function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const Icon = ICONS[it.icon];
        const active = isActive(path, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium", active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white")}
          >
            <Icon />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((it) => {
          const Icon = ICONS[it.icon];
          const active = isActive(path, it.href);
          return (
            <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-brand" : "text-muted")}>
              <Icon />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
