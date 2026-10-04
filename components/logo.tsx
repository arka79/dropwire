export function Mark({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Dropwire"
      fill="none"
    >
      <rect width="32" height="32" rx="7" className="fill-brand" />
      <path
        d="M8.5 22.5 C 13 22.5, 13.5 9.5, 23.5 9.5"
        stroke="currentColor"
        className="text-brand-ink"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="8.5" cy="22.5" r="3.1" className="fill-brand-ink" />
      <circle cx="23.5" cy="9.5" r="3.1" className="fill-brand-ink" />
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
        <span className="text-[15px] font-semibold tracking-tight text-ink">
          Dropwire
        </span>
      ) : null}
    </span>
  );
}
