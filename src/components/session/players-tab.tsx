import type { Member } from "@prisma/client";
import type { SessionDetail, SessionState } from "@/server/session-state";
import { addNewMemberToSession, addParticipantsForm, removeParticipant, setParticipantStatus } from "@/server/actions/play";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action";
import { Dialog } from "@/components/dialog";
import { AddMembersForm } from "@/components/session/add-members";
import { ParticipantStatusBadge } from "@/components/session/status";
import { LevelBadge, LevelPicker } from "@/components/level";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input } from "@/components/ui/field";

export function PlayersTab({ s, st, isAdmin, roster, myMemberId }: { s: SessionDetail; st: SessionState; isAdmin: boolean; roster: Pick<Member, "id" | "nickname" | "level">[]; myMemberId?: string }) {
  const closed = s.status === "CLOSED";
  const queuePos = new Map(st.queue.map((q, i) => [q.id, i + 1]));
  const courtName = new Map(s.courts.map((c) => [c.id, c.name]));
  const inSession = new Set(s.participants.map((p) => p.memberId));
  const available = roster.filter((m) => !inSession.has(m.id));

  return (
    <Card>
      <CardHeader
        title={`ผู้เล่น ${s.participants.length}${s.maxPlayers ? `/${s.maxPlayers}` : ""} คน`}
        description={s.selfSignup ? "สมาชิกลงชื่อเองได้ หรือหัวก๊วนเพิ่มให้" : "รอบนี้หัวก๊วนเป็นคนเพิ่มชื่อ"}
        action={
          isAdmin &&
          !closed && (
            <>
              <Dialog trigger="+ จากทะเบียน" variant="primary" size="sm" title="เพิ่มจากทะเบียนสมาชิก" description="เลือกได้หลายคน">
                <AddMembersForm action={addParticipantsForm.bind(null, s.id)} members={available} />
              </Dialog>
              <Dialog trigger="+ คนใหม่" size="sm" title="เพิ่มคนใหม่" description="สร้างสมาชิกใหม่ในทะเบียน แล้วใส่เข้ารอบนี้ทันที">
                <ActionForm action={addNewMemberToSession.bind(null, s.id)} closeDialog className="flex flex-col gap-4">
                  <Field label="ชื่อเล่น">
                    <Input name="nickname" required maxLength={30} autoComplete="off" />
                  </Field>
                  <LevelPicker />
                  <SubmitButton>เพิ่ม</SubmitButton>
                </ActionForm>
              </Dialog>
            </>
          )
        }
      />
      {s.participants.length === 0 ? (
        <EmptyState title="ยังไม่มีใครลงชื่อ" description={isAdmin ? "เพิ่มจากทะเบียน หรือส่งลิงก์หน้านี้ในกลุ่ม LINE ให้สมาชิกลงชื่อเอง" : "เป็นคนแรกได้เลย"} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="hidden w-10 px-5 py-2 font-semibold sm:table-cell">#</th>
                <th className="px-4 py-2 font-semibold sm:px-2">ชื่อ</th>
                <th className="hidden px-2 py-2 font-semibold sm:table-cell">สถานะ</th>
                <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell">เกม</th>
                <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell">ชนะ–แพ้</th>
                <th className="px-4 py-2 text-right font-semibold sm:px-5"><span className="sr-only">จัดการ</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {s.participants.map((p, i) => {
                const stat = st.stats.get(p.memberId)!;
                const mine = p.memberId === myMemberId;
                const canEdit = (isAdmin || mine) && !closed;
                return (
                  <tr key={p.id} className={mine ? "bg-brand-soft/40" : ""}>
                    <td className="num hidden px-5 py-2.5 text-muted sm:table-cell">{i + 1}</td>
                    <td className="px-4 py-2.5 sm:px-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold">{p.member.nickname}</span>
                        <LevelBadge level={p.member.level} />
                        {mine && <Badge tone="brand">คุณ</Badge>}
                        {p.source === "SELF" && <span className="text-xs text-muted">ลงชื่อเอง</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted sm:hidden">
                        <ParticipantStatusBadge status={p.status} court={stat.playing ? courtName.get(stat.playing.courtId) : undefined} queue={s.status === "LIVE" ? queuePos.get(p.memberId) : undefined} />
                        {stat.games} เกม · ชนะ {stat.wins} แพ้ {stat.losses}
                      </div>
                    </td>
                    <td className="hidden px-2 py-2.5 sm:table-cell">
                      <ParticipantStatusBadge status={p.status} court={stat.playing ? courtName.get(stat.playing.courtId) : undefined} queue={s.status === "LIVE" ? queuePos.get(p.memberId) : undefined} />
                    </td>
                    <td className="num hidden px-2 py-2.5 text-right sm:table-cell">{stat.games}</td>
                    <td className="num hidden px-2 py-2.5 text-right sm:table-cell">{stat.wins}–{stat.losses}</td>
                    <td className="px-4 py-2.5 sm:px-5">
                      {canEdit && (
                        <div className="flex flex-wrap justify-end gap-1">
                          {s.status === "LIVE" &&
                            (p.status === "ACTIVE" ? (
                              <ActionButton action={setParticipantStatus.bind(null, p.id, "RESTING")} size="sm">พัก</ActionButton>
                            ) : (
                              <ActionButton action={setParticipantStatus.bind(null, p.id, "ACTIVE")} size="sm" variant="primary">กลับมาเล่น</ActionButton>
                            ))}
                          {s.status === "LIVE" && p.status !== "LEFT" && stat.games > 0 && (
                            <ActionButton action={setParticipantStatus.bind(null, p.id, "LEFT")} size="sm" variant="ghost">กลับบ้าน</ActionButton>
                          )}
                          {stat.games === 0 && !stat.playing && (
                            <ActionButton action={removeParticipant.bind(null, p.id)} size="sm" variant="ghost" confirm={mine && !isAdmin ? "ยืนยันถอนชื่อ" : "ยืนยันลบ"}>
                              {mine && !isAdmin ? "ถอนชื่อ" : "ลบ"}
                            </ActionButton>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
