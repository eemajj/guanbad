import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMemberPage } from "@/lib/viewer";
import { baht, thaiDateLong } from "@/lib/format";
import { deriveState, loadSession, type SessionDetail, type SessionState } from "@/server/session-state";
import { closeSession, reopenSession, startSession } from "@/server/actions/sessions";
import { joinSession, removeParticipant, setParticipantStatus } from "@/server/actions/play";
import { ActionButton } from "@/components/action";
import { AutoRefresh } from "@/components/auto-refresh";
import { BillsTab } from "@/components/session/bills-tab";
import { CourtsTab } from "@/components/session/courts-tab";
import { PlayersTab } from "@/components/session/players-tab";
import { SessionStatusBadge, SessionSteps } from "@/components/session/status";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { TabLinks } from "@/components/ui/tabs";

type Tab = "players" | "courts" | "bills";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const s = await prisma.session.findUnique({ where: { id: (await params).id }, select: { venue: true } });
  return { title: s?.venue ?? "รอบตี" };
}

export default async function SessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const viewer = await requireMemberPage();
  const { id } = await params;
  const s = await loadSession(id);
  if (!s) notFound();
  const st = deriveState(s);
  const { tab: tabParam } = await searchParams;
  const fallback: Tab = s.status === "OPEN" ? "players" : s.status === "LIVE" ? "courts" : "bills";
  const tab: Tab = tabParam === "players" || tabParam === "courts" || tabParam === "bills" ? tabParam : fallback;
  const myId = viewer.member?.id;

  const roster = viewer.isAdmin
    ? await prisma.member.findMany({ where: { active: true }, select: { id: true, nickname: true, level: true }, orderBy: { nickname: "asc" } })
    : [];

  return (
    <>
      {s.status === "LIVE" && <AutoRefresh />}
      <header className="flex flex-col gap-3">
        <Link href="/sessions" className="text-[13px] text-muted hover:text-ink">← รอบตีทั้งหมด</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{s.venue}</h1>
              <SessionStatusBadge status={s.status} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {thaiDateLong(s.date)} · {s.startTime}–{s.endTime} น. · คอร์ท {s.courts.map((c) => c.name).join(", ")}
            </p>
            {s.note && <p className="mt-2 max-w-prose rounded-lg bg-surface-2 px-3 py-2 text-sm">{s.note}</p>}
          </div>
          {viewer.isAdmin && <AdminActions s={s} />}
        </div>
        <SessionSteps status={s.status} />
      </header>

      {myId && <MyCard s={s} st={st} memberId={myId} isAdmin={viewer.isAdmin} />}

      <TabLinks
        current={tab}
        tabs={[
          { key: "players", label: "ผู้เล่น", href: `?tab=players`, count: s.participants.length },
          { key: "courts", label: "คอร์ท", href: `?tab=courts`, count: st.playingByCourt.size || undefined },
          { key: "bills", label: "ค่าใช้จ่าย", href: `?tab=bills` },
        ]}
      />
      {tab === "players" && <PlayersTab s={s} st={st} isAdmin={viewer.isAdmin} roster={roster} myMemberId={myId} />}
      {tab === "courts" && <CourtsTab s={s} st={st} isAdmin={viewer.isAdmin} />}
      {tab === "bills" && <BillsTab s={s} st={st} isAdmin={viewer.isAdmin} myMemberId={myId} />}
    </>
  );
}

function AdminActions({ s }: { s: SessionDetail }) {
  return (
    <div className="flex flex-wrap gap-2">
      {s.status !== "CLOSED" && <LinkButton href={`/sessions/${s.id}/edit`}>แก้ไขรอบ</LinkButton>}
      {s.status === "OPEN" && (
        <ActionButton action={startSession.bind(null, s.id)} variant="primary">เริ่มตี</ActionButton>
      )}
      {s.status === "LIVE" && (
        <ActionButton action={closeSession.bind(null, s.id)} variant="accent" confirm="ยืนยันจบรอบและออกบิล">จบรอบ & ออกบิล</ActionButton>
      )}
      {s.status === "CLOSED" && (
        <ActionButton action={reopenSession.bind(null, s.id)} confirm="ยืนยันเปิดรอบอีกครั้ง">เปิดรอบอีกครั้ง</ActionButton>
      )}
    </div>
  );
}

/** สถานะของผู้ใช้คนนี้ในรอบ + สิ่งที่ทำได้ตอนนี้ */
function MyCard({ s, st, memberId, isAdmin }: { s: SessionDetail; st: SessionState; memberId: string; isAdmin: boolean }) {
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
            {!s.selfSignup ? "รอบนี้หัวก๊วนเป็นคนเพิ่มชื่อให้" : full ? `เต็มแล้ว (${s.maxPlayers} คน)` : `ลงชื่อแล้ว ${s.participants.length} คน`}
          </div>
        </div>
        {s.selfSignup && !full && <ActionButton action={joinSession.bind(null, s.id)} variant="primary" size="lg">ลงชื่อ</ActionButton>}
      </div>
    );
  }

  const stat = st.stats.get(memberId)!;
  const charge = s.charges.find((c) => c.memberId === memberId);
  const playingCourt = stat.playing && s.courts.find((c) => c.id === stat.playing!.courtId);
  const queuePos = st.queue.findIndex((q) => q.id === memberId) + 1;

  let headline: string;
  let sub = `เล่นแล้ว ${stat.games} เกม · ชนะ ${stat.wins}`;
  if (s.status === "OPEN") { headline = "ลงชื่อแล้ว ✓"; sub = `เจอกัน ${s.startTime} น.`; }
  else if (s.status === "CLOSED") headline = charge ? `ยอดของคุณ ${baht(charge.total)}` : "จบรอบแล้ว";
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
          <ActionButton action={removeParticipant.bind(null, me.id)} variant="ghost" confirm="ยืนยันถอนชื่อ">ถอนชื่อ</ActionButton>
        )}
        {s.status === "LIVE" &&
          (me.status === "ACTIVE" ? (
            <ActionButton action={setParticipantStatus.bind(null, me.id, "RESTING")} size="lg">ขอพัก</ActionButton>
          ) : (
            <ActionButton action={setParticipantStatus.bind(null, me.id, "ACTIVE")} variant="primary" size="lg">กลับมาเล่น</ActionButton>
          ))}
        {s.status === "CLOSED" && charge && (charge.status === "UNPAID" || charge.status === "REPORTED") && (
          <Link href={`/pay/${charge.id}`} className={buttonClass("accent", "lg")}>{charge.status === "REPORTED" ? "ดูการแจ้งโอน" : "จ่ายเงิน"}</Link>
        )}
      </div>
    </div>
  );
}
