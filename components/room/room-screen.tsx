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

  const outgoing = state.transfers.filter((item) => item.direction === "out");
  const incoming = state.transfers.filter((item) => item.direction === "in");
  const completed = state.transfers.filter((item) => item.status === "complete");
  const showSummary = !summaryHidden && completed.length > 0 && activeCount === 0;

  const handleFiles = (files: File[]) => {
    const queuedFor = actions.sendFiles(files);
    if (queuedFor === 0) {
      actions.notify(
        "info",
        "Nobody is connected yet.",
        "Share the room ticket. Your files leave the moment a second device joins.",
      );
    } else {
      setSummaryHidden(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <RoomHeader
        roomId={roomId}
        link={state.link}
        route={route}
        signal={state.signal}
        expiresAt={state.snapshot.room.expiresAt}
        onOpenSettings={() => setSettingsOpen(true)}
        onLeave={leave}
      />

      <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
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
          <CompletionBanner items={completed} onDismiss={() => setSummaryHidden(true)} />
        ) : null}

        <div className="relative mt-6 grid gap-9 lg:grid-cols-2 lg:gap-0">
          <span
            aria-hidden
            className="seam absolute inset-y-0 left-1/2 hidden w-px lg:block"
          />

          <section
            aria-label="Send from this device"
            className={[
              "min-w-0 lg:pr-9",
              hasPeers ? "" : "order-2 lg:order-none",
            ].join(" ")}
          >
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-2">
                send from this device
              </h2>
              <span className="font-mono text-[10px] text-ink-3">
                {outgoing.length} outgoing
              </span>
            </div>

            <div className="mt-5 space-y-5">
              <DropZone
                ready={hasPeers}
                waitingLabel="Share the room ticket first — the pad opens as soon as a second device joins."
                onFiles={handleFiles}
              />

              <TransferQueue
                heading="outgoing"
                items={outgoing}
                onPause={actions.pauseTransfer}
                onResume={actions.resumeTransfer}
                onCancel={actions.cancelTransfer}
                onRetry={actions.retryTransfer}
                onDismiss={actions.dismissTransfer}
                onPauseAll={actions.pauseAll}
                onResumeAll={actions.resumeAll}
                onClearFinished={actions.dismissFinished}
              />

              {hasPeers && outgoing.length === 0 ? (
                <p className="font-mono text-[10px] text-ink-3">
                  outgoing queue empty — drop a file to start
                </p>
              ) : null}
            </div>
          </section>

          <section
            aria-label="The room"
            className={[
              "min-w-0 lg:pl-9",
              hasPeers ? "" : "order-1 lg:order-none",
            ].join(" ")}
          >
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-2">
                the room
              </h2>
              <span className="font-mono text-[10px] text-ink-3">
                {peerCount + 1} devices
              </span>
            </div>

            <div className="mt-5 space-y-5">
              <SharePanel
                roomId={roomId}
                waiting={!hasPeers}
                peerCount={peerCount}
                onShowQr={() => setQrOpen(true)}
              />

              <Participants
                peers={state.peers}
                snapshot={state.snapshot}
                onRenameLocal={actions.updateLocalName}
              />

              <TransferQueue
                heading="incoming"
                showBulk={false}
                items={incoming}
                onPause={actions.pauseTransfer}
                onResume={actions.resumeTransfer}
                onCancel={actions.cancelTransfer}
                onRetry={actions.retryTransfer}
                onDismiss={actions.dismissTransfer}
                onPauseAll={actions.pauseAll}
                onResumeAll={actions.resumeAll}
                onClearFinished={actions.dismissFinished}
              />
            </div>
          </section>
        </div>

        <p className="mt-8 flex items-center gap-2 border-t border-line pt-4 font-mono text-[10px] text-ink-3">
          <ShieldCheck className="size-3.5 text-live" aria-hidden />
          file bytes never reach the server — only this room code and the handshake
        </p>
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
