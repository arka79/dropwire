const ADJECTIVES = [
  "Quiet", "Blue", "Pixel", "Silver", "Orange", "Lucky", "Hidden", "Rapid",
  "Soft", "Bright", "Wild", "Calm", "Golden", "Lunar", "Plaid", "Swift",
  "Cedar", "Mint", "Cosmic", "Brave", "Tiny", "North", "Velvet", "Amber",
];

const NOUNS = [
  "Fox", "Comet", "Panda", "Otter", "Heron", "Lynx", "Ferret", "Wren",
  "Badger", "Raven", "Ibis", "Marten", "Puffin", "Quokka", "Tapir", "Yak",
  "Cursor", "Socket", "Packet", "Beacon", "Drifter", "Kite", "Sparrow",
];

const STORAGE_KEY = "dropwire:device";
const MAX_NAME = 28;

export interface DeviceIdentity {
  id: string;
  name: string;
}

function randomFrom<T>(items: readonly T[]): T {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return items[buffer[0] % items.length];
}

export function randomDeviceName(): string {
  return `${randomFrom(ADJECTIVES)} ${randomFrom(NOUNS)}`;
}

function createId(): string {
  const buffer = new Uint8Array(8);
  globalThis.crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

let cached: DeviceIdentity | null = null;

export function loadIdentity(): DeviceIdentity {
  if (cached) return cached;
  if (typeof window === "undefined") {
    return { id: "server", name: "Device" };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeviceIdentity>;
      if (parsed.id && parsed.name) {
        cached = { id: parsed.id, name: parsed.name.slice(0, MAX_NAME) };
        return cached;
      }
    }
  } catch {
    // corrupted storage: fall through and create a fresh identity
  }
  cached = { id: createId(), name: randomDeviceName() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // private mode: keep the identity for this session only
  }
  return cached;
}

export function renameIdentity(name: string): DeviceIdentity {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
  const identity = { ...loadIdentity(), name: clean || randomDeviceName() };
  cached = identity;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // ignore
  }
  return identity;
}

export function subscribeIdentity(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cached = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
