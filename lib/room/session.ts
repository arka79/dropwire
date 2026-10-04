import type { RoomSnapshot } from "../../types/room";
import type { LinkPhase, PeerPhase, PeerSnapshot, RouteKind } from "../../types/peer";
import type { TransferItem, TransferStatus } from "../../types/transfer";
import { loadIdentity, renameIdentity } from "../identity";
import { SIGNALING_URL } from "../env";
import { SignalingClient, SignalingError } from "../signaling/socket";
import { PeerConnection } from "../webrtc/peer";
import { TransferEngine, type IncomingOffer } from "../webrtc/transfer";

export type SessionPhase = "starting" | "joining" | "ready" | "error";

export interface Notice {
  id: string;
  kind: "info" | "success" | "error";
  title: string;
  body?: string;
  at: number;
}

export interface RoomViewState {
  phase: SessionPhase;
  errorCode: string | null;
  errorMessage: string | null;
  snapshot: RoomSnapshot | null;
  signal: "connecting" | "online" | "offline";
  link: LinkPhase;
  peers: PeerSnapshot[];
  transfers: TransferItem[];
  incoming: IncomingOffer[];
  notices: Notice[];
}

export interface RoomSessionOptions {
  roomId: string;
  password?: string;
}

interface PeerHandle {
  snapshot: PeerSnapshot;
  conn: PeerConnection | null;
  engine: TransferEngine | null;
  initiator: boolean;
  retryTimer: ReturnType<typeof setTimeout> | null;
}

const SECRET_KEY = (roomId: string) => `dropwire:room:${roomId}`;

export function stashRoomSecret(roomId: string, password: string): void {
  try {
    window.sessionStorage.setItem(SECRET_KEY(roomId), password);
  } catch {
    // ignore
  }
}

export function readRoomSecret(roomId: string): string | undefined {
  try {
    return window.sessionStorage.getItem(SECRET_KEY(roomId)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function forgetRoomSecret(roomId: string): void {
  try {
    window.sessionStorage.removeItem(SECRET_KEY(roomId));
  } catch {
    // ignore
  }
}

export async function createRoomRequest(input: {
  access: "open" | "password";
  password?: string;
  nickname?: string;
}): Promise<RoomSnapshot> {
  cancelPendingLeave();
  const identity = loadIdentity();
  const client = new SignalingClient();
  client.connect();
  return client.createRoom({
    access: input.access,
    password: input.password,
    nickname: input.nickname,
    deviceId: identity.id,
    name: identity.name,
  });
}

type PendingLeave = { roomId: string; timer: ReturnType<typeof setTimeout> };
let pendingLeave: PendingLeave | null = null;

function cancelPendingLeave(): void {
  if (pendingLeave) clearTimeout(pendingLeave.timer);
  pendingLeave = null;
}

function scheduleLeave(roomId: string): void {
  cancelPendingLeave();
  const client = new SignalingClient();
  pendingLeave = {
    roomId,
    timer: setTimeout(() => {
      pendingLeave = null;
      void client.leaveRoom();
    }, 1200),
  };
}

let noticeCounter = 0;

export function emptyRoomState(): RoomViewState {
  return {
    phase: "starting",
    errorCode: null,
    errorMessage: null,
    snapshot: null,
    signal: "connecting",
    link: "offline",
    peers: [],
    transfers: [],
    incoming: [],
    notices: [],
  };
}

/**
 * Owns one room: signaling membership, one PeerConnection per device and one
 * TransferEngine per open data channel. React only ever reads a frozen-ish
 * view-model produced here; file bytes never enter React state.
 */
export class RoomSession {
  private state: RoomViewState;
  private readonly listeners = new Set<() => void>();
  private readonly signaling = new SignalingClient();
  private readonly handles = new Map<string, PeerHandle>();
  private readonly items = new Map<string, TransferItem>();
  private readonly owners = new Map<string, string>();
  private readonly cleanups: (() => void)[] = [];
  private readonly pendingFiles = new Map<string, File[]>();
  private readonly retryCounts = new Map<string, number>();
  private iceServers: RTCIceServer[] = [];
  private selfId: string | null = null;
  private joined = false;
  private started = false;
  private destroyed = false;

  constructor(private readonly options: RoomSessionOptions) {
    this.state = {
      phase: "starting",
      errorCode: null,
      errorMessage: null,
      snapshot: null,
      signal: "connecting",
      link: "offline",
      peers: [],
      transfers: [],
      incoming: [],
      notices: [],
    };
  }

  /* ---------------------------------------------------------------- *
   * external store
   * ---------------------------------------------------------------- */

  getState = (): RoomViewState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<RoomViewState>): void {
    if (this.destroyed) return;
    const next: RoomViewState = { ...this.state, ...patch };
    next.link = this.computeLink(next);
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  private computeLink(state: RoomViewState): LinkPhase {
    if (state.phase === "error") return "offline";
    if (state.signal === "offline") {
      return state.peers.length > 0 ? "reconnecting" : "offline";
    }
    if (state.phase !== "ready") return state.signal === "online" ? "searching" : "offline";
    if (state.peers.length === 0) return "searching";

    const phases = state.peers.map((peer) => peer.phase);
    const connected = phases.filter((phase) => phase === "connected").length;
    if (phases.includes("failed") && connected === 0) return "disconnected";
    if (phases.includes("failed") || phases.includes("reconnecting")) {
      return "reconnecting";
    }
    if (phases.some((phase) => phase === "connecting")) return "connecting";
    if (!phases.every((phase) => phase === "connected")) return "connecting";

    const moving = state.transfers.some(
      (item) => item.status === "sending" || item.status === "receiving",
    );
    return moving ? "transferring" : "connected";
  }

  /* ---------------------------------------------------------------- *
   * lifecycle
   * ---------------------------------------------------------------- */

  async start(): Promise<void> {
    if (this.started || this.destroyed) return;
    this.started = true;
    cancelPendingLeave();
    this.set({ phase: "starting" });

    this.iceServers = await this.fetchIceConfig();
    if (this.destroyed) return;

    this.wireSignaling();
    this.signaling.connect();

    try {
      const snapshot = await this.join();
      if (this.destroyed) return;
      this.applySnapshot(snapshot);
      this.set({ phase: "ready" });
      this.syncPeers(snapshot);
    } catch (error) {
      if (this.destroyed) return;
      if (error instanceof SignalingError) {
        this.set({
          phase: "error",
          errorCode: error.code,
          errorMessage: error.message,
        });
      } else {
        this.set({
          phase: "error",
          errorCode: "invalid",
          errorMessage: "Something went wrong joining this room.",
        });
      }
    }
  }

  private join(): Promise<RoomSnapshot> {
    const identity = loadIdentity();
    return this.signaling.joinRoom({
      roomId: this.options.roomId,
      deviceId: identity.id,
      name: identity.name,
      password: this.options.password,
    });
  }

  private async fetchIceConfig(): Promise<RTCIceServer[]> {
    try {
      const base = SIGNALING_URL.replace(/\/$/, "");
      const response = await fetch(`${base}/config`, {
        headers: { accept: "application/json" },
        signal: typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(5000)
          : undefined,
      });
      if (!response.ok) throw new Error(`config ${response.status}`);
      const data = (await response.json()) as { iceServers?: RTCIceServer[] };
      return Array.isArray(data.iceServers) ? data.iceServers : [];
    } catch (error) {
      console.warn("[dropwire] falling back to default STUN config", error);
      return [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.length = 0;

    for (const handle of this.handles.values()) {
      if (handle.retryTimer) clearTimeout(handle.retryTimer);
      handle.engine?.destroy();
      handle.conn?.close();
    }
    this.handles.clear();

    for (const item of this.items.values()) {
      if (item.downloadUrl) URL.revokeObjectURL(item.downloadUrl);
    }
    this.items.clear();
    this.owners.clear();

    if (this.joined) scheduleLeave(this.options.roomId);
    this.listeners.clear();
  }

  /* ---------------------------------------------------------------- *
   * signaling
   * ---------------------------------------------------------------- */

  private wireSignaling(): void {
    this.cleanups.push(
      this.signaling.onConnect(() => {
        void this.handleReconnect();
      }),
      this.signaling.onDisconnect((reason) => {
        if (this.destroyed) return;
        this.set({ signal: "offline" });
        console.info("[dropwire] signaling disconnected", reason);
      }),
      this.signaling.on("peer:joined", (event) => {
        if (this.destroyed) return;
        const peers = this.state.snapshot?.peers ?? [];
        if (!peers.some((peer) => peer.id === event.peer.id)) {
          // keep the server's roster authoritative
          const snapshot = this.state.snapshot;
          if (snapshot) {
            this.applySnapshot({
              ...snapshot,
              room: event.room,
              peers: [...peers, event.peer].sort((a, b) => a.joinedAt - b.joinedAt),
            });
          }
        }
        this.ensurePeer(event.peer.id, event.peer.name, {
          recreate: true,
        });
        this.pushNotice("info", `${event.peer.name} joined the room`);
      }),
      this.signaling.on("peer:left", (event) => {
        if (this.destroyed) return;
        this.dropPeer(event.peerId, "The other device left the room.");
        const snapshot = this.state.snapshot;
        if (snapshot) {
          this.applySnapshot({
            ...snapshot,
            peers: snapshot.peers.filter((peer) => peer.id !== event.peerId),
          });
        }
        this.pushNotice("info", "The other device disconnected");
      }),
      this.signaling.on("peer:renamed", (event) => {
        if (this.destroyed) return;
        const handle = this.handles.get(event.peerId);
        if (handle) {
          this.updatePeer(event.peerId, { name: event.name });
          if (handle.engine) this.detachEngine(event.peerId, "renamed");
        }
        const snapshot = this.state.snapshot;
        if (snapshot) {
          this.applySnapshot({
            ...snapshot,
            peers: snapshot.peers.map((peer) =>
              peer.id === event.peerId ? { ...peer, name: event.name } : peer,
            ),
          });
        }
      }),
      this.signaling.on("signal:offer", (event) => {
        if (this.destroyed) return;
        void this.handleOffer(event.from, event.data);
      }),
      this.signaling.on("signal:answer", (event) => {
        if (this.destroyed) return;
        const handle = this.handles.get(event.from);
        if (!handle?.conn) return;
        void handle.conn.handleAnswer(event.data).catch((error) => {
          console.warn("[dropwire] answer failed", error);
        });
      }),
      this.signaling.on("signal:ice", (event) => {
        if (this.destroyed) return;
        const handle = this.handles.get(event.from);
        if (!handle?.conn) return;
        void handle.conn.handleIce(event.data);
      }),
      this.signaling.on("signal:retry", (event) => {
        if (this.destroyed) return;
        const handle = this.handles.get(event.from);
        if (!handle) return;
        console.info("[dropwire] peer asked to renegotiate");
        if (handle.initiator) {
          if (handle.conn) handle.conn.restartIce();
          else this.ensurePeer(event.from, handle.snapshot.name, { recreate: true });
        }
      }),
      this.signaling.on("room:closed", (event) => {
        if (this.destroyed) return;
        this.joined = false;
        for (const peerId of [...this.handles.keys()]) {
          this.dropPeer(peerId, event.message);
        }
        this.set({
          phase: "error",
          errorCode: event.reason === "expired" ? "expired" : "closed",
          errorMessage: event.message,
        });
      }),
      this.signaling.on("room:error", (event) => {
        if (this.destroyed) return;
        this.pushNotice("error", event.message);
      }),
    );
  }

  private async handleReconnect(): Promise<void> {
    if (this.destroyed) return;
    this.set({ signal: "online" });
    if (!this.started || !this.joined) return;
    try {
      const snapshot = await this.join();
      if (this.destroyed) return;
      this.applySnapshot(snapshot);
      this.set({ phase: "ready", errorCode: null, errorMessage: null });
      this.syncPeers(snapshot);
      this.pushNotice("success", "Connection restored");
    } catch (error) {
      if (this.destroyed) return;
      if (error instanceof SignalingError) {
        if (["not_found", "expired", "closed", "full"].includes(error.code)) {
          this.set({
            phase: "error",
            errorCode: error.code,
            errorMessage: error.message,
          });
          return;
        }
        if (error.code === "password_required" || error.code === "password_incorrect") {
          this.set({
            phase: "error",
            errorCode: error.code,
            errorMessage: error.message,
          });
          return;
        }
      }
      console.warn("[dropwire] rejoin failed, will retry on next connect", error);
    }
  }

  private applySnapshot(snapshot: RoomSnapshot): void {
    this.selfId = snapshot.selfId;
    this.joined = true;
    const known = new Set(snapshot.peers.map((peer) => peer.id));
    for (const peerId of [...this.handles.keys()]) {
      if (!known.has(peerId)) this.dropPeer(peerId, "The other device left the room.");
    }
    this.set({ snapshot });
    this.syncPeerStates(snapshot);
  }

  /* ---------------------------------------------------------------- *
   * peers
   * ---------------------------------------------------------------- */

  private syncPeers(snapshot: RoomSnapshot): void {
    for (const peer of snapshot.peers) {
      if (peer.id === snapshot.selfId) continue;
      const existing = this.handles.get(peer.id);
      if (existing?.conn && existing.conn.currentPhase !== "failed") {
        this.updatePeer(peer.id, { name: peer.name });
        continue;
      }
      this.ensurePeer(peer.id, peer.name, { recreate: !existing?.conn });
    }
  }

  private syncPeerStates(snapshot: RoomSnapshot): void {
    const merged = new Map<string, PeerSnapshot>();
    for (const peer of snapshot.peers) {
      if (peer.id === snapshot.selfId) continue;
      const handle = this.handles.get(peer.id);
      if (handle) {
        handle.snapshot = { ...handle.snapshot, name: peer.name };
        merged.set(peer.id, handle.snapshot);
      } else {
        merged.set(peer.id, {
          id: peer.id,
          name: peer.name,
          phase: "idle",
          route: "unknown",
          phaseSince: Date.now(),
        });
      }
    }
    for (const [peerId, handle] of this.handles) {
      if (!merged.has(peerId)) merged.set(peerId, handle.snapshot);
    }
    this.set({ peers: [...merged.values()] });
  }

  private ensurePeer(
    peerId: string,
    name: string,
    options: { recreate?: boolean } = {},
  ): PeerHandle {
    const existing = this.handles.get(peerId);
    if (existing && !options.recreate) return existing;
    if (existing) this.dropPeer(peerId, "Reconnecting…", { silent: true });

    const initiator = this.selfId !== null && this.selfId < peerId;
    const snapshot: PeerSnapshot = {
      id: peerId,
      name: name || existing?.snapshot.name || "Other device",
      phase: "connecting",
      route: "unknown",
      phaseSince: Date.now(),
    };

    const handle: PeerHandle = { snapshot, conn: null, engine: null, initiator, retryTimer: null };
    this.handles.set(peerId, handle);
    this.syncPeerStatesFromHandles();

    const conn = new PeerConnection(peerId, initiator, this.iceServers, {
      sendOffer: (sdp) => this.signaling.sendOffer(peerId, sdp),
      sendAnswer: (sdp) => this.signaling.sendAnswer(peerId, sdp),
      sendIce: (candidate) => this.signaling.sendIce(peerId, candidate),
      onPhaseChange: (phase) => this.handlePhase(peerId, phase),
      onRouteChange: (route) => this.handleRoute(peerId, route),
      onChannelOpen: (channel) => this.attachEngine(peerId, channel),
      onChannelClose: () => this.handleChannelClose(peerId),
    });
    handle.conn = conn;
    if (initiator) {
      void conn.start().catch((error) => {
        console.warn("[dropwire] offer failed", error);
        this.updatePeer(peerId, { phase: "failed" });
      });
    }
    return handle;
  }

  private async handleOffer(
    peerId: string,
    sdp: RTCSessionDescriptionInit,
  ): Promise<void> {
    let handle = this.handles.get(peerId);
    if (!handle) {
      handle = this.ensurePeer(peerId, "Other device");
    }
    if (!handle.conn) {
      this.dropPeer(peerId, "Reconnecting…", { silent: true });
      handle = this.ensurePeer(peerId, "Other device");
    }
    if (!handle.conn) return;
    try {
      await handle.conn.handleOffer(sdp);
    } catch (error) {
      console.warn("[dropwire] offer handling failed", error);
      this.dropPeer(peerId, "Reconnecting…", { silent: true });
      this.ensurePeer(peerId, handle.snapshot.name);
    }
  }

  private handlePhase(peerId: string, phase: PeerPhase): void {
    const handle = this.handles.get(peerId);
    if (!handle) return;
    const wasConnected = handle.snapshot.phase === "connected";
    this.updatePeer(peerId, { phase });
    if (phase === "connected") {
      handle.retryTimer = null;
      return;
    }
    if (phase === "failed") {
      const attempts = this.retryCount(peerId);
      if (attempts < 2) {
        this.setRetryCount(peerId, attempts + 1);
        handle.retryTimer = setTimeout(() => {
          if (this.destroyed) return;
          const current = this.handles.get(peerId);
          if (!current || current.snapshot.phase === "connected") return;
          console.info(`[dropwire] reconnect attempt ${attempts + 1} for ${peerId}`);
          if (current.initiator) current.conn?.restartIce();
          else this.signaling.sendRetry(peerId, attempts + 1);
        }, 1800);
      }
      return;
    }
    if (phase === "reconnecting" && wasConnected) {
      this.pushNotice("info", "Connection interrupted — trying to reconnect…");
    }
  }

  private handleRoute(peerId: string, route: RouteKind): void {
    this.updatePeer(peerId, { route });
  }

  private handleChannelClose(peerId: string): void {
    const handle = this.handles.get(peerId);
    if (!handle) return;
    this.detachEngine(peerId, "The connection closed.");
    if (handle.snapshot.phase === "connected") {
      this.updatePeer(peerId, { phase: "reconnecting" });
    }
  }

  private detachEngine(peerId: string, reason: string): void {
    const handle = this.handles.get(peerId);
    if (!handle?.engine) return;
    handle.engine.destroy(reason);
    handle.engine = null;
  }

  private attachEngine(peerId: string, channel: RTCDataChannel): void {
    const handle = this.handles.get(peerId);
    if (!handle) return;
    if (handle.engine) {
      if (handle.engine.dataChannel === channel && handle.engine.ready) return;
      handle.engine.destroy("Replaced by a new connection.");
      handle.engine = null;
    }
    handle.engine = new TransferEngine(peerId, channel, handle.snapshot.name, {
      onItem: (item) => this.upsertItem(item),
      onIncoming: (offer) => {
        this.set({ incoming: [...this.state.incoming, offer] });
      },
      onIncomingResolved: (id) => {
        this.set({ incoming: this.state.incoming.filter((entry) => entry.id !== id) });
      },
      onReady: (peerName) => {
        this.updatePeer(peerId, { name: peerName });
      },
    });
    this.updatePeer(peerId, { phase: "connected" });
    this.flushPending(peerId);
    this.pushNotice("success", "Direct connection established");
  }

  private dropPeer(peerId: string, reason: string, options: { silent?: boolean } = {}): void {
    const handle = this.handles.get(peerId);
    if (!handle) return;
    if (handle.retryTimer) clearTimeout(handle.retryTimer);
    this.handles.delete(peerId);
    handle.engine?.destroy(reason);
    handle.conn?.close();
    this.retryCounts.delete(peerId);
    if (!options.silent) this.syncPeerStatesFromHandles();
  }

  private syncPeerStatesFromHandles(): void {
    const snapshot = this.state.snapshot;
    if (snapshot) {
      this.syncPeerStates(snapshot);
      return;
    }
    this.set({ peers: [...this.handles.values()].map((handle) => handle.snapshot) });
  }

  private updatePeer(peerId: string, patch: Partial<PeerSnapshot>): void {
    const handle = this.handles.get(peerId);
    if (!handle) return;
    handle.snapshot = {
      ...handle.snapshot,
      ...patch,
      phaseSince:
        patch.phase && patch.phase !== handle.snapshot.phase
          ? Date.now()
          : handle.snapshot.phaseSince,
    };
    this.syncPeerStatesFromHandles();
  }

  private retryCount(peerId: string): number {
    return this.retryCounts.get(peerId) ?? 0;
  }

  private setRetryCount(peerId: string, value: number): void {
    this.retryCounts.set(peerId, value);
  }

  /* ---------------------------------------------------------------- *
   * transfers
   * ---------------------------------------------------------------- */

  private upsertItem(item: TransferItem): void {
    const existed = this.items.has(item.id);
    this.items.set(item.id, item);
    if (!existed) this.owners.set(item.id, item.peerId ?? "");
    const list = [...this.state.transfers];
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index >= 0) list[index] = item;
    else list.push(item);
    this.set({ transfers: list });
  }

  private engineFor(peerId: string): TransferEngine | null {
    return this.handles.get(peerId)?.engine ?? null;
  }

  /** Returns the number of devices the files were queued for. */
  sendFiles(files: File[], target: string | "all" = "all"): number {
    const readyPeerIds = [...this.handles.entries()]
      .filter(([, handle]) => handle.engine?.ready)
      .map(([peerId]) => peerId);

    let targets: string[];
    if (target === "all") targets = readyPeerIds;
    else targets = readyPeerIds.includes(target) ? [target] : [];

    // Queue for devices that are not connected yet too, so files leave as
    // soon as the channel opens.
    if (targets.length === 0) {
      const waiting = [...this.handles.keys()];
      targets = target === "all" ? waiting : waiting.includes(target) ? [target] : [];
    }

    let queued = 0;
    for (const peerId of targets) {
      const handle = this.handles.get(peerId);
      if (!handle) continue;
      const start = () => {
        const engine = handle.engine;
        if (!engine) return;
        const created = engine.enqueue(files);
        for (const item of created) this.upsertItem(item);
        queued += 1;
      };
      if (handle.engine?.ready) start();
      else {
        // engine appears when the channel opens; remember the intent
        this.pendingFiles.set(peerId, [
          ...(this.pendingFiles.get(peerId) ?? []),
          ...files,
        ]);
        queued += 1;
      }
    }
    return queued;
  }

  private flushPending(peerId: string): void {
    const files = this.pendingFiles.get(peerId);
    if (!files || files.length === 0) return;
    this.pendingFiles.delete(peerId);
    const handle = this.handles.get(peerId);
    const engine = handle?.engine;
    if (!engine) return;
    const created = engine.enqueue(files);
    for (const item of created) this.upsertItem(item);
  }

  hasConnectedPeer(): boolean {
    return [...this.handles.values()].some((handle) => handle.engine?.ready);
  }

  pauseTransfer(id: string): void {
    this.withItem(id, (engine, item) => {
      if (item.direction === "out") engine.pause(id);
      else engine.pauseIncoming(id);
    });
  }

  resumeTransfer(id: string): void {
    this.withItem(id, (engine, item) => {
      if (item.direction === "out") engine.resume(id);
      else engine.resumeIncoming(id);
    });
  }

  cancelTransfer(id: string): void {
    this.withItem(id, (engine, item) => {
      if (item.direction === "out") engine.cancel(id);
      else engine.cancelIncoming(id);
    });
  }

  retryTransfer(id: string): void {
    this.withItem(id, (engine, item) => {
      if (item.direction === "out") engine.retry(id);
    });
  }

  pauseAll(): void {
    for (const item of this.state.transfers) {
      if (item.direction === "out") this.pauseTransfer(item.id);
      else this.pauseIncoming(item.id);
    }
  }

  resumeAll(): void {
    for (const item of this.state.transfers) {
      if (item.direction === "out") this.resumeTransfer(item.id);
      else this.resumeIncoming(item.id);
    }
  }

  cancelAll(): void {
    for (const item of this.state.transfers) this.cancelTransfer(item.id);
  }

  /** Removes a finished row from the queue (no wire traffic). */
  dismissTransfer(id: string): void {
    this.items.delete(id);
    this.owners.delete(id);
    this.set({
      transfers: this.state.transfers.filter((entry) => entry.id !== id),
    });
  }

  dismissFinished(): void {
    const terminal: TransferStatus[] = [
      "complete",
      "failed",
      "cancelled",
      "rejected",
      "interrupted",
    ];
    const keep = this.state.transfers.filter(
      (entry) => !terminal.includes(entry.status),
    );
    for (const entry of this.state.transfers) {
      if (terminal.includes(entry.status)) {
        this.items.delete(entry.id);
        this.owners.delete(entry.id);
      }
    }
    this.set({ transfers: keep });
  }

  private pauseIncoming(id: string): void {
    this.withItem(id, (engine) => engine.pauseIncoming(id));
  }

  private resumeIncoming(id: string): void {
    this.withItem(id, (engine) => engine.resumeIncoming(id));
  }

  private withItem(
    id: string,
    action: (engine: TransferEngine, item: TransferItem) => void,
  ): void {
    const item = this.items.get(id) ?? this.state.transfers.find((entry) => entry.id === id);
    if (!item) return;
    const peerId = this.owners.get(id) ?? item.peerId;
    if (!peerId) return;
    const engine = this.engineFor(peerId);
    if (engine) action(engine, item);
  }

  async acceptIncoming(id: string): Promise<boolean> {
    const offer = this.state.incoming.find((entry) => entry.id === id);
    if (!offer) return false;
    const engine = this.engineFor(offer.peerId);
    if (!engine) return false;
    return engine.accept(id);
  }

  rejectIncoming(id: string, reason = "declined"): void {
    const offer = this.state.incoming.find((entry) => entry.id === id);
    if (!offer) return;
    this.engineFor(offer.peerId)?.reject(id, reason);
  }

  /* ---------------------------------------------------------------- *
   * misc
   * ---------------------------------------------------------------- */

  async rename(name: string): Promise<void> {
    await this.signaling.rename(name);
    const snapshot = this.state.snapshot;
    if (snapshot) {
      this.applySnapshot({
        ...snapshot,
        peers: snapshot.peers.map((peer) =>
          peer.id === snapshot.selfId ? { ...peer, name } : peer,
        ),
      });
    }
  }

  retryConnection(peerId?: string): void {
    const ids = peerId ? [peerId] : [...this.handles.keys()];
    for (const id of ids) {
      const handle = this.handles.get(id);
      if (!handle) continue;
      this.setRetryCount(id, 0);
      if (handle.initiator) {
        this.dropPeer(id, "Reconnecting…", { silent: true });
        const fresh = this.ensurePeer(id, handle.snapshot.name, { recreate: true });
        void fresh.conn?.start();
      } else {
        handle.conn?.restartIce();
        this.signaling.sendRetry(id, 0);
      }
    }
  }

  dismissNotice(id: string): void {
    this.set({ notices: this.state.notices.filter((notice) => notice.id !== id) });
  }

  pushNotice(kind: Notice["kind"], title: string, body?: string): void {
    if (this.destroyed) return;
    const notice: Notice = {
      id: `n${(noticeCounter += 1)}`,
      kind,
      title,
      body,
      at: Date.now(),
    };
    this.set({ notices: [...this.state.notices, notice] });
  }

  /** Called by the UI after a device name change. Persists locally + relays. */
  updateLocalName(name: string): void {
    const identity = renameIdentity(name);
    void this.rename(identity.name).catch((error) => {
      console.warn("[dropwire] rename failed", error);
    });
  }
}
