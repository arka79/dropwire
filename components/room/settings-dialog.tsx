"use client";

import { useEffect, useState } from "react";
import { LogOut, Monitor, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { loadIdentity, subscribeIdentity } from "@/lib/identity";

export function SettingsDialog({
  open,
  onOpenChange,
  onSaveName,
  onLeave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveName: (name: string) => void;
  onLeave: () => void;
}) {
  const [name, setName] = useState(() => loadIdentity().name);

  useEffect(() => subscribeIdentity(() => setName(loadIdentity().name)), []);

  const save = () => {
    const next = name.trim();
    if (next) onSaveName(next);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent open={open} className="max-w-md">
        <DialogHeader
          eyebrow="room settings"
          title="Settings"
          description="Everything here stays in this browser — nothing is sent to the server."
        />

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="device-name" hint="shown to others">
              Device name
            </Label>
            <Input
              id="device-name"
              value={name}
              maxLength={32}
              onChange={(e) => setName(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-[3px] border border-line bg-surface-2 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-ink">
              <Monitor className="size-4 text-ink-3" aria-hidden />
              Appearance
            </span>
            <ThemeToggle />
          </div>

          <div className="flex gap-3 rounded-[3px] border border-line px-4 py-3">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0 text-live"
              aria-hidden
            />
            <p className="text-[12px] leading-relaxed text-ink-2">
              Files travel over an encrypted WebRTC data channel straight to the
              other device. The signaling server sees room codes and connection
              handshakes only — never file bytes.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
          <Button
            variant="danger"
            onClick={onLeave}
            icon={<LogOut className="size-3.5" aria-hidden />}
          >
            Leave room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
