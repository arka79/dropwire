"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, FileDown, X } from "lucide-react";
import type { IncomingOffer } from "@/lib/webrtc/transfer";
import { INCOMING_OFFER_TTL } from "@/types/transfer";
import { formatBytes } from "@/lib/format";
import { Badge } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export function IncomingPanel({
  offers,
  onAccept,
  onReject,
}: {
  offers: IncomingOffer[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const now = useNow(offers.length > 0);

  return (
    <AnimatePresence initial={false}>
      {offers.length > 0 ? (
        <motion.section
          key="incoming"
          layout
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-5 overflow-hidden border border-brand/60"
          aria-label="Incoming files"
        >
          <div className="flex items-center justify-between gap-3 bg-brand px-4 py-2 text-brand-ink">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em]">
              <ArrowDownLeft className="size-3.5" aria-hidden />
              incoming {offers.length > 1 ? "files" : "file"}
            </span>
            <span className="font-mono text-[10px]">waiting for your ok</span>
          </div>

          <ul className="divide-y divide-line bg-surface">
            {offers.map((offer) => {
              const remaining = Math.max(0, offer.offeredAt + INCOMING_OFFER_TTL - now);
              const share = Math.max(0, Math.min(1, remaining / INCOMING_OFFER_TTL));
              return (
                <li
                  key={offer.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center border border-line-strong bg-surface-2 text-ink"
                    aria-hidden
                  >
                    <FileDown className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-medium text-ink">
                        {offer.name}
                      </p>
                      <Badge tone="brand">{formatBytes(offer.size)}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-ink-3">
                      from {offer.peerName}
                      <span className="mx-1.5 text-line-strong">|</span>
                      {remaining > 0
                        ? `expires in ${Math.ceil(remaining / 1000)}s`
                        : "expiring…"}
                    </p>
                    <div className="mt-2 h-1 w-full bg-surface-2" aria-hidden>
                      <div
                        className="h-1 bg-brand transition-[width] duration-500 ease-linear"
                        style={{ width: `${share * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReject(offer.id)}
                      icon={<X className="size-3.5" aria-hidden />}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={busy === offer.id}
                      onClick={() => {
                        setBusy(offer.id);
                        onAccept(offer.id);
                        setTimeout(() => setBusy(null), 800);
                      }}
                    >
                      Accept
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
