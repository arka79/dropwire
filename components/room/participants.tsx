import { useEffect, useState } from "react";
import { Check, Crown, Loader2, Pencil, X } from "lucide-react";
import type { RoomSnapshot } from "@/types/room";
import type { PeerSnapshot, PeerPhase } from "@/types/peer";
import { loadIdentity, subscribeIdentity } from "@/lib/identity";
import { routeLabel } from "./connection-status";

const PHASE_META: Record<PeerPhase, { label: string; dot: string; pulse?: boolean }> = {
  idle: { label: "present", dot: "bg-brand", pulse: true },
  connecting: { label: "connecting", dot: "bg-brand", pulse: true },
  connected: { label: "connected", dot: "bg-live" },
  reconnecting: { label: "reconnecting", dot: "bg-brand-text", pulse: true },
  failed: { label: "disconnected", dot: "bg-danger" },
};

function Node({ className = "", pulse = false }: { className?: string; pulse?: boolean }) {
  return (
    <span
      aria-hidden
      className={[
        "absolute left-[15px] top-1/2 z-10 size-2 -translate-y-1/2",
        pulse ? "animate-blink" : "",
        className,
      ].join(" ")}
    />
  );
}

function SelfNameEditor({
  name,
  onCommit,
}: {
  name: string;
  onCommit: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (!editing) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-medium text-ink">{name}</span>
        <button
          type="button"
          className="rounded-[2px] p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          aria-label="Rename this device"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
        >
          <Pencil className="size-3" aria-hidden />
        </button>
      </span>
    );
  }

  const commit = () => {
    const next = draft.trim();
    if (next && next !== name) onCommit(next);
    setEditing(false);
  };

  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <input
        autoFocus
        value={draft}
        maxLength={32}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-full min-w-0 border border-line bg-canvas px-2 py-1 text-sm text-ink outline-none focus-visible:border-ink"
        aria-label="Device name"
      />
      <button
        type="button"
        className="p-1 text-live hover:bg-surface-2"
        aria-label="Save device name"
        onClick={commit}
      >
        <Check className="size-3.5" aria-hidden />
      </button>
      <span className="hidden font-mono text-[10px] text-ink-3 sm:inline">enter</span>
      <button
        type="button"
        className="p-1 text-ink-3 hover:bg-surface-2 sm:hidden"
        aria-label="Cancel rename"
        onClick={() => setEditing(false)}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}

export function Participants({
  peers,
  snapshot,
  onRenameLocal,
}: {
  peers: PeerSnapshot[];
  snapshot: RoomSnapshot | null;
  onRenameLocal: (name: string) => void;
}) {
  const [localName, setLocalName] = useState(() => loadIdentity().name);

  useEffect(() => subscribeIdentity(() => setLocalName(loadIdentity().name)), []);

  const hostIds = new Set(
    snapshot?.peers.filter((peer) => peer.isHost).map((peer) => peer.id) ?? [],
  );

  return (
    <section className="border border-line bg-surface" aria-label="Devices in this room">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-2">
          devices
        </span>
        <span className="font-mono text-[10px] text-ink-3">
          {peers.length + 1} present
        </span>
      </div>

      <ul className="relative py-1">
        <span
          aria-hidden
          className="absolute bottom-4 left-[19px] top-4 w-px bg-line-strong/50"
        />

        <li className="relative flex items-center gap-3 py-3 pl-9 pr-4">
          <Node className="bg-brand" />
          <SelfNameEditor name={localName} onCommit={onRenameLocal} />
          <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-3">
            this device
          </span>
        </li>

        {peers.map((peer) => {
          const meta = PHASE_META[peer.phase];
          const connected = peer.phase === "connected";
          return (
            <li key={peer.id} className="relative flex items-center gap-3 py-3 pl-9 pr-4">
              <Node className={meta.dot} pulse={meta.pulse} />
              <span className="min-w-0 truncate text-sm font-medium text-ink">
                {peer.name}
              </span>
              {hostIds.has(peer.id) ? (
                <Crown className="size-3.5 shrink-0 text-brand-text" aria-label="Room host" />
              ) : null}
              <span className="ml-auto flex shrink-0 items-center gap-2">
                {peer.phase === "connecting" || peer.phase === "reconnecting" ? (
                  <Loader2 className="size-3.5 animate-spin text-brand-text" aria-hidden />
                ) : null}
                <span className="font-mono text-[10px] text-ink-3">
                  {connected ? routeLabel(peer.route) : meta.label}
                </span>
              </span>
            </li>
          );
        })}

        {peers.length === 0 ? (
          <li className="relative flex items-center gap-3 py-3 pl-9 pr-4">
            <span
              aria-hidden
              className="absolute left-[15px] top-1/2 z-10 size-2 -translate-y-1/2 border border-line-strong bg-surface"
            />
            <p className="text-sm text-ink-2">
              Open end. Share the room ticket to connect.
            </p>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
