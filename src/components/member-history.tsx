import Link from "next/link";
import { prisma } from "@/lib/db";
import { baht, thaiDate } from "@/lib/format";
import { memberStats } from "@/server/queries";
import { ChargeStatusBadge } from "@/components/session/status";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Stat } from "@/components/ui/stat";

/** Stats, recent sessions and bills for one member — used on the member page and on "ของฉัน". */
export async function MemberHistory({ memberId, payLinks }: { memberId: string; payLinks: boolean }) {
  const [stats, participations, charges] = await Promise.all([
    memberStats([memberId]).then((s) => s.get(memberId)),
    prisma.participant.findMany({
      where: { memberId, session: { status: { not: "OPEN" } } },
      include: { session: { include: { matches: { where: { status: "DONE", players: { some: { memberId } } }, include: { players: true } } } } },
      orderBy: { session: { date: "desc" } },
      take: 20,
    }),
    prisma.charge.findMany({ where: { memberId }, include: { session: true }, orderBy: { session: { date: "desc" } }, take: 20 }),
  ]);

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="มาตี" value={stats.sessions} sub="รอบ" />
        <Stat label="เล่น" value={stats.games} sub="เกม" />
        <Stat label="อัตราชนะ" value={stats.games ? `${Math.round((stats.wins / stats.games) * 100)}%` : "–"} sub={`ชนะ ${stats.wins} เกม`} />
        <Stat label="ยอดค้าง" value={baht(stats.outstanding)} tone={stats.outstanding ? "danger" : undefined} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
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
            <EmptyState title="ยังไม่มีบิล" />
          )}
        </Card>
        <Card>
          <CardHeader title="รอบที่มาตี" />
          {participations.length ? (
            <ul className="divide-y divide-line">
              {participations.map((p) => {
                const games = p.session.matches.length;
                const wins = p.session.matches.filter((m) => m.players.find((x) => x.memberId === memberId)?.team === m.winner).length;
                return (
                  <li key={p.id}>
                    <Link href={`/sessions/${p.sessionId}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-surface-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.session.venue}</div>
                        <div className="text-xs text-muted">{thaiDate(p.session.date)}</div>
                      </div>
                      <span className="text-muted">{games} เกม · ชนะ {wins}</span>
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
    </>
  );
}
