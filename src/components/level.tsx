"use client";

import { useState } from "react";
import type { Level } from "@prisma/client";
import { LEVELS, LEVEL_ORDER } from "@/domain/levels";
import { cn } from "@/lib/cn";

export function LevelBadge({ level, className }: { level: Level; className?: string }) {
  return (
    <span title={LEVELS[level].name} className={cn("inline-flex h-5 min-w-8 items-center justify-center rounded-md bg-brand-soft px-1.5 font-display text-xs font-bold text-brand", className)}>
      {LEVELS[level].code}
    </span>
  );
}

/** Radio list with the group's own description for each level, so people pick consistently. */
export function LevelPicker({ name = "level", defaultValue = "N", compact }: { name?: string; defaultValue?: Level; compact?: boolean }) {
  const [value, setValue] = useState<Level>(defaultValue);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-medium text-muted">ระดับมือ</legend>
      <div className={cn("grid gap-1.5", compact ? "grid-cols-7" : "grid-cols-1")}>
        {LEVEL_ORDER.map((l) => (
          <label
            key={l}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
              compact && "justify-center px-0",
              value === l ? "border-brand bg-brand-soft" : "border-line bg-surface-2 hover:border-muted/50",
            )}
          >
            <input type="radio" name={name} value={l} checked={value === l} onChange={() => setValue(l)} className="sr-only" />
            <span className={cn("font-display text-sm font-bold", compact ? "" : "w-8 text-center text-brand")}>{LEVELS[l].code}</span>
            {!compact && (
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{LEVELS[l].name}</span>
                <span className="block text-xs text-muted">{LEVELS[l].description}</span>
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
