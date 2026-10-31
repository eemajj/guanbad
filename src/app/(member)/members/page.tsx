import { paths } from "@/lib/paths";
import Link from "next/link";
import { requireAdminPage } from "@/server/viewer";
import { baht, thaiDate } from "@/lib/format";
import { LEVELS, LEVEL_ORDER } from "@/domain/levels";
import { listMembers } from "@/features/members/queries";
import { formatRate, winRate } from "@/domain/results";
import { LevelBadge } from "@/ui/level";
import { Badge } from "@/ui/badge";
import { Table, TBody, THead, Td, Th } from "@/ui/table";
import { Card, CardHeader } from "@/ui/card";
import { EmptyState } from "@/ui/empty";
import { Input, Select } from "@/ui/field";
import { LinkButton, Button } from "@/ui/button";
import { PageHeader } from "@/ui/page-header";
import { TabLinks } from "@/ui/tabs";

export const metadata = { title: "สมาชิก" };

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; level?: string; show?: string }> }) {
  await requireAdminPage();
  const { q = "", level = "", show } = await searchParams;
  const inactive = show === "inactive";
  const { members, stats, activeCount, inactiveCount } = await listMembers({ q, level, inactive });
  const count = (active: boolean) => (active ? activeCount : inactiveCount);

  return (
    <>
      <PageHeader
        title="สมาชิก"
        description="ทะเบียนคนในก๊วน ระดับมือ สถิติ และยอดค้าง"
        actions={
          <LinkButton href={paths.newMember} variant="primary">
            + เพิ่มสมาชิก
          </LinkButton>
        }
      />
      <TabLinks
        current={inactive ? "inactive" : "active"}
        tabs={[
          { key: "active", label: "สมาชิก", href: "/members", count: count(true) },
          { key: "inactive", label: "ไม่ได้มาแล้ว", href: "/members?show=inactive", count: count(false) },
        ]}
      />
      <Card>
        <CardHeader
          title={`${members.length} คน`}
          action={
            <form className="flex flex-wrap gap-2" action="/members">
              {inactive && <input type="hidden" name="show" value="inactive" />}
              <Input name="q" defaultValue={q} placeholder="ค้นหาชื่อ / เบอร์" className="h-9 w-40 py-1.5" aria-label="ค้นหา" />
              <Select name="level" defaultValue={level} className="h-9 w-28 py-1.5" aria-label="กรองระดับมือ">
                <option value="">ทุกระดับ</option>
                {LEVEL_ORDER.map((l) => (
                  <option key={l} value={l}>
                    {LEVELS[l].code}
                  </option>
                ))}
              </Select>
              <Button type="submit" size="sm">
                ค้นหา
              </Button>
            </form>
          }
        />
        {members.length ? (
          <Table>
            <THead>
              <Th>ชื่อ</Th>
              <Th hide="sm">บัญชี</Th>
              <Th hide="sm" align="right">
                รอบ
              </Th>
              <Th align="right">เกม</Th>
              <Th align="right">%ชนะ</Th>
              <Th hide="md">มาล่าสุด</Th>
              <Th align="right">ยอดค้าง</Th>
            </THead>
            <TBody>
              {members.map((m) => {
                const st = stats.get(m.id);
                return (
                  <tr key={m.id} className="hover:bg-surface-2">
                    <Td>
                      <Link href={paths.member(m.id)} className="flex items-center gap-2 font-semibold hover:underline">
                        {m.nickname} <LevelBadge level={m.level} />
                      </Link>
                      {m.fullName && <div className="text-xs text-muted">{m.fullName}</div>}
                      <div className="text-xs text-muted sm:hidden">
                        {st.sessions} รอบ{m.user ? "" : " · ยังไม่ผูกบัญชี"}
                      </div>
                    </Td>
                    <Td hide="sm">
                      {m.user ? (
                        <Badge tone={m.user.role === "ADMIN" ? "brand" : "ok"}>{m.user.role === "ADMIN" ? "หัวก๊วน" : "LINE"}</Badge>
                      ) : (
                        <Badge tone="outline">ยังไม่ผูก</Badge>
                      )}
                    </Td>
                    <Td hide="sm" align="right" num>
                      {st.sessions}
                    </Td>
                    <Td align="right" num>
                      {st.games}
                    </Td>
                    <Td align="right" num>
                      {formatRate(winRate(st))}
                    </Td>
                    <Td hide="md" className="text-muted">
                      {st.lastSession ? thaiDate(st.lastSession) : "–"}
                    </Td>
                    <Td num align="right" className={st.outstanding ? "font-bold text-danger" : "text-muted"}>
                      {st.outstanding ? baht(st.outstanding) : "–"}
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <EmptyState
            title={q || level ? "ไม่พบสมาชิกตามเงื่อนไข" : "ยังไม่มีสมาชิก"}
            description="เพิ่มสมาชิกเอง หรือให้เพื่อนล็อกอินด้วย LINE แล้วสร้างโปรไฟล์"
          />
        )}
      </Card>
    </>
  );
}
