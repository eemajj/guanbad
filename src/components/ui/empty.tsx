import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="mb-2 grid h-12 w-20 place-items-center rounded border-2 border-court-line bg-court/80">
        <div className="h-full w-0 border-l-2 border-dashed border-court-line" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
