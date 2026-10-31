import type { SessionDetail } from "@/features/sessions/state";

/** Look up players of one session by id: name("id"), pair(["a","b"]) → "ต้น + เอ". */
export function namesFor(s: SessionDetail) {
  const member = new Map(s.participants.map((p) => [p.memberId, p.member]));
  const name = (id: string) => member.get(id)?.nickname ?? "?";
  return { member, name, pair: (ids: string[]) => ids.map(name).join(" + ") };
}
