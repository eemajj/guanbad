import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Data table used on every list screen. Columns that are not essential on a phone
 * take `hide="sm"` (shown from 640px) or `hide="md"` (from 768px); put the same
 * information in a small line under the name so nothing is lost on mobile.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          "w-full text-sm",
          "[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4",
          "sm:[&_td:first-child]:pl-5 sm:[&_td:last-child]:pr-5 sm:[&_th:first-child]:pl-5 sm:[&_th:last-child]:pr-5",
          className,
        )}
      >
        {children}
      </table>
    </div>
  );
}

export const THead = ({ children }: { children: ReactNode }) => (
  <thead className="text-left text-xs text-muted">
    <tr className="border-b border-line">{children}</tr>
  </thead>
);

export const TBody = ({ children }: { children: ReactNode }) => <tbody className="divide-y divide-line">{children}</tbody>;

type CellProps = { children?: ReactNode; className?: string; align?: "right"; hide?: "sm" | "md"; title?: string };

const cellClass = ({ align, hide, className }: CellProps) =>
  cn(
    "px-2",
    align === "right" && "text-right",
    hide === "sm" && "hidden sm:table-cell",
    hide === "md" && "hidden md:table-cell",
    className,
  );

export const Th = (p: CellProps) => (
  <th title={p.title} className={cn("py-2 font-semibold", cellClass(p))}>
    {p.children}
  </th>
);

/** `num` renders figures in the tabular display face so columns line up. */
export const Td = (p: CellProps & { num?: boolean }) => <td className={cn("py-2.5", p.num && "num", cellClass(p))}>{p.children}</td>;
