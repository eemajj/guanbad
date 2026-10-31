import type { ParticipantStatus, SessionStatus } from "@prisma/client";
import { PARTICIPANT_STATUS, SESSION_STATUS, SESSION_STEPS } from "@/domain/labels";
import { cn } from "@/lib/cn";
import { Badge } from "@/ui/badge";

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const tone = status === "LIVE" ? "ok" : status === "CLOSED" ? "neutral" : "accent";
  return (
    <Badge tone={tone}>
      {status === "LIVE" && "● "}
      {SESSION_STATUS[status]}
    </Badge>
  );
}

export function ParticipantStatusBadge({ status, court, queue }: { status: ParticipantStatus; court?: string; queue?: number }) {
  if (court) return <Badge tone="ok">คอร์ท {court}</Badge>;
  if (status === "RESTING") return <Badge tone="warn">{PARTICIPANT_STATUS.RESTING}</Badge>;
  if (status === "LEFT") return <Badge tone="outline">{PARTICIPANT_STATUS.LEFT}</Badge>;
  return <Badge>{queue ? `คิว ${queue}` : PARTICIPANT_STATUS.ACTIVE}</Badge>;
}

export function SessionSteps({ status }: { status: SessionStatus }) {
  const current = SESSION_STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="ขั้นตอนของรอบ">
      {SESSION_STEPS.map((s, i) => (
        <li key={s.status} className="flex items-center gap-2">
          <span
            aria-current={i === current ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold",
              i < current && "text-ok",
              i === current && "bg-accent text-accent-ink",
              i > current && "text-muted",
            )}
          >
            <span className="num">{i < current ? "✓" : i + 1}</span>
            {s.label}
          </span>
          {i < SESSION_STEPS.length - 1 && <span className="h-px w-5 bg-line" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
