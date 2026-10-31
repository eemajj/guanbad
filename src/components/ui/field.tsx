import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Field({ label, hint, className, children }: { label: string; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const Input = ({ className, ...p }: ComponentProps<"input">) => <input className={cn("input", className)} {...p} />;
export const Select = ({ className, ...p }: ComponentProps<"select">) => <select className={cn("input", className)} {...p} />;
export const Textarea = ({ className, ...p }: ComponentProps<"textarea">) => (
  <textarea className={cn("input min-h-20", className)} {...p} />
);

export function Checkbox({ label, hint, ...p }: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]" {...p} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}
