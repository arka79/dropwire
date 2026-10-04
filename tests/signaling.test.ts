import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Socket } from "socket.io-client";
import { startServer, type SignalingServer } from "../server/signaling/server";
import type { RoomSnapshot } from "../types/room";
import { connected, connect, once, request } from "./helpers";

interface PeerJoined {
  peer: { id: string; name: string; isHost: boolean };
}

interface SignalRelay<T> {
  from: string;
  data: T;
}

let server: SignalingServer;
let url: string;

const sockets: Socket[] = [];

function client(): Socket {
  const socket = connect(url);
  sockets.push(socket);
  return socket;
}

async function failWithCode(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<string> {
  try {
    await request(socket, event, payload);
    throw new Error(`${event} unexpectedly succeeded`);
  } catch (error) {
    const response = (error as { response?: { error?: { code?: string } } }).response;
    if (!response) throw error;
    return response.error?.code ?? "unknown";
  }
}

before(async () => {
  server = await startServer(0);
  const address = server.httpServer.address();
  if (!address || typeof address === "string") throw new Error("no port bound");
  url = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  for (const socket of sockets) socket.disconnect();
  await server.close();
});

test("health endpoint reports a live server", async () => {
  const response = await fetch(`${url}/health`);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; version: string };
  assert.equal(body.ok, true);
  assert.equal(typeof body.version, "string");
});

test("create + join puts two devices in one room", async () => {
  const host = client();
  const guest = client();
  await connected(host);
  await connected(guest);

  const hostSnapshot = await request<{ ok: boolean; snapshot: RoomSnapshot }>(
    host,
    "room:create",
    { access: "open", deviceId: "dev-host-1", name: "Host Device" },
  ).then((response) => response.snapshot);

  assert.match(hostSnapshot.room.id, /^[A-Z]{3,10}-[A-Z0-9]{4,6}$/);
  assert.equal(hostSnapshot.peers.length, 1);
  assert.equal(hostSnapshot.peers[0].isHost, true);
  assert.equal(hostSnapshot.room.access, "open");

  const joined = once<PeerJoined>(host, "peer:joined");
  const guestSnapshot = await request<{ ok: boolean; snapshot: RoomSnapshot }>(
    guest,
    "room:join",
    {
      roomId: hostSnapshot.room.id,
      deviceId: "dev-guest-1",
      name: "Guest Device",
    },
  ).then((response) => response.snapshot);

  assert.equal(guestSnapshot.room.id, hostSnapshot.room.id);
  assert.equal(guestSnapshot.peers.length, 2);
  // The server issues its own peer ids; deviceId only tracks the browser.
  assert.ok(guestSnapshot.selfId);
  assert.notEqual(guestSnapshot.selfId, hostSnapshot.selfId);

  const event = await joined;
  assert.equal(event.peer.id, guestSnapshot.selfId);
  assert.equal(event.peer.name, "Guest Device");
  assert.equal(event.peer.isHost, false);

  // room:state reflects the same membership
  const state = await request<{ ok: boolean; snapshot: RoomSnapshot }>(
    guest,
    "room:state",
    {},
  ).then((response) => response.snapshot);
  assert.equal(state.peers.length, 2);
});

test("offers and answers are relayed only between peers", async () => {
  const a = client();
  const b = client();
  await connected(a);
  await connected(b);

  const snapshot = await request<{ ok: boolean; snapshot: RoomSnapshot }>(
    a,
    "room:create",
    { access: "open", deviceId: "dev-a", name: "A" },
  ).then((response) => response.snapshot);
  const guestSnapshot = await request<{ ok: boolean; snapshot: RoomSnapshot }>(
    b,
    "room:join",
    {
      roomId: snapshot.room.id,
      deviceId: "dev-b",
      name: "B",
    },
  ).then((response) => response.snapshot);

  const offer = once<SignalRelay<{ type: string; sdp: string }>>(b, "signal:offer");
  await request(a, "signal:offer", {
    to: guestSnapshot.selfId,
    data: { type: "offer", sdp: "v=0 fake" },
  });

  const relayed = await offer;
  assert.equal(relayed.from, snapshot.selfId);
  assert.equal(relayed.data.type, "offer");
  assert.equal(relayed.data.sdp, "v=0 fake");

  const answer = once<SignalRelay<{ type: string }>>(a, "signal:answer");
  await request(b, "signal:answer", {
    to: snapshot.selfId,
    data: { type: "answer", sdp: "v=0 reply" },
  });
  assert.equal((await answer).from, guestSnapshot.selfId);

  const ice = once<SignalRelay<{ candidate: string }>>(a, "signal:ice");
  await request(b, "signal:ice", {
    to: snapshot.selfId,
    data: { candidate: "candidate:1 1 UDP 123" },
  });
  assert.equal((await ice).from, guestSnapshot.selfId);
});

test("a room with a password gates every join", async () => {
  const host = client();
  const guest = client();
  await connected(host);
  await connected(guest);

  const snapshot = await request<{ ok: boolean; snapshot: RoomSnapshot }>(
    host,
    "room:create",
    { access: "password", password: "correct horse", deviceId: "dev-pw", name: "Host" },
  ).then((response) => response.snapshot);
  assert.equal(snapshot.room.access, "password");

  const missingCode = await failWithCode(guest, "room:join", {
    roomId: snapshot.room.id,
    deviceId: "dev-pw-2",
    name: "Guest",
  });
  assert.equal(missingCode, "password_required");

  const wrongCode = await failWithCode(guest, "room:join", {
    roomId: snapshot.room.id,
    deviceId: "dev-pw-2",
    name: "Guest",
    password: "wrong",
  });
  assert.equal(wrongCode, "password_incorrect");

  const ok = await request<{ ok: boolean; snapshot: RoomSnapshot }>(
    guest,
    "room:join",
    {
      roomId: snapshot.room.id,
      deviceId: "dev-pw-2",
      name: "Guest",
      password: "correct horse",
    },
  );
  assert.equal(ok.snapshot.peers.length, 2);
});

test("joining an unknown room fails cleanly", async () => {
  const guest = client();
  await connected(guest);
  const code = await failWithCode(guest, "room:join", {
    roomId: "ZZZZ-9999",
    deviceId: "dev-x",
    name: "X",
  });
  assert.equal(code, "not_found");
});

test("renaming and leaving are broadcast to the room", async () => {
  const host = client();
  const guest = client();
  await connected(host);
  await connected(guest);

  const snapshot = await request<{ ok: boolean; snapshot: RoomSnapshot }>(
    host,
    "room:create",
    { access: "open", deviceId: "dev-r1", name: "Before" },
  ).then((response) => response.snapshot);
  const guestSnapshot = await request<{ ok: boolean; snapshot: RoomSnapshot }>(
    guest,
    "room:join",
    {
      roomId: snapshot.room.id,
      deviceId: "dev-r2",
      name: "Guest",
    },
  ).then((response) => response.snapshot);

  const renamed = once<{ peerId: string; name: string }>(guest, "peer:renamed");
  await request(host, "peer:rename", { name: "After" });
  assert.deepEqual(await renamed, { peerId: snapshot.selfId, name: "After" });

  const left = once<{ peerId: string; reason: string }>(host, "peer:left");
  await request(guest, "room:leave", {});
  assert.equal((await left).peerId, guestSnapshot.selfId);
});
