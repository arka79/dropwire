"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ListX, PauseCircle, PlayCircle } from "lucide-react";
import type { TransferItem } from "@/types/transfer";
import { Button } from "@/components/ui/button";
import { TransferRow, isActive, isTerminal } from "./transfer-row";

export function TransferQueue({
  items,
  heading = "transfers",
  showBulk = true,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onDismiss,
  onPauseAll,
  onResumeAll,
  onClearFinished,
}: {
  items: TransferItem[];
  heading?: string;
  showBulk?: boolean;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
  onPauseAll: () => void;
  onResumeAll: () => void;
  onClearFinished: () => void;
}) {
  if (items.length === 0) return null;

  const hasActive = items.some(isActive);
  const hasPaused = items.some((item) => item.status === "paused");
  const hasFinished = items.some(isTerminal);

  return (
    <section className="panel overflow-hidden" aria-label="Transfers">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-5">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-2">
            {heading}
          </span>
          <span className="font-mono text-[10px] text-ink-3">
            {items.length} {items.length === 1 ? "file" : "files"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {!showBulk ? null : hasPaused ? (
            <Button
              variant="quiet"
              size="sm"
              onClick={onResumeAll}
              icon={<PlayCircle className="size-3.5" aria-hidden />}
            >
              Resume all
            </Button>
          ) : hasActive ? (
            <Button
              variant="quiet"
              size="sm"
              onClick={onPauseAll}
              icon={<PauseCircle className="size-3.5" aria-hidden />}
            >
              Pause all
            </Button>
          ) : null}
          {showBulk && hasFinished ? (
            <Button
              variant="quiet"
              size="sm"
              onClick={onClearFinished}
              icon={<ListX className="size-3.5" aria-hidden />}
            >
              Clear finished
            </Button>
          ) : null}
        </div>
      </div>

      <ul className="divide-y divide-line">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="[&>div]:border-0"
            >
              <TransferRow
                item={item}
                onPause={() => onPause(item.id)}
                onResume={() => onResume(item.id)}
                onCancel={() => onCancel(item.id)}
                onRetry={() => onRetry(item.id)}
                onDismiss={() => onDismiss(item.id)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
