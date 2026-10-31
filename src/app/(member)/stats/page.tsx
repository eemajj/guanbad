import { requireMemberPage } from "@/server/viewer";
import { thaiMonth, todayISO } from "@/lib/format";
import { LeaderboardCard, MissingResultsCard, PairsCard } from "@/features/stats/components/leaderboard";
import { getLeaderboard, isPeriod, PERIODS, type Period } from "@/features/stats/queries";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty";
import { PageHeader } from "@/ui/page-header";
import { Stat } from "@/ui/stat";
import { TabLinks } from "@/ui/tabs";

export const metadata = { title: "สถิติ" };

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const viewer = await requireMemberPage();
  const { p } = await searchParams;
  const period: Period = isPeriod(p) ? p : "month";
  const { min } = PERIODS[period];
  const ym = todayISO().slice(0, 7);
  const board = await getLeaderboard(period, viewer.isAdmin);
  const { coverage: cov, players, members, mostGames, missingSessions } = board;
  const myId = viewer.member?.id;

  const name = (id: string) => members.get(id)?.nickname ?? "?";
  const pct = (n: number) => (cov.total ? Math.round((n / cov.total) * 100) : 0);

  return (
    <>
      <PageHeader
        title="สถิติ"
        description={period === "month" ? thaiMonth(ym) : period === "quarter" ? "3 เดือนล่าสุด" : "ตั้งแต่เริ่มใช้ระบบ"}
      />
      <TabLinks
        current={period}
        tabs={(Object.keys(PERIODS) as Period[]).map((k) => ({ key: k, label: PERIODS[k].label, href: `/stats?p=${k}` }))}
      />

      {cov.total === 0 ? (
        <Card>
          <EmptyState title="ยังไม่มีเกมในช่วงนี้" description="สถิติจะขึ้นเมื่อมีเกมที่จบแล้ว" />
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="เกมทั้งหมด" value={cov.total} sub={`${players} คนลงเล่น`} />
            <Stat
              label="บันทึกผลแล้ว"
              value={`${pct(cov.withWinner)}%`}
              sub={`${cov.withWinner} จาก ${cov.total} เกม`}
              tone={pct(cov.withWinner) < 70 ? "danger" : undefined}
            />
            <Stat label="มีแต้ม" value={`${pct(cov.withScore)}%`} sub={`${cov.withScore} เกม`} />
            <Stat
              label="เล่นเยอะสุด"
              value={mostGames ? name(mostGames.memberId) : "–"}
              sub={mostGames ? `${mostGames.record.games} เกม` : undefined}
            />
          </section>

          {missingSessions.length > 0 && <MissingResultsCard board={board} />}

          <LeaderboardCard board={board} min={min} myId={myId} isAdmin={viewer.isAdmin} />

          <PairsCard board={board} />

          <p className="text-xs text-muted">
            วิธีนับ: เกมที่ไม่ได้บันทึกผลนับเป็นเกมที่เล่น แต่ไม่นับชนะหรือแพ้ · อัตราชนะ = ชนะ ÷ (ชนะ + แพ้) · แต้ม +/−
            เฉลี่ยจากเกมที่บันทึกแต้มเท่านั้น
          </p>
        </>
      )}
    </>
  );
}
