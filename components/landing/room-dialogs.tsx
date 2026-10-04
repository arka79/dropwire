"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Link2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createRoomRequest, stashRoomSecret } from "@/lib/room/session";
import { SignalingError } from "@/lib/signaling/socket";
import { normalizeRoomId, roomPath } from "@/lib/room/room-utils";

export function CreateRoomDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [access, setAccess] = useState<"open" | "password">("open");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const snapshot = await createRoomRequest({
        access,
        password: access === "password" ? password : undefined,
        nickname: nickname.trim() || undefined,
      });
      if (access === "password") stashRoomSecret(snapshot.room.id, password);
      onOpenChange(false);
      router.push(roomPath(snapshot.room.id));
    } catch (caught) {
      setError(
        caught instanceof SignalingError
          ? caught.message
          : "Couldn't reach the signaling server. Is it running?",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent open={open}>
        <DialogHeader
          eyebrow="new room"
          title="Create a temporary room"
          description="A room is a short-lived rendezvous point. Files never touch the server — only this code and the peer list do."
        />

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label>Who can join</Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Room access">
              <button
                type="button"
                role="radio"
                aria-checked={access === "open"}
                onClick={() => setAccess("open")}
                className={[
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                  access === "open"
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-surface hover:border-line-strong",
                ].join(" ")}
              >
                <Link2 className="size-4 text-ink-2" aria-hidden />
                <span className="text-sm font-medium text-ink">Anyone with the link</span>
                <span className="text-[11px] text-ink-3">Fastest path — just share it.</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={access === "password"}
                onClick={() => setAccess("password")}
                className={[
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                  access === "password"
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-surface hover:border-line-strong",
                ].join(" ")}
              >
                <Lock className="size-4 text-ink-2" aria-hidden />
                <span className="text-sm font-medium text-ink">Protected with a password</span>
                <span className="text-[11px] text-ink-3">Link and password needed.</span>
              </button>
            </div>
          </div>

          {access === "password" ? (
            <div className="space-y-1.5">
              <Label htmlFor="room-password" hint="stored only for this room's lifetime">
                Password
              </Label>
              <Input
                id="room-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 4 characters"
                minLength={4}
                required={access === "password"}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="room-nickname" hint="optional">
              Room nickname
            </Label>
            <Input
              id="room-nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Project files"
              maxLength={40}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              icon={<ArrowRight className="size-4" aria-hidden />}
            >
              {busy ? "Creating room…" : "Create room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function JoinRoomDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const roomId = normalizeRoomId(code);
    if (!roomId) {
      setError("That doesn't look like a room code. It looks like NOVA-7K2P.");
      return;
    }
    onOpenChange(false);
    reset();
    setCode("");
    router.push(roomPath(roomId));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent open={open}>
        <DialogHeader
          eyebrow="join"
          title="Join a room"
          description="Paste the link or type the room code the other device is showing. If the room is password protected you'll be asked next."
        />

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="join-code">Room code or link</Label>
            <Input
              id="join-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="NOVA-7K2P"
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase tracking-widest"
              required
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Join room
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
