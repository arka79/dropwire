export function ProgressBar({
  value,
  max = 100,
  label,
  tone = "brand",
}: {
  value: number;
  max?: number;
  label: string;
  tone?: "brand" | "live" | "danger" | "neutral";
}) {
  const clamped = Math.max(0, Math.min(max, value));
  const percent = max === 0 ? 0 : (clamped / max) * 100;
  const fill =
    tone === "live"
      ? "bg-live"
      : tone === "danger"
        ? "bg-danger"
        : tone === "neutral"
          ? "bg-ink-3"
          : "bg-brand";

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className="relative h-1.5 w-full overflow-hidden bg-surface-2"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0 9px, var(--line) 9px 10px)",
        }}
      />
      <div
        className={`relative h-full transition-[width] duration-200 ease-[var(--ease-out)] ${fill}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

const TONES: Record<string, string> = {
  neutral: "text-ink-2 bg-surface-2 border-line",
  live: "text-live bg-live-soft border-live/30",
  brand: "text-brand-text bg-brand-soft border-brand/40",
  danger: "text-danger bg-danger-soft border-danger/30",
  signal: "text-signal bg-signal-soft border-signal/30",
};

export function Badge({
  children,
  tone = "neutral",
  dot,
  className = "",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-[2px] border px-1.5 py-0.5",
        "font-mono text-[10px] uppercase tracking-[0.08em]",
        TONES[tone],
        className,
      ].join(" ")}
    >
      {dot ? <span className="size-1.5 bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}
