"use client";

import { useState } from "react";
import type { ActionResult } from "@/lib/action";
import { ActionForm, SubmitButton } from "@/components/action";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function FinishMatchForm({ action, teamA, teamB }: { action: (f: FormData) => Promise<ActionResult>; teamA: string; teamB: string }) {
  const [winner, setWinner] = useState<"" | "A" | "B">("");
  const [shuttles, setShuttles] = useState(1);
  return (
    <ActionForm action={action} closeDialog className="flex flex-col gap-5">
      <input type="hidden" name="winner" value={winner} />
      <input type="hidden" name="shuttles" value={shuttles} />
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-muted">ทีมไหนชนะ (ไม่ใส่ก็ได้)</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["A", teamA], ["B", teamB]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={winner === k}
              onClick={() => setWinner(winner === k ? "" : k)}
              className={cn("rounded-xl border px-3 py-4 font-display font-semibold", winner === k ? "border-ok bg-ok-soft text-ok" : "border-line bg-surface-2")}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium text-muted">ใช้ลูกไปกี่ลูก</div>
          <div className="text-xs text-muted">ค่าลูกหาร 4 คนในเกมนี้</div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="lg" className="w-12 px-0 text-xl" onClick={() => setShuttles(Math.max(0, shuttles - 1))} aria-label="ลดจำนวนลูก">−</Button>
          <output className="num w-8 text-center text-2xl font-bold" aria-live="polite">{shuttles}</output>
          <Button size="lg" className="w-12 px-0 text-xl" onClick={() => setShuttles(Math.min(30, shuttles + 1))} aria-label="เพิ่มจำนวนลูก">+</Button>
        </div>
      </div>
      <SubmitButton size="lg">บันทึกผล แล้วจัดคู่ถัดไป</SubmitButton>
    </ActionForm>
  );
}
