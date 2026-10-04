"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck, X } from "lucide-react";
import type { TransferItem } from "@/types/transfer";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function CompletionBanner({
  items,
  onDismiss,
}: {
  items: TransferItem[];
  onDismiss: () => void;
}) {
  const finished = items.filter(
    (item) => item.status === "complete" && item.updatedAt > 0,
  );
  if (finished.length === 0) return null;

  const sent = finished.filter((item) => item.direction === "out");
  const received = finished.filter((item) => item.direction === "in");
  const parts: string[] = [];
  if (sent.length > 0) {
    const bytes = sent.reduce((total, item) => total + item.size, 0);
    parts.push(
      `${sent.length} ${sent.length === 1 ? "file" : "files"} sent (${formatBytes(bytes)})`,
    );
  }
  if (received.length > 0) {
    const bytes = received.reduce((total, item) => total + item.size, 0);
    parts.push(
      `${received.length} ${received.length === 1 ? "file" : "files"} received (${formatBytes(bytes)})`,
    );
  }

  const awaitingDownload = received.some((item) => item.downloadUrl !== null);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="flex items-center justify-between gap-3 rounded-xl border border-live/35 bg-live-soft px-4 py-3 sm:px-5"
        role="status"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full border border-live/35 bg-surface text-live">
            <CheckCheck className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">{parts.join(" · ")}</p>
            <p className="text-[12px] text-ink-2">
              {awaitingDownload
                ? "Your received files are still listed below — use Download to save them."
                : "All bytes accounted for."}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          aria-label="Hide transfer summary"
          icon={<X className="size-3.5" aria-hidden />}
        />
      </motion.div>
    </AnimatePresence>
  );
}
