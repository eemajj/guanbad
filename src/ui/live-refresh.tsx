"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** After this many polls in a row where the screen is still behind, reload the page instead. */
const MAX_SOFT_TRIES = 2;

/**
 * Keeps a screen current for everyone at the court without reloading it for nothing:
 * every few seconds (while the tab is visible) ask the server for a version number,
 * and refresh the page data when it is newer than what is on screen.
 *
 * It compares against the version currently *on screen* (committed), so a refresh
 * that does not land is retried on the next tick. After MAX_SOFT_TRIES ticks still
 * behind, it falls back to a full reload so the data is always correct. (Next 15.5 dropped
 * soft refreshes; fixed by Next 16, see docs/adr/0006. The fallback stays as a safety net.)
 *
 * @param url     endpoint returning `{ v: number }`
 * @param version the version the current render was built from
 */
export function LiveRefresh({ url, version, seconds = 3 }: { url: string; version: number; seconds?: number }) {
  const router = useRouter();
  const rendered = useRef(version);
  const behindTicks = useRef(0);

  // Record the version only once the new screen is committed. A render that React starts
  // but never shows (e.g. stuck behind a dropped response) must not count as "up to date".
  useEffect(() => {
    rendered.current = version;
    behindTicks.current = 0;
  }, [version]);

  useEffect(() => {
    let stopped = false;
    let busy = false;
    const check = async () => {
      if (busy || stopped || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const { v } = (await res.json()) as { v: number };
        if (v <= rendered.current) {
          behindTicks.current = 0;
          return;
        }
        behindTicks.current += 1;
        if (behindTicks.current > MAX_SOFT_TRIES) window.location.reload();
        else router.refresh();
      } catch {
        // Offline for a moment at the court: try again on the next tick.
      } finally {
        busy = false;
      }
    };
    const id = setInterval(check, seconds * 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [url, seconds, router]);

  return null;
}
