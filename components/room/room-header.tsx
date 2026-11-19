"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, LogOut, Settings } from "lucide-react";
import type { LinkPhase, RouteKind } from "@/types/peer";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/copy";
import { formatCountdown } from "@/lib/format";
import { useNow } from "@/hooks/use-now";
import { ConnectionPill } from "./connection-status";

export function RoomHeader({
  roomId,
  link,
  route,
  signal,
  expiresAt,
  onOpenSettings,
  onLeave,
}: {
  roomId: string;
  link: LinkPhase;
  route: RouteKind;
  signal: "connecting" | "online" | "offline";
  expiresAt: number | null;
  onOpenSettings: () => void;
  onLeave: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const now = useNow(15_000, expiresAt !== null);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          aria-label="Dropwire home"
        >
          <Logo />
        </Link>

        <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />

        <div className="flex min-w-0 items-center">
          <span className="truncate bg-brand px-2 py-1 font-mono text-[12px] tracking-[0.1em] text-brand-ink select-all sm:text-[13px]">
            {roomId}
          </span>
          <button
            type="button"
            className="border border-l-0 border-line bg-surface p-1.5 text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            aria-label={copied ? "Room code copied" : "Copy room code"}
            onClick={async () => {
              if (await copyText(roomId)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }
            }}
          >
            {copied ? (
              <Check className="size-3.5 text-live" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
          </button>
        </div>

        <ConnectionPill link={link} route={route} />

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {expiresAt ? (
            <span className="hidden font-mono text-[10px] text-ink-3 md:inline">
              expires in {formatCountdown(expiresAt - now)}
            </span>
          ) : null}
          <span
            className={`hidden h-1.5 w-1.5 md:block ${
              signal === "online"
                ? "bg-live"
                : signal === "connecting"
                  ? "bg-brand-text animate-blink"
                  : "bg-danger"
            }`}
            title={`Signaling ${signal}`}
            aria-label={`Signaling ${signal}`}
          />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            aria-label="Room settings"
            icon={<Settings className="size-4" aria-hidden />}
          />
          <span className="hidden sm:inline-flex">
            <Button
              variant="secondary"
              size="sm"
              onClick={onLeave}
              icon={<LogOut className="size-3.5" aria-hidden />}
            >
              Leave
            </Button>
          </span>
        </div>
      </div>

      {signal === "offline" ? (
        <div className="border-t border-brand/40 bg-brand-soft px-4 py-1.5 text-center sm:px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-brand-text">
            reconnecting to the signaling server…
          </p>
        </div>
      ) : null}
    </header>
  );
}
