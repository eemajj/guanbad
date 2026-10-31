import { startSession } from "@/features/sessions/actions";
import type { SessionDetail, SessionState } from "@/features/sessions/state";
import { ActionButton } from "@/ui/action";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty";
import { fillCourts } from "../actions";
import { CourtCard } from "./court-card";
import { MatchHistory } from "./match-history";
import { namesFor } from "./names";
import { QueueCard } from "./queue-card";

/** The "คอร์ท" tab: courts, what's next, the queue and finished games. */
export function CourtsTab({ s, st, isAdmin }: { s: SessionDetail; st: SessionState; isAdmin: boolean }) {
  if (s.status === "OPEN") {
    return (
      <Card>
        <EmptyState
          title="รอบยังไม่เริ่ม"
          description={`ตอนนี้ลงชื่อ ${s.participants.length} คน เมื่อถึงสนามแล้ว หัวก๊วนกด “เริ่มตี” ระบบจะจัดคู่ลงทุกคอร์ทให้`}
          action={
            isAdmin && (
              <ActionButton action={startSession.bind(null, s.id)} variant="primary" size="lg">
                เริ่มตี
              </ActionButton>
            )
          }
        />
      </Card>
    );
  }

  const { pair } = namesFor(s);
  const canFill = st.freeCourts.length > 0 && st.queue.length >= 4;

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && s.status === "LIVE" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <div className="text-sm">
            <b>คอร์ทว่าง {st.freeCourts.length}</b> <span className="text-muted">· รอคิว {st.queue.length} คน</span>
          </div>
          <ActionButton action={fillCourts.bind(null, s.id, undefined)} variant="primary" className={canFill ? "" : "opacity-50"}>
            จัดคู่ลงคอร์ทว่าง
          </ActionButton>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {s.courts.map((court) => (
          <CourtCard
            key={court.id}
            s={s}
            court={court}
            match={st.playingByCourt.get(court.id)}
            nextInQueue={st.queue[0]?.id}
            isAdmin={isAdmin}
          />
        ))}
      </div>

      {st.next && s.status === "LIVE" && (
        <div className="rounded-xl border border-dashed border-accent bg-accent-soft px-4 py-3">
          <div className="text-xs font-semibold text-muted">เกมถัดไป (ถ้าจัดตอนนี้)</div>
          <div className="font-display text-lg font-semibold">
            {pair(st.next.teamA)} <span className="mx-1 text-accent">vs</span> {pair(st.next.teamB)}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <QueueCard s={s} st={st} />
        <MatchHistory s={s} st={st} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
