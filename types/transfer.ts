export type TransferDirection = "out" | "in";

export type TransferStatus =
  | "queued"
  | "preparing"
  | "connecting"
  | "sending"
  | "receiving"
  | "paused"
  | "complete"
  | "failed"
  | "cancelled"
  | "rejected"
  | "interrupted";

export interface TransferItem {
  /** Stable UI id (local to this browser). */
  id: string;
  /** Numeric id used on the wire. Only meaningful for outgoing transfers. */
  seq: number;
  peerId: string | null;
  peerName: string | null;
  direction: TransferDirection;
  name: string;
  size: number;
  mime: string;
  lastModified: number;
  status: TransferStatus;
  /** Bytes confirmed written by the receiver (out) / by us (in). */
  bytes: number;
  /** Instantaneous speed, bytes/second (rolling average). */
  speed: number;
  /** Average speed since the transfer started. */
  avgSpeed: number;
  etaSeconds: number | null;
  error: string | null;
  /** How an incoming file was stored. */
  storedAs: "stream" | "memory" | null;
  /** Object URL for a completed in-memory file (null once revoked). */
  downloadUrl: string | null;
  startedAt: number | null;
  updatedAt: number;
}

/** Control frames are UTF-8 JSON text messages on the data channel. */
export type ControlMessage =
  | { t: "hello"; v: number; name: string }
  | {
      t: "offer";
      id: number;
      name: string;
      size: number;
      mime: string;
      lastModified: number;
    }
  | { t: "accept"; id: number }
  | { t: "reject"; id: number; reason?: string }
  | { t: "pause"; id: number }
  | { t: "resume"; id: number }
  | { t: "cancel"; id: number; by: "sender" | "receiver" }
  | { t: "ack"; id: number; bytes: number }
  | { t: "saved"; id: number }
  | { t: "done"; id: number }
  | { t: "error"; id: number; message: string };

export const PROTOCOL_VERSION = 1;

/** Bytes of file data per data channel message. */
export const CHUNK_SIZE = 64 * 1024;

/** Length of the binary frame header (uint32 transfer id, big endian). */
export const FRAME_HEADER_BYTES = 4;

/** Stop reading from the socket when the outgoing buffer reaches this. */
export const HIGH_WATER_MARK = 4 * 1024 * 1024;

/** Resume reading when the outgoing buffer drains to this. */
export const LOW_WATER_MARK = 512 * 1024;

/** Receiver credit window: max unacknowledged bytes in flight. */
export const CREDIT_WINDOW = 24 * 1024 * 1024;

/** Incoming files larger than this use the File System Access API when available. */
export const STREAM_THRESHOLD = 200 * 1024 * 1024;

export const INCOMING_OFFER_TTL = 60_000;
