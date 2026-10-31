import { thaiTime } from "@/lib/format";
import { Badge } from "@/ui/badge";
import { Card, CardBody, CardHeader } from "@/ui/card";
import { Dialog } from "@/ui/dialog";
import { teamOf, type SessionDetail, type SessionState } from "@/features/sessions/state";
import { updateMatchResult } from "../actions";
import { namesFor } from "./names";
import { ResultForm } from "./result-form";

/** Finished games, newest first. Games without a result are flagged so the organiser can fill them in. */
export function MatchHistory({ s, st, isAdmin }: { s: SessionDetail; st: SessionState; isAdmin: boolean }) {
  const { pair } = namesFor(s);
  const done = s.matches.filter((m) => m.status === "DONE").reverse();
  const missing = done.length - st.results.withWinner;

  return (
    <Card>
      <CardHeader
        title="ผลการแข่ง"
        description={`${done.length} เกม · รู้ผล ${st.results.withWinner} · มีแต้ม ${st.results.withScore} · ใช้ลูก ${st.fees.shuttlesUsed} ลูก`}
      />
      {isAdmin && missing > 0 && (
        <p className="border-b border-line bg-warn-soft px-5 py-2 text-sm text-warn">
          ยังไม่ได้บันทึกผล {missing} เกม แตะ “ใส่ผล” เพื่อเติม (ไม่เติมก็ได้ แต่เกมนั้นจะไม่นับชนะ/แพ้)
        </p>
      )}
      {done.length ? (
        <ul className="divide-y divide-line">
          {done.map((m) => {
            const court = s.courts.find((c) => c.id === m.courtId);
            const ta = teamOf(m, "A");
            const tb = teamOf(m, "B");
            const scored = m.scoreA !== null && m.scoreB !== null;
            return (
              <li key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-2.5 text-sm">
                <div className="min-w-0">
                  <div>
                    <span className={m.winner === "A" ? "font-semibold text-ok" : ""}>{pair(ta)}</span>
                    <span className="mx-1.5 text-muted">vs</span>
                    <span className={m.winner === "B" ? "font-semibold text-ok" : ""}>{pair(tb)}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>คอร์ท {court?.name}</span>·<span>{m.shuttles} ลูก</span>
                    {m.endedAt && (
                      <>
                        ·<span>{thaiTime(m.endedAt)}</span>
                      </>
                    )}
                    {!m.winner && <Badge tone="warn">ยังไม่บันทึกผล</Badge>}
                    {m.winner && !scored && <Badge>ไม่มีแต้ม</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {scored && (
                    <span className="num text-base font-bold">
                      {m.scoreA}–{m.scoreB}
                    </span>
                  )}
                  {isAdmin && (
                    <Dialog
                      trigger={m.winner ? "แก้" : "ใส่ผล"}
                      size="sm"
                      variant={m.winner ? "ghost" : "secondary"}
                      title={`แก้ผลเกม คอร์ท ${court?.name}`}
                      description={`${pair(ta)} vs ${pair(tb)}`}
                    >
                      <ResultForm
                        action={updateMatchResult.bind(null, m.id)}
                        teamA={pair(ta)}
                        teamB={pair(tb)}
                        initial={{ winner: m.winner, scoreA: m.scoreA, scoreB: m.scoreB, shuttles: m.shuttles }}
                        shuttlesLocked={s.status === "CLOSED"}
                        submitLabel="บันทึกผล"
                      />
                    </Dialog>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <CardBody className="text-sm text-muted">ยังไม่มีเกมที่จบ</CardBody>
      )}
    </Card>
  );
}
