import Link from "next/link";
import type { Court, Session } from "@prisma/client";
import { SessionStatusBadge } from "@/components/session/status";
import { Badge } from "@/components/ui/badge";

export function SessionRow({ s, count, joined }: { s: Session & { courts: Court[] }; count: number; joined?: boolean }) {
  return (
    <li>
      <Link href={`/sessions/${s.id}`} className="grid grid-cols-[56px_1fr_auto] items-center gap-4 px-5 py-3 hover:bg-surface-2">
        <div className="rounded-lg bg-brand py-1.5 text-center font-display leading-tight text-brand-ink">
          <div className="text-xl font-bold">{s.date.getUTCDate()}</div>
          <div className="text-[11px] opacity-85">{s.date.toLocaleDateString("th-TH", { month: "short", timeZone: "UTC" })}</div>
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold">{s.venue}</div>
          <div className="text-sm text-muted">
            {s.date.toLocaleDateString("th-TH", { weekday: "short", timeZone: "UTC" })} {s.startTime}–{s.endTime} · {s.courts.length} คอร์ท · {count}
            {s.maxPlayers ? `/${s.maxPlayers}` : ""} คน
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <SessionStatusBadge status={s.status} />
          {joined && <Badge tone="brand">ลงชื่อแล้ว</Badge>}
        </div>
      </Link>
    </li>
  );
}
