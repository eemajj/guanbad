import type { Level } from "@prisma/client";
import { prisma } from "@/server/db";
import { session } from "./setup";

let n = 0;
const uniq = (p: string) => `${p}-${++n}-${Date.now().toString(36)}`;

export async function makeUser(role: "ADMIN" | "MEMBER", withMember = true) {
  const name = uniq(role.toLowerCase());
  return prisma.user.create({
    data: { lineId: `dev:${name}`, name, role, ...(withMember ? { member: { create: { nickname: name } } } : {}) },
    include: { member: true },
  });
}

export const actAs = (user: { id: string } | null) => {
  session.userId = user?.id ?? null;
};

export async function makeMembers(count: number, level: Level = "N") {
  return Promise.all(Array.from({ length: count }, () => prisma.member.create({ data: { nickname: uniq("m"), level } })));
}

/** A session with the given members already signed up (in order). */
export async function makeSession(memberIds: string[], opts: { courts?: number; status?: "OPEN" | "LIVE" } = {}) {
  const now = Date.now();
  return prisma.session.create({
    data: {
      venue: uniq("สนาม"),
      date: new Date(Date.UTC(2026, 9, 31)),
      startTime: "19:00",
      endTime: "21:00",
      courtRate: 18000,
      shuttlePrice: 8500,
      status: opts.status ?? "OPEN",
      courts: { create: Array.from({ length: opts.courts ?? 1 }, (_, i) => ({ name: String(i + 1), position: i })) },
      participants: { create: memberIds.map((memberId, i) => ({ memberId, joinedAt: new Date(now + i), queuedAt: new Date(now + i) })) },
    },
  });
}

export const playingMatches = (sessionId: string) =>
  prisma.match.findMany({ where: { sessionId, status: "PLAYING" }, include: { players: true } });
