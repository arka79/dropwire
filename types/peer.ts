export type PeerPhase =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

/** How bytes are actually travelling right now. */
export type RouteKind = "direct" | "relay" | "unknown";

export interface PeerSnapshot {
  id: string;
  name: string;
  phase: PeerPhase;
  route: RouteKind;
  /** epoch ms when the current phase began */
  phaseSince: number;
}

export type LinkPhase =
  | "offline"
  | "searching"
  | "connecting"
  | "connected"
  | "transferring"
  | "reconnecting"
  | "disconnected";
