import type { Court } from "@prisma/client";
import { levelCode } from "@/domain/levels";
import { minutesSince } from "@/lib/format";
import { MinutesSince } from "@/ui/elapsed";
import { ActionButton } from "@/ui/action";
import { Badge } from "@/ui/badge";
import { Dialog } from "@/ui/dialog";
import { teamOf, type MatchWithPlayers, type SessionDetail } from "@/features/sessions/state";
import { cancelMatch, fillCourts, finishMatch, substitutePlayer } from "../actions";
import { namesFor } from "./names";
import { ResultForm } from "./result-form";

type Props = { s: SessionDetail; court: Court; match?: MatchWithPlayers; nextInQueue?: string; isAdmin: boolean };

/** One court: who is on it (drawn as a court), and the organiser's controls. */
export function CourtCard({ s, court, match: m, nextInQueue, isAdmin }: Props) {
  const { member, name, pair } = namesFor(s);
  const a = m ? teamOf(m, "A") : [];
  const b = m ? teamOf(m, "B") : [];
  const live = isAdmin && s.status === "LIVE";

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-card">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-bold">คอร์ท {court.name}</h3>
        {m ? (
          <span className="num text-sm text-muted">
            <MinutesSince since={m.startedAt} /> นาที
          </span>
        ) : (
          <Badge>ว่าง</Badge>
        )}
      </div>

      {m ? (
        <div className="relative grid min-h-28 grid-cols-2 rounded-sm border-2 border-court-line bg-court text-white">
          <div className="pointer-events-none absolute inset-x-2 inset-y-2.5 border border-court-line/50" />
          {[a, b].map((team, i) => (
            <div
              key={i}
              className={`relative flex flex-col items-center justify-center gap-1.5 p-3 ${i ? "border-l-[3px] border-dashed border-court-line" : ""}`}
            >
              {team.map((id) => (
                <span
                  key={id}
                  className="flex max-w-full items-center gap-1 truncate rounded bg-black/20 px-2 py-0.5 font-display font-semibold"
                >
                  {name(id)}
                  <span className="text-[11px] font-medium opacity-80">{member.get(id) && levelCode(member.get(id)!.level)}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid min-h-28 place-items-center rounded-sm border-2 border-court-line bg-[repeating-linear-gradient(135deg,rgb(var(--court))_0_10px,rgb(var(--court)/.85)_10px_20px)] font-display text-white/90 opacity-70">
          {s.status === "CLOSED" ? "จบรอบแล้ว" : "รอจัดคู่"}
        </div>
      )}

      {live && m && (
        <div className="flex flex-wrap gap-2">
          {/* key: a new game on this court must open with an empty form */}
          <Dialog
            key={m.id}
            trigger="จบเกม"
            variant="primary"
            triggerClassName="flex-1"
            title={`จบเกม คอร์ท ${court.name}`}
            description={`เล่นไป ${minutesSince(m.startedAt)} นาที`}
          >
            <ResultForm action={finishMatch.bind(null, m.id)} teamA={pair(a)} teamB={pair(b)} submitLabel="บันทึก แล้วจัดคู่ถัดไป" />
          </Dialog>
          <Dialog
            key={`sub-${m.id}`}
            trigger="เปลี่ยนตัว"
            title="เปลี่ยนตัว"
            description={nextInQueue ? `${name(nextInQueue)} (หัวคิว) จะลงแทน แล้วคนที่ออกจะถูกตั้งเป็นพัก` : "ไม่มีคนรอคิวลงแทน"}
          >
            <div className="grid grid-cols-2 gap-2">
              {[...a, ...b].map((id) => (
                <ActionButton key={id} action={substitutePlayer.bind(null, m.id, id)} closeDialog>
                  {name(id)} ออก
                </ActionButton>
              ))}
            </div>
          </Dialog>
          <ActionButton action={cancelMatch.bind(null, m.id)} variant="ghost" confirm="ยกเลิกเกม (ไม่นับ)">
            ยกเลิก
          </ActionButton>
        </div>
      )}
      {live && !m && <ActionButton action={fillCourts.bind(null, s.id, court.id)}>จัดคู่ลงคอร์ทนี้</ActionButton>}
    </article>
  );
}
