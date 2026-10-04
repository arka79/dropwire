const rawSignaling = process.env.NEXT_PUBLIC_SIGNALING_URL?.trim();

/**
 * Signaling server base URL.
 *  - unset        → http://localhost:4000 (local dev)
 *  - "" (empty)   → same origin: the web server/proxy must forward
 *                   /socket.io, /config and /health to the signaling process
 *  - https://…    → a dedicated signaling origin
 */
export const SIGNALING_URL =
  rawSignaling === undefined ? "http://localhost:4000" : rawSignaling;

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

export function appOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return APP_URL ?? "http://localhost:3000";
}
