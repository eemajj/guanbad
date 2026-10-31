import { paths } from "@/lib/paths";
import { thaiDate } from "@/lib/format";
import { ActionButton } from "@/ui/action";
import { LinkButton } from "@/ui/button";
import { ShareToLine } from "@/ui/share";
import { reopenSession } from "../actions";
import type { SessionDetail } from "../state";

/** Header buttons for organisers. The next step of the session lives in the bottom action bar. */
export function AdminActions({ s }: { s: SessionDetail }) {
  return (
    <div className="flex flex-wrap gap-2">
      {s.status !== "CLOSED" && (
        <ShareToLine
          path={paths.session(s.id)}
          text={`ลงชื่อตีแบด ${s.venue} ${thaiDate(s.date)} ${s.startTime}–${s.endTime} น.`}
          label="ชวนลงชื่อ"
          size="sm"
        />
      )}
      {s.status === "LIVE" && (
        <LinkButton href={paths.board(s.id)} size="sm" target="_blank">
          จอใหญ่
        </LinkButton>
      )}
      {s.status !== "CLOSED" && (
        <LinkButton href={paths.editSession(s.id)} size="sm">
          แก้ไขรอบ
        </LinkButton>
      )}
      {s.status === "CLOSED" && (
        <ActionButton action={reopenSession.bind(null, s.id)} size="sm" confirm="ยืนยันเปิดรอบอีกครั้ง">
          เปิดรอบอีกครั้ง
        </ActionButton>
      )}
    </div>
  );
}
