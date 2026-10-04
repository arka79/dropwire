"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useRoomSession } from "@/hooks/use-room-session";
import {
  forgetRoomSecret,
  readRoomSecret,
  stashRoomSecret,
} from "@/lib/room/session";
import type { RouteKind } from "@/types/peer";
import { RoomHeader } from "./room-header";
import { ConnectionBanner } from "./connection-status";
import { SharePanel } from "./share-panel";
import { QrModal } from "./qr-modal";
import { Participants } from "./participants";
import { DropZone } from "./drop-zone";
import { SettingsDialog } from "./settings-dialog";
import { Notices } from "./notices";
import { PasswordGate, RoomErrorState, RoomLoading } from "./room-states";
import { IncomingPanel } from "@/components/transfer/incoming-panel";
import { TransferQueue } from "@/components/transfer/transfer-queue";
import { CompletionBanner } from "@/components/transfer/completion-banner";
import { isActive } from "@/components/transfer/transfer-row";

export function RoomScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [password, setPassword] = useState<string | undefined>(() =>
    readRoomSecret(roomId),
  );
  const [attempt, setAttempt] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [summaryHidden, setSummaryHidden] = useState(false);
  const { state, actions } = useRoomSession(roomId, password, attempt);

  const errorCode = state.errorCode;
  useEffect(() => {
    if (errorCode === "password_incorrect") forgetRoomSecret(roomId);
  }, [errorCode, roomId]);

  // A fresh round of completions re-arms the summary banner.
  const activeCount = state.transfers.filter(isActive).length;
  const prevActive = useRef<number | null>(null);
  useEffect(() => {
    if (prevActive.current !== null && prevActive.current > 0 && activeCount === 0) {
      setSummaryHidden(false);
    }
    prevActive.current = activeCount;
  }, [activeCount]);

  const leave = () => {
    forgetRoomSecret(roomId);
    router.push("/");
  };

  if (state.phase === "error") {
    const code = state.errorCode ?? "invalid";
    if (code === "password_required" || code === "password_incorrect") {
      return (
        <PasswordGate
          code={code}
          message={state.errorMessage}
          onSubmit={(value) => {
            stashRoomSecret(roomId, value);
            setPassword(value);
            setAttempt((count) => count + 1);
          }}
        />
      );
    }
    return (
      <RoomErrorState
        code={code}
        message={state.errorMessage}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (state.phase !== "ready" || !state.snapshot) {
    return <RoomLoading roomId={roomId} />;
  }

  const peerCount = state.peers.length;
  const hasPeers = peerCount > 0;
  const firstPeerName =
    state.peers.find((peer) => peer.phase === "connected")?.name ??
    state.peers[0]?.name;
  const routes = state.peers
    .filter((peer) => peer.phase === "connected")
    .map((peer) => peer.route);
  const route: RouteKind = routes.includes("relay")
    ? "relay"
    : routes.includes("direct")
      ? "direct"
      : "unknown";

  const completed = state.transfers.filter((item) => item.status === "complete");
  const showSummary =
    !summaryHidden && completed.length > 0 && activeCount === 0;

  const handleFiles = (files: File[]) => {
    const queuedFor = actions.sendFiles(files);
    if (queuedFor === 0) {
      actions.notify(
        "info",
        "No one has joined yet.",
        "Share the link or QR code — your files start moving the moment another device joins.",
      );
    } else {
      setSummaryHidden(false);
    }
  };

  return (
    <div className="noise-field min-h-dvh">
      <RoomHeader
        roomId={roomId}
        link={state.link}
        route={route}
        signal={state.signal}
        expiresAt={state.snapshot.room.expiresAt}
        onOpenSettings={() => setSettingsOpen(true)}
        onLeave={leave}
      />

      <main className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:py-6">
        <div className="flex min-w-0 flex-col gap-5">
          <ConnectionBanner
            link={state.link}
            peerName={firstPeerName}
            onRetry={() => actions.retryConnection()}
          />

          <IncomingPanel
            offers={state.incoming}
            onAccept={(id) => void actions.acceptIncoming(id)}
            onReject={actions.rejectIncoming}
          />

          {showSummary ? (
            <CompletionBanner
              items={completed}
              onDismiss={() => setSummaryHidden(true)}
            />
          ) : null}

          {!hasPeers ? (
            <SharePanel
              roomId={roomId}
              variant="hero"
              waiting
              peerCount={peerCount}
              onShowQr={() => setQrOpen(true)}
            />
          ) : null}

          <DropZone
            ready={hasPeers}
            waitingLabel="Share the link or QR code — drop files the moment another device joins."
            onFiles={handleFiles}
          />

          <TransferQueue
            items={state.transfers}
            onPause={actions.pauseTransfer}
            onResume={actions.resumeTransfer}
            onCancel={actions.cancelTransfer}
            onRetry={actions.retryTransfer}
            onDismiss={actions.dismissTransfer}
            onPauseAll={actions.pauseAll}
            onResumeAll={actions.resumeAll}
            onClearFinished={actions.dismissFinished}
          />

          {hasPeers && state.transfers.length === 0 ? (
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
              queue empty · ready to send
            </p>
          ) : null}
        </div>

        <aside className="flex flex-col gap-5">
          {hasPeers ? (
            <SharePanel
              roomId={roomId}
              variant="compact"
              waiting={false}
              peerCount={peerCount}
              onShowQr={() => setQrOpen(true)}
            />
          ) : null}

          <Participants
            peers={state.peers}
            snapshot={state.snapshot}
            onRenameLocal={actions.updateLocalName}
          />

          <section className="panel p-4" aria-label="Privacy summary">
            <div className="flex items-center justify-between">
              <span className="label">server sees</span>
              <ShieldCheck className="size-3.5 text-live" aria-hidden />
            </div>
            <ul className="mt-3 space-y-2 font-mono text-[11px] text-ink-2">
              <li className="flex justify-between border-b border-line pb-2">
                <span>room code + state</span>
                <span className="text-ink-3">yes</span>
              </li>
              <li className="flex justify-between border-b border-line pb-2">
                <span>sdp / ice handshake</span>
                <span className="text-ink-3">yes</span>
              </li>
              <li className="flex justify-between">
                <span>file bytes</span>
                <span className="text-live">never</span>
              </li>
            </ul>
          </section>
        </aside>
      </main>

      <Notices notices={state.notices} onDismiss={actions.dismissNotice} />

      <QrModal open={qrOpen} onOpenChange={setQrOpen} roomId={roomId} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaveName={actions.updateLocalName}
        onLeave={() => {
          setSettingsOpen(false);
          leave();
        }}
      />
    </div>
  );
}
