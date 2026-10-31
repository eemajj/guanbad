"use server";

import type { ChargeStatus } from "@prisma/client";
import { asAdmin, asUser } from "@/server/action";
import { prisma } from "@/server/db";
import { refresh } from "@/server/revalidate";
import { ActionError } from "@/server/viewer";

/** สมาชิกแจ้งว่าโอนแล้ว (หัวก๊วนแจ้งแทนได้) */
export async function reportPaid(chargeId: string) {
  return asUser(async (viewer) => {
    const c = await prisma.charge.findUnique({ where: { id: chargeId } });
    if (!c) throw new ActionError("ไม่พบบิลนี้");
    if (!viewer.isAdmin && c.memberId !== viewer.member?.id) throw new ActionError("แจ้งโอนได้เฉพาะบิลของตัวเอง");
    if (c.status !== "UNPAID") throw new ActionError("บิลนี้แจ้งโอนหรือชำระแล้ว");
    await prisma.charge.update({ where: { id: chargeId }, data: { status: "REPORTED", reportedAt: new Date() } });
    refresh.money();
    refresh.session(c.sessionId);
    refresh.charge(chargeId);
    return { ok: true, message: "แจ้งโอนแล้ว รอหัวก๊วนยืนยัน" };
  });
}

const MESSAGE: Record<ChargeStatus, string> = {
  PAID: "บันทึกว่าได้รับเงินแล้ว",
  WAIVED: "ยกเว้นบิลนี้แล้ว",
  UNPAID: "แก้เป็นยังไม่จ่ายแล้ว",
  REPORTED: "บันทึกแล้ว",
};

/** หัวก๊วนเปลี่ยนสถานะบิล: ยืนยันรับเงิน / ยกเว้น / แก้กลับเป็นยังไม่จ่าย */
export async function setChargeStatus(chargeId: string, status: ChargeStatus) {
  return asAdmin(async (viewer) => {
    const c = await prisma.charge.findUnique({ where: { id: chargeId } });
    if (!c) throw new ActionError("ไม่พบบิลนี้");
    const settled = status === "PAID" || status === "WAIVED";
    await prisma.charge.update({
      where: { id: chargeId },
      data: {
        status,
        paidAt: status === "PAID" ? new Date() : null,
        reportedAt: status === "UNPAID" ? null : c.reportedAt,
        confirmedById: settled ? viewer.user.id : null,
      },
    });
    refresh.money();
    refresh.session(c.sessionId);
    refresh.charge(chargeId);
    return { ok: true, message: MESSAGE[status] };
  });
}
