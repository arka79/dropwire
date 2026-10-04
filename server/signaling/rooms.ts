import { createHash, randomBytes, randomInt } from "node:crypto";
import type {
  PeerPublic,
  RoomAccess,
  RoomPublic,
  RoomSnapshot,
} from "../../types/room";
import { config } from "./config";

const WORDS = [
  "AURORA", "BASALT", "BEACON", "BLITZ", "CINDER", "CIRRUS", "COMET",
  "CORAL", "CRYO", "DELTA", "DRIFT", "EMBER", "FLINT", "FLUX", "FROST",
  "GLACIER", "GLINT", "HARBOR", "HELIX", "ICICLE", "JASPER", "KESTREL",
  "LUMEN", "MARBLE", "MERIDIAN", "MIST", "NEBULA", "NOVA", "OASIS",
  "ONYX", "ORBIT", "PASTEL", "PEBBLE", "PHASE", "PIXEL", "PLUME", "PRISM",
  "QUARTZ", "QUILL", "RADAR", "RELAY", "RIDGE", "RIVER", "SAFFRON",
  "SIGNAL", "SUMMIT", "TUNDRA", "VELVET", "VECTOR", "ZEPHYR",
];

/** Unambiguous alphabet: no I, O, 0 or 1. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomId(): string {
  const word = WORDS[randomInt(WORDS.length)];
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `${word}-${suffix}`;
}

export function hashPassword(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

export interface PeerRecord {
  id: string;
  deviceId: string;
  name: string;
  isHost: boolean;
  /** null while the device is temporarily disconnected. */
  socketId: string | null;
  joinedAt: number;
  lastSeen: number;
}

export interface RoomRecord {
  id: string;
  nickname: string | null;
  access: RoomAccess;
  passwordHash: string | null;
  hostId: string;
  hostDeviceId: string;
  createdAt: number;
  expiresAt: number;
  lastActivity: number;
  emptySince: number | null;
  maxPeers: number;
  peers: Map<string, PeerRecord>;
}

export type JoinOutcome =
  | { ok: true; peer: PeerRecord; reclaimed: boolean }
  | { ok: false; code: "not_found" | "full" | "password_required" | "password_incorrect" };

export interface SweepResult {
  closed: { roomId: string; reason: "expired" | "idle" | "ended"; sockets: string[] }[];
  removed: {
    roomId: string;
    peerId: string;
    socketId: string;
    reason: "idle" | "disconnected";
  }[];
}

export class RoomStore {
  private readonly rooms = new Map<string, RoomRecord>();

  get size(): number {
    return this.rooms.size;
  }

  get peerCount(): number {
    let total = 0;
    for (const room of this.rooms.values()) total += room.peers.size;
    return total;
  }

  create(input: {
    access: RoomAccess;
    password?: string;
    nickname?: string;
    host: { deviceId: string; name: string; socketId: string };
    now?: number;
  }): RoomRecord {
    const now = input.now ?? Date.now();
    let id = generateRoomId();
    while (this.rooms.has(id)) id = generateRoomId();

    const host: PeerRecord = {
      id: randomPeerId(),
      deviceId: input.host.deviceId,
      name: input.host.name,
      isHost: true,
      socketId: input.host.socketId,
      joinedAt: now,
      lastSeen: now,
    };

    const room: RoomRecord = {
      id,
      nickname: input.nickname ?? null,
      access: input.access,
      passwordHash:
        input.access === "password" && input.password
          ? hashPassword(input.password)
          : null,
      hostId: host.id,
      hostDeviceId: input.host.deviceId,
      createdAt: now,
      expiresAt: now + config.roomTtlSec * 1000,
      lastActivity: now,
      emptySince: null,
      maxPeers: config.maxPeers,
      peers: new Map([[host.id, host]]),
    };

    this.rooms.set(id, room);
    return room;
  }

  get(roomId: string): RoomRecord | undefined {
    return this.rooms.get(roomId);
  }

  findPeer(roomId: string, peerId: string): PeerRecord | undefined {
    return this.rooms.get(roomId)?.peers.get(peerId);
  }

  socketIdFor(roomId: string, peerId: string): string | null | undefined {
    return this.rooms.get(roomId)?.peers.get(peerId)?.socketId;
  }

  join(
    roomId: string,
    input: { deviceId: string; name: string; socketId: string; password?: string },
    now = Date.now(),
  ): JoinOutcome {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, code: "not_found" };
    if (now > room.expiresAt) {
      this.rooms.delete(roomId);
      return { ok: false, code: "not_found" };
    }

    if (room.access === "password") {
      if (!input.password) return { ok: false, code: "password_required" };
      if (
        !room.passwordHash ||
        hashPassword(input.password) !== room.passwordHash
      ) {
        return { ok: false, code: "password_incorrect" };
      }
    }

    const isHost = input.deviceId === room.hostDeviceId;
    const reclaimed = [...room.peers.values()].find(
      (p) => p.deviceId === input.deviceId && p.socketId === null,
    );
    if (reclaimed) {
      reclaimed.socketId = input.socketId;
      reclaimed.name = input.name;
      reclaimed.lastSeen = now;
      reclaimed.isHost = isHost;
      if (isHost) room.hostId = reclaimed.id;
      room.lastActivity = now;
      room.emptySince = null;
      return { ok: true, peer: reclaimed, reclaimed: true };
    }

    if (this.connectedCount(room) >= room.maxPeers) {
      return { ok: false, code: "full" };
    }

    const peer: PeerRecord = {
      id: randomPeerId(),
      deviceId: input.deviceId,
      name: input.name,
      isHost: isHost && !this.hasConnectedHost(room),
      socketId: input.socketId,
      joinedAt: now,
      lastSeen: now,
    };
    if (peer.isHost) room.hostId = peer.id;
    room.peers.set(peer.id, peer);
    room.lastActivity = now;
    room.emptySince = null;
    return { ok: true, peer, reclaimed: false };
  }

  private hasConnectedHost(room: RoomRecord): boolean {
    for (const peer of room.peers.values()) {
      if (peer.isHost && peer.socketId !== null) return true;
    }
    return false;
  }

  touch(roomId: string, peerId: string, now = Date.now()): void {
    const peer = this.rooms.get(roomId)?.peers.get(peerId);
    if (peer) peer.lastSeen = now;
  }

  rename(roomId: string, peerId: string, name: string, now = Date.now()): PeerRecord | null {
    const peer = this.rooms.get(roomId)?.peers.get(peerId);
    if (!peer) return null;
    peer.name = name;
    peer.lastSeen = now;
    this.rooms.get(roomId)!.lastActivity = now;
    return peer;
  }

  /**
   * Marks a peer as disconnected but keeps the record so the same device can
   * reclaim its identity (and host role) if it comes back.
   */
  detachSocket(roomId: string, peerId: string, now = Date.now()): PeerRecord | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const peer = room.peers.get(peerId);
    if (!peer || peer.socketId === null) return null;
    peer.socketId = null;
    peer.lastSeen = now;
    room.lastActivity = now;
    if (this.connectedCount(room) === 0) room.emptySince = now;
    return peer;
  }

  removePeer(roomId: string, peerId: string, now = Date.now()): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.peers.delete(peerId);
    if (this.connectedCount(room) === 0) room.emptySince = now;
    room.lastActivity = now;
  }

  destroy(roomId: string): RoomRecord | undefined {
    const room = this.rooms.get(roomId);
    this.rooms.delete(roomId);
    return room;
  }

  snapshot(roomId: string, selfId: string): RoomSnapshot | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return {
      room: this.toRoomPublic(room),
      selfId,
      peers: this.connectedPeers(room).map((peer) => this.toPeerPublic(peer)),
    };
  }

  connectedPeers(room: RoomRecord): PeerRecord[] {
    return [...room.peers.values()].filter((peer) => peer.socketId !== null);
  }

  private connectedCount(room: RoomRecord): number {
    let total = 0;
    for (const peer of room.peers.values()) if (peer.socketId !== null) total += 1;
    return total;
  }

  toRoomPublic(room: RoomRecord): RoomPublic {
    return {
      id: room.id,
      nickname: room.nickname,
      access: room.access,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
      lastActivity: room.lastActivity,
      maxPeers: room.maxPeers,
      peerCount: this.connectedCount(room),
    };
  }

  toPeerPublic(peer: PeerRecord): PeerPublic {
    return {
      id: peer.id,
      name: peer.name,
      isHost: peer.isHost,
      joinedAt: peer.joinedAt,
    };
  }

  sweep(now = Date.now()): SweepResult {
    const result: SweepResult = { closed: [], removed: [] };

    for (const [roomId, room] of this.rooms) {
      if (now > room.expiresAt) {
        result.closed.push({
          roomId,
          reason: "expired",
          sockets: this.connectedPeers(room)
            .map((peer) => peer.socketId)
            .filter((id): id is string => id !== null),
        });
        this.rooms.delete(roomId);
        continue;
      }

      let hostDisconnected = false;
      for (const peer of [...room.peers.values()]) {
        const limit =
          (peer.isHost ? config.hostIdleSec : config.peerIdleSec) * 1000;
        if (now - peer.lastSeen <= limit) continue;

        if (peer.isHost) {
          hostDisconnected = true;
          continue;
        }
        room.peers.delete(peer.id);
        if (peer.socketId !== null) {
          result.removed.push({
            roomId,
            peerId: peer.id,
            socketId: peer.socketId,
            reason: "idle",
          });
        }
      }

      if (hostDisconnected) {
        const host = room.peers.get(room.hostId);
        if (host) room.peers.delete(host.id);
        result.closed.push({
          roomId,
          reason: "idle",
          sockets: this.connectedPeers(room)
            .map((peer) => peer.socketId)
            .filter((id): id is string => id !== null),
        });
        this.rooms.delete(roomId);
        continue;
      }

      if (this.connectedCount(room) === 0) {
        const since = room.emptySince ?? now;
        room.emptySince = since;
        if (now - since > config.emptyRoomGraceSec * 1000) {
          result.closed.push({ roomId, reason: "ended", sockets: [] });
          this.rooms.delete(roomId);
        }
      }
    }

    return result;
  }

  list(): RoomRecord[] {
    return [...this.rooms.values()];
  }
}

function randomPeerId(): string {
  return randomBytes(6).toString("hex");
}
