"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Download,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import type { TransferItem, TransferStatus } from "@/types/transfer";
import { formatBytes, formatEta, formatSpeed } from "@/lib/format";
import { Badge, ProgressBar } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const STATUS_META: Record<
  TransferStatus,
  { label: string; tone: "neutral" | "live" | "brand" | "danger" | "signal" }
> = {
  queued: { label: "queued", tone: "neutral" },
  preparing: { label: "preparing", tone: "brand" },
  connecting: { label: "connecting", tone: "brand" },
  sending: { label: "sending", tone: "brand" },
  receiving: { label: "receiving", tone: "brand" },
  paused: { label: "paused", tone: "neutral" },
  complete: { label: "complete", tone: "live" },
  failed: { label: "failed", tone: "danger" },
  cancelled: { label: "cancelled", tone: "neutral" },
  rejected: { label: "declined", tone: "danger" },
  interrupted: { label: "interrupted", tone: "danger" },
};

const ACTIVE: TransferStatus[] = [
  "queued",
  "preparing",
  "connecting",
  "sending",
  "receiving",
  "paused",
];

const TERMINAL: TransferStatus[] = [
  "complete",
  "failed",
  "cancelled",
  "rejected",
  "interrupted",
];

export function isActive(item: TransferItem): boolean {
  return ACTIVE.includes(item.status);
}

export function isTerminal(item: TransferItem): boolean {
  return TERMINAL.includes(item.status);
}

export function TransferRow({
  item,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onDismiss,
}: {
  item: TransferItem;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const [actionBusy, setActionBusy] = useState(false);
  const meta = STATUS_META[item.status];
  const progress = item.size > 0 ? Math.min(100, (item.bytes / item.size) * 100) : 0;
  const running = item.status === "sending" || item.status === "receiving";
  const direction = item.direction;

  const marker =
    item.status === "complete"
      ? "border-live/30 bg-live-soft text-live"
      : isTerminal(item)
        ? "border-danger/30 bg-danger-soft text-danger"
        : "border-line bg-surface-2 text-ink-2";

  const controls: React.ReactNode[] = [];
  if (item.status === "paused") {
    controls.push(
      <Button
        key="resume"
        variant="secondary"
        size="sm"
        onClick={onResume}
        icon={<Play className="size-3.5" aria-hidden />}
      >
        Resume
      </Button>,
    );
  } else if (running || item.status === "preparing" || item.status === "connecting") {
    controls.push(
      <Button
        key="pause"
        variant="secondary"
        size="sm"
        onClick={onPause}
        icon={<Pause className="size-3.5" aria-hidden />}
      >
        Pause
      </Button>,
    );
  } else if (
    direction === "out" &&
    (item.status === "failed" || item.status === "interrupted")
  ) {
    controls.push(
      <Button
        key="retry"
        variant="secondary"
        size="sm"
        loading={actionBusy}
        onClick={() => {
          setActionBusy(true);
          onRetry();
          setTimeout(() => setActionBusy(false), 600);
        }}
        icon={<RotateCcw className="size-3.5" aria-hidden />}
      >
        Retry
      </Button>,
    );
  }

  if (item.status === "complete") {
    if (item.downloadUrl) {
      controls.unshift(
        <a
          key="download"
          href={item.downloadUrl}
          download={item.name}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[3px] border border-line bg-surface px-3 text-[13px] font-medium text-ink transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-line-strong hover:bg-surface-2 active:scale-[0.98]"
        >
          <Download className="size-3.5" aria-hidden />
          Download
        </a>,
      );
    }
  } else if (!isTerminal(item)) {
    controls.push(
      <Button
        key="cancel"
        variant="ghost"
        size="sm"
        onClick={item.status === "queued" ? onDismiss : onCancel}
      >
        {item.status === "queued" ? "Remove" : "Cancel"}
      </Button>,
    );
  }

  if (isTerminal(item)) {
    controls.push(
      <Button
        key="dismiss"
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        aria-label={`Remove ${item.name} from the list`}
        icon={<X className="size-3.5" aria-hidden />}
      />,
    );
  }

  const telemetry = [
    `${formatBytes(item.bytes)} / ${formatBytes(item.size)}`,
    running ? formatSpeed(item.speed) : null,
    running && item.etaSeconds !== null && item.etaSeconds > 0
      ? `${formatEta(item.etaSeconds)} left`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[3px] border ${marker}`}
          aria-hidden
        >
          {item.status === "complete" ? (
            <Check className="size-4" />
          ) : isTerminal(item) ? (
            <AlertTriangle className="size-4" />
          ) : direction === "out" ? (
            <ArrowUpRight className="size-4" />
          ) : (
            <ArrowDownLeft className="size-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="min-w-0 truncate text-sm font-medium text-ink">{item.name}</p>
            <Badge tone={meta.tone} dot={running || item.status === "queued"}>
              {meta.label}
            </Badge>
          </div>

          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="min-w-0 truncate font-mono text-[11px] text-ink-3">
              {direction === "out" ? "to" : "from"} {item.peerName ?? "device"}
              <span className="mx-1.5 text-line-strong">|</span>
              {telemetry}
            </p>
            {running || item.status === "paused" ? (
              <span className="font-mono text-[11px] tabular-nums text-ink-2">
                {Math.round(progress)}%
              </span>
            ) : null}
          </div>

          {running || item.status === "paused" ? (
            <div className="mt-2.5">
              <ProgressBar
                value={progress}
                label={`${item.name} ${Math.round(progress)}% complete`}
                tone={
                  item.status === "paused"
                    ? "neutral"
                    : item.status === "complete"
                      ? "live"
                      : "brand"
                }
              />
            </div>
          ) : null}

          {item.error ? (
            <p className="mt-1.5 text-[12px] leading-relaxed text-danger">{item.error}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {controls}
        </div>
      </div>
    </div>
  );
}
