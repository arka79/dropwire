import type { PeerPublic, RoomPublic, RoomSnapshot } from "./room";

/* ------------------------------------------------------------------ *
 * client -> server
 * ------------------------------------------------------------------ */

export interface CreateRoomRequest {
  access: "open" | "password";
  password?: string;
  nickname?: string;
  deviceId: string;
  name: string;
}

export interface JoinRoomRequest {
  roomId: string;
  deviceId: string;
  name: string;
  password?: string;
}

export interface SignalOffer {
  to: string;
  sdp: RTCSessionDescriptionInit;
}

export interface SignalAnswer {
  to: string;
  sdp: RTCSessionDescriptionInit;
}

export interface SignalIce {
  to: string;
  candidate: RTCIceCandidateInit | null;
}

/* ------------------------------------------------------------------ *
 * server -> client
 * ------------------------------------------------------------------ */

export interface PeerJoinedEvent {
  peer: PeerPublic;
  room: RoomPublic;
}

export interface PeerLeftEvent {
  peerId: string;
  reason: "left" | "disconnected" | "expired" | "idle";
}

export interface PeerRenamedEvent {
  peerId: string;
  name: string;
}

export interface FromSignal<T> {
  from: string;
  data: T;
}

export interface RoomClosedEvent {
  reason: "expired" | "ended" | "idle" | "full";
  message: string;
}

export interface ServerErrorEvent {
  code: string;
  message: string;
}

export type SignalingEvents = {
  "peer:joined": PeerJoinedEvent;
  "peer:left": PeerLeftEvent;
  "peer:renamed": PeerRenamedEvent;
  "signal:offer": FromSignal<RTCSessionDescriptionInit>;
  "signal:answer": FromSignal<RTCSessionDescriptionInit>;
  "signal:ice": FromSignal<RTCIceCandidateInit | null>;
  "signal:retry": FromSignal<{ attempt: number }>;
  "room:closed": RoomClosedEvent;
  "room:error": ServerErrorEvent;
};

export type { RoomSnapshot };
