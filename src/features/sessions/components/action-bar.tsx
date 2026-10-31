import Link from "next/link";
import type { ReactNode } from "react";
import { baht } from "@/lib/format";
import { paths } from "@/lib/paths";
import { cn } from "@/lib/cn";
import { ActionButton } from "@/ui/action";
import { buttonClass } from "@/ui/button";
import { fillCourts } from "@/features/play/actions";
import { closeSession, startSession } from "../actions";
import { joinSession, removeParticipant, setParticipantStatus } from "../signup-actions";
import type { SessionDetail, SessionState } from "../state";

/**
 * The one thing to do next, always within thumb reach: fixed above the tab bar on phones,
 * an ordinary card under the header on larger screens. Organisers see the next step of the
 * session; members see their own status and action.
 */
export function SessionActionBar({
  s,
  st,
  memberId,
  isAdmin,
}: {
  s: SessionDetail;
  st: SessionState;
  memberId?: string;
  isAdmin: boolean;
}) {
  const content = isAdmin ? organiser(s, st) : memberId ? member(s, st, memberId) : null;
  if (!content) return null;
  return (
    <>
      <div
        role="region"
        aria-label="สิ่งที่ทำได้ตอนนี้"
        className={cn(
          "fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface/95 px-4 py-3 shadow-[0_-6px_20px_rgb(0_0_0/0.08)] backdrop-blur",
          "lg:static lg:rounded-xl lg:border lg:shadow-none",
        )}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3">{content}</div>
      </div>
      {/* keeps the end of the page from hiding behind the bar on phones */}
      <div aria-hidden className="order-last h-20 lg:hidden" />
    </>
  );
}

function Info({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate font-display text-base font-bold">{title}</div>
      {sub && <div className="truncate text-[13px] text-muted">{sub}</div>}
    </div>
  );
}

function organiser(s: SessionDetail, st: SessionState) {
  if (s.status === "OPEN") {
    const ready = s.participants.filter((p) => p.status === "ACTIVE").length;
    return (
      <>
        <Info
          title={`${s.participants.length} คนลงชื่อแล้ว`}
          sub={ready >= 4 ? "ถึงสนามแล้วกดเริ่มตี" : "ต้องมีอย่างน้อย 4 คนถึงจัดคู่ได้"}
        />
        <ActionButton action={startSession.bind(null, s.id)} variant="primary" size="lg" optimistic="กำลังเริ่ม…">
          เริ่มตี
        </ActionButton>
      </>
    );
  }
  if (s.status === "LIVE") {
    const canFill = st.freeCourts.length > 0 && st.queue.length >= 4;
    return (
      <>
        <Info
          title={st.freeCourts.length ? `คอร์ทว่าง ${st.freeCourts.length}` : "ทุกคอร์ทกำลังเล่น"}
          sub={`รอคิว ${st.queue.length} คน · จบไปแล้ว ${st.results.total} เกม`}
        />
        {canFill ? (
          <ActionButton action={fillCourts.bind(null, s.id, undefined)} variant="primary" size="lg" optimistic="กำลังจัด…">
            จัดคู่
          </ActionButton>
        ) : (
          <ActionButton action={closeSession.bind(null, s.id)} variant="accent" size="lg" confirm="ยืนยันจบรอบ">
            จบรอบ & ออกบิล
          </ActionButton>
        )}
      </>
    );
  }
  const billed = s.charges.filter((c) => c.status !== "WAIVED").reduce((a, c) => a + c.total, 0);
  const received = s.charges.filter((c) => c.status === "PAID").reduce((a, c) => a + c.total, 0);
  const waiting = s.charges.filter((c) => c.status === "UNPAID" || c.status === "REPORTED").length;
  return (
    <>
      <Info title={`เก็บได้ ${baht(received)} / ${baht(billed)}`} sub={waiting ? `ยังไม่ได้รับ ${waiting} คน` : "ได้รับครบทุกคนแล้ว ✓"} />
      <Link href={paths.session(s.id, "bills")} className={buttonClass("secondary", "lg")}>
        ดูบิล
      </Link>
    </>
  );
}

function member(s: SessionDetail, st: SessionState, memberId: string) {
  const me = s.participants.find((p) => p.memberId === memberId);

  if (!me) {
    if (s.status === "CLOSED") return null;
    const full = s.maxPlayers != null && s.participants.length >= s.maxPlayers;
    const why = !s.selfSignup
      ? "รอบนี้หัวก๊วนเป็นคนเพิ่มชื่อให้"
      : full
        ? `เต็มแล้ว (${s.maxPlayers} คน)`
        : `ลงชื่อแล้ว ${s.participants.length} คน`;
    return (
      <>
        <Info title="ยังไม่ได้ลงชื่อ" sub={why} />
        {s.selfSignup && !full && (
          <ActionButton action={joinSession.bind(null, s.id)} variant="primary" size="lg" optimistic="ลงชื่อแล้ว ✓">
            ลงชื่อ
          </ActionButton>
        )}
      </>
    );
  }

  if (s.status === "OPEN") {
    return (
      <>
        <Info title="ลงชื่อแล้ว ✓" sub={`เจอกัน ${s.startTime} น. ที่ ${s.venue}`} />
        <ActionButton action={removeParticipant.bind(null, me.id)} variant="ghost" confirm="ยืนยันถอนชื่อ">
          ถอนชื่อ
        </ActionButton>
      </>
    );
  }

  const stat = st.stats.get(memberId)!;
  if (s.status === "LIVE") {
    const court = stat.playing && s.courts.find((c) => c.id === stat.playing!.courtId);
    const queue = st.queue.findIndex((q) => q.id === memberId) + 1;
    const title = court
      ? `กำลังเล่น คอร์ท ${court.name}`
      : me.status === "RESTING"
        ? "พักอยู่"
        : me.status === "LEFT"
          ? "กลับบ้านแล้ว"
          : `คิวที่ ${queue}`;
    const sub =
      me.status === "RESTING" && court ? "จะได้พักหลังจบเกมนี้" : `เล่นแล้ว ${stat.games} เกม · ชนะ ${stat.wins} แพ้ ${stat.losses}`;
    return (
      <>
        <Info title={title} sub={sub} />
        {me.status === "ACTIVE" ? (
          <ActionButton action={setParticipantStatus.bind(null, me.id, "RESTING")} size="lg" optimistic="พักแล้ว">
            ขอพัก
          </ActionButton>
        ) : (
          <ActionButton action={setParticipantStatus.bind(null, me.id, "ACTIVE")} variant="primary" size="lg" optimistic="เข้าคิวแล้ว">
            กลับมาเล่น
          </ActionButton>
        )}
      </>
    );
  }

  const charge = s.charges.find((c) => c.memberId === memberId);
  if (!charge) return null;
  const open = charge.status === "UNPAID" || charge.status === "REPORTED";
  return (
    <>
      <Info
        title={`ยอดของคุณ ${baht(charge.total)}`}
        sub={
          charge.status === "PAID"
            ? "หัวก๊วนได้รับแล้ว ขอบคุณ"
            : charge.status === "REPORTED"
              ? "แจ้งโอนแล้ว รอหัวก๊วนยืนยัน"
              : charge.status === "WAIVED"
                ? "ยกเว้นไม่เก็บ"
                : "สแกน QR จ่ายได้เลย"
        }
      />
      {open && (
        <Link href={paths.pay(charge.id)} className={buttonClass(charge.status === "UNPAID" ? "accent" : "secondary", "lg")}>
          {charge.status === "UNPAID" ? "จ่ายเงิน" : "ดูบิล"}
        </Link>
      )}
    </>
  );
}
