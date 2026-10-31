import { notFound } from "next/navigation";
import { levelCode } from "@/domain/levels";
import { thaiDate } from "@/lib/format";
import { paths } from "@/lib/paths";
import { MinutesSince } from "@/ui/elapsed";
import { LiveRefresh } from "@/ui/live-refresh";
import { getSettings } from "@/features/settings/queries";
import { deriveState, loadSession, teamOf } from "@/features/sessions/state";

export const metadata = { title: "จอคอร์ท", robots: { index: false } };

/**
 * Big-screen view for a tablet or TV at the venue: courts, who is next, and the queue.
 * Read-only and open without login (like the payment page, reachable only by its link),
 * so a spare device can stay on it all evening.
 */
export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await loadSession(id);
  if (!s) notFound();
  const st = deriveState(s);
  const settings = await getSettings();
  const member = new Map(s.participants.map((p) => [p.memberId, p.member]));
  const name = (mid: string) => member.get(mid)?.nickname ?? "?";
  const pair = (ids: string[]) => ids.map(name).join(" + ");

  return (
    <main className="min-h-dvh bg-[#0c1a13] p-4 text-white sm:p-6 lg:p-8">
      {s.status !== "CLOSED" && <LiveRefresh url={paths.api.sessionVersion(s.id)} version={s.version} seconds={3} />}
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-bold sm:text-4xl">{s.venue}</h1>
        <p className="text-lg text-white/70">
          {settings.groupName} · {thaiDate(s.date)} · {s.startTime}–{s.endTime}
        </p>
      </header>

      {s.status !== "LIVE" ? (
        <p className="py-24 text-center font-display text-3xl text-white/80">
          {s.status === "OPEN" ? "รอหัวก๊วนเริ่มตี" : "จบรอบแล้ว ขอบคุณที่มาตีครับ"}
        </p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <section className="grid gap-4 sm:grid-cols-2" aria-label="คอร์ท">
            {s.courts.map((court) => {
              const m = st.playingByCourt.get(court.id);
              return (
                <article key={court.id} className="rounded-2xl border-4 border-[#e9f5ee] bg-[#1e6a4d] p-4">
                  <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="font-display text-3xl font-bold">คอร์ท {court.name}</h2>
                    {m && (
                      <span className="font-display text-2xl tabular-nums text-white/80">
                        <MinutesSince since={m.startedAt} /> นาที
                      </span>
                    )}
                  </div>
                  {m ? (
                    <div className="grid grid-cols-2 divide-x-4 divide-dashed divide-[#e9f5ee]">
                      {(["A", "B"] as const).map((t) => (
                        <div key={t} className="flex flex-col items-center gap-2 px-2 py-3">
                          {teamOf(m, t).map((mid) => (
                            <span key={mid} className="max-w-full truncate font-display text-3xl font-bold sm:text-4xl">
                              {name(mid)} <span className="text-lg font-medium text-white/70">{levelCode(member.get(mid)!.level)}</span>
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-8 text-center font-display text-2xl text-white/70">ว่าง</p>
                  )}
                </article>
              );
            })}
          </section>

          <aside className="flex flex-col gap-4">
            {st.next && (
              <section className="rounded-2xl bg-[#d9831a] p-4 text-[#2a1804]">
                <h2 className="font-display text-xl font-bold">เกมถัดไป</h2>
                <p className="font-display text-3xl font-bold">
                  {pair(st.next.teamA)} <span className="opacity-70">vs</span> {pair(st.next.teamB)}
                </p>
              </section>
            )}
            <section className="rounded-2xl bg-white/10 p-4">
              <h2 className="mb-2 font-display text-xl font-bold">คิวรอ ({st.queue.length})</h2>
              <ol className="flex flex-col gap-1.5">
                {st.queue.map((q, i) => (
                  <li key={q.id} className="flex items-baseline gap-3 font-display text-2xl">
                    <span className="w-8 text-right tabular-nums text-white/60">{i + 1}</span>
                    {name(q.id)}
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
