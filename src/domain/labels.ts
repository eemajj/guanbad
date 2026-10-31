import type { ChargeStatus, ExpenseCategory, ParticipantStatus, SessionStatus } from "@prisma/client";

/** Thai wording for every status, in one place so screens and messages always agree. */
export const SESSION_STATUS: Record<SessionStatus, string> = { OPEN: "เปิดรับชื่อ", LIVE: "กำลังตี", CLOSED: "จบรอบแล้ว" };

export const CHARGE_STATUS: Record<ChargeStatus, string> = {
  UNPAID: "ยังไม่จ่าย",
  REPORTED: "แจ้งโอนแล้ว",
  PAID: "ได้รับแล้ว",
  WAIVED: "ยกเว้น",
};

export const PARTICIPANT_STATUS: Record<ParticipantStatus, string> = { ACTIVE: "พร้อมเล่น", RESTING: "พัก", LEFT: "กลับแล้ว" };

export const EXPENSE_CATEGORY: Record<ExpenseCategory, string> = { COURT: "ค่าคอร์ท", SHUTTLE: "ค่าลูก", OTHER: "อื่นๆ" };

/** The three steps of a session as people experience it. */
export const SESSION_STEPS: { status: SessionStatus; label: string }[] = [
  { status: "OPEN", label: "ลงชื่อ" },
  { status: "LIVE", label: "ตี" },
  { status: "CLOSED", label: "เก็บเงิน" },
];
