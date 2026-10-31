import { paths } from "@/lib/paths";
import Link from "next/link";
import { thaiDate } from "@/lib/format";
import { avgPointDiff, coverage, formatDiff, formatRate, winRate } from "@/domain/results";
import type { getLeaderboard } from "@/features/stats/queries";
import { LevelBadge } from "@/ui/level";
import { Badge } from "@/ui/badge";
import { Table, TBody, THead, Td, Th } from "@/ui/table";
import { Card, CardBody, CardHeader } from "@/ui/card";
import { cn } from "@/lib/cn";

type Board = Awaited<ReturnType<typeof getLeaderboard>>;

/** Sessions that still have games without a result, so the organiser can fill them in. */
export function MissingResultsCard({ board }: { board: Board }) {
  const { coverage: cov, missingSessions } = board;
  return (
    <Card className="border-warn/40">
      <CardHeader
        title={`ยังไม่ได้บันทึกผล ${cov.total - cov.withWinner} เกม`}
        description="เกมที่ไม่มีผลยังนับว่าเล่น แต่ไม่นับชนะ/แพ้ เติมย้อนหลังได้ที่แท็บคอร์ทของแต่ละรอบ"
      />
      <ul className="divide-y divide-line">
        {missingSessions.map((s) => (
          <li key={s.id}>
            <Link href={paths.session(s.id, "courts")} className="flex items-center justify-between px-5 py-2.5 text-sm hover:bg-surface-2">
              <span>
                {s.venue} · {thaiDate(s.date)}
              </span>
              <Badge tone="warn">{s.missing} เกม →</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Ranked players (enough decided games) and the ones still below the minimum. */
export function LeaderboardCard({ board, min, myId, isAdmin }: { board: Board; min: number; myId?: string; isAdmin: boolean }) {
  const { members, ranked, unranked } = board;
  const name = (id: string) => board.members.get(id)?.nickname ?? "?";
  return (
    <Card>
      <CardHeader
        title="อันดับ"
        description={`ต้องมีเกมที่รู้ผลอย่างน้อย ${min} เกมถึงจะติดอันดับ · เรียงตามอัตราชนะ แล้วแต้มได้–เสียเฉลี่ย`}
      />
      {ranked.length ? (
        <Table>
          <THead>
            <Th className="w-10">#</Th>
            <Th>ชื่อ</Th>
            <Th align="right">ชนะ–แพ้</Th>
            <Th align="right">%ชนะ</Th>
            <Th hide="sm" align="right" title="แต้มได้ลบแต้มเสีย เฉลี่ยต่อเกม จากเกมที่มีแต้ม">
              แต้ม +/−
            </Th>
            <Th hide="sm" align="right" title="สัดส่วนเกมที่รู้ผล">
              ข้อมูลครบ
            </Th>
          </THead>
          <TBody>
            {ranked.map(({ memberId, record: r }, i) => (
              <tr key={memberId} className={memberId === myId ? "bg-brand-soft/50" : ""}>
                <Td num className={cn("text-lg font-bold", i < 3 ? "text-accent" : "text-muted")}>
                  {i + 1}
                </Td>
                <Td>
                  <div className="flex items-center gap-2 font-semibold">
                    {isAdmin ? (
                      <Link href={paths.member(memberId)} className="hover:underline">
                        {name(memberId)}
                      </Link>
                    ) : (
                      name(memberId)
                    )}
                    {members.get(memberId) && <LevelBadge level={members.get(memberId)!.level} />}
                  </div>
                  <div className="text-xs text-muted">
                    {r.games} เกม{r.unrecorded ? ` · ไม่มีผล ${r.unrecorded}` : ""}
                    <span className="sm:hidden"> · แต้ม {formatDiff(avgPointDiff(r))}</span>
                  </div>
                </Td>
                <Td align="right" num>
                  {r.wins}–{r.losses}
                </Td>
                <Td align="right" num className="text-base font-bold">
                  {formatRate(winRate(r))}
                </Td>
                <Td
                  num
                  align="right"
                  hide="sm"
                  className={(avgPointDiff(r) ?? 0) > 0 ? "text-ok" : (avgPointDiff(r) ?? 0) < 0 ? "text-danger" : "text-muted"}
                >
                  {formatDiff(avgPointDiff(r))}
                  {r.scoredGames > 0 && <div className="text-[11px] text-muted">{r.scoredGames} เกม</div>}
                </Td>
                <Td num align="right" hide="sm" className={coverage(r) < 0.7 ? "text-warn" : "text-muted"}>
                  {formatRate(coverage(r))}
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
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
  );
}

/** Pairs with the best record together (at least 3 decided games). */
export function PairsCard({ board }: { board: Board }) {
  const { pairs } = board;
  const name = (id: string) => board.members.get(id)?.nickname ?? "?";
  return (
    <Card>
      <CardHeader title="คู่ที่เข้าขาที่สุด" description="คู่ที่จับกันแล้วรู้ผลอย่างน้อย 3 เกม" />
      {pairs.length ? (
        <ol className="divide-y divide-line">
          {pairs.map((x, i) => (
            <li key={x.ids.join()} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span>
                <span className="num mr-3 text-muted">{i + 1}</span>
                <b>
                  {name(x.ids[0])} + {name(x.ids[1])}
                </b>
              </span>
              <span className="text-muted">
                {x.games} เกม ·{" "}
                <span className="num text-ink">
                  {x.wins}–{x.losses}
                </span>{" "}
                · <b className="text-ink">{formatRate(x.wins / (x.wins + x.losses))}</b>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <CardBody className="text-sm text-muted">ยังไม่มีคู่ที่เล่นด้วยกันครบ 3 เกมที่รู้ผล</CardBody>
      )}
    </Card>
  );
}
