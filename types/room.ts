export type RoomAccess = "open" | "password";

export interface PeerPublic {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

export interface RoomPublic {
  id: string;
  nickname: string | null;
  access: RoomAccess;
  createdAt: number;
  expiresAt: number;
  lastActivity: number;
  maxPeers: number;
  peerCount: number;
}

export interface RoomSnapshot {
  room: RoomPublic;
  selfId: string;
  peers: PeerPublic[];
}

export type RoomErrorCode =
  | "not_found"
  | "expired"
  | "full"
  | "password_required"
  | "password_incorrect"
  | "invalid"
  | "rate_limited"
  | "closed";

export interface RoomError {
  code: RoomErrorCode;
  message: string;
}

export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: RoomError };
