import type { ChargeStatus, ParticipantStatus, SessionStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  if (status === "LIVE") return <Badge tone="ok">● กำลังตี</Badge>;
  if (status === "CLOSED") return <Badge tone="neutral">จบรอบแล้ว</Badge>;
  return <Badge tone="accent">เปิดรับชื่อ</Badge>;
}

export function ChargeStatusBadge({ status }: { status: ChargeStatus }) {
  const map = {
    UNPAID: ["danger", "ยังไม่จ่าย"],
    REPORTED: ["accent", "แจ้งโอนแล้ว"],
    PAID: ["ok", "ได้รับแล้ว"],
    WAIVED: ["outline", "ยกเว้น"],
  } as const;
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function ParticipantStatusBadge({ status, court, queue }: { status: ParticipantStatus; court?: string; queue?: number }) {
  if (court) return <Badge tone="ok">คอร์ท {court}</Badge>;
  if (status === "RESTING") return <Badge tone="warn">พัก</Badge>;
  if (status === "LEFT") return <Badge tone="outline">กลับแล้ว</Badge>;
  return queue ? <Badge>คิว {queue}</Badge> : <Badge>พร้อมเล่น</Badge>;
}

const STEPS: { key: SessionStatus; label: string }[] = [
  { key: "OPEN", label: "ลงชื่อ" },
  { key: "LIVE", label: "ตี" },
  { key: "CLOSED", label: "เก็บเงิน" },
];

export function SessionSteps({ status }: { status: SessionStatus }) {
  const current = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="ขั้นตอนของรอบ">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
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
          {i < STEPS.length - 1 && <span className="h-px w-5 bg-line" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
