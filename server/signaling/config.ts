import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function list(name: string, fallback: string[] = []): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  const items = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

function bool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function str(name: string, fallback = ""): string {
  const raw = process.env[name];
  return raw && raw.trim() ? raw.trim() : fallback;
}

/** Read the first non-empty variable from a list of aliases. */
function strAny(names: string[], fallback = ""): string {
  for (const name of names) {
    const raw = process.env[name];
    if (raw && raw.trim()) return raw.trim();
  }
  return fallback;
}

/** Like list(), but accepts aliases and always falls back to defaults. */
function listAny(names: string[], fallback: string[] = []): string[] {
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) continue;
    const items = raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (items.length) return items;
  }
  return fallback;
}

// ICE settings accept both the server-side names and the NEXT_PUBLIC_*
// aliases so a browser-style .env paste keeps working.
const turnServers = listAny(["TURN_SERVERS", "NEXT_PUBLIC_TURN_SERVER"]);
const turnUsername = strAny(["TURN_USERNAME", "NEXT_PUBLIC_TURN_USERNAME"]);
const turnCredential = strAny(["TURN_CREDENTIAL", "NEXT_PUBLIC_TURN_PASSWORD"]);

export interface ServerConfig {
  port: number;
  host: string;
  /** Honour x-forwarded-for when running behind a reverse proxy. */
  trustProxy: boolean;
  corsOrigins: string[];
  stunServers: string[];
  turn: { urls: string[]; username: string; credential: string } | null;
  maxPeers: number;
  roomTtlSec: number;
  hostIdleSec: number;
  peerIdleSec: number;
  emptyRoomGraceSec: number;
  maxSignalBytes: number;
  maxNameLength: number;
  maxPasswordLength: number;
  maxRoomsPerIpPerMinute: number;
  sweepIntervalMs: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

export const config: ServerConfig = {
  port: num("SIGNALING_PORT", num("PORT", 4000)),
  host: str("HOST", "0.0.0.0"),
  trustProxy: bool("TRUST_PROXY", false),
  corsOrigins: list("CORS_ORIGINS", [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]),
  stunServers: listAny(["STUN_SERVERS", "NEXT_PUBLIC_STUN_SERVER"], [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
  ]),
  turn:
    turnServers.length && turnUsername && turnCredential
      ? {
          urls: turnServers,
          username: turnUsername,
          credential: turnCredential,
        }
      : turnServers.length
        ? { urls: turnServers, username: "", credential: "" }
        : null,
  maxPeers: num("MAX_PEERS", 10),
  roomTtlSec: num("ROOM_TTL", 21600),
  hostIdleSec: num("HOST_IDLE_TIME", 3600),
  peerIdleSec: num("PEER_IDLE_TIME", 1800),
  emptyRoomGraceSec: num("EMPTY_ROOM_GRACE", 60),
  maxSignalBytes: num("MAX_SIGNAL_BYTES", 64 * 1024),
  maxNameLength: 32,
  maxPasswordLength: 128,
  maxRoomsPerIpPerMinute: num("MAX_ROOMS_PER_IP_PER_MIN", 12),
  sweepIntervalMs: num("SWEEP_INTERVAL_MS", 15_000),
  logLevel: (str("LOG_LEVEL", "debug") as ServerConfig["logLevel"]) ?? "debug",
};

export function iceServers(): RTCIceServerLike[] {
  const servers: RTCIceServerLike[] = [];
  if (config.stunServers.length) servers.push({ urls: config.stunServers });
  if (config.turn) {
    servers.push({
      urls: config.turn.urls,
      username: config.turn.username,
      credential: config.turn.credential,
    });
  }
  return servers;
}

export interface RTCIceServerLike {
  urls: string | string[];
  username?: string;
  credential?: string;
}
