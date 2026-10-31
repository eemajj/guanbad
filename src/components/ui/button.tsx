import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink border-brand hover:bg-brand-deep",
  secondary: "bg-surface text-ink border-line hover:border-muted/60",
  ghost: "bg-transparent text-muted border-transparent hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger-soft text-danger border-transparent hover:bg-danger hover:text-white",
  accent: "bg-accent text-accent-ink border-accent hover:brightness-95",
};
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] rounded-md",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-12 px-5 text-[15px] rounded-xl",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 border font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

type Props = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className, type = "button", ...rest }: Props) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

export function LinkButton({ variant, size, className, ...rest }: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
