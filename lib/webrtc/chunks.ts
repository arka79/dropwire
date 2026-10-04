import { FRAME_HEADER_BYTES } from "../../types/transfer";

/** Prefixes file data with a 4-byte big-endian transfer id. */
export function buildFrame(seq: number, payload: ArrayBuffer): ArrayBuffer {
  const frame = new ArrayBuffer(FRAME_HEADER_BYTES + payload.byteLength);
  const view = new DataView(frame);
  view.setUint32(0, seq >>> 0, false);
  new Uint8Array(frame, FRAME_HEADER_BYTES).set(new Uint8Array(payload));
  return frame;
}

export function parseFrame(
  frame: ArrayBuffer,
): { seq: number; payload: Uint8Array } | null {
  if (frame.byteLength < FRAME_HEADER_BYTES) return null;
  const view = new DataView(frame);
  const seq = view.getUint32(0, false);
  if (seq === 0) return null;
  return { seq, payload: new Uint8Array(frame, FRAME_HEADER_BYTES) };
}

export async function readSlice(
  file: Blob,
  offset: number,
  end: number,
): Promise<ArrayBuffer> {
  return file.slice(offset, end).arrayBuffer();
}

export type Sample = { t: number; b: number };

/**
 * Rolling-window transfer speed. Keeps the last few seconds of samples so the
 * displayed number moves smoothly instead of jumping on every chunk.
 */
export class SpeedTracker {
  private samples: Sample[] = [];
  private start = 0;
  private startBytes = 0;
  private smoothed = 0;

  constructor(private readonly windowMs = 6000) {}

  begin(bytes = 0, now = performance.now()): void {
    this.start = now;
    this.startBytes = bytes;
    this.samples = [{ t: now, b: bytes }];
    this.smoothed = 0;
  }

  sample(bytes: number, now = performance.now()): void {
    if (!this.start) this.begin(bytes, now);
    this.samples.push({ t: now, b: bytes });
    const cutoff = now - this.windowMs;
    while (this.samples.length > 2 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0.05) return;
    const instantaneous = Math.max(0, (last.b - first.b) / dt);
    this.smoothed =
      this.smoothed === 0
        ? instantaneous
        : this.smoothed * 0.65 + instantaneous * 0.35;
  }

  /** Bytes per second, smoothed. */
  get speed(): number {
    return this.smoothed;
  }

  /** Bytes per second since the transfer began. */
  get average(): number {
    if (!this.start || this.samples.length < 2) return 0;
    const last = this.samples[this.samples.length - 1];
    const dt = (last.t - this.start) / 1000;
    if (dt <= 0) return 0;
    return Math.max(0, (last.b - this.startBytes) / dt);
  }

  eta(remainingBytes: number): number | null {
    if (remainingBytes <= 0) return 0;
    const rate = this.smoothed || this.average;
    if (rate < 1) return null;
    return remainingBytes / rate;
  }

  reset(): void {
    this.samples = [];
    this.start = 0;
    this.startBytes = 0;
    this.smoothed = 0;
  }
}

/** A promise that can be woken from the outside, with a safety re-check timer. */
export class WakeSignal {
  private listeners = new Set<() => void>();

  notify(): void {
    const listeners = [...this.listeners];
    this.listeners.clear();
    for (const listener of listeners) listener();
  }

  wait(timeoutMs = 500): Promise<void> {
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.listeners.delete(done);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      this.listeners.add(done);
    });
  }

  dispose(): void {
    this.listeners.clear();
  }
}
