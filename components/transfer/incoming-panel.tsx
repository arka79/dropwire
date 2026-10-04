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
          className="overflow-hidden rounded-xl border border-brand/35 bg-brand-soft"
          aria-label="Incoming files"
        >
          <div className="flex items-center justify-between border-b border-brand/20 px-4 py-3 sm:px-5">
            <span className="label flex items-center gap-2 text-brand">
              <ArrowDownLeft className="size-3.5" aria-hidden />
              incoming file
              {offers.length > 1 ? "s" : ""}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
              waiting for your ok
            </span>
          </div>

          <ul className="divide-y divide-brand/15">
            {offers.map((offer) => {
              const remaining = Math.max(
                0,
                offer.offeredAt + INCOMING_OFFER_TTL - now,
              );
              return (
                <li
                  key={offer.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-surface text-brand"
                    aria-hidden
                  >
                    <FileDown className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-medium text-ink">
                        {offer.name}
                      </p>
                      <Badge tone="brand">
                        {formatBytes(offer.size)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-3">
                      from {offer.peerName}
                      {remaining > 0
                        ? ` · expires in ${Math.ceil(remaining / 1000)}s`
                        : " · expiring…"}
                    </p>
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
