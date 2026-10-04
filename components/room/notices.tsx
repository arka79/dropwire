"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Info, X } from "lucide-react";
import type { Notice } from "@/lib/room/session";

function NoticeCard({
  notice,
  onDismiss,
}: {
  notice: Notice;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notice.id), 6000);
    return () => clearTimeout(timer);
  }, [notice.id, notice.at, onDismiss]);

  const tone =
    notice.kind === "error"
      ? "border-danger/35 bg-danger-soft"
      : notice.kind === "success"
        ? "border-live/35 bg-live-soft"
        : "border-line bg-surface";

  const Icon =
    notice.kind === "error"
      ? AlertTriangle
      : notice.kind === "success"
        ? Info
        : Info;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className={[
        "pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.5)]",
        tone,
      ].join(" ")}
      role={notice.kind === "error" ? "alert" : "status"}
    >
      <Icon
        className={[
          "mt-0.5 size-4 shrink-0",
          notice.kind === "error"
            ? "text-danger"
            : notice.kind === "success"
              ? "text-live"
              : "text-ink-2",
        ].join(" ")}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{notice.title}</p>
        {notice.body ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">
            {notice.body}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(notice.id)}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </motion.li>
  );
}

export function Notices({
  notices,
  onDismiss,
}: {
  notices: Notice[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:items-end sm:gap-2.5"
      aria-live="polite"
    >
      <ul className="flex w-full flex-col gap-2 sm:w-80">
        <AnimatePresence initial={false}>
          {notices.slice(-3).map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              onDismiss={onDismiss}
            />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
