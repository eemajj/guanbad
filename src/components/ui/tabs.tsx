import Link from "next/link";
import { cn } from "@/lib/cn";

export function TabLinks({ tabs, current }: { tabs: { key: string; label: string; href: string; count?: number }[]; current: string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line" aria-label="แท็บ">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          aria-current={t.key === current ? "page" : undefined}
          className={cn(
            "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-[3px] px-4 py-2.5 font-display text-[15px] font-semibold",
            t.key === current ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-surface-2 px-2 text-xs text-muted">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
