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
  reconnecting: { label: "reconnecting", dot: "bg-brand", pulse: true },
  failed: { label: "disconnected", dot: "bg-danger" },
};

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
          className="rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
        className="w-full min-w-0 rounded-md border border-line bg-canvas px-2 py-1 text-sm text-ink outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
        aria-label="Device name"
      />
      <button
        type="button"
        className="rounded p-1 text-live hover:bg-surface-2"
        aria-label="Save device name"
        onClick={commit}
      >
        <Check className="size-3.5" aria-hidden />
      </button>
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3 sm:inline">
        enter
      </span>
      <button
        type="button"
        className="rounded p-1 text-ink-3 hover:bg-surface-2 sm:hidden"
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
    <section className="panel" aria-label="Devices in this room">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="label">devices</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
          {peers.length + 1} present
        </span>
      </div>

      <ul className="divide-y divide-line">
        <li className="flex items-center gap-3 px-4 py-3">
          <span className="size-2 shrink-0 rounded-full bg-live" aria-hidden />
          <SelfNameEditor name={localName} onCommit={onRenameLocal} />
          <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            this device
          </span>
        </li>

        {peers.map((peer) => {
          const meta = PHASE_META[peer.phase];
          const connected = peer.phase === "connected";
          return (
            <li key={peer.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`size-2 shrink-0 rounded-full ${meta.dot} ${meta.pulse ? "animate-pulse-dot" : ""}`}
                aria-hidden
              />
              <span className="min-w-0 truncate text-sm font-medium text-ink">
                {peer.name}
              </span>
              {hostIds.has(peer.id) ? (
                <Crown
                  className="size-3.5 shrink-0 text-brand"
                  aria-label="Room host"
                />
              ) : null}
              <span className="ml-auto flex shrink-0 items-center gap-2">
                {peer.phase === "connecting" || peer.phase === "reconnecting" ? (
                  <Loader2
                    className="size-3.5 animate-spin text-brand"
                    aria-hidden
                  />
                ) : null}
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                  {connected ? routeLabel(peer.route) : meta.label}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {peers.length === 0 ? (
        <p className="border-t border-line px-4 py-3 text-sm text-ink-2">
          No one has joined yet — share the link or QR code.
        </p>
      ) : null}
    </section>
  );
}
