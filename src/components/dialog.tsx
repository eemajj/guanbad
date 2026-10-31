"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

const Ctx = createContext<() => void>(() => {});
/** Close the surrounding dialog (e.g. after a successful action). */
export const useCloseDialog = () => useContext(Ctx);

/** Bottom sheet on phones, centred dialog on larger screens. Built on the native <dialog>. */
export function Dialog({
  trigger,
  title,
  description,
  children,
  variant = "secondary",
  size = "md",
  triggerClassName,
}: {
  trigger: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <>
      <Button variant={variant} size={size} className={triggerClassName} onClick={() => ref.current?.showModal()}>
        {trigger}
      </Button>
      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && close()}
        className="m-0 mt-auto w-full max-w-none rounded-t-2xl bg-surface p-0 text-ink shadow-2xl sm:m-auto sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex max-h-[88vh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={close} aria-label="ปิด">
              ปิด
            </Button>
          </div>
          <div className="overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Ctx.Provider value={close}>{children}</Ctx.Provider>
          </div>
        </div>
      </dialog>
    </>
  );
}
