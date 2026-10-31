"use client";

import { useEffect, useState } from "react";

/** "12" minutes since `since`, updating by itself (the page only reloads when data changes). */
export function MinutesSince({ since }: { since: string | Date }) {
  const start = new Date(since).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  // Server and phone clocks can disagree by a minute at render time; that is fine.
  return <span suppressHydrationWarning>{Math.max(0, Math.floor((now - start) / 60_000))}</span>;
}
