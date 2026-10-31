import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireMemberPage } from "@/lib/viewer";
import { dateFromISO, monthRange, thaiDate, thaiMonth, todayISO } from "@/lib/format";
import { avgPointDiff, coverage, formatDiff, formatRate, pairRecords, playerRecords, rankPlayers, recordCoverage, winRate } from "@/domain/results";
import { loadResults } from "@/server/queries";
import { LevelBadge } from "@/components/level";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { TabLinks } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";

export const metadata = { title: "สถิติ" };

/** ช่วงเวลาและจำนวน "เกมที่รู้ผล" ขั้นต่ำที่ต้องมีถึงจะติดอันดับ */
const PERIODS = {
  month: { label: "เดือนนี้", min: 4 },
  quarter: { label: "3 เดือน", min: 8 },
  all: { label: "ทั้งหมด", min: 10 },
} as const;
type Period = keyof typeof PERIODS;

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const viewer = await requireMemberPage();
  const { p } = await searchParams;
  const period: Period = p === "quarter" || p === "all" ? p : "month";
  const { min } = PERIODS[period];

  const ym = todayISO().slice(0, 7);
  const from = period === "month" ? monthRange(ym).from : period === "quarter" ? (() => { const d = dateFromISO(todayISO()); d.setUTCMonth(d.getUTCMonth() - 3); return d; })() : undefined;

  const results = await loadResults({ from });
  const records = playerRecords(results);
  const ids = [...records.keys()];
  const members = new Map((await prisma.member.findMany({ where: { id: { in: ids } }, select: { id: true, nickname: true, level: true } })).map((m) => [m.id, m]));
  const rows = ids.map((memberId) => ({ memberId, record: records.get(memberId)! }));
  const { ranked, unranked } = rankPlayers(rows, min);
  const cov = recordCoverage(results);
  const myId = viewer.member?.id;

  const pairs = [...pairRecords(results).values()]
    .filter((x) => x.wins + x.losses >= 3)
    .sort((a, b) => b.wins / (b.wins + b.losses) - a.wins / (a.wins + a.losses) || b.wins - a.wins)
    .slice(0, 5);
  const mostGames = [...rows].sort((a, b) => b.record.games - a.record.games)[0];

  // Sessions with games that have no result, so the organiser can fill them in.
  const missingBySession = new Map<string, number>();
  for (const r of results) if (!r.winner) missingBySession.set(r.sessionId, (missingBySession.get(r.sessionId) ?? 0) + 1);
  const missingSessions = viewer.isAdmin && missingBySession.size
    ? await prisma.session.findMany({ where: { id: { in: [...missingBySession.keys()] } }, select: { id: true, venue: true, date: true }, orderBy: { date: "desc" } })
    : [];

  const name = (id: string) => members.get(id)?.nickname ?? "?";
  const pct = (n: number) => (cov.total ? Math.round((n / cov.total) * 100) : 0);

  return (
    <>
      <PageHeader title="สถิติ" description={period === "month" ? thaiMonth(ym) : period === "quarter" ? "3 เดือนล่าสุด" : "ตั้งแต่เริ่มใช้ระบบ"} />
      <TabLinks current={period} tabs={(Object.keys(PERIODS) as Period[]).map((k) => ({ key: k, label: PERIODS[k].label, href: `/stats?p=${k}` }))} />

      {cov.total === 0 ? (
        <Card><EmptyState title="ยังไม่มีเกมในช่วงนี้" description="สถิติจะขึ้นเมื่อมีเกมที่จบแล้ว" /></Card>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="เกมทั้งหมด" value={cov.total} sub={`${ids.length} คนลงเล่น`} />
            <Stat label="บันทึกผลแล้ว" value={`${pct(cov.withWinner)}%`} sub={`${cov.withWinner} จาก ${cov.total} เกม`} tone={pct(cov.withWinner) < 70 ? "danger" : undefined} />
            <Stat label="มีแต้ม" value={`${pct(cov.withScore)}%`} sub={`${cov.withScore} เกม`} />
            <Stat label="เล่นเยอะสุด" value={mostGames ? name(mostGames.memberId) : "–"} sub={mostGames ? `${mostGames.record.games} เกม` : undefined} />
          </section>

          {missingSessions.length > 0 && (
            <Card className="border-warn/40">
              <CardHeader title={`ยังไม่ได้บันทึกผล ${cov.total - cov.withWinner} เกม`} description="เกมที่ไม่มีผลยังนับว่าเล่น แต่ไม่นับชนะ/แพ้ เติมย้อนหลังได้ที่แท็บคอร์ทของแต่ละรอบ" />
              <ul className="divide-y divide-line">
                {missingSessions.map((s) => (
                  <li key={s.id}>
                    <Link href={`/sessions/${s.id}?tab=courts`} className="flex items-center justify-between px-5 py-2.5 text-sm hover:bg-surface-2">
                      <span>{s.venue} · {thaiDate(s.date)}</span>
                      <Badge tone="warn">{missingBySession.get(s.id)} เกม →</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="อันดับ" description={`ต้องมีเกมที่รู้ผลอย่างน้อย ${min} เกมถึงจะติดอันดับ · เรียงตามอัตราชนะ แล้วแต้มได้–เสียเฉลี่ย`} />
            {ranked.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr className="border-b border-line">
                      <th className="w-10 px-4 py-2 font-semibold sm:px-5">#</th>
                      <th className="px-2 py-2 font-semibold">ชื่อ</th>
                      <th className="px-2 py-2 text-right font-semibold">ชนะ–แพ้</th>
                      <th className="px-2 py-2 text-right font-semibold">%ชนะ</th>
                      <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell" title="แต้มได้ลบแต้มเสีย เฉลี่ยต่อเกม จากเกมที่มีแต้ม">แต้ม +/−</th>
                      <th className="hidden px-4 py-2 text-right font-semibold sm:table-cell sm:px-5" title="สัดส่วนเกมที่รู้ผล">ข้อมูลครบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ranked.map(({ memberId, record: r }, i) => (
                      <tr key={memberId} className={memberId === myId ? "bg-brand-soft/50" : ""}>
                        <td className={cn("num px-4 py-2.5 text-lg font-bold sm:px-5", i < 3 ? "text-accent" : "text-muted")}>{i + 1}</td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2 font-semibold">
                            {viewer.isAdmin ? <Link href={`/members/${memberId}`} className="hover:underline">{name(memberId)}</Link> : name(memberId)}
                            {members.get(memberId) && <LevelBadge level={members.get(memberId)!.level} />}
                          </div>
                          <div className="text-xs text-muted">
                            {r.games} เกม{r.unrecorded ? ` · ไม่มีผล ${r.unrecorded}` : ""}
                            <span className="sm:hidden"> · แต้ม {formatDiff(avgPointDiff(r))}</span>
                          </div>
                        </td>
                        <td className="num px-2 py-2.5 text-right">{r.wins}–{r.losses}</td>
                        <td className="num px-2 py-2.5 text-right text-base font-bold">{formatRate(winRate(r))}</td>
                        <td className={cn("num hidden px-2 py-2.5 text-right sm:table-cell", (avgPointDiff(r) ?? 0) > 0 ? "text-ok" : (avgPointDiff(r) ?? 0) < 0 ? "text-danger" : "text-muted")}>
                          {formatDiff(avgPointDiff(r))}
                          {r.scoredGames > 0 && <div className="text-[11px] text-muted">{r.scoredGames} เกม</div>}
                        </td>
                        <td className={cn("num hidden px-4 py-2.5 text-right sm:table-cell sm:px-5", coverage(r) < 0.7 ? "text-warn" : "text-muted")}>{formatRate(coverage(r))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <CardBody className="text-sm text-muted">ยังไม่มีใครมีเกมที่รู้ผลครบ {min} เกม</CardBody>
            )}
            {unranked.length > 0 && (
              <CardBody className="border-t border-line text-sm">
                <span className="text-xs font-semibold text-muted">ยังไม่ถึงเกณฑ์ ({unranked.length} คน): </span>
                <span className="text-muted">
                  {unranked.map(({ memberId, record: r }) => `${name(memberId)} ${r.wins}–${r.losses}`).join(" · ")}
                </span>
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader title="คู่ที่เข้าขาที่สุด" description="คู่ที่จับกันแล้วรู้ผลอย่างน้อย 3 เกม" />
            {pairs.length ? (
              <ol className="divide-y divide-line">
                {pairs.map((x, i) => (
                  <li key={x.ids.join()} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span><span className="num mr-3 text-muted">{i + 1}</span><b>{name(x.ids[0])} + {name(x.ids[1])}</b></span>
                    <span className="text-muted">{x.games} เกม · <span className="num text-ink">{x.wins}–{x.losses}</span> · <b className="text-ink">{formatRate(x.wins / (x.wins + x.losses))}</b></span>
                  </li>
                ))}
              </ol>
            ) : (
              <CardBody className="text-sm text-muted">ยังไม่มีคู่ที่เล่นด้วยกันครบ 3 เกมที่รู้ผล</CardBody>
            )}
          </Card>

          <p className="text-xs text-muted">
            วิธีนับ: เกมที่ไม่ได้บันทึกผลนับเป็นเกมที่เล่น แต่ไม่นับชนะหรือแพ้ · อัตราชนะ = ชนะ ÷ (ชนะ + แพ้) · แต้ม +/− เฉลี่ยจากเกมที่บันทึกแต้มเท่านั้น
          </p>
        </>
      )}
    </>
  );
}
