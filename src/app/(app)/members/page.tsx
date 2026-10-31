import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/viewer";
import { baht, thaiDate } from "@/lib/format";
import { LEVELS, LEVEL_ORDER } from "@/domain/levels";
import { memberStats } from "@/server/queries";
import { LevelBadge } from "@/components/level";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/field";
import { LinkButton, Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import type { Level, Prisma } from "@prisma/client";

export const metadata = { title: "สมาชิก" };

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; level?: string; show?: string }> }) {
  await requireAdminPage();
  const { q = "", level = "", show } = await searchParams;
  const inactive = show === "inactive";
  const where: Prisma.MemberWhereInput = {
    active: !inactive,
    ...(q ? { OR: [{ nickname: { contains: q, mode: "insensitive" } }, { fullName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
    ...(level in LEVELS ? { level: level as Level } : {}),
  };
  const [members, counts] = await Promise.all([
    prisma.member.findMany({ where, orderBy: { nickname: "asc" }, include: { user: { select: { role: true } } } }),
    prisma.member.groupBy({ by: ["active"], _count: true }),
  ]);
  const stats = await memberStats(members.map((m) => m.id));
  const count = (a: boolean) => counts.find((c) => c.active === a)?._count ?? 0;

  return (
    <>
      <PageHeader title="สมาชิก" description="ทะเบียนคนในก๊วน ระดับมือ สถิติ และยอดค้าง" actions={<LinkButton href="/members/new" variant="primary">+ เพิ่มสมาชิก</LinkButton>} />
      <TabLinks current={inactive ? "inactive" : "active"} tabs={[{ key: "active", label: "สมาชิก", href: "/members", count: count(true) }, { key: "inactive", label: "ไม่ได้มาแล้ว", href: "/members?show=inactive", count: count(false) }]} />
      <Card>
        <CardHeader
          title={`${members.length} คน`}
          action={
            <form className="flex flex-wrap gap-2" action="/members">
              {inactive && <input type="hidden" name="show" value="inactive" />}
              <Input name="q" defaultValue={q} placeholder="ค้นหาชื่อ / เบอร์" className="h-9 w-40 py-1.5" aria-label="ค้นหา" />
              <Select name="level" defaultValue={level} className="h-9 w-28 py-1.5" aria-label="กรองระดับมือ">
                <option value="">ทุกระดับ</option>
                {LEVEL_ORDER.map((l) => <option key={l} value={l}>{LEVELS[l].code}</option>)}
              </Select>
              <Button type="submit" size="sm">ค้นหา</Button>
            </form>
          }
        />
        {members.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-2 font-semibold">ชื่อ</th>
                  <th className="hidden px-2 py-2 font-semibold sm:table-cell">บัญชี</th>
                  <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell">รอบ</th>
                  <th className="px-2 py-2 text-right font-semibold">เกม</th>
                  <th className="px-2 py-2 text-right font-semibold">ชนะ</th>
                  <th className="hidden px-2 py-2 font-semibold md:table-cell">มาล่าสุด</th>
                  <th className="px-5 py-2 text-right font-semibold">ยอดค้าง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.map((m) => {
                  const st = stats.get(m.id);
                  return (
                    <tr key={m.id} className="hover:bg-surface-2">
                      <td className="px-4 py-2.5 sm:px-5">
                        <Link href={`/members/${m.id}`} className="flex items-center gap-2 font-semibold hover:underline">
                          {m.nickname} <LevelBadge level={m.level} />
                        </Link>
                        {m.fullName && <div className="text-xs text-muted">{m.fullName}</div>}
                        <div className="text-xs text-muted sm:hidden">{st.sessions} รอบ{m.user ? "" : " · ยังไม่ผูกบัญชี"}</div>
                      </td>
                      <td className="hidden px-2 py-2.5 sm:table-cell">{m.user ? <Badge tone={m.user.role === "ADMIN" ? "brand" : "ok"}>{m.user.role === "ADMIN" ? "หัวก๊วน" : "LINE"}</Badge> : <Badge tone="outline">ยังไม่ผูก</Badge>}</td>
                      <td className="num hidden px-2 py-2.5 text-right sm:table-cell">{st.sessions}</td>
                      <td className="num px-2 py-2.5 text-right">{st.games}</td>
                      <td className="num px-2 py-2.5 text-right">{st.games ? `${Math.round((st.wins / st.games) * 100)}%` : "–"}</td>
                      <td className="hidden px-2 py-2.5 text-muted md:table-cell">{st.lastSession ? thaiDate(st.lastSession) : "–"}</td>
                      <td className={`num px-5 py-2.5 text-right ${st.outstanding ? "font-bold text-danger" : "text-muted"}`}>{st.outstanding ? baht(st.outstanding) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={q || level ? "ไม่พบสมาชิกตามเงื่อนไข" : "ยังไม่มีสมาชิก"} description="เพิ่มสมาชิกเอง หรือให้เพื่อนล็อกอินด้วย LINE แล้วสร้างโปรไฟล์" />
        )}
      </Card>
    </>
  );
}
