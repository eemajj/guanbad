import Link from "next/link";
import { paths } from "@/lib/paths";
import { thaiDate, thaiDateTime } from "@/lib/format";
import { Badge, type Tone } from "@/ui/badge";
import type { ActivityRow } from "../queries";

const KIND: { prefix: string; label: string; tone: Tone }[] = [
  { prefix: "charge.", label: "เงิน", tone: "accent" },
  { prefix: "expense.", label: "รายจ่าย", tone: "accent" },
  { prefix: "settings.", label: "ตั้งค่า", tone: "danger" },
  { prefix: "match.", label: "เกม", tone: "ok" },
  { prefix: "session.delete", label: "ลบรอบ", tone: "danger" },
  { prefix: "session.", label: "รอบ", tone: "brand" },
  { prefix: "participant.", label: "ผู้เล่น", tone: "neutral" },
  { prefix: "member.", label: "สมาชิก", tone: "neutral" },
  { prefix: "user.", label: "สิทธิ์", tone: "danger" },
];
const kindOf = (type: string) => KIND.find((k) => type.startsWith(k.prefix)) ?? { label: "อื่นๆ", tone: "neutral" as Tone };

/** Who did what, newest first. `showSession` adds a link to the session for the global history page. */
export function ActivityList({ rows, showSession }: { rows: ActivityRow[]; showSession?: boolean }) {
  if (!rows.length) return <p className="px-5 py-6 text-sm text-muted">ยังไม่มีประวัติ</p>;
  return (
    <ol className="divide-y divide-line">
      {rows.map((a) => {
        const kind = kindOf(a.type);
        const who = a.actor?.member?.nickname ?? a.actor?.name ?? "ระบบ";
        return (
          <li key={a.id} className="flex gap-3 px-5 py-2.5 text-sm">
            <Badge tone={kind.tone} className="mt-0.5 shrink-0">
              {kind.label}
            </Badge>
            <div className="min-w-0 flex-1">
              <div className="break-words">{a.summary}</div>
              <div className="text-xs text-muted">
                {who} · {thaiDateTime(a.at)}
                {showSession && a.session && (
                  <>
                    {" · "}
                    <Link href={paths.session(a.session.id)} className="hover:underline">
                      {a.session.venue} {thaiDate(a.session.date)}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
