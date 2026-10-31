import { paths } from "@/lib/paths";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMemberPage } from "@/server/viewer";
import { thaiDateLong } from "@/lib/format";
import { deriveState, loadSession } from "@/features/sessions/state";
import { AutoRefresh } from "@/ui/auto-refresh";
import { BillsTab } from "@/features/billing/components/bills-tab";
import { CourtsTab } from "@/features/play/components/courts-tab";
import { PlayersTab } from "@/features/sessions/components/players-tab";
import { SessionStatusBadge, SessionSteps } from "@/features/sessions/components/status";
import { TabLinks } from "@/ui/tabs";
import { Card, CardHeader } from "@/ui/card";
import { ActivityList } from "@/features/activity/components/activity-list";
import { listActivity } from "@/features/activity/queries";
import type { SessionTab } from "@/lib/paths";
import { AdminActions } from "@/features/sessions/components/admin-actions";
import { MyCard } from "@/features/sessions/components/my-card";
import { getSessionVenue } from "@/features/sessions/queries";
import { activeRoster } from "@/features/members/queries";

type Tab = SessionTab;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const s = await getSessionVenue((await params).id);
  return { title: s?.venue ?? "รอบตี" };
}

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const viewer = await requireMemberPage();
  const { id } = await params;
  const s = await loadSession(id);
  if (!s) notFound();
  const st = deriveState(s);
  const { tab: tabParam } = await searchParams;
  const fallback: Tab = s.status === "OPEN" ? "players" : s.status === "LIVE" ? "courts" : "bills";
  const allowed: Tab[] = viewer.isAdmin ? ["players", "courts", "bills", "history"] : ["players", "courts", "bills"];
  const tab: Tab = allowed.includes(tabParam as Tab) ? (tabParam as Tab) : fallback;
  const myId = viewer.member?.id;

  const roster = viewer.isAdmin ? await activeRoster() : [];

  return (
    <>
      {s.status === "LIVE" && <AutoRefresh />}
      <header className="flex flex-col gap-3">
        <Link href={paths.sessions} className="text-[13px] text-muted hover:text-ink">
          ← รอบตีทั้งหมด
        </Link>
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
        {viewer.isAdmin && s.status === "CLOSED" && st.results.total > st.results.withWinner && (
          <Link href="?tab=courts" className="self-start rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn hover:underline">
            ยังไม่ได้บันทึกผล {st.results.total - st.results.withWinner} เกม · ใส่ผลย้อนหลังได้ที่แท็บคอร์ท →
          </Link>
        )}
      </header>

      {myId && <MyCard s={s} st={st} memberId={myId} isAdmin={viewer.isAdmin} />}

      <TabLinks
        current={tab}
        tabs={[
          { key: "players", label: "ผู้เล่น", href: `?tab=players`, count: s.participants.length },
          { key: "courts", label: "คอร์ท", href: `?tab=courts`, count: st.playingByCourt.size || undefined },
          { key: "bills", label: "ค่าใช้จ่าย", href: `?tab=bills` },
          ...(viewer.isAdmin ? [{ key: "history", label: "ประวัติ", href: `?tab=history` }] : []),
        ]}
      />
      {tab === "players" && <PlayersTab s={s} st={st} isAdmin={viewer.isAdmin} roster={roster} myMemberId={myId} />}
      {tab === "courts" && <CourtsTab s={s} st={st} isAdmin={viewer.isAdmin} />}
      {tab === "bills" && <BillsTab s={s} st={st} isAdmin={viewer.isAdmin} myMemberId={myId} />}
      {tab === "history" && (
        <Card>
          <CardHeader title="ประวัติของรอบนี้" description="ใครทำอะไร เมื่อไหร่ (เห็นเฉพาะหัวก๊วน)" />
          <ActivityList rows={await listActivity({ sessionId: s.id })} />
        </Card>
      )}
    </>
  );
}
