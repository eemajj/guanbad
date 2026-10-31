import { paths } from "@/lib/paths";
import Link from "next/link";
import { baht } from "@/lib/format";
import { type SessionDetail, type SessionState } from "@/features/sessions/state";
import { joinSession, removeParticipant, setParticipantStatus } from "@/features/sessions/signup-actions";
import { ActionButton } from "@/ui/action";
import { buttonClass } from "@/ui/button";

/** สถานะของผู้ใช้คนนี้ในรอบ + สิ่งที่ทำได้ตอนนี้ */
export function MyCard({ s, st, memberId, isAdmin }: { s: SessionDetail; st: SessionState; memberId: string; isAdmin: boolean }) {
  const me = s.participants.find((p) => p.memberId === memberId);
  const box = "flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-brand bg-surface px-4 py-3";

  if (!me) {
    if (s.status === "CLOSED" || isAdmin) return null;
    const full = s.maxPlayers != null && s.participants.length >= s.maxPlayers;
    return (
      <div className={box}>
        <div>
          <div className="font-semibold">คุณยังไม่ได้ลงชื่อรอบนี้</div>
          <div className="text-sm text-muted">
            {!s.selfSignup
              ? "รอบนี้หัวก๊วนเป็นคนเพิ่มชื่อให้"
              : full
                ? `เต็มแล้ว (${s.maxPlayers} คน)`
                : `ลงชื่อแล้ว ${s.participants.length} คน`}
          </div>
        </div>
        {s.selfSignup && !full && (
          <ActionButton action={joinSession.bind(null, s.id)} optimistic="ลงชื่อแล้ว ✓" variant="primary" size="lg">
            ลงชื่อ
          </ActionButton>
        )}
      </div>
    );
  }

  const stat = st.stats.get(memberId)!;
  const charge = s.charges.find((c) => c.memberId === memberId);
  const playingCourt = stat.playing && s.courts.find((c) => c.id === stat.playing!.courtId);
  const queuePos = st.queue.findIndex((q) => q.id === memberId) + 1;

  let headline: string;
  let sub = `เล่นแล้ว ${stat.games} เกม · ชนะ ${stat.wins} แพ้ ${stat.losses}`;
  if (s.status === "OPEN") {
    headline = "ลงชื่อแล้ว ✓";
    sub = `เจอกัน ${s.startTime} น.`;
  } else if (s.status === "CLOSED") headline = charge ? `ยอดของคุณ ${baht(charge.total)}` : "จบรอบแล้ว";
  else if (playingCourt) headline = `กำลังเล่น คอร์ท ${playingCourt.name}`;
  else if (me.status === "RESTING") headline = "พักอยู่";
  else if (me.status === "LEFT") headline = "กลับบ้านแล้ว";
  else headline = `คิวที่ ${queuePos}`;
  if (me.status === "RESTING" && playingCourt) sub = "จะได้พักหลังจบเกมนี้";

  return (
    <div className={box}>
      <div>
        <div className="text-xs font-semibold text-muted">สถานะของคุณ</div>
        <div className="font-display text-xl font-bold">{headline}</div>
        <div className="text-sm text-muted">{sub}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {s.status === "OPEN" && (
          <ActionButton action={removeParticipant.bind(null, me.id)} variant="ghost" confirm="ยืนยันถอนชื่อ">
            ถอนชื่อ
          </ActionButton>
        )}
        {s.status === "LIVE" &&
          (me.status === "ACTIVE" ? (
            <ActionButton action={setParticipantStatus.bind(null, me.id, "RESTING")} optimistic="พักแล้ว" size="lg">
              ขอพัก
            </ActionButton>
          ) : (
            <ActionButton action={setParticipantStatus.bind(null, me.id, "ACTIVE")} optimistic="เข้าคิวแล้ว" variant="primary" size="lg">
              กลับมาเล่น
            </ActionButton>
          ))}
        {s.status === "CLOSED" && charge && (charge.status === "UNPAID" || charge.status === "REPORTED") && (
          <Link href={paths.pay(charge.id)} className={buttonClass("accent", "lg")}>
            {charge.status === "REPORTED" ? "ดูการแจ้งโอน" : "จ่ายเงิน"}
          </Link>
        )}
      </div>
    </div>
  );
}
