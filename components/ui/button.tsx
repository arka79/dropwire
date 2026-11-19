import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "quiet"
  | "solid"
  | "onBrand";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-ink border border-brand font-semibold hover:bg-brand-hover hover:border-brand-hover",
  solid:
    "bg-ink text-canvas border border-ink font-semibold hover:bg-ink/85 dark:hover:bg-ink/90",
  secondary:
    "bg-surface text-ink border border-line-strong font-medium hover:bg-surface-2",
  ghost:
    "bg-transparent text-ink-2 border border-transparent font-medium hover:text-ink hover:bg-surface-2",
  danger:
    "bg-danger-soft text-danger border border-danger/35 font-medium hover:bg-danger/15",
  quiet:
    "bg-surface-2 text-ink-2 border border-transparent font-medium hover:text-ink",
  onBrand:
    "bg-transparent text-brand-ink border border-brand-ink/40 font-semibold hover:bg-brand-ink/10 hover:border-brand-ink",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[3px]",
  md: "h-10 px-4 text-sm gap-2 rounded-[3px]",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-[3px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, block, className = "", children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center select-none whitespace-nowrap",
        "transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)]",
        "active:scale-[0.98]",
        "disabled:opacity-45 disabled:pointer-events-none disabled:active:scale-100",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:focus-visible:outline-brand",
        VARIANTS[variant],
        SIZES[size],
        block ? "w-full" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
    </button>
  );
});
