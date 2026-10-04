import assert from "node:assert/strict";
import { test } from "node:test";
import { TransferEngine, type IncomingOffer } from "../lib/webrtc/transfer";
import { parseFrame } from "../lib/webrtc/chunks";
import type { TransferItem } from "../types/transfer";

/**
 * A pair of fake RTCDataChannels. Everything one engine sends is delivered to
 * the other on the next macrotask, with a little buffering so backpressure
 * behaves roughly like a real socket.
 */
class FakeChannel {
  readyState: "connecting" | "open" | "closing" | "closed" = "open";
  binaryType: BinaryType = "blob";
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 64 * 1024;
  peer: FakeChannel | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  /** Everything this channel has been asked to send (test observability). */
  readonly sent: Array<string | ArrayBuffer> = [];

  private listeners = new Map<string, Set<(event: unknown) => void>>();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  private dispatch(type: string, event: unknown = {}): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  private readonly outbox: Array<{ payload: string | ArrayBuffer; bytes: number }> = [];
  private flushing = false;

  send(data: string | ArrayBuffer | ArrayBufferView): void {
    if (this.readyState !== "open") throw new Error("channel is not open");

    const payload =
      typeof data === "string"
        ? data
        : data instanceof ArrayBuffer
          ? data
          : (data.buffer.slice(
              data.byteOffset,
              data.byteOffset + data.byteLength,
            ) as ArrayBuffer);
    const bytes = typeof payload === "string" ? payload.length : payload.byteLength;

    this.sent.push(payload);
    this.bufferedAmount += bytes;
    this.outbox.push({ payload, bytes });
    void this.flushOutbox();
  }

  /** One message per macrotask, so senders feel real pacing + backpressure. */
  private async flushOutbox(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (this.outbox.length > 0) {
        const item = this.outbox.shift();
        if (!item) break;
        this.bufferedAmount = Math.max(0, this.bufferedAmount - item.bytes);
        if (this.bufferedAmount <= this.bufferedAmountLowThreshold) {
          this.dispatch("bufferedamountlow");
        }
        const target = this.peer;
        if (target && target.readyState !== "closed") {
          target.onmessage?.({ data: item.payload });
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    } finally {
      this.flushing = false;
    }
  }

  close(): void {
    if (this.readyState === "closed") return;
    this.readyState = "closed";
    this.dispatch("close");
    const peer = this.peer;
    if (peer && peer.readyState !== "closed") peer.close();
  }
}

function pair(): [FakeChannel, FakeChannel] {
  const a = new FakeChannel();
  const b = new FakeChannel();
  a.peer = b;
  b.peer = a;
  return [a, b];
}

// The memory save path builds an object URL when the transfer completes; Node
// does not ship URL.createObjectURL, so give the test a stand-in.
const urlApi = URL as unknown as { createObjectURL?: (blob: Blob) => string };
let objectUrlCounter = 0;
if (typeof urlApi.createObjectURL !== "function") {
  urlApi.createObjectURL = () => `blob:test-${(objectUrlCounter += 1)}`;
}

interface Harness {
  sender: TransferEngine;
  receiver: TransferEngine;
  senderItems: Map<string, TransferItem>;
  receiverItems: Map<string, TransferItem>;
  offers: IncomingOffer[];
  frames: ArrayBuffer[];
}

function harness(name: string): Harness {
  const [chanA, chanB] = pair();
  const senderItems = new Map<string, TransferItem>();
  const receiverItems = new Map<string, TransferItem>();
  const offers: IncomingOffer[] = [];
  const frames: ArrayBuffer[] = [];

  const sender = new TransferEngine("peer-b", chanA as unknown as RTCDataChannel, "Bob", {
    onItem: (item) => senderItems.set(item.id, item),
    onIncoming: () => undefined,
    onIncomingResolved: () => undefined,
    onReady: () => undefined,
  });

  const receiver = new TransferEngine("peer-a", chanB as unknown as RTCDataChannel, "Alice", {
    onItem: (item) => receiverItems.set(item.id, item),
    onIncoming: (offer) => offers.push(offer),
    onIncomingResolved: (id) => {
      const index = offers.findIndex((offer) => offer.id === id);
      if (index >= 0) offers.splice(index, 1);
    },
    onReady: () => undefined,
  });

  // Record binary frames as they arrive so the payload can be reassembled.
  const originalOnMessage = chanB.onmessage;
  chanB.onmessage = (event) => {
    if (typeof event.data !== "string") frames.push(event.data as ArrayBuffer);
    originalOnMessage?.(event);
  };

  void name;
  return { sender, receiver, senderItems, receiverItems, offers, frames };
}

async function waitFor(
  predicate: () => boolean,
  label: string,
  timeoutMs = 5000,
): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function bytes(size: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) out[i] = (i * 131 + (i >> 8)) % 256;
  return out;
}

test("chunks a file, hands it over and reports progress on both sides", async () => {
  const h = harness("happy");
  const payload = bytes(300 * 1024 + 12345);
  const file = new File([payload], "payload.bin", { type: "application/octet-stream" });

  const created = h.sender.enqueue([file]);
  assert.equal(created.length, 1);
  assert.equal(created[0].direction, "out");
  assert.equal(created[0].status, "queued");
  assert.equal(created[0].size, file.size);

  await waitFor(() => h.offers.length === 1, "incoming offer");
  const offer = h.offers[0];
  assert.equal(offer.name, "payload.bin");
  assert.equal(offer.size, file.size);

  assert.equal(await h.receiver.accept(offer.id), true);

  await waitFor(
    () => h.senderItems.get(created[0].id)?.status === "complete",
    "sender completion",
  );
  await waitFor(
    () =>
      [...h.receiverItems.values()].some((item) => item.status === "complete"),
    "receiver completion",
  );

  const sent = h.senderItems.get(created[0].id);
  assert.ok(sent);
  assert.equal(sent.bytes, file.size);
  assert.equal(sent.error, null);

  const received = [...h.receiverItems.values()].find(
    (item) => item.name === "payload.bin",
  );
  assert.ok(received);
  assert.equal(received.bytes, file.size);
  assert.equal(received.size, file.size);
  assert.equal(received.storedAs, "memory");

  // Reassemble the binary frames and compare with the original bytes.
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (const frame of h.frames) {
    const parsed = parseFrame(frame);
    if (!parsed || parsed.seq !== 1) continue;
    chunks.push(parsed.payload);
    total += parsed.payload.byteLength;
  }
  assert.equal(total, payload.byteLength, "every payload byte crossed the wire");

  const rebuilt = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    rebuilt.set(chunk, offset);
    offset += chunk.byteLength;
  }
  assert.deepEqual([...rebuilt], [...payload], "bytes survive chunking intact");

  h.sender.destroy("test done");
  h.receiver.destroy("test done");
});

test("a declined offer never sends data", async () => {
  const h = harness("reject");
  const file = new File([bytes(4096)], "nope.bin");
  const created = h.sender.enqueue([file]);

  await waitFor(() => h.offers.length === 1, "incoming offer");
  h.receiver.reject(h.offers[0].id, "declined");

  await waitFor(
    () => h.senderItems.get(created[0].id)?.status === "rejected",
    "sender sees the rejection",
  );
  assert.equal(
    h.senderItems.get(created[0].id)?.error,
    "The other device declined this file.",
  );
  assert.equal(h.frames.length, 0, "no payload frames should have been sent");

  h.sender.destroy("test done");
  h.receiver.destroy("test done");
});

test("pause stops the flow and resume finishes it", async () => {
  const h = harness("pause");
  const file = new File([bytes(16 * 1024 * 1024)], "pause.bin");
  const created = h.sender.enqueue([file]);

  await waitFor(() => h.offers.length === 1, "incoming offer");
  await h.receiver.accept(h.offers[0].id);

  await waitFor(() => h.frames.length >= 3, "a few data frames");
  h.sender.pause(created[0].id);
  await new Promise((resolve) => setTimeout(resolve, 150));

  assert.equal(h.senderItems.get(created[0].id)?.status, "paused");
  const settled = h.frames.length;
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(h.frames.length, settled, "no frames while paused");

  h.sender.resume(created[0].id);
  await waitFor(
    () => h.senderItems.get(created[0].id)?.status === "complete",
    "completion after resume",
  );

  h.sender.destroy("test done");
  h.receiver.destroy("test done");
});

test("cancelling stops the sender and marks the row cancelled", async () => {
  const h = harness("cancel");
  const file = new File([bytes(16 * 1024 * 1024)], "cancel.bin");
  const created = h.sender.enqueue([file]);

  await waitFor(() => h.offers.length === 1, "incoming offer");
  await h.receiver.accept(h.offers[0].id);
  await waitFor(() => h.frames.length > 0, "first data frame");

  h.sender.cancel(created[0].id);
  await waitFor(
    () => h.senderItems.get(created[0].id)?.status === "cancelled",
    "sender cancellation",
  );

  h.sender.destroy("test done");
  h.receiver.destroy("test done");
});
