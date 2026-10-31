"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import { Button, type ButtonSize, type ButtonVariant } from "@/ui/button";
import { useCloseDialog } from "@/ui/dialog";

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

const PendingContext = createContext(false);

/**
 * A form that posts to a server action and shows the result as a toast.
 *
 * Submission is handled with onSubmit (not the `action` prop) on purpose: React resets a form
 * automatically when an `action` transition ends, which can wipe text the user already typed
 * for the next entry. Here fields are only cleared when `resetOnSuccess` is set.
 */
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
  const [pending, start] = useTransition();
  return (
    <form
      className={className}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const form = e.currentTarget;
        const data = new FormData(form);
        start(async () => {
          const r = await action(data);
          handle(r, () => {
            if (resetOnSuccess) form.reset();
            if (closeDialog) close();
          });
        });
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size,
  className,
  pendingText,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  pendingText?: string;
}) {
  const pending = useContext(PendingContext);
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
  optimistic,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  confirm?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  closeDialog?: boolean;
  /** Shown as soon as the button is pressed, e.g. "✓ ได้รับแล้ว". Reverts if the server refuses. */
  optimistic?: ReactNode;
}) {
  const handle = useResult();
  const close = useCloseDialog();
  const [pending, start] = useTransition();
  const busy = optimistic ?? "กำลังทำ…";
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
          {pending ? busy : confirm}
        </Button>
        <Button variant="ghost" size={size} onClick={() => setArming(false)}>
          ไม่ใช่
        </Button>
      </span>
    );
  }
  return (
    <Button
      variant={pending && optimistic ? "secondary" : variant}
      size={size}
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={() => (confirm ? setArming(true) : fire())}
    >
      {pending ? busy : children}
    </Button>
  );
}
