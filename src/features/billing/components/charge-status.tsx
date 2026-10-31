import type { ChargeStatus } from "@prisma/client";
import { CHARGE_STATUS } from "@/domain/labels";
import { Badge, type Tone } from "@/ui/badge";

const TONE: Record<ChargeStatus, Tone> = { UNPAID: "danger", REPORTED: "accent", PAID: "ok", WAIVED: "outline" };

export function ChargeStatusBadge({ status }: { status: ChargeStatus }) {
  return <Badge tone={TONE[status]}>{CHARGE_STATUS[status]}</Badge>;
}
