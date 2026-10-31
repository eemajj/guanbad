import "server-only";
import { prisma } from "@/server/db";

export async function outstandingCharges(memberId?: string) {
  return prisma.charge.findMany({
    where: { status: { in: ["UNPAID", "REPORTED"] }, ...(memberId ? { memberId } : {}) },
    include: { member: true, session: true },
    orderBy: [{ status: "desc" }, { session: { date: "asc" } }],
  });
}

/** Transfers members reported, waiting for the organiser to check the bank app. */
export const reportedCharges = () =>
  prisma.charge.findMany({ where: { status: "REPORTED" }, include: { member: true, session: true }, orderBy: { reportedAt: "asc" } });

/** One bill with the person and session, for the public payment page. */
export const getCharge = (id: string) => prisma.charge.findUnique({ where: { id }, include: { member: true, session: true } });
