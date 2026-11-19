"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, KeyRound, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function RoomLoading({ roomId }: { roomId: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm border border-line bg-surface p-6">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
          <span className="size-1.5 bg-brand-text animate-blink" aria-hidden />
          opening the wire
        </div>

        <p className="mt-5 font-mono text-xl tracking-[0.1em] text-ink">{roomId}</p>

        <div className="mt-4 flex h-2 items-center gap-1" aria-hidden>
          <span className="h-full flex-1 bg-surface-2" />
          <span className="h-full flex-1 bg-surface-2" />
          <span className="h-full flex-1 bg-surface-2" />
          <span className="h-full flex-1 bg-brand" />
        </div>

        <p className="mt-4 font-mono text-[11px] leading-relaxed text-ink-2">
          Joining the room and negotiating a direct connection.
        </p>
      </div>
    </main>
  );
}

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  not_found: {
    title: "Room not found.",
    body: "The code may be mistyped, or the room has already expired.",
  },
  expired: {
    title: "This room has expired.",
    body: "Rooms close after a few hours so nothing lingers on the server.",
  },
  full: {
    title: "This room is full.",
    body: "The room is at its device limit. Ask one of them to leave and try again.",
  },
  invalid: {
    title: "That room code isn't valid.",
    body: "Room codes look like NOVA-7K2P — check for missing characters.",
  },
  rate_limited: {
    title: "Too many attempts.",
    body: "Wait a moment before trying again.",
  },
  closed: {
    title: "This room was closed.",
    body: "The host left and nobody else was inside.",
  },
  network: {
    title: "Can't reach the signaling server.",
    body: "Check your connection. The server only handles handshakes — your files never left this device.",
  },
  timeout: {
    title: "The server took too long to answer.",
    body: "Try again in a moment.",
  },
};

export function RoomErrorState({
  code,
  message,
  onRetry,
}: {
  code: string;
  message: string | null;
  onRetry: () => void;
}) {
  const copy = ERROR_COPY[code] ?? {
    title: "Something went wrong.",
    body: message ?? "The room could not be opened.",
  };
  const retryable = code === "network" || code === "timeout";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4">
      <div className="w-full max-w-md border border-line bg-surface p-6">
        <span className="flex size-9 items-center justify-center border border-danger/35 bg-danger-soft text-danger">
          <AlertTriangle className="size-4" aria-hidden />
        </span>
        <h1 className="display mt-4 text-[26px] text-ink">{copy.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{copy.body}</p>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
          {retryable ? (
            <Button variant="primary" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
          <Link href="/">
            <Button variant={retryable ? "secondary" : "primary"}>Back home</Button>
          </Link>
        </div>
      </div>
      <p className="font-mono text-[10px] text-ink-3">error: {code}</p>
    </main>
  );
}

export function PasswordGate({
  code,
  message,
  onSubmit,
}: {
  code: string;
  message: string | null;
  onSubmit: (password: string) => void;
}) {
  const [value, setValue] = useState("");
  const wrong = code === "password_incorrect";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!value) return;
    onSubmit(value);
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4">
      <div className="w-full max-w-md border border-line bg-surface p-6">
        <span className="flex size-9 items-center justify-center border border-line-strong bg-surface-2 text-ink">
          <KeyRound className="size-4" aria-hidden />
        </span>
        <h1 className="display mt-4 text-[26px] text-ink">
          This room has a password.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Enter the password the host shared with you. The server only compares a
          hash it stored for this room.
        </p>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="room-password">Room password</Label>
            <Input
              id="room-password"
              type="password"
              autoFocus
              autoComplete="off"
              placeholder="••••••••"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={wrong}
            />
            {wrong ? (
              <p className="text-[12px] text-danger" role="alert">
                {message ?? "That password doesn't match."}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            variant="primary"
            block
            disabled={!value}
            icon={<Lock className="size-4" aria-hidden />}
          >
            Unlock room
          </Button>
        </form>

        <p className="mt-5 border-t border-line pt-4 font-mono text-[10px] text-ink-3">
          rooms without a password skip this step
        </p>
      </div>

      <Link
        href="/"
        className="text-sm text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        Back home
      </Link>
    </main>
  );
}
