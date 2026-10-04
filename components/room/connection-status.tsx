import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import type { LinkPhase, RouteKind } from "@/types/peer";
import { Button } from "@/components/ui/button";

export const LINK_META: Record<
  LinkPhase,
  { label: string; dot: string; text: string; pulse?: boolean }
> = {
  offline: { label: "offline", dot: "bg-ink-3", text: "text-ink-3" },
  searching: {
    label: "waiting",
    dot: "bg-brand",
    text: "text-brand",
    pulse: true,
  },
  connecting: {
    label: "connecting",
    dot: "bg-brand",
    text: "text-brand",
    pulse: true,
  },
  connected: { label: "connected", dot: "bg-live", text: "text-live" },
  transferring: {
    label: "transferring",
    dot: "bg-live",
    text: "text-live",
    pulse: true,
  },
  reconnecting: {
    label: "reconnecting",
    dot: "bg-brand",
    text: "text-brand",
    pulse: true,
  },
  disconnected: { label: "disconnected", dot: "bg-danger", text: "text-danger" },
};

export function routeLabel(route: RouteKind): string {
  if (route === "relay") return "relayed";
  if (route === "direct") return "direct";
  return "link";
}

export function ConnectionPill({
  link,
  route,
  compact = false,
}: {
  link: LinkPhase;
  route: RouteKind;
  compact?: boolean;
}) {
  const meta = LINK_META[link];
  const showRoute = link === "connected" || link === "transferring";
  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1",
        compact ? "" : "sm:px-3",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <span
        className={`size-2 rounded-full ${meta.dot} ${meta.pulse ? "animate-pulse-dot" : ""}`}
        aria-hidden
      />
      <span
        className={`font-mono text-[10px] uppercase tracking-[0.16em] ${meta.text}`}
      >
        {meta.label}
      </span>
      {showRoute ? (
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3 sm:inline">
          · {routeLabel(route)}
        </span>
      ) : null}
    </div>
  );
}

export function ConnectionBanner({
  link,
  peerName,
  onRetry,
}: {
  link: LinkPhase;
  peerName?: string;
  onRetry: () => void;
}) {
  if (link !== "reconnecting" && link !== "disconnected") return null;
  const failed = link === "disconnected";
  return (
    <div
      role="alert"
      className={[
        "animate-rise flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
        failed
          ? "border-danger/35 bg-danger-soft"
          : "border-brand/35 bg-brand-soft",
      ].join(" ")}
    >
      <div className="flex gap-3">
        {failed ? (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        ) : (
          <WifiOff className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        )}
        <div>
          <p className="text-sm font-medium text-ink">
            {failed
              ? "We couldn't keep a direct connection."
              : "Connection interrupted — trying to reconnect…"}
          </p>
          <p className="mt-0.5 text-sm text-ink-2">
            {failed
              ? `${peerName ?? "The other device"} and this browser can retry — transfers that were in flight are marked as interrupted.`
              : "Transfers resume automatically when the link comes back."}
          </p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRetry}
        icon={<RefreshCw className="size-3.5" aria-hidden />}
        className="shrink-0 self-start sm:self-auto"
      >
        Try again
      </Button>
    </div>
  );
}
