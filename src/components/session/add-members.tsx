"use client";

import { useMemo, useState } from "react";
import type { Level } from "@prisma/client";
import type { ActionResult } from "@/lib/action";
import { ActionForm, SubmitButton } from "@/components/action";
import { LevelBadge } from "@/components/level";
import { Input } from "@/components/ui/field";

/** Searchable checklist of registered members who are not in the session yet. */
export function AddMembersForm({
  action,
  members,
}: {
  action: (f: FormData) => Promise<ActionResult>;
  members: { id: string; nickname: string; level: Level }[];
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const shown = useMemo(() => members.filter((m) => m.nickname.toLowerCase().includes(q.trim().toLowerCase())), [members, q]);
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (!members.length) return <p className="text-sm text-muted">ทุกคนในทะเบียนอยู่ในรอบนี้แล้ว ใช้ “คนใหม่” เพื่อเพิ่มคนที่ยังไม่เคยมา</p>;

  return (
    <ActionForm action={action} closeDialog className="flex flex-col gap-3">
      <Input placeholder="ค้นหาชื่อ" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาชื่อ" />
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">เลือกแล้ว {picked.size} คน</span>
        <button type="button" className="font-medium text-brand" onClick={() => setPicked(new Set(shown.map((m) => m.id)))}>
          เลือกทั้งหมดที่แสดง
        </button>
      </div>
      <ul className="max-h-[45vh] divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {shown.map((m) => (
          <li key={m.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
              <input
                type="checkbox"
                name="memberId"
                value={m.id}
                checked={picked.has(m.id)}
                onChange={() => toggle(m.id)}
                className="h-4 w-4 accent-[rgb(var(--brand))]"
              />
              <span className="flex-1 font-medium">{m.nickname}</span>
              <LevelBadge level={m.level} />
            </label>
          </li>
        ))}
        {!shown.length && <li className="px-3 py-4 text-sm text-muted">ไม่พบชื่อนี้</li>}
      </ul>
      <SubmitButton>เพิ่ม {picked.size || ""} คนเข้ารอบ</SubmitButton>
    </ActionForm>
  );
}
