import Link from "next/link";
import { prisma } from "@/lib/db";
import { baht, thaiDate } from "@/lib/format";
import { avgPointDiff, coverage, formatDiff, formatRate, partnerRecords, playerRecords, winRate } from "@/domain/results";
import { loadResults, memberStats } from "@/server/queries";
import { ChargeStatusBadge } from "@/components/session/status";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Stat } from "@/components/ui/stat";

/** Stats, partners, recent sessions and bills for one member — used on the member page and on "ของฉัน". */
export async function MemberHistory({ memberId, payLinks }: { memberId: string; payLinks: boolean }) {
  const [stats, results, participations, charges] = await Promise.all([
    memberStats([memberId]).then((s) => s.get(memberId)),
    loadResults({ memberIds: [memberId] }),
    prisma.participant.findMany({
      where: { memberId, session: { status: { not: "OPEN" } } },
      include: { session: true },
      orderBy: { session: { date: "desc" } },
      take: 20,
    }),
    prisma.charge.findMany({ where: { memberId }, include: { session: true }, orderBy: { session: { date: "desc" } }, take: 20 }),
  ]);

  // Per-session record from the same results
  const bySession = new Map<string, typeof results>();
  for (const r of results) bySession.set(r.sessionId, [...(bySession.get(r.sessionId) ?? []), r]);

  const partners = [...partnerRecords(results, memberId).entries()].sort((a, b) => b[1].games - a[1].games).slice(0, 8);
  const partnerNames = new Map(
    (await prisma.member.findMany({ where: { id: { in: partners.map(([id]) => id) } }, select: { id: true, nickname: true } })).map((m) => [m.id, m.nickname]),
  );
  const decided = stats.wins + stats.losses;

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="มาตี / เล่น" value={`${stats.sessions} / ${stats.games}`} sub="รอบ / เกม" />
        <Stat label="ชนะ–แพ้" value={`${stats.wins}–${stats.losses}`} sub={`อัตราชนะ ${formatRate(winRate(stats))}`} />
        <Stat label="แต้มได้–เสีย เฉลี่ย" value={formatDiff(avgPointDiff(stats))} sub={stats.scoredGames ? `จาก ${stats.scoredGames} เกมที่มีแต้ม` : "ยังไม่มีเกมที่บันทึกแต้ม"} />
        <Stat label="ยอดค้าง" value={baht(stats.outstanding)} tone={stats.outstanding ? "danger" : undefined} />
      </section>
      {stats.games > 0 && stats.unrecorded > 0 && (
        <p className="-mt-3 text-xs text-muted">
          สถิติชนะ/แพ้คิดจาก {decided} จาก {stats.games} เกม ({formatRate(coverage(stats))}) อีก {stats.unrecorded} เกมไม่ได้บันทึกผล จึงไม่นับ
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="คู่หู" description="ผลเมื่อจับคู่กับแต่ละคน (เกมที่รู้ผล)" />
          {partners.length ? (
            <ul className="divide-y divide-line">
              {partners.map(([id, r]) => (
                <li key={id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="font-medium">{partnerNames.get(id) ?? "?"}</span>
                  <span className="text-muted">
                    {r.games} เกม · <span className="num text-ink">{r.wins}–{r.losses}</span> · {formatRate(r.wins + r.losses ? r.wins / (r.wins + r.losses) : null)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="ยังไม่มีเกมที่เล่น" />
          )}
        </Card>
        <Card>
          <CardHeader title="รอบที่มาตี" />
          {participations.length ? (
            <ul className="divide-y divide-line">
              {participations.map((p) => {
                const rec = playerRecords(bySession.get(p.sessionId) ?? []).get(memberId);
                return (
                  <li key={p.id}>
                    <Link href={`/sessions/${p.sessionId}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-surface-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.session.venue}</div>
                        <div className="text-xs text-muted">{thaiDate(p.session.date)}</div>
                      </div>
                      <span className="text-muted">
                        {rec?.games ?? 0} เกม · ชนะ {rec?.wins ?? 0} แพ้ {rec?.losses ?? 0}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="ยังไม่เคยมาตี" />
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="บิลค่าตี" />
        {charges.length ? (
          <ul className="divide-y divide-line">
            {charges.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.session.venue}</div>
                  <div className="text-xs text-muted">{thaiDate(c.session.date)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <ChargeStatusBadge status={c.status} />
                  <span className="num w-16 text-right font-bold">{baht(c.total)}</span>
                  {payLinks && (c.status === "UNPAID" || c.status === "REPORTED") ? (
                    <Link href={`/pay/${c.id}`} className="text-xs font-semibold text-brand hover:underline">จ่าย</Link>
                  ) : (
                    <span className="w-6" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <CardBody className="text-sm text-muted">ยังไม่มีบิล</CardBody>
        )}
      </Card>
    </>
  );
}
