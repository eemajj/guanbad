"use client";

import { toast } from "sonner";
import { Button, type ButtonSize, type ButtonVariant } from "@/ui/button";

/**
 * Share a link of this app to LINE (opens the LINE app on phones) — the group already talks there.
 * Paths are relative to the site; full URLs are built in the browser so they are right on any domain.
 * `links` adds one line per item under the text, e.g. every player's bill in one message.
 */
export function ShareToLine({
  path,
  links = [],
  text,
  label = "แชร์ไป LINE",
  variant = "secondary",
  size = "md",
}: {
  path?: string;
  links?: { label: string; path: string }[];
  text: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const share = async () => {
    const full = (p: string) => new URL(p, window.location.origin).toString();
    const url = path ? full(path) : "";
    const message = [text, url, ...links.map((l) => `${l.label} ${full(l.path)}`)].filter(Boolean).join("\n");
    // The phone's own share sheet when available (lets them pick LINE, Messenger, ...), else LINE directly.
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        /* cancelled: fall through to LINE */
      }
    }
    const opened = window.open(`https://line.me/R/share?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    if (!opened) {
      await navigator.clipboard.writeText(message).then(
        () => toast.success("คัดลอกลิงก์แล้ว วางในแชท LINE ได้เลย"),
        () => toast.message(message),
      );
    }
  };
  return (
    <Button variant={variant} size={size} onClick={share}>
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="currentColor">
        <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.6 7.2 8.4 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5 1-.4 5.6-3.3 7.7-5.7C21.2 14.6 22 12.9 22 11c0-4.4-4.5-8-10-8z" />
      </svg>
      {label}
    </Button>
  );
}
