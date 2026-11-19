import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={[
          "h-10 w-full rounded-[3px] border border-line bg-surface px-3 text-sm text-ink",
          "placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150",
          "hover:border-line-strong focus:border-brand focus:outline-none",
          "focus:shadow-[0_0_0_3px_var(--brand-soft)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        ].join(" ")}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={[
        "w-full rounded-[3px] border border-line bg-surface px-3 py-2 text-sm text-ink",
        "placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150",
        "hover:border-line-strong focus:border-brand focus:outline-none",
        "focus:shadow-[0_0_0_3px_var(--brand-soft)]",
        className,
      ].join(" ")}
      {...rest}
    />
  );
});

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="label text-ink-2">
        {children}
      </label>
      {hint ? <span className="text-[11px] text-ink-3">{hint}</span> : null}
    </div>
  );
}
