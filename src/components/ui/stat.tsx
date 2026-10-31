import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "danger" | "ok" }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className={cn("num mt-1 text-2xl font-bold", tone === "danger" && "text-danger", tone === "ok" && "text-ok")}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
