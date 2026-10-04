"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, QrCode } from "lucide-react";
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
          <Check className="size-3.5 text-live" aria-hidden />
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
  variant,
  waiting,
  onShowQr,
  peerCount,
}: {
  roomId: string;
  variant: "hero" | "compact";
  waiting: boolean;
  onShowQr: () => void;
  peerCount: number;
}) {
  const link = roomUrl(roomId);

  if (variant === "compact") {
    return (
      <div className="panel p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="label">invite</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            {peerCount} other {peerCount === 1 ? "device" : "devices"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton value={link}>Copy link</CopyButton>
          <Button
            variant="secondary"
            size="sm"
            onClick={onShowQr}
            icon={<QrCode className="size-3.5" aria-hidden />}
          >
            Show QR
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section
      className="panel overflow-hidden"
      aria-label="Share this room"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <span className="label">your room</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
          <Link2 className="size-3" aria-hidden />
          invite only
        </span>
      </div>

      <div className="px-5 py-6 sm:px-6">
        <p className="label">room code</p>
        <p
          className="mt-2 font-mono text-[clamp(1.75rem,6vw,2.5rem)] font-medium tracking-[0.12em] text-ink select-all"
          aria-label={`Room code ${roomId.split("").join(" ")}`}
        >
          {roomId}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
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
            Show QR
          </Button>
        </div>

        <div className="mt-5 flex items-center gap-2.5 border-t border-line pt-4">
          <span
            className={`size-2 rounded-full bg-brand ${waiting ? "animate-pulse-dot" : "bg-live"}`}
            aria-hidden
          />
          <p className="text-sm text-ink-2" aria-live="polite">
            {waiting
              ? "Waiting for someone to join…"
              : "Share the link to add more devices."}
          </p>
        </div>
      </div>
    </section>
  );
}
