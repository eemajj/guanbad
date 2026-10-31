import "server-only";
import { Prisma, type Level } from "@prisma/client";
import { LEVELS } from "@/domain/levels";
import { emptyRecord, partnerRecords, playerRecords, type PlayerRecord } from "@/domain/results";
import { prisma } from "@/server/db";
import { loadResults } from "@/features/stats/queries";

export type MemberStats = PlayerRecord & { sessions: number; outstanding: number; lastSession: Date | null };

const emptyStats = (): MemberStats => ({ ...emptyRecord(), sessions: 0, outstanding: 0, lastSession: null });

/** Lifetime stats for members: game record via domain/results, plus sessions attended and money owed. */
export async function memberStats(memberIds?: string[]) {
  const ids = memberIds ? (memberIds.length ? memberIds : [""]) : undefined;
  const [results, sessions, owed] = await Promise.all([
    loadResults({ memberIds: ids }),
    prisma.$queryRaw<{ memberId: string; sessions: bigint; last: Date }[]>`
      SELECT p."memberId", COUNT(*) AS sessions, MAX(s.date) AS last
      FROM "Participant" p JOIN "Session" s ON s.id = p."sessionId"
      WHERE s.status <> 'OPEN' ${ids ? Prisma.sql`AND p."memberId" IN (${Prisma.join(ids)})` : Prisma.empty}
      GROUP BY p."memberId"`,
    prisma.charge.groupBy({
      by: ["memberId"],
      where: { status: { in: ["UNPAID", "REPORTED"] }, ...(ids ? { memberId: { in: ids } } : {}) },
      _sum: { total: true },
    }),
  ]);
  const records = playerRecords(results);
  const map = new Map<string, MemberStats>();
  const get = (id: string) => map.get(id) ?? (map.set(id, { ...emptyStats(), ...(records.get(id) ?? {}) }), map.get(id)!);
  for (const id of records.keys()) get(id);
  for (const s of sessions) Object.assign(get(s.memberId), { sessions: Number(s.sessions), lastSession: s.last });
  for (const o of owed) get(o.memberId).outstanding = o._sum.total ?? 0;
  return { get: (id: string) => map.get(id) ?? emptyStats() };
}

/** Member list for the organiser with search, level filter and active/inactive tab. */
export async function listMembers(filter: { q?: string; level?: string; inactive?: boolean }) {
  const q = filter.q?.trim();
  const where: Prisma.MemberWhereInput = {
    active: !filter.inactive,
    ...(q
      ? {
          OR: [
            { nickname: { contains: q, mode: "insensitive" } },
            { fullName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : {}),
    ...(filter.level && filter.level in LEVELS ? { level: filter.level as Level } : {}),
  };
  const [members, counts] = await Promise.all([
    prisma.member.findMany({ where, orderBy: { nickname: "asc" }, include: { user: { select: { role: true } } } }),
    prisma.member.groupBy({ by: ["active"], _count: true }),
  ]);
  const stats = await memberStats(members.map((m) => m.id));
  const count = (active: boolean) => counts.find((c) => c.active === active)?._count ?? 0;
  return { members, stats, activeCount: count(true), inactiveCount: count(false) };
}

/** Active members for the "add from registry" picker. */
export const activeRoster = () =>
  prisma.member.findMany({ where: { active: true }, select: { id: true, nickname: true, level: true }, orderBy: { nickname: "asc" } });

export const getMember = (id: string) => prisma.member.findUnique({ where: { id }, include: { user: true } });

export const getMemberByClaimToken = (token: string) => prisma.member.findUnique({ where: { claimToken: token } });

/** Stats, partners, recent sessions and bills for one member. */
export async function getMemberHistory(memberId: string) {
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

  const bySession = new Map<string, typeof results>();
  for (const r of results) bySession.set(r.sessionId, [...(bySession.get(r.sessionId) ?? []), r]);
  const sessions = participations.map((p) => ({
    ...p,
    record: playerRecords(bySession.get(p.sessionId) ?? []).get(memberId) ?? emptyRecord(),
  }));

  const partnerList = [...partnerRecords(results, memberId).entries()].sort((a, b) => b[1].games - a[1].games).slice(0, 8);
  const names = new Map(
    (await prisma.member.findMany({ where: { id: { in: partnerList.map(([id]) => id) } }, select: { id: true, nickname: true } })).map(
      (m) => [m.id, m.nickname],
    ),
  );
  const partners = partnerList.map(([id, r]) => ({ id, name: names.get(id) ?? "?", ...r }));

  return { stats, partners, sessions, charges };
}
