export default function Loading() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <span className="sr-only">กำลังโหลด</span>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-line/60" />
      <div className="h-28 animate-pulse rounded-xl bg-line/40" />
      <div className="h-64 animate-pulse rounded-xl bg-line/40" />
    </div>
  );
}
