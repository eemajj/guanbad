import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { ActionError } from "@/server/viewer";

export type Tx = Prisma.TransactionClient;

/** Serialise all changes to one session so two organisers can't double-book a player or a court. */
export async function lockSession(tx: Tx, sessionId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))`;
}

/** Run `fn` in a transaction holding the session lock. */
export function inSessionLock<T>(sessionId: string, fn: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await lockSession(tx, sessionId);
    return fn(tx);
  });
}

/** Same as inSessionLock, starting from a match id (looks up its session first). */
export function inMatchLock<T>(matchId: string, fn: (tx: Tx, sessionId: string) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: matchId }, select: { sessionId: true } });
    if (!match) throw new ActionError("ไม่พบเกมนี้");
    await lockSession(tx, match.sessionId);
    return fn(tx, match.sessionId);
  });
}
