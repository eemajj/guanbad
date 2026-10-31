"use server";

import type { ChargeStatus } from "@prisma/client";
import { CHARGE_STATUS } from "@/domain/labels";
import { baht } from "@/lib/format";
import { asAdmin, asUser } from "@/server/action";
import { audit } from "@/server/activity";
import { prisma } from "@/server/db";
import { refresh } from "@/server/revalidate";
import { ActionError } from "@/server/viewer";

const loadCharge = async (id: string) => {
  const c = await prisma.charge.findUnique({ where: { id }, include: { member: { select: { nickname: true } } } });
  if (!c) throw new ActionError("ไม่พบบิลนี้");
  return c;
};

function refreshCharge(c: { id: string; sessionId: string }) {
  refresh.money();
  refresh.session(c.sessionId);
  refresh.charge(c.id);
}

/** สมาชิกแจ้งว่าโอนแล้ว (หัวก๊วนแจ้งแทนได้) */
export async function reportPaid(chargeId: string) {
  return asUser(async (viewer) => {
    const c = await loadCharge(chargeId);
    if (!viewer.isAdmin && c.memberId !== viewer.member?.id) throw new ActionError("แจ้งโอนได้เฉพาะบิลของตัวเอง");
    if (c.status !== "UNPAID") throw new ActionError("บิลนี้แจ้งโอนหรือชำระแล้ว");
    await prisma.$transaction(async (tx) => {
      await tx.charge.update({ where: { id: chargeId }, data: { status: "REPORTED", reportedAt: new Date() } });
      await audit(
        viewer,
        { type: "charge.reported", sessionId: c.sessionId, summary: `${c.member.nickname} แจ้งโอน ${baht(c.total)}`, data: { chargeId } },
        tx,
      );
    });
    refreshCharge(c);
    return { ok: true, message: "แจ้งโอนแล้ว รอหัวก๊วนยืนยัน" };
  });
}

const MESSAGE: Record<ChargeStatus, string> = {
  PAID: "บันทึกว่าได้รับเงินแล้ว",
  WAIVED: "ยกเว้นบิลนี้แล้ว",
  UNPAID: "แก้เป็นยังไม่จ่ายแล้ว",
  REPORTED: "บันทึกแล้ว",
};
const TYPE = { PAID: "charge.paid", WAIVED: "charge.waived", UNPAID: "charge.unpaid", REPORTED: "charge.reported" } as const;

/** หัวก๊วนเปลี่ยนสถานะบิล: ยืนยันรับเงิน / ยกเว้น / แก้กลับเป็นยังไม่จ่าย */
export async function setChargeStatus(chargeId: string, status: ChargeStatus) {
  return asAdmin(async (viewer) => {
    const c = await loadCharge(chargeId);
    if (c.status === status) return { ok: true, message: MESSAGE[status] };
    const settled = status === "PAID" || status === "WAIVED";
    await prisma.$transaction(async (tx) => {
      await tx.charge.update({
        where: { id: chargeId },
        data: {
          status,
          paidAt: status === "PAID" ? new Date() : null,
          reportedAt: status === "UNPAID" ? null : c.reportedAt,
          confirmedById: settled ? viewer.user.id : null,
        },
      });
      await audit(
        viewer,
        {
          type: TYPE[status],
          sessionId: c.sessionId,
          summary: `บิล ${c.member.nickname} ${baht(c.total)}: ${CHARGE_STATUS[c.status]} → ${CHARGE_STATUS[status]}`,
          data: { chargeId, before: c.status, after: status },
        },
        tx,
      );
    });
    refreshCharge(c);
    return { ok: true, message: MESSAGE[status] };
  });
}

/** ย้อนการเปลี่ยนสถานะบิลล่าสุดของหัวก๊วน (เช่น กด “ได้รับแล้ว” ผิดคน) กลับเป็นสถานะก่อนหน้า */
export async function undoChargeStatus(chargeId: string) {
  return asAdmin(async () => {
    const last = await prisma.activity.findFirst({
      where: { type: { in: ["charge.paid", "charge.waived", "charge.unpaid"] }, data: { path: ["chargeId"], equals: chargeId } },
      orderBy: { at: "desc" },
    });
    const data = last?.data as { before?: ChargeStatus; after?: ChargeStatus } | null;
    const c = await loadCharge(chargeId);
    if (!data?.before || data.after !== c.status) throw new ActionError("สถานะบิลเปลี่ยนไปแล้ว ย้อนกลับไม่ได้");
    return setChargeStatus(chargeId, data.before).then((r) =>
      r.ok ? { ok: true as const, message: `ย้อนกลับเป็น “${CHARGE_STATUS[data.before!]}” แล้ว` } : r,
    );
  });
}
