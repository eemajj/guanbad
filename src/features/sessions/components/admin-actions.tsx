import { paths } from "@/lib/paths";
import { type SessionDetail } from "@/features/sessions/state";
import { closeSession, reopenSession, startSession } from "@/features/sessions/actions";
import { ActionButton } from "@/ui/action";
import { LinkButton } from "@/ui/button";

/** Organiser buttons in the session header: the next step of the session. */
export function AdminActions({ s }: { s: SessionDetail }) {
  return (
    <div className="flex flex-wrap gap-2">
      {s.status !== "CLOSED" && <LinkButton href={paths.editSession(s.id)}>แก้ไขรอบ</LinkButton>}
      {s.status === "OPEN" && (
        <ActionButton action={startSession.bind(null, s.id)} variant="primary">
          เริ่มตี
        </ActionButton>
      )}
      {s.status === "LIVE" && (
        <ActionButton action={closeSession.bind(null, s.id)} variant="accent" confirm="ยืนยันจบรอบและออกบิล">
          จบรอบ & ออกบิล
        </ActionButton>
      )}
      {s.status === "CLOSED" && (
        <ActionButton action={reopenSession.bind(null, s.id)} confirm="ยืนยันเปิดรอบอีกครั้ง">
          เปิดรอบอีกครั้ง
        </ActionButton>
      )}
    </div>
  );
}
