import type { SessionDetail, SessionState } from "@/server/session-state";
import { teamOf } from "@/server/session-state";
import { levelCode } from "@/domain/levels";
import { cancelMatch, fillCourts, finishMatch, substitutePlayer } from "@/server/actions/play";
import { startSession } from "@/server/actions/sessions";
import { minutesSince, thaiDateTime } from "@/lib/format";
import { ActionButton } from "@/components/action";
import { Dialog } from "@/components/dialog";
import { FinishMatchForm } from "@/components/session/finish-match";
import { LevelBadge } from "@/components/level";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";

export function CourtsTab({ s, st, isAdmin }: { s: SessionDetail; st: SessionState; isAdmin: boolean }) {
  const member = new Map(s.participants.map((p) => [p.memberId, p.member]));
  const name = (id: string) => member.get(id)?.nickname ?? "?";
  const pair = (ids: string[]) => ids.map(name).join(" + ");

  if (s.status === "OPEN") {
    return (
      <Card>
        <EmptyState
          title="รอบยังไม่เริ่ม"
          description={`ตอนนี้ลงชื่อ ${s.participants.length} คน เมื่อถึงสนามแล้ว หัวก๊วนกด “เริ่มตี” ระบบจะจัดคู่ลงทุกคอร์ทให้`}
          action={isAdmin && <ActionButton action={startSession.bind(null, s.id)} variant="primary" size="lg">เริ่มตี</ActionButton>}
        />
      </Card>
    );
  }

  const done = s.matches.filter((m) => m.status === "DONE").reverse();
  const resting = s.participants.filter((p) => p.status !== "ACTIVE");

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && s.status === "LIVE" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <div className="text-sm">
            <b>คอร์ทว่าง {st.freeCourts.length}</b> <span className="text-muted">· รอคิว {st.queue.length} คน</span>
          </div>
          <ActionButton action={fillCourts.bind(null, s.id, undefined)} variant="primary" className={st.freeCourts.length && st.queue.length >= 4 ? "" : "opacity-50"}>
            จัดคู่ลงคอร์ทว่าง
          </ActionButton>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {s.courts.map((court) => {
          const m = st.playingByCourt.get(court.id);
          const a = m ? teamOf(m, "A") : [];
          const b = m ? teamOf(m, "B") : [];
          return (
            <article key={court.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-card">
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-bold">คอร์ท {court.name}</h3>
                {m ? <span className="num text-sm text-muted">{minutesSince(m.startedAt)} นาที</span> : <Badge>ว่าง</Badge>}
              </div>

              {m ? (
                <div className="relative grid min-h-28 grid-cols-2 rounded-sm border-2 border-court-line bg-court text-white">
                  <div className="pointer-events-none absolute inset-x-2 inset-y-2.5 border border-court-line/50" />
                  {[a, b].map((team, i) => (
                    <div key={i} className={`relative flex flex-col items-center justify-center gap-1.5 p-3 ${i ? "border-l-[3px] border-dashed border-court-line" : ""}`}>
                      {team.map((id) => (
                        <span key={id} className="flex max-w-full items-center gap-1 truncate rounded bg-black/20 px-2 py-0.5 font-display font-semibold">
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

              {isAdmin && s.status === "LIVE" && m && (
                <div className="flex flex-wrap gap-2">
                  <Dialog trigger="จบเกม" variant="primary" triggerClassName="flex-1" title={`จบเกม คอร์ท ${court.name}`} description={`เล่นไป ${minutesSince(m.startedAt)} นาที`}>
                    <FinishMatchForm action={finishMatch.bind(null, m.id)} teamA={pair(a)} teamB={pair(b)} />
                  </Dialog>
                  <Dialog trigger="เปลี่ยนตัว" title="เปลี่ยนตัว" description={st.queue[0] ? `${name(st.queue[0].id)} (หัวคิว) จะลงแทน แล้วคนที่ออกจะถูกตั้งเป็นพัก` : "ไม่มีคนรอคิวลงแทน"}>
                    <div className="grid grid-cols-2 gap-2">
                      {[...a, ...b].map((id) => (
                        <ActionButton key={id} action={substitutePlayer.bind(null, m.id, id)} closeDialog>
                          {name(id)} ออก
                        </ActionButton>
                      ))}
                    </div>
                  </Dialog>
                  <ActionButton action={cancelMatch.bind(null, m.id)} variant="ghost" confirm="ยกเลิกเกม (ไม่นับ)">ยกเลิก</ActionButton>
                </div>
              )}
              {isAdmin && s.status === "LIVE" && !m && (
                <ActionButton action={fillCourts.bind(null, s.id, court.id)}>จัดคู่ลงคอร์ทนี้</ActionButton>
              )}
            </article>
          );
        })}
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
        <Card>
          <CardHeader title="คิวรอ" description="คนที่รอนานที่สุดได้ลงก่อน แล้วระบบแบ่งทีมให้ระดับมือใกล้กัน และเลี่ยงคู่ซ้ำ" />
          {st.queue.length ? (
            <ol className="divide-y divide-line">
              {st.queue.map((q, i) => {
                const mem = member.get(q.id)!;
                return (
                  <li key={q.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="num w-6 text-right text-muted">{i + 1}</span>
                    <span className="flex-1 font-medium">{mem.nickname}</span>
                    <span className="text-xs text-muted">รอ {minutesSince(new Date(q.queuedAt))} นาที · {q.games} เกม</span>
                    <LevelBadge level={mem.level} />
                  </li>
                );
              })}
            </ol>
          ) : (
            <CardBody className="text-sm text-muted">ไม่มีใครรอคิว</CardBody>
          )}
          {!!resting.length && (
            <CardBody className="flex flex-wrap items-center gap-2 border-t border-line">
              <span className="text-xs font-semibold text-muted">พัก / กลับแล้ว</span>
              {resting.map((p) => (
                <Badge key={p.id} tone={p.status === "RESTING" ? "warn" : "outline"}>{p.member.nickname}</Badge>
              ))}
            </CardBody>
          )}
        </Card>

        <Card>
          <CardHeader title="ผลการแข่ง" description={`${done.length} เกม · ใช้ลูก ${st.fees.shuttlesUsed} ลูก`} />
          {done.length ? (
            <ul className="divide-y divide-line">
              {done.map((m) => {
                const court = s.courts.find((c) => c.id === m.courtId);
                return (
                  <li key={m.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-2.5 text-sm">
                    <Badge>คอร์ท {court?.name}</Badge>
                    <span className="min-w-0">
                      <span className={m.winner === "A" ? "font-semibold text-ok" : ""}>{pair(teamOf(m, "A"))}</span>
                      <span className="mx-1.5 text-muted">vs</span>
                      <span className={m.winner === "B" ? "font-semibold text-ok" : ""}>{pair(teamOf(m, "B"))}</span>
                    </span>
                    <span className="text-right text-xs text-muted">
                      {m.shuttles} ลูก
                      <br />
                      {m.endedAt && thaiDateTime(m.endedAt).split(" ").pop()}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <CardBody className="text-sm text-muted">ยังไม่มีเกมที่จบ</CardBody>
          )}
        </Card>
      </div>
    </div>
  );
}

