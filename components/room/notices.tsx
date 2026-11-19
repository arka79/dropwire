"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Info, X } from "lucide-react";
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

  const edge =
    notice.kind === "error"
      ? "border-l-danger"
      : notice.kind === "success"
        ? "border-l-live"
        : "border-l-line-strong";

  const Icon =
    notice.kind === "error" ? AlertTriangle : notice.kind === "success" ? Check : Info;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      className={[
        "pointer-events-auto flex items-start gap-3 rounded-[3px] border border-l-2 border-line bg-surface px-3.5 py-3",
        "shadow-[0_18px_44px_-28px_rgba(0,0,0,0.55)]",
        edge,
      ].join(" ")}
      role={notice.kind === "error" ? "alert" : "status"}
    >
      <Icon
        className={[
          "mt-0.5 size-3.5 shrink-0",
          notice.kind === "error"
            ? "text-danger"
            : notice.kind === "success"
              ? "text-live"
              : "text-ink-2",
        ].join(" ")}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">{notice.title}</p>
        {notice.body ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">{notice.body}</p>
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
      className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:items-end"
      aria-live="polite"
    >
      <ul className="flex w-full flex-col gap-2 sm:w-[21rem]">
        <AnimatePresence initial={false}>
          {notices.slice(-3).map((notice) => (
            <NoticeCard key={notice.id} notice={notice} onDismiss={onDismiss} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
