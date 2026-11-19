export function Mark({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Dropwire"
      fill="none"
    >
      <rect width="32" height="32" rx="4" className="fill-brand" />
      <rect x="6" y="10" width="7" height="12" rx="1" className="fill-brand-ink" />
      <rect x="19" y="10" width="7" height="12" rx="1" className="fill-brand-ink" />
      <path
        d="M13 16h6"
        className="stroke-brand-ink"
        strokeWidth="2"
        strokeDasharray="2 2.4"
        strokeLinecap="round"
      />
      <rect x="14.5" y="13.5" width="3" height="5" rx="0.5" className="fill-brand-ink" />
    </svg>
  );
}

export function Logo({
  withWordmark = true,
  className = "",
}: {
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark className="size-6 shrink-0" />
      {withWordmark ? (
        <span className="text-[15px] font-bold tracking-[-0.03em] text-ink">
          Dropwire
        </span>
      ) : null}
    </span>
  );
}
