import http from "node:http";
import cors from "cors";
import express from "express";
import { Server as IOServer, type Socket } from "socket.io";
import { config, iceServers } from "./config";
import { RateLimiter } from "./ratelimit";
import { RoomStore } from "./rooms";
import {
  parseCreateRoom,
  parseJoinRoom,
  parseSignal,
} from "./validate";

const LEVELS: Record<string, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function log(
  level: keyof typeof LEVELS,
  message: string,
  meta?: Record<string, unknown>,
) {
  if (LEVELS[level] < LEVELS[config.logLevel]) return;
  const stamp = new Date().toISOString().slice(11, 19);
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  const line = `[dropwire] ${stamp} ${level.toUpperCase().padEnd(5)} ${message}${suffix}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

type Ack = (payload: unknown) => void;

function ackOk(ack: unknown, value: Record<string, unknown> = {}) {
  if (typeof ack === "function") (ack as Ack)({ ok: true, ...value });
}

function ackErr(ack: unknown, code: string, message: string) {
  if (typeof ack === "function") (ack as Ack)({ ok: false, error: { code, message } });
}

/**
 * The `cors` package calls custom origins with (origin, callback) — it waits
 * for the callback, so returning a boolean instead would hang every request.
 */
function originAllowed(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  let allowed = false;
  if (!origin) allowed = true;
  else if (config.corsOrigins.includes(origin)) allowed = true;
  else if (process.env.NODE_ENV !== "production") {
    try {
      const url = new URL(origin);
      allowed = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    } catch {
      allowed = false;
    }
  }
  callback(null, allowed);
}

/**
 * Client address for rate limiting. `x-forwarded-for` is only trusted when
 * TRUST_PROXY is on — otherwise a client could spoof it to mint unlimited
 * rooms. Behind a reverse proxy you must enable it, or every visitor shares
 * the proxy's bucket.
 */
function clientIp(socket: Socket): string {
  if (config.trustProxy) {
    const forwarded = socket.handshake.headers["x-forwarded-for"]
      ?.toString()
      .split(",")[0]
      ?.trim();
    if (forwarded) return forwarded;
  }
  return socket.handshake.address || "unknown";
}

export interface SignalingServer {
  httpServer: http.Server;
  io: IOServer;
  store: RoomStore;
  close(): Promise<void>;
}

export function createSignalingServer(): SignalingServer {
  const store = new RoomStore();
  const app = express();
  const httpServer = http.createServer(app);
  const startedAt = Date.now();

  const createLimiter = new RateLimiter(
    config.maxRoomsPerIpPerMinute,
    config.maxRoomsPerIpPerMinute,
  );
  const packetLimiter = new RateLimiter(400, 400);
  // Joins get their own bucket: a join must never be blocked by room creates.
  const joinLimiter = new RateLimiter(30, 30);

  app.disable("x-powered-by");
  app.use(cors({ origin: originAllowed, methods: ["GET", "POST"] }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      rooms: store.size,
      peers: store.peerCount,
      version: "1.0.0",
    });
  });

  app.get("/config", (_req, res) => {
    res.json({
      iceServers: iceServers(),
      turnConfigured: Boolean(config.turn),
      maxPeers: config.maxPeers,
      roomTtlSeconds: config.roomTtlSec,
    });
  });

  const io = new IOServer(httpServer, {
    cors: { origin: originAllowed, methods: ["GET", "POST"] },
    maxHttpBufferSize: Math.max(config.maxSignalBytes, 128 * 1024),
    pingInterval: 20_000,
    pingTimeout: 25_000,
  });

  io.on("connection", (socket) => {
    const ip = clientIp(socket);
    socket.data.roomId = null as string | null;
    socket.data.peerId = null as string | null;
    socket.data.joinedAt = 0;

    log("debug", "socket connected", { socket: socket.id, ip });

    socket.use((_packet, next) => {
      if (!packetLimiter.allow(socket.id, 1)) {
        log("warn", "rate limited", { socket: socket.id, ip });
        next(new Error("rate_limited"));
        return;
      }
      next();
    });

    const leaveCurrentRoom = (reason: "left" | "disconnected") => {
      const roomId = socket.data.roomId as string | null;
      const peerId = socket.data.peerId as string | null;
      if (!roomId || !peerId) return;
      const room = store.get(roomId);
      socket.leave(roomId);
      socket.data.roomId = null;
      socket.data.peerId = null;
      if (!room) return;

      const peer = room.peers.get(peerId);
      if (!peer || peer.socketId !== socket.id) return;

      if (reason === "left") {
        store.removePeer(roomId, peerId);
      } else {
        store.detachSocket(roomId, peerId);
      }
      socket.to(roomId).emit("peer:left", { peerId, reason });
      log("info", reason === "left" ? "peer left" : "peer disconnected", {
        room: roomId,
        peer: peerId,
        name: peer.name,
      });
      if (!store.get(roomId)) {
        log("info", "room closed (empty)", { room: roomId });
      }
    };

    socket.on("room:create", (payload, ack) => {
      if (!createLimiter.allow(ip)) {
        ackErr(ack, "rate_limited", "Too many rooms from this network. Try again shortly.");
        return;
      }
      const parsed = parseCreateRoom(payload);
      if (!parsed.ok) {
        ackErr(ack, parsed.code, parsed.message);
        return;
      }
      leaveCurrentRoom("left");

      const room = store.create({
        access: parsed.value.access,
        password: parsed.value.password,
        nickname: parsed.value.nickname,
        host: {
          deviceId: parsed.value.deviceId,
          name: parsed.value.name,
          socketId: socket.id,
        },
      });
      const peer = [...room.peers.values()][0];
      socket.join(room.id);
      socket.data.roomId = room.id;
      socket.data.peerId = peer.id;
      socket.data.joinedAt = Date.now();

      log("info", `room created: ${room.id}`, {
        access: room.access,
        nickname: room.nickname ?? undefined,
        peer: peer.id,
      });
      ackOk(ack, { snapshot: store.snapshot(room.id, peer.id) });
    });

    socket.on("room:join", (payload, ack) => {
      const parsed = parseJoinRoom(payload);
      if (!parsed.ok) {
        ackErr(ack, parsed.code, parsed.message);
        return;
      }
      const { roomId } = parsed.value;
      const existingRoom = store.get(roomId);
      if (!existingRoom) {
        ackErr(ack, "not_found", "That room no longer exists.");
        return;
      }
      if (!joinLimiter.allow(ip)) {
        ackErr(ack, "rate_limited", "Too many join attempts. Try again shortly.");
        return;
      }

      // Same socket re-joining the room it already belongs to (page refresh
      // right after creating a room): return the current state as-is.
      const currentPeerId = socket.data.peerId as string | null;
      if (socket.data.roomId === roomId && currentPeerId) {
        const existing = store.snapshot(roomId, currentPeerId);
        if (existing) {
          store.touch(roomId, currentPeerId);
          ackOk(ack, { snapshot: existing });
          return;
        }
      }

      const outcome = store.join(roomId, {
        deviceId: parsed.value.deviceId,
        name: parsed.value.name,
        socketId: socket.id,
        password: parsed.value.password,
      });

      if (!outcome.ok) {
        const messages: Record<string, string> = {
          not_found: "That room no longer exists.",
          full: "This room is full.",
          password_required: "This room needs a password.",
          password_incorrect: "That password doesn't match.",
        };
        log("debug", "join rejected", { room: roomId, code: outcome.code });
        ackErr(ack, outcome.code, messages[outcome.code] ?? "Can't join this room.");
        return;
      }

      const previousRoom = socket.data.roomId as string | null;
      if (previousRoom && previousRoom !== roomId) leaveCurrentRoom("left");

      const { peer, reclaimed } = outcome;
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.peerId = peer.id;
      socket.data.joinedAt = Date.now();

      const snapshot = store.snapshot(roomId, peer.id);
      const roomPublic = store.toRoomPublic(existingRoom);
      ackOk(ack, { snapshot });

      socket.to(roomId).emit("peer:joined", {
        peer: store.toPeerPublic(peer),
        room: roomPublic,
      });
      log("info", reclaimed ? "peer rejoined" : "peer joined", {
        room: roomId,
        peer: peer.id,
        name: peer.name,
        peers: roomPublic.peerCount,
      });
    });

    socket.on("room:leave", (_payload, ack) => {
      leaveCurrentRoom("left");
      ackOk(ack);
    });

    socket.on("room:state", (_payload, ack) => {
      const roomId = socket.data.roomId as string | null;
      const peerId = socket.data.peerId as string | null;
      if (!roomId || !peerId) {
        ackErr(ack, "not_found", "You are not in a room.");
        return;
      }
      const snapshot = store.snapshot(roomId, peerId);
      if (!snapshot) {
        ackErr(ack, "expired", "This room has expired.");
        return;
      }
      store.touch(roomId, peerId);
      ackOk(ack, { snapshot });
    });

    socket.on("peer:rename", (payload, ack) => {
      const roomId = socket.data.roomId as string | null;
      const peerId = socket.data.peerId as string | null;
      const body = payload as { name?: unknown } | undefined;
      const name =
        typeof body?.name === "string"
          ? body.name.trim().replace(/\s+/g, " ").slice(0, config.maxNameLength)
          : "";
      if (!roomId || !peerId || !name) {
        ackErr(ack, "invalid", "That name isn't valid.");
        return;
      }
      const peer = store.rename(roomId, peerId, name);
      if (!peer) {
        ackErr(ack, "not_found", "You are not in a room.");
        return;
      }
      socket.to(roomId).emit("peer:renamed", { peerId, name });
      ackOk(ack, { name });
    });

    const relaySignal = (
      event: "signal:offer" | "signal:answer" | "signal:ice" | "signal:retry",
    ) =>
      (payload: unknown, ack: unknown) => {
        const roomId = socket.data.roomId as string | null;
        const peerId = socket.data.peerId as string | null;
        if (!roomId || !peerId) {
          ackErr(ack, "invalid", "Join a room before signalling.");
          return;
        }
        const parsed = parseSignal(payload, config.maxSignalBytes);
        if (!parsed.ok) {
          ackErr(ack, parsed.code, parsed.message);
          return;
        }
        const room = store.get(roomId);
        const from = room?.peers.get(peerId);
        if (!room || !from) {
          ackErr(ack, "not_found", "You are no longer in this room.");
          return;
        }
        const target = room.peers.get(parsed.value.to);
        if (!target || target.socketId === null) {
          ackErr(ack, "not_found", "That device is no longer in the room.");
          return;
        }
        store.touch(roomId, peerId);
        io.to(target.socketId).emit(event, {
          from: peerId,
          data: parsed.value.data,
        });
        if (event !== "signal:ice") {
          log("debug", `${event.replace("signal:", "")} relayed`, {
            room: roomId,
            from: peerId,
            to: target.id,
          });
        }
        ackOk(ack);
      };

    socket.on("signal:offer", relaySignal("signal:offer"));
    socket.on("signal:answer", relaySignal("signal:answer"));
    socket.on("signal:ice", relaySignal("signal:ice"));
    socket.on("signal:retry", relaySignal("signal:retry"));

    socket.on("disconnect", (reason) => {
      log("debug", "socket disconnected", { socket: socket.id, reason });
      leaveCurrentRoom("disconnected");
    });
  });

  const sweepTimer = setInterval(() => {
    const now = Date.now();
    const { closed, removed } = store.sweep(now);
    createLimiter.cleanup(now);
    packetLimiter.cleanup(now);
    for (const item of removed) {
      io.to(item.socketId).emit("room:error", {
        code: "idle",
        message: "Removed from the room after a period of inactivity.",
      });
      log("info", "peer idle timeout", { room: item.roomId, peer: item.peerId });
    }
    for (const item of closed) {
      for (const socketId of item.sockets) {
        io.to(socketId).emit("room:closed", {
          reason: item.reason,
          message:
            item.reason === "expired"
              ? "This room has expired."
              : "This room has closed.",
        });
      }
      io.in(item.roomId).socketsLeave(item.roomId);
      log("info", `room closed (${item.reason})`, { room: item.roomId });
    }
  }, config.sweepIntervalMs);
  sweepTimer.unref();

  return {
    httpServer,
    io,
    store,
    async close() {
      clearInterval(sweepTimer);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}

export function startServer(port = config.port): Promise<SignalingServer> {
  const server = createSignalingServer();
  return new Promise((resolve, reject) => {
    server.httpServer.once("error", reject);
    server.httpServer.listen(port, config.host, () => {
      log("info", `signaling server listening on :${port}`, {
        stun: config.stunServers.length,
        turn: Boolean(config.turn),
        maxPeers: config.maxPeers,
      });
      resolve(server);
    });
  });
}
