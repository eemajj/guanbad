import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { Tx } from "@/server/lock";
import type { Viewer } from "@/server/viewer";

/**
 * Every kind of change recorded in the history. Grouped by the prefix before the dot,
 * which the history screen uses as its filter (session, participant, match, charge, expense, member, settings).
 */
export type ActivityType =
  | "session.create"
  | "session.update"
  | "session.start"
  | "session.close"
  | "session.reopen"
  | "session.delete"
  | "participant.add"
  | "participant.join"
  | "participant.remove"
  | "participant.status"
  | "match.finish"
  | "match.result"
  | "match.cancel"
  | "match.substitute"
  | "match.undo"
  | "charge.reported"
  | "charge.paid"
  | "charge.unpaid"
  | "charge.waived"
  | "expense.add"
  | "expense.delete"
  | "member.create"
  | "member.update"
  | "member.active"
  | "member.claim-link"
  | "member.claim"
  | "user.role"
  | "settings.update";

export type ActivityEntry = {
  type: ActivityType;
  /** One Thai sentence shown in the history list. */
  summary: string;
  sessionId?: string | null;
  /** Before/after values, or what is needed to undo the change. */
  data?: Prisma.InputJsonValue;
};

/** Record who did what. Pass the transaction client when inside one, so the record commits with the change. */
export function audit(viewer: Viewer | null, entry: ActivityEntry, db: Tx = prisma) {
  return db.activity.create({ data: { actorId: viewer?.user.id ?? null, ...entry } });
}
