"use client";

import { useEffect, useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/copy";
import { roomUrl } from "@/lib/room/room-utils";

function CopyButton({
  value,
  children,
  variant = "secondary",
  size = "sm",
  className = "",
}: {
  value: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "quiet";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant={copied ? "quiet" : variant}
      size={size}
      className={className}
      icon={
        copied ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )
      }
      onClick={async () => {
        const ok = await copyText(value);
        if (ok) setCopied(true);
      }}
    >
      {copied ? "Copied" : children}
    </Button>
  );
}

export function SharePanel({
  roomId,
  waiting,
  onShowQr,
  peerCount,
}: {
  roomId: string;
  waiting: boolean;
  onShowQr: () => void;
  peerCount: number;
}) {
  const link = roomUrl(roomId);

  return (
    <div className="relative">
      {/* Two stubs behind the ticket: a stack of invites, not a floating card. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-2 bottom-[-6px] top-2 border border-line bg-surface-2/70"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-1 bottom-[-3px] top-1 border border-line bg-surface"
      />

      <section className="relative border border-line bg-surface" aria-label="Share this room">
      <div className="flex items-center justify-between gap-3 bg-brand px-4 py-2 text-brand-ink">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em]">
          room ticket
        </span>
        <span className="font-mono text-[10px]">
          {peerCount + 1} of {peerCount + 1 === 1 ? "?" : peerCount + 1} devices
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label">code</p>
            <p
              className="mt-2 font-mono text-[clamp(1.65rem,5.4vw,2.2rem)] leading-none tracking-[0.1em] text-ink select-all"
              aria-label={`Room code ${roomId.split("").join(" ")}`}
            >
              {roomId}
            </p>
          </div>
          <span
            className={`mt-1 flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
              waiting ? "text-brand-text" : "text-live"
            }`}
          >
            <span
              className={`size-1.5 ${waiting ? "bg-brand-text animate-blink" : "bg-live"}`}
              aria-hidden
            />
            {waiting ? "waiting" : "open"}
          </span>
        </div>

        <div className="mt-4 border-t border-dashed border-line-strong" aria-hidden />

        <div className="mt-4 flex flex-wrap gap-2">
          <CopyButton value={link} variant="primary" size="md">
            Copy link
          </CopyButton>
          <CopyButton value={roomId} variant="secondary" size="md">
            Copy code
          </CopyButton>
          <Button
            variant="secondary"
            size="md"
            onClick={onShowQr}
            icon={<QrCode className="size-4" aria-hidden />}
          >
            QR
          </Button>
        </div>

        <p className="mt-4 font-mono text-[10px] leading-relaxed text-ink-3">
          {waiting
            ? "Waiting for someone to join…"
            : "Share the link to add another device to the room."}
        </p>
      </div>
      </section>
    </div>
  );
}
