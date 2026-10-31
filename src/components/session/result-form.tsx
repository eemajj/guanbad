"use client";

import { useState } from "react";
import type { ActionResult } from "@/lib/action";
import { normalizeResult, type Side } from "@/domain/results";
import { ActionForm, SubmitButton } from "@/components/action";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Initial = { winner: Side | null; scoreA: number | null; scoreB: number | null; shuttles: number };

/**
 * ใช้ทั้งตอน "จบเกม" และ "แก้ผล" ทีหลัง
 * ทุกช่องไม่บังคับ: ใส่แต้ม → ระบบรู้เองว่าใครชนะ, ไม่มีแต้ม → แตะทีมที่ชนะ, ไม่รู้เลย → บันทึกได้ (ไม่นับชนะ/แพ้)
 */
export function ResultForm({
  action,
  teamA,
  teamB,
  initial = { winner: null, scoreA: null, scoreB: null, shuttles: 1 },
  submitLabel,
  shuttlesLocked,
}: {
  action: (f: FormData) => Promise<ActionResult>;
  teamA: string;
  teamB: string;
  initial?: Initial;
  submitLabel: string;
  shuttlesLocked?: boolean;
}) {
  const [picked, setPicked] = useState<Side | null>(initial.winner);
  const [a, setA] = useState(initial.scoreA?.toString() ?? "");
  const [b, setB] = useState(initial.scoreB?.toString() ?? "");
  const [shuttles, setShuttles] = useState(initial.shuttles);

  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const hasScore = a.trim() !== "" || b.trim() !== "";
  const check = normalizeResult({ winner: hasScore ? null : picked, scoreA: num(a), scoreB: num(b) });
  const winner = check.ok ? check.value.winner : null;
  const contradicts = hasScore && check.ok && picked && picked !== winner;
  const status = !check.ok ? check.error : winner ? (hasScore ? "ระบบคิดผู้ชนะจากแต้มให้แล้ว" : "บันทึกแค่ผู้ชนะ (ไม่มีแต้ม)") : "ยังไม่มีผล เกมนี้จะไม่นับชนะ/แพ้ แก้ทีหลังได้";

  return (
    <ActionForm action={action} closeDialog className="flex flex-col gap-5">
      <input type="hidden" name="winner" value={hasScore ? "" : (picked ?? "")} />
      <input type="hidden" name="shuttles" value={shuttles} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-medium text-muted">ผลการแข่ง (ไม่บังคับ)</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["A", teamA, a, setA], ["B", teamB, b, setB]] as const).map(([side, label, value, set]) => (
            <div key={side} className={cn("flex flex-col gap-2 rounded-xl border p-2.5", winner === side ? "border-ok bg-ok-soft" : "border-line bg-surface-2")}>
              <button
                type="button"
                aria-pressed={winner === side}
                disabled={hasScore}
                onClick={() => setPicked(picked === side ? null : side)}
                className={cn("min-h-12 rounded-lg px-2 font-display font-semibold disabled:cursor-default", winner === side ? "text-ok" : "text-ink")}
              >
                {label}
                {winner === side && <span className="block text-xs">ชนะ</span>}
              </button>
              <input
                name={side === "A" ? "scoreA" : "scoreB"}
                value={value}
                onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 2))}
                inputMode="numeric"
                placeholder="แต้ม"
                aria-label={`แต้มของ ${label}`}
                className="input num text-center text-xl"
              />
            </div>
          ))}
        </div>
        <p className={cn("text-xs", check.ok && !contradicts ? "text-muted" : "text-danger")} aria-live="polite">
          {contradicts ? "แต้มขัดกับทีมที่แตะไว้ ระบบจะใช้ผลตามแต้ม" : status}
        </p>
        {hasScore && (
          <button type="button" className="self-start text-xs font-medium text-brand" onClick={() => { setA(""); setB(""); }}>
            ล้างแต้ม
          </button>
        )}
      </fieldset>

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium text-muted">ใช้ลูกไปกี่ลูก</div>
          <div className="text-xs text-muted">{shuttlesLocked ? "ออกบิลแล้ว แก้จำนวนลูกไม่ได้" : "ค่าลูกหาร 4 คนในเกมนี้"}</div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="lg" className="w-12 px-0 text-xl" disabled={shuttlesLocked} onClick={() => setShuttles(Math.max(0, shuttles - 1))} aria-label="ลดจำนวนลูก">−</Button>
          <output className="num w-8 text-center text-2xl font-bold" aria-live="polite">{shuttles}</output>
          <Button size="lg" className="w-12 px-0 text-xl" disabled={shuttlesLocked} onClick={() => setShuttles(Math.min(30, shuttles + 1))} aria-label="เพิ่มจำนวนลูก">+</Button>
        </div>
      </div>

      <SubmitButton size="lg">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
