import type { PeerPhase, RouteKind } from "../../types/peer";
import { LOW_WATER_MARK } from "../../types/transfer";

export interface PeerConnectionCallbacks {
  sendOffer(sdp: RTCSessionDescriptionInit): void;
  sendAnswer(sdp: RTCSessionDescriptionInit): void;
  sendIce(candidate: RTCIceCandidateInit | null): void;
  onPhaseChange(phase: PeerPhase, detail?: string): void;
  onRouteChange(route: RouteKind): void;
  onChannelOpen(channel: RTCDataChannel): void;
  onChannelClose(): void;
}

export const CHANNEL_LABEL = "dropwire";

interface StatsEntry {
  type?: string;
  state?: string;
  nominated?: boolean;
  localCandidateId?: string;
  candidateType?: string;
}

/**
 * Thin wrapper around RTCPeerConnection: offer/answer, ICE queueing, route
 * detection and the single reliable data channel used for transfers.
 */
export class PeerConnection {
  readonly peerId: string;
  readonly pc: RTCPeerConnection;

  private channel: RTCDataChannel | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private makingOffer = false;
  private phase: PeerPhase = "idle";
  private closed = false;
  private routeDetectToken = 0;

  constructor(
    peerId: string,
    private readonly isInitiator: boolean,
    iceServers: RTCIceServer[],
    private readonly callbacks: PeerConnectionCallbacks,
  ) {
    this.peerId = peerId;
    this.pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 4,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });

    this.pc.onicecandidate = (event) => {
      this.callbacks.sendIce(event.candidate?.toJSON() ?? null);
    };

    this.pc.onicecandidateerror = (event) => {
      // Common and non-fatal: a single STUN server being unreachable.
      if (event.errorCode === 701) return;
      console.debug(
        `[dropwire] ice candidate error ${event.errorCode} (${event.errorText})`,
      );
    };

    this.pc.onconnectionstatechange = () => this.syncPhase();
    this.pc.oniceconnectionstatechange = () => {
      this.syncPhase();
      if (this.pc.iceConnectionState === "connected") void this.detectRoute();
    };
    this.pc.onicegatheringstatechange = () => {
      if (this.pc.iceGatheringState === "complete") void this.detectRoute();
    };

    this.pc.ondatachannel = (event) => {
      this.attachChannel(event.channel);
    };
  }

  get isOpen(): boolean {
    return this.channel?.readyState === "open";
  }

  get channelState(): RTCDataChannelState | "none" {
    return this.channel?.readyState ?? "none";
  }

  get currentPhase(): PeerPhase {
    return this.phase;
  }

  /** Initiator: creates the channel and sends the first offer. */
  async start(): Promise<void> {
    if (!this.isInitiator) return;
    if (!this.channel) {
      this.attachChannel(this.pc.createDataChannel(CHANNEL_LABEL, { ordered: true }));
    }
    await this.negotiate(true);
  }

  async handleOffer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (this.closed) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.remoteDescriptionSet = true;
    await this.flushCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    if (this.pc.localDescription) {
      this.callbacks.sendAnswer(this.pc.localDescription.toJSON());
    }
    void this.detectRoute();
  }

  async handleAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (this.closed) return;
    if (this.pc.signalingState !== "have-local-offer") return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.remoteDescriptionSet = true;
    await this.flushCandidates();
    void this.detectRoute();
  }

  async handleIce(candidate: RTCIceCandidateInit | null): Promise<void> {
    if (this.closed || !candidate) return;
    if (!this.remoteDescriptionSet) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.debug("[dropwire] failed to add ice candidate", error);
    }
  }

  /** Only the initiator renegotiates, which keeps glare impossible. */
  async negotiate(iceRestart = false): Promise<void> {
    if (!this.isInitiator || this.closed) return;
    if (this.makingOffer) return;
    if (!iceRestart && this.pc.signalingState !== "stable") return;
    this.makingOffer = true;
    try {
      const offer = await this.pc.createOffer(iceRestart ? { iceRestart: true } : {});
      if (this.closed) return;
      await this.pc.setLocalDescription(offer);
      if (this.pc.localDescription) {
        this.callbacks.sendOffer(this.pc.localDescription.toJSON());
      }
      this.syncPhase();
    } finally {
      this.makingOffer = false;
    }
  }

  restartIce(): void {
    if (this.closed) return;
    if (typeof this.pc.restartIce === "function") this.pc.restartIce();
    void this.negotiate(true);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.routeDetectToken += 1;
    try {
      this.channel?.close();
    } catch {
      // ignore
    }
    this.channel = null;
    try {
      this.pc.close();
    } catch {
      // ignore
    }
    this.pendingCandidates = [];
    this.setPhase("idle");
  }

  private attachChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = LOW_WATER_MARK;
    channel.onopen = () => {
      this.syncPhase();
      this.callbacks.onChannelOpen(channel);
      void this.detectRoute();
    };
    channel.onclose = () => {
      this.syncPhase();
      this.callbacks.onChannelClose();
    };
    channel.onerror = () => {
      console.warn("[dropwire] data channel error");
    };
    if (channel.readyState === "open") {
      queueMicrotask(() => {
        this.syncPhase();
        this.callbacks.onChannelOpen(channel);
      });
    }
  }

  private async flushCandidates(): Promise<void> {
    const queued = this.pendingCandidates.splice(0);
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.debug("[dropwire] failed to add queued ice candidate", error);
      }
    }
  }

  private syncPhase(): void {
    if (this.closed) return;
    const state = this.pc.connectionState;
    let next: PeerPhase = this.phase;
    if (state === "failed") next = "failed";
    else if (state === "disconnected") next = "reconnecting";
    else if (state === "closed") next = "idle";
    else if (state === "connected") next = this.isOpen ? "connected" : "connecting";
    else if (state === "connecting" || state === "new") {
      next = this.phase === "connected" ? "reconnecting" : "connecting";
    }
    if (this.channel?.readyState === "closing" && next === "connected") {
      next = "reconnecting";
    }
    this.setPhase(next);
  }

  private setPhase(next: PeerPhase): void {
    if (this.phase === next) return;
    this.phase = next;
    this.callbacks.onPhaseChange(next, this.pc.connectionState);
    if (next === "connected") void this.detectRoute();
  }

  /**
   * Asks the browser which ICE candidate pair is actually carrying the bytes
   * so the UI can say "direct" versus "relayed".
   */
  async detectRoute(): Promise<RouteKind> {
    const token = ++this.routeDetectToken;
    try {
      const report = await this.pc.getStats();
      if (token !== this.routeDetectToken) return "unknown";
      let route: RouteKind = "unknown";
      const pairs: StatsEntry[] = [];
      report.forEach((entry: unknown) => {
        const stat = entry as StatsEntry;
        if (
          (stat.type === "candidate-pair" || stat.type === "candidatePair") &&
          (stat.state === "succeeded" || stat.nominated)
        ) {
          pairs.push(stat);
        }
      });
      for (const pair of pairs) {
        const local = report.get(String(pair.localCandidateId)) as
          | StatsEntry
          | undefined;
        const type = String(local?.candidateType ?? "");
        if (type === "relay") {
          route = "relay";
          break;
        }
        if (type && route === "unknown") route = "direct";
      }
      if (route !== "unknown") this.callbacks.onRouteChange(route);
      return route;
    } catch (error) {
      console.debug("[dropwire] stats unavailable", error);
      return "unknown";
    }
  }
}
