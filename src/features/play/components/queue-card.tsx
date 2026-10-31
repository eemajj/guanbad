import { minutesSince } from "@/lib/format";
import { Badge } from "@/ui/badge";
import { Card, CardBody, CardHeader } from "@/ui/card";
import { LevelBadge } from "@/ui/level";
import type { SessionDetail, SessionState } from "@/features/sessions/state";

/** Who is waiting, in the order they will play, plus who is resting or has gone home. */
export function QueueCard({ s, st }: { s: SessionDetail; st: SessionState }) {
  const member = new Map(s.participants.map((p) => [p.memberId, p.member]));
  const away = s.participants.filter((p) => p.status !== "ACTIVE");
  return (
    <Card>
      <CardHeader title="คิวรอ" description="คนที่รอนานที่สุดได้ลงก่อน แล้วระบบแบ่งทีมให้ระดับมือใกล้กัน และเลี่ยงคู่ซ้ำ" />
      {st.queue.length ? (
        <ol className="divide-y divide-line">
          {st.queue.map((q, i) => {
            const m = member.get(q.id)!;
            return (
              <li key={q.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="num w-6 text-right text-muted">{i + 1}</span>
                <span className="flex-1 font-medium">{m.nickname}</span>
                <span className="text-xs text-muted">
                  รอ {minutesSince(new Date(q.queuedAt))} นาที · {q.games} เกม
                </span>
                <LevelBadge level={m.level} />
              </li>
            );
          })}
        </ol>
      ) : (
        <CardBody className="text-sm text-muted">ไม่มีใครรอคิว</CardBody>
      )}
      {away.length > 0 && (
        <CardBody className="flex flex-wrap items-center gap-2 border-t border-line">
          <span className="text-xs font-semibold text-muted">พัก / กลับแล้ว</span>
          {away.map((p) => (
            <Badge key={p.id} tone={p.status === "RESTING" ? "warn" : "outline"}>
              {p.member.nickname}
            </Badge>
          ))}
        </CardBody>
      )}
    </Card>
  );
}
