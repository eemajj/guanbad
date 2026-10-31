"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { useCloseDialog } from "@/components/dialog";

function useResult() {
  const router = useRouter();
  return (r: ActionResult | undefined, onSuccess?: () => void) => {
    if (!r) return;
    if (r.ok) {
      if (r.message) toast.success(r.message);
      onSuccess?.();
      if (r.redirect) router.push(r.redirect);
    } else {
      toast.error(r.error);
    }
  };
}

/** A form that posts to a server action and shows the result as a toast. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  closeDialog,
}: {
  action: (form: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  /** Close the surrounding <Dialog> after success */
  closeDialog?: boolean;
}) {
  const handle = useResult();
  const close = useCloseDialog();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className}
      action={async (fd) => {
        const r = await action(fd);
        handle(r, () => {
          if (resetOnSuccess) ref.current?.reset();
          if (closeDialog) close();
        });
      }}
    >
      {children}
    </form>
  );
}

export function SubmitButton({ children, variant = "primary", size, className, pendingText }: { children: ReactNode; variant?: ButtonVariant; size?: ButtonSize; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending} aria-busy={pending}>
      {pending ? (pendingText ?? "กำลังบันทึก…") : children}
    </Button>
  );
}

/**
 * A button that runs a server action. With `confirm`, the first click asks
 * for a second click (the page can't use window.confirm on phones reliably).
 */
export function ActionButton({
  action,
  children,
  confirm,
  variant,
  size,
  className,
  closeDialog,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  confirm?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  closeDialog?: boolean;
}) {
  const handle = useResult();
  const close = useCloseDialog();
  const [pending, start] = useTransition();
  const [arming, setArming] = useState(false);
  const fire = () =>
    start(async () => {
      handle(await action(), closeDialog ? close : undefined);
      setArming(false);
    });
  if (confirm && arming) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Button variant="danger" size={size} disabled={pending} onClick={fire}>
          {pending ? "กำลังทำ…" : confirm}
        </Button>
        <Button variant="ghost" size={size} onClick={() => setArming(false)}>
          ไม่ใช่
        </Button>
      </span>
    );
  }
  return (
    <Button variant={variant} size={size} className={className} disabled={pending} onClick={() => (confirm ? setArming(true) : fire())}>
      {pending ? "กำลังทำ…" : children}
    </Button>
  );
}
