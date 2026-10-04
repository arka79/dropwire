"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ListX, PauseCircle, PlayCircle } from "lucide-react";
import type { TransferItem } from "@/types/transfer";
import { Button } from "@/components/ui/button";
import { TransferRow, isActive, isTerminal } from "./transfer-row";

export function TransferQueue({
  items,
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="label">transfers</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            {items.length} {items.length === 1 ? "file" : "files"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {hasPaused ? (
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
          {hasFinished ? (
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
              transition={{ duration: 0.18 }}
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
