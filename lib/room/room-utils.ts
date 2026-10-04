const ROOM_ID_RE = /^[A-Z]{3,10}-[A-Z0-9]{4,6}$/;

/** Accepts "nova-7k2p", "NOVA7K2P" or a pasted room URL. */
export function normalizeRoomId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let candidate = trimmed;
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("/")) {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      candidate = parts[parts.length - 1] ?? "";
    } catch {
      const parts = trimmed.split("/").filter(Boolean);
      candidate = parts[parts.length - 1] ?? "";
    }
  }
  const cleaned = candidate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned || cleaned.length > 16) return "";
  const match = cleaned.match(/^([A-Z]{3,10})([A-Z0-9]{4,6})$/);
  const id = match ? `${match[1]}-${match[2]}` : cleaned;
  return ROOM_ID_RE.test(id) ? id : "";
}

export function isValidRoomId(id: string): boolean {
  return ROOM_ID_RE.test(id);
}

export function roomPath(roomId: string): string {
  return `/room/${roomId}`;
}

export function roomUrl(roomId: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  return `${base}${roomPath(roomId)}`;
}

/** Reads a room id out of a pathname like /room/NOVA-7K2P. */
export function roomFromPathname(pathname: string): string | null {
  const match = pathname.match(/\/room\/([^/?#]+)/);
  if (!match) return null;
  const id = normalizeRoomId(decodeURIComponent(match[1]));
  return id || null;
}
