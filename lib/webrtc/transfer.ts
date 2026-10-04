import type { TransferItem } from "../../types/transfer";
import {
  CHUNK_SIZE,
  CREDIT_WINDOW,
  HIGH_WATER_MARK,
  INCOMING_OFFER_TTL,
  PROTOCOL_VERSION,
  STREAM_THRESHOLD,
  type ControlMessage,
} from "../../types/transfer";
import { SpeedTracker, WakeSignal, buildFrame, parseFrame, readSlice } from "./chunks";

const PROGRESS_INTERVAL = 180;
const ACK_INTERVAL_BYTES = 4 * 1024 * 1024;
const ACK_INTERVAL_MS = 250;
const OFFER_TIMEOUT_MS = 90_000;
const SAVED_TIMEOUT_MS = 60_000;

class TransferCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "TransferCancelled";
  }
}

class TransferInterrupted extends Error {
  constructor() {
    super("interrupted");
    this.name = "TransferInterrupted";
  }
}

class TransferRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferRejected";
  }
}

class TransferFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferFailed";
  }
}

export interface IncomingOffer {
  id: string;
  seq: number;
  peerId: string;
  peerName: string;
  name: string;
  size: number;
  mime: string;
  lastModified: number;
  offeredAt: number;
}

export interface EngineCallbacks {
  /** Upsert a transfer row. The item is already cloned and safe for React. */
  onItem(item: TransferItem): void;
  /** The other device asked to send a file. */
  onIncoming(offer: IncomingOffer): void;
  /** The offer is no longer pending (accepted, declined or expired). */
  onIncomingResolved(id: string): void;
  /** Data channel handshake finished. */
  onReady(peerName: string): void;
}

interface OutRecord {
  seq: number;
  id: string;
  file: File;
  peerId: string;
  peerName: string;
  status: TransferItem["status"];
  sentBytes: number;
  ackedBytes: number;
  paused: boolean;
  cancelled: boolean;
  error: string | null;
  tracker: SpeedTracker;
  startedAt: number;
  updatedAt: number;
  remoteResponse: "accept" | "reject" | null;
  rejectReason: string | null;
  acceptWait: (() => void) | null;
  saved: boolean;
  savedWait: (() => void) | null;
  timer: ReturnType<typeof setTimeout> | null;
}

interface InRecord {
  seq: number;
  id: string;
  peerId: string;
  peerName: string;
  name: string;
  size: number;
  mime: string;
  lastModified: number;
  status: TransferItem["status"];
  received: number;
  lastAckBytes: number;
  lastAckAt: number;
  paused: boolean;
  doneSeen: boolean;
  error: string | null;
  tracker: SpeedTracker;
  startedAt: number;
  updatedAt: number;
  storedAs: "stream" | "memory" | null;
  downloadUrl: string | null;
}

interface FileWriteParams {
  type: "write";
  position?: number;
  data: ArrayBuffer | ArrayBufferView | string | Blob;
}

interface WritableLike {
  write(data: FileWriteParams): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

interface SavePickerWindow {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable: () => Promise<WritableLike> }>;
}

type SinkHandle = {
  storedAs: "stream" | "memory";
  write(chunk: ArrayBufferView): Promise<void>;
  finalize(): Promise<string | null>;
  abort(): Promise<void>;
};

const UNSAFE_NAME = /[/\\]/g;
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function safeName(name: string): string {
  const cleaned = name.replace(UNSAFE_NAME, "_").replace(CONTROL_CHARS, "").trim();
  return cleaned || "file";
}

function extensionOf(name: string): string | null {
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) return null;
  return name.slice(index).slice(0, 12);
}

const TERMINAL: TransferItem["status"][] = [
  "complete",
  "failed",
  "cancelled",
  "rejected",
  "interrupted",
];

/**
 * Moves bytes over one RTCDataChannel in both directions: chunked, ordered,
 * back-pressure aware, with progress that comes from real transfer state.
 */
export class TransferEngine {
  private readonly wake = new WakeSignal();
  private readonly outgoing = new Map<number, OutRecord>();
  private readonly incoming = new Map<number, InRecord>();
  private readonly offers = new Map<number, IncomingOffer>();
  private readonly sinks = new Map<number, SinkHandle>();
  private readonly pending: OutRecord[] = [];
  private pumping = false;
  private destroyed = false;
  private nextSeq = 1;
  private inbox: Promise<void> = Promise.resolve();
  private offerSweeper: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly peerId: string,
    private channel: RTCDataChannel,
    private peerName: string,
    private readonly callbacks: EngineCallbacks,
  ) {
    channel.binaryType = "arraybuffer";
    channel.onmessage = (event) =>
      this.routeMessage(event.data as string | ArrayBuffer);
    channel.addEventListener("bufferedamountlow", () => this.wake.notify());
    channel.addEventListener("open", () => this.sendHello());

    this.offerSweeper = setInterval(() => this.sweepOffers(), 5000);
    if (channel.readyState === "open") this.sendHello();
  }

  get ready(): boolean {
    return this.channel.readyState === "open";
  }

  get dataChannel(): RTCDataChannel {
    return this.channel;
  }

  get pendingOffers(): IncomingOffer[] {
    return [...this.offers.values()];
  }

  /* ---------------------------------------------------------------- *
   * sending
   * ---------------------------------------------------------------- */

  enqueue(files: File[]): TransferItem[] {
    const created: TransferItem[] = [];
    if (this.destroyed) return created;
    for (const file of files) {
      const seq = this.nextSeq++;
      const record: OutRecord = {
        seq,
        id: `out:${this.peerId}:${seq}`,
        file,
        peerId: this.peerId,
        peerName: this.peerName,
        status: "queued",
        sentBytes: 0,
        ackedBytes: 0,
        paused: false,
        cancelled: false,
        error: null,
        tracker: new SpeedTracker(),
        startedAt: Date.now(),
        updatedAt: Date.now(),
        remoteResponse: null,
        rejectReason: null,
        acceptWait: null,
        saved: false,
        savedWait: null,
        timer: null,
      };
      this.outgoing.set(seq, record);
      this.pending.push(record);
      created.push(this.snapshot(record));
      this.emit(record);
    }
    void this.pumpQueue();
    return created;
  }

  pause(id: string): void {
    const record = this.findOut(id);
    if (!record || TERMINAL.includes(record.status)) return;
    record.paused = true;
    this.setStatus(record, "paused");
    this.sendControl({ t: "pause", id: record.seq });
    this.wake.notify();
  }

  resume(id: string): void {
    const record = this.findOut(id);
    if (!record || record.cancelled || TERMINAL.includes(record.status)) return;
    record.paused = false;
    this.setStatus(record, record.sentBytes > 0 ? "sending" : "queued");
    this.sendControl({ t: "resume", id: record.seq });
    this.wake.notify();
    void this.pumpQueue();
  }

  cancel(id: string): void {
    const record = this.findOut(id);
    if (!record || record.status === "complete") return;
    record.cancelled = true;
    const index = this.pending.indexOf(record);
    if (index >= 0) this.pending.splice(index, 1);
    record.acceptWait?.();
    record.acceptWait = null;
    record.savedWait?.();
    record.savedWait = null;
    if (record.timer) clearTimeout(record.timer);
    record.timer = null;
    this.sendControl({ t: "cancel", id: record.seq, by: "sender" });
    this.finishOutgoing(record, "cancelled", "Cancelled.");
    void this.pumpQueue();
  }

  pauseAll(): void {
    for (const record of this.outgoing.values()) {
      if (["queued", "preparing", "connecting", "sending"].includes(record.status)) {
        this.pause(record.id);
      }
    }
  }

  resumeAll(): void {
    for (const record of this.outgoing.values()) {
      if (record.status === "paused") this.resume(record.id);
    }
  }

  cancelAll(): void {
    for (const record of this.outgoing.values()) {
      if (!TERMINAL.includes(record.status)) this.cancel(record.id);
    }
  }

  /** Puts a finished/failed/cancelled transfer back into the queue. */
  retry(id: string): void {
    const record = this.findOut(id);
    if (!record || this.destroyed) return;
    if (!TERMINAL.includes(record.status)) return;
    record.sentBytes = 0;
    record.ackedBytes = 0;
    record.paused = false;
    record.cancelled = false;
    record.error = null;
    record.remoteResponse = null;
    record.rejectReason = null;
    record.saved = false;
    record.acceptWait = null;
    record.savedWait = null;
    record.tracker = new SpeedTracker();
    record.startedAt = Date.now();
    this.outgoing.set(record.seq, record);
    this.setStatus(record, "queued");
    if (!this.pending.includes(record)) this.pending.push(record);
    void this.pumpQueue();
  }

  /* ---------------------------------------------------------------- *
   * receiving
   * ---------------------------------------------------------------- */

  async accept(id: string): Promise<boolean> {
    const offer = [...this.offers.values()].find((entry) => entry.id === id);
    if (!offer || this.destroyed) return false;

    const seq = offer.seq;
    let sink: SinkHandle;
    try {
      sink = await this.createSink(offer.name, offer.size, offer.mime);
    } catch (error) {
      if (isAbortError(error)) {
        this.offers.delete(seq);
        this.sendControl({ t: "reject", id: seq, reason: "cancelled" });
        this.callbacks.onIncomingResolved(offer.id);
        return false;
      }
      sink = await this.createMemorySink(offer.mime);
    }

    if (this.destroyed || !this.offers.has(seq)) {
      void sink.abort();
      return false;
    }

    const record: InRecord = {
      seq,
      id: offer.id,
      peerId: offer.peerId,
      peerName: offer.peerName,
      name: safeName(offer.name).slice(0, 180),
      size: offer.size,
      mime: offer.mime,
      lastModified: offer.lastModified,
      status: "receiving",
      received: 0,
      lastAckBytes: 0,
      lastAckAt: Date.now(),
      paused: false,
      doneSeen: false,
      error: null,
      tracker: new SpeedTracker(),
      startedAt: Date.now(),
      updatedAt: Date.now(),
      storedAs: sink.storedAs,
      downloadUrl: null,
    };

    this.offers.delete(seq);
    this.sinks.set(seq, sink);
    this.incoming.set(seq, record);
    this.callbacks.onIncomingResolved(offer.id);
    this.sendControl({ t: "accept", id: seq });
    record.tracker.begin(0);
    this.emit(record, true);
    return true;
  }

  reject(id: string, reason = "declined"): void {
    const offer = [...this.offers.values()].find((entry) => entry.id === id);
    if (!offer) return;
    this.offers.delete(offer.seq);
    this.sendControl({ t: "reject", id: offer.seq, reason });
    this.callbacks.onIncomingResolved(offer.id);
  }

  pauseIncoming(id: string): void {
    const record = this.findIn(id);
    if (!record || record.status !== "receiving") return;
    record.paused = true;
    this.setStatus(record, "paused");
    this.sendControl({ t: "pause", id: record.seq });
  }

  resumeIncoming(id: string): void {
    const record = this.findIn(id);
    if (!record || !record.paused) return;
    record.paused = false;
    this.setStatus(record, "receiving");
    this.sendControl({ t: "resume", id: record.seq });
    this.wake.notify();
  }

  cancelIncoming(id: string): void {
    const record = this.findIn(id);
    if (!record || record.status === "complete") return;
    this.abortIncoming(record, "cancelled", "Cancelled.", true);
  }

  /* ---------------------------------------------------------------- *
   * message plumbing
   * ---------------------------------------------------------------- */

  private sendHello(): void {
    if (this.destroyed) return;
    this.sendControl({ t: "hello", v: PROTOCOL_VERSION, name: this.peerName });
  }

  private sendControl(message: ControlMessage): void {
    if (this.destroyed) return;
    if (this.channel.readyState !== "open") return;
    try {
      this.channel.send(JSON.stringify(message));
    } catch (error) {
      console.warn("[dropwire] control message failed", error);
    }
  }

  private routeMessage(data: string | ArrayBuffer): void {
    if (this.destroyed) return;
    if (typeof data === "string") {
      this.inbox = this.inbox
        .then(() => this.handleControl(data))
        .catch((error) => console.warn("[dropwire] control handling failed", error));
      return;
    }
    this.inbox = this.inbox
      .then(() => this.handleBinary(data))
      .catch((error) => console.warn("[dropwire] chunk handling failed", error));
  }

  private async handleControl(raw: string): Promise<void> {
    let message: ControlMessage;
    try {
      message = JSON.parse(raw) as ControlMessage;
    } catch {
      return;
    }

    switch (message.t) {
      case "hello": {
        if (message.v !== PROTOCOL_VERSION) {
          console.warn("[dropwire] protocol version mismatch", message.v);
        }
        if (typeof message.name === "string" && message.name) {
          this.peerName = message.name.slice(0, 32);
        }
        this.callbacks.onReady(this.peerName);
        break;
      }
      case "offer": {
        if (
          !message.id ||
          this.offers.has(message.id) ||
          this.incoming.has(message.id) ||
          typeof message.name !== "string" ||
          !message.name ||
          !Number.isFinite(message.size) ||
          message.size < 0
        ) {
          return;
        }
        const offer: IncomingOffer = {
          id: `in:${this.peerId}:${message.id}`,
          seq: message.id,
          peerId: this.peerId,
          peerName: this.peerName,
          name: safeName(message.name).slice(0, 180),
          size: Math.floor(message.size),
          mime:
            typeof message.mime === "string" && message.mime
              ? message.mime.slice(0, 120)
              : "application/octet-stream",
          lastModified:
            Number.isFinite(message.lastModified) && message.lastModified > 0
              ? message.lastModified
              : Date.now(),
          offeredAt: Date.now(),
        };
        this.offers.set(message.id, offer);
        this.callbacks.onIncoming(offer);
        break;
      }
      case "accept": {
        const record = this.outgoing.get(message.id);
        if (!record) return;
        record.remoteResponse = "accept";
        if (record.timer) clearTimeout(record.timer);
        record.timer = null;
        record.acceptWait?.();
        record.acceptWait = null;
        break;
      }
      case "reject": {
        const record = this.outgoing.get(message.id);
        if (!record) return;
        record.remoteResponse = "reject";
        record.rejectReason = message.reason ?? "declined";
        if (record.timer) clearTimeout(record.timer);
        record.timer = null;
        record.acceptWait?.();
        record.acceptWait = null;
        break;
      }
      case "pause": {
        const out = this.outgoing.get(message.id);
        if (out && !TERMINAL.includes(out.status)) {
          out.paused = true;
          this.setStatus(out, "paused");
          break;
        }
        const incoming = this.incoming.get(message.id);
        if (incoming) {
          incoming.paused = true;
          this.setStatus(incoming, "paused");
        }
        break;
      }
      case "resume": {
        const out = this.outgoing.get(message.id);
        if (out && !TERMINAL.includes(out.status)) {
          out.paused = false;
          this.setStatus(out, out.sentBytes > 0 ? "sending" : "queued");
          this.wake.notify();
          break;
        }
        const incoming = this.incoming.get(message.id);
        if (incoming) {
          incoming.paused = false;
          this.setStatus(incoming, "receiving");
          this.wake.notify();
        }
        break;
      }
      case "cancel": {
        if (message.by === "receiver") {
          const out = this.outgoing.get(message.id);
          if (out && !TERMINAL.includes(out.status)) {
            this.finishOutgoing(out, "cancelled", "Cancelled by the receiver.");
          }
          break;
        }
        const incoming = this.incoming.get(message.id);
        if (incoming) {
          this.abortIncoming(incoming, "cancelled", "Cancelled.", false);
        }
        break;
      }
      case "ack": {
        const record = this.outgoing.get(message.id);
        if (!record) return;
        record.ackedBytes = Math.max(record.ackedBytes, message.bytes ?? 0);
        this.wake.notify();
        break;
      }
      case "saved": {
        const record = this.outgoing.get(message.id);
        if (!record) return;
        record.saved = true;
        if (record.timer) clearTimeout(record.timer);
        record.timer = null;
        record.savedWait?.();
        record.savedWait = null;
        this.wake.notify();
        break;
      }
      case "done": {
        const record = this.incoming.get(message.id);
        if (!record) break;
        record.doneSeen = true;
        if (record.received >= record.size) await this.finalizeIncoming(record);
        break;
      }
      case "error": {
        const record = this.outgoing.get(message.id);
        if (!record) return;
        this.finishOutgoing(record, "failed", message.message || "Transfer failed.");
        break;
      }
      default:
        break;
    }
  }

  private async handleBinary(frame: ArrayBuffer): Promise<void> {
    const parsed = parseFrame(frame);
    if (!parsed) return;
    const record = this.incoming.get(parsed.seq);
    if (!record || record.status === "complete") return;
    if (record.received >= record.size) return;

    const sink = this.sinks.get(parsed.seq);
    if (!sink) return;

    const remaining = record.size - record.received;
    const chunk =
      parsed.payload.byteLength > remaining
        ? parsed.payload.subarray(0, remaining)
        : parsed.payload;

    try {
      await sink.write(chunk);
    } catch (error) {
      console.warn("[dropwire] write failed", error);
      this.abortIncoming(
        record,
        "failed",
        "Couldn't write the file on this device.",
        false,
      );
      this.sendControl({
        t: "error",
        id: record.seq,
        message: "The receiver could not store the file.",
      });
      return;
    }

    record.received += chunk.byteLength;
    record.updatedAt = Date.now();
    record.tracker.sample(record.received);
    this.maybeAck(record);
    this.emitThrottled(record);

    if (record.received >= record.size && record.doneSeen) {
      await this.finalizeIncoming(record);
    }
  }

  private maybeAck(record: InRecord): void {
    const now = Date.now();
    if (
      record.received - record.lastAckBytes >= ACK_INTERVAL_BYTES ||
      now - record.lastAckAt >= ACK_INTERVAL_MS
    ) {
      record.lastAckBytes = record.received;
      record.lastAckAt = now;
      this.sendControl({ t: "ack", id: record.seq, bytes: record.received });
    }
  }

  private async finalizeIncoming(record: InRecord): Promise<void> {
    if (record.status === "complete") return;
    const sink = this.sinks.get(record.seq);
    if (!sink) return;
    try {
      const url = await sink.finalize();
      this.sinks.delete(record.seq);
      record.downloadUrl = url;
      record.storedAs = sink.storedAs;
      record.tracker.sample(record.received);
      this.setStatus(record, "complete");
      this.emit(record, true);
      this.sendControl({ t: "ack", id: record.seq, bytes: record.received });
      this.sendControl({ t: "saved", id: record.seq });
      if (url) this.autoDownload(url, record.name);
    } catch (error) {
      console.warn("[dropwire] finalize failed", error);
      this.abortIncoming(
        record,
        "failed",
        "Couldn't finish writing the file.",
        false,
      );
      this.sendControl({
        t: "error",
        id: record.seq,
        message: "The receiver could not store the file.",
      });
    }
  }

  private abortIncoming(
    record: InRecord,
    status: TransferItem["status"],
    error: string | null,
    notifyRemote: boolean,
  ): void {
    const sink = this.sinks.get(record.seq);
    this.sinks.delete(record.seq);
    void sink?.abort();
    this.incoming.delete(record.seq);
    record.error = error;
    record.paused = false;
    record.updatedAt = Date.now();
    record.status = status;
    this.emit(record, true);
    if (notifyRemote) {
      this.sendControl({ t: "cancel", id: record.seq, by: "receiver" });
    }
    this.wake.notify();
  }

  private autoDownload(url: string, name: string): void {
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.rel = "noopener";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      // the "Save file" button stays available in the queue
    }
  }

  /* ---------------------------------------------------------------- *
   * outgoing pump
   * ---------------------------------------------------------------- */

  private async pumpQueue(): Promise<void> {
    if (this.pumping || this.destroyed) return;
    this.pumping = true;
    try {
      while (this.pending.length > 0 && !this.destroyed) {
        const record = this.pending[0];
        if (record.cancelled) {
          this.pending.shift();
          continue;
        }
        await this.sendOne(record);
        const index = this.pending.indexOf(record);
        if (index >= 0) this.pending.splice(index, 1);
      }
    } finally {
      this.pumping = false;
    }
  }

  private async sendOne(record: OutRecord): Promise<void> {
    try {
      this.setStatus(record, "queued");
      await this.waitForChannel();
      if (record.cancelled) throw new TransferCancelled();

      this.setStatus(record, "preparing");
      record.tracker.begin(0);
      this.sendControl({
        t: "offer",
        id: record.seq,
        name: record.file.name,
        size: record.file.size,
        mime: record.file.type || "application/octet-stream",
        lastModified: record.file.lastModified || Date.now(),
      });

      this.setStatus(record, "connecting");
      await this.waitForAccept(record);
      if (record.cancelled) throw new TransferCancelled();

      this.setStatus(record, "sending");
      let offset = 0;
      while (offset < record.file.size) {
        await this.waitUntilSendable(record);
        const end = Math.min(offset + CHUNK_SIZE, record.file.size);
        const buffer = await readSlice(record.file, offset, end);
        if (record.cancelled) throw new TransferCancelled();
        if (this.channel.readyState !== "open") throw new TransferInterrupted();
        this.channel.send(buildFrame(record.seq, buffer));
        offset += buffer.byteLength;
        record.sentBytes = offset;
        record.tracker.sample(offset);
        this.emitThrottled(record);
      }

      this.sendControl({ t: "done", id: record.seq });
      await this.waitForSaved(record);

      record.tracker.sample(record.sentBytes);
      this.finishOutgoing(record, "complete", null);
    } catch (error) {
      if (error instanceof TransferCancelled) {
        this.finishOutgoing(record, "cancelled", "Cancelled.");
      } else if (error instanceof TransferRejected) {
        const declined = record.rejectReason !== "cancelled";
        this.finishOutgoing(
          record,
          declined ? "rejected" : "cancelled",
          declined
            ? record.rejectReason === "expired"
              ? "The other device didn't respond in time."
              : "The other device declined this file."
            : "Cancelled by the other device.",
        );
      } else if (error instanceof TransferInterrupted) {
        this.finishOutgoing(
          record,
          "interrupted",
          "The connection dropped before this file finished.",
        );
      } else if (error instanceof TransferFailed) {
        this.finishOutgoing(record, "failed", error.message);
      } else {
        console.warn("[dropwire] transfer failed", error);
        this.finishOutgoing(
          record,
          "failed",
          error instanceof Error && error.message
            ? error.message
            : "This file couldn't be sent.",
        );
      }
    }
  }

  private async waitForChannel(): Promise<void> {
    while (true) {
      if (this.destroyed) throw new TransferInterrupted();
      if (this.channel.readyState === "open") return;
      if (this.channel.readyState === "closed") throw new TransferInterrupted();
      await this.wake.wait(400);
    }
  }

  private async waitUntilSendable(record: OutRecord): Promise<void> {
    while (true) {
      if (this.destroyed) throw new TransferInterrupted();
      if (record.cancelled) throw new TransferCancelled();
      if (this.channel.readyState !== "open") throw new TransferInterrupted();
      if (record.paused) {
        await this.wake.wait(400);
        continue;
      }
      const buffered = this.channel.bufferedAmount;
      const inflight = record.sentBytes - record.ackedBytes;
      if (buffered <= HIGH_WATER_MARK && inflight <= CREDIT_WINDOW) return;
      await this.wake.wait(400);
    }
  }

  private waitForAccept(record: OutRecord): Promise<void> {
    if (record.remoteResponse === "accept") return Promise.resolve();
    if (record.remoteResponse === "reject") {
      return Promise.reject(new TransferRejected(record.rejectReason ?? "rejected"));
    }
    return new Promise<void>((resolve, reject) => {
      record.acceptWait = () => {
        if (record.remoteResponse === "accept") resolve();
        else reject(new TransferRejected(record.rejectReason ?? "rejected"));
      };
      record.timer = setTimeout(() => {
        record.timer = null;
        reject(new TransferFailed("The other device didn't respond in time."));
      }, OFFER_TIMEOUT_MS);
    });
  }

  private waitForSaved(record: OutRecord): Promise<void> {
    if (record.saved) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      record.savedWait = () => {
        if (record.cancelled) reject(new TransferCancelled());
        else resolve();
      };
      record.timer = setTimeout(() => {
        record.timer = null;
        reject(new TransferFailed("The other device didn't confirm the file."));
      }, SAVED_TIMEOUT_MS);
    });
  }

  private finishOutgoing(
    record: OutRecord,
    status: TransferItem["status"],
    error: string | null,
  ): void {
    if (record.timer) clearTimeout(record.timer);
    record.timer = null;
    record.acceptWait = null;
    record.savedWait = null;
    record.error = error;
    record.paused = false;
    record.updatedAt = Date.now();
    if (record.status === status && TERMINAL.includes(status)) return;
    record.status = status;
    if (status === "complete") record.sentBytes = record.file.size;
    this.emit(record, true);
    this.wake.notify();
    void this.pumpQueue();
  }

  /* ---------------------------------------------------------------- *
   * receive sinks
   * ---------------------------------------------------------------- */

  private async createSink(
    name: string,
    size: number,
    mime: string,
  ): Promise<SinkHandle> {
    const picker = (globalThis as unknown as SavePickerWindow).showSaveFilePicker;
    if (size >= STREAM_THRESHOLD && typeof picker === "function") {
      try {
        const options: {
          suggestedName?: string;
          types?: { description?: string; accept: Record<string, string[]> }[];
        } = { suggestedName: name };
        const extension = extensionOf(name);
        if (extension) {
          options.types = [
            {
              description: extension.replace(".", "").toUpperCase(),
              accept: { [mime]: [extension] },
            },
          ];
        }
        const handle = await picker(options);
        const writer = await handle.createWritable();
        let position = 0;
        return {
          storedAs: "stream",
          write: async (chunk) => {
            await writer.write({ type: "write", position, data: chunk });
            position += chunk.byteLength;
          },
          finalize: async () => {
            await writer.close();
            return null;
          },
          abort: async () => {
            try {
              await writer.abort();
            } catch {
              // already closed
            }
          },
        };
      } catch (error) {
        if (isAbortError(error)) throw error;
        console.debug("[dropwire] save picker unavailable, buffering in memory", error);
      }
    }
    return this.createMemorySink(mime);
  }

  private async createMemorySink(mime: string): Promise<SinkHandle> {
    const parts: ArrayBufferView[] = [];
    return {
      storedAs: "memory",
      write: async (chunk) => {
        parts.push(chunk);
      },
      finalize: async () => {
        const blob = new Blob(parts as BlobPart[], { type: mime });
        parts.length = 0;
        return URL.createObjectURL(blob);
      },
      abort: async () => {
        parts.length = 0;
      },
    };
  }

  /* ---------------------------------------------------------------- *
   * helpers
   * ---------------------------------------------------------------- */

  private setStatus(record: OutRecord | InRecord, status: TransferItem["status"]) {
    if (record.status === status) return;
    record.status = status;
    record.updatedAt = Date.now();
    this.emit(record, true);
  }

  private emitThrottled(record: OutRecord | InRecord): void {
    if (Date.now() - record.updatedAt >= PROGRESS_INTERVAL) this.emit(record);
  }

  private emit(record: OutRecord | InRecord, force = false): void {
    if (this.destroyed && !force) return;
    this.callbacks.onItem(this.snapshot(record));
  }

  private snapshot(record: OutRecord | InRecord): TransferItem {
    if ("file" in record) {
      const out = record;
      const size = out.file.size;
      const remaining = Math.max(0, size - out.sentBytes);
      const live = out.status === "sending";
      return {
        id: out.id,
        seq: out.seq,
        peerId: out.peerId,
        peerName: out.peerName,
        direction: "out",
        name: out.file.name,
        size,
        mime: out.file.type || "application/octet-stream",
        lastModified: out.file.lastModified,
        status: out.status,
        bytes: out.sentBytes,
        speed: live ? out.tracker.speed : 0,
        avgSpeed: out.tracker.average,
        etaSeconds:
          out.status === "complete"
            ? 0
            : out.status === "sending"
              ? remaining === 0
                ? 0
                : out.tracker.eta(remaining)
              : null,
        error: out.error,
        storedAs: null,
        downloadUrl: null,
        startedAt: out.startedAt,
        updatedAt: out.updatedAt,
      };
    }

    const incoming = record;
    const remaining = Math.max(0, incoming.size - incoming.received);
    const live = incoming.status === "receiving";
    return {
      id: incoming.id,
      seq: incoming.seq,
      peerId: incoming.peerId,
      peerName: incoming.peerName,
      direction: "in",
      name: incoming.name,
      size: incoming.size,
      mime: incoming.mime,
      lastModified: incoming.lastModified,
      status: incoming.status,
      bytes: incoming.received,
      speed: live ? incoming.tracker.speed : 0,
      avgSpeed: incoming.tracker.average,
      etaSeconds:
        incoming.status === "complete"
          ? 0
          : incoming.status === "receiving"
            ? remaining === 0
              ? 0
              : incoming.tracker.eta(remaining)
            : null,
      error: incoming.error,
      storedAs: incoming.storedAs,
      downloadUrl: incoming.downloadUrl,
      startedAt: incoming.startedAt,
      updatedAt: incoming.updatedAt,
    };
  }

  private sweepOffers(): void {
    const now = Date.now();
    for (const [seq, offer] of this.offers) {
      if (now - offer.offeredAt > INCOMING_OFFER_TTL) {
        this.offers.delete(seq);
        this.sendControl({ t: "reject", id: seq, reason: "expired" });
        this.callbacks.onIncomingResolved(offer.id);
      }
    }
  }

  private findOut(id: string): OutRecord | undefined {
    for (const value of this.outgoing.values()) if (value.id === id) return value;
    return undefined;
  }

  private findIn(id: string): InRecord | undefined {
    for (const value of this.incoming.values()) if (value.id === id) return value;
    return undefined;
  }

  destroy(reason = "The connection closed."): void {
    if (this.destroyed) return;

    for (const offer of this.offers.values()) {
      this.sendControl({ t: "reject", id: offer.seq, reason: "disconnected" });
      this.callbacks.onIncomingResolved(offer.id);
    }
    this.offers.clear();

    this.destroyed = true;
    if (this.offerSweeper) clearInterval(this.offerSweeper);
    this.offerSweeper = null;
    this.wake.notify();

    for (const record of this.outgoing.values()) {
      if (record.timer) clearTimeout(record.timer);
      record.acceptWait?.();
      record.savedWait?.();
      if (!TERMINAL.includes(record.status)) {
        record.error = reason;
        record.status = "interrupted";
        record.updatedAt = Date.now();
        this.callbacks.onItem(this.snapshot(record));
      }
    }

    for (const record of this.incoming.values()) {
      const sink = this.sinks.get(record.seq);
      void sink?.abort();
      if (record.status !== "complete") {
        record.status = "interrupted";
        record.error = reason;
        record.updatedAt = Date.now();
        this.callbacks.onItem(this.snapshot(record));
      }
    }
    this.sinks.clear();
    this.incoming.clear();
    this.pending.length = 0;
    this.wake.dispose();

    try {
      this.channel.onmessage = null;
      this.channel.close();
    } catch {
      // ignore
    }
  }
}
