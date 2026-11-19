"use client";

import { QRCodeSVG } from "qrcode.react";
import { Copy, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/copy";
import { roomUrl } from "@/lib/room/room-utils";

export function QrModal({
  open,
  onOpenChange,
  roomId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
}) {
  const link = roomUrl(roomId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent open={open} className="max-w-sm text-center">
        <DialogHeader
          eyebrow="scan to join"
          title="Open this room on another device"
          description="Point a phone camera at the code — the other browser joins the same room."
        />

        <div className="mx-auto w-fit rounded-[3px] border border-line bg-white p-4 text-neutral-900">
          <QRCodeSVG
            value={link}
            size={208}
            level="M"
            marginSize={0}
            bgColor="#ffffff"
            fgColor="#111318"
            title={`QR code for room ${roomId}`}
          />
        </div>

        <div className="mt-5 space-y-1">
          <p className="label">room</p>
          <p className="font-mono text-2xl font-medium tracking-[0.14em] text-ink">
            {roomId}
          </p>
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-2">
          <Smartphone className="size-4 text-ink-3" aria-hidden />
          Scan with another device
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="primary"
            block
            icon={<Copy className="size-4" aria-hidden />}
            onClick={() => void copyText(link)}
          >
            Copy link
          </Button>
          <p className="truncate font-mono text-[11px] text-ink-3" title={link}>
            {link}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
