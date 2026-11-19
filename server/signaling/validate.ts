import type { RoomAccess } from "../../types/room";
import { config } from "./config";

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

const ROOM_ID_RE = /^[A-Z]{3,10}-[A-Z0-9]{4,6}$/;
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

export function normalizeRoomId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned || cleaned.length > 16) return null;
  const match = cleaned.match(/^([A-Z]{3,10})([A-Z0-9]{4,6})$/);
  const id = match ? `${match[1]}-${match[2]}` : null;
  if (!id || !ROOM_ID_RE.test(id)) return null;
  return id;
}

export function isValidRoomId(id: string): boolean {
  return ROOM_ID_RE.test(id);
}

function bad(code: string, message: string): ValidationResult<never> {
  return { ok: false, code, message };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanString(
  value: unknown,
  max: number,
  field: string,
): ValidationResult<string> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: "" };
  }
  if (typeof value !== "string") {
    return bad("invalid", `${field} must be text.`);
  }
  const trimmed = value.trim().replace(/\s+/g, " ").replace(CONTROL_CHARS, "");
  if (trimmed.length > max) {
    return bad("invalid", `${field} is too long (max ${max} characters).`);
  }
  if (!trimmed) {
    return bad("invalid", `${field} contains invalid characters.`);
  }
  return { ok: true, value: trimmed };
}

export interface CreateRoomInput {
  access: RoomAccess;
  password?: string;
  nickname?: string;
  deviceId: string;
  name: string;
}

export function parseCreateRoom(
  payload: unknown,
): ValidationResult<CreateRoomInput> {
  const body = asRecord(payload);
  if (!body) return bad("invalid", "Malformed request.");

  const access: RoomAccess = body.access === "password" ? "password" : "open";

  const deviceId = cleanString(body.deviceId, 64, "Device id");
  if (!deviceId.ok) return deviceId;
  if (!deviceId.value) return bad("invalid", "Device id is required.");

  const name = cleanString(body.name, config.maxNameLength, "Device name");
  if (!name.ok) return name;
  if (!name.value) return bad("invalid", "Device name is required.");

  const nickname = cleanString(body.nickname, 40, "Room nickname");
  if (!nickname.ok) return nickname;

  let password: string | undefined;
  if (access === "password") {
    const pw = cleanString(body.password, config.maxPasswordLength, "Password");
    if (!pw.ok) return pw;
    if (!pw.value || pw.value.length < 4) {
      return bad("invalid", "Use at least 4 characters for the password.");
    }
    password = pw.value;
  }

  return {
    ok: true,
    value: {
      access,
      password,
      nickname: nickname.value || undefined,
      deviceId: deviceId.value,
      name: name.value,
    },
  };
}

export interface JoinRoomInput {
  roomId: string;
  deviceId: string;
  name: string;
  password?: string;
}

export function parseJoinRoom(
  payload: unknown,
): ValidationResult<JoinRoomInput> {
  const body = asRecord(payload);
  if (!body) return bad("invalid", "Malformed request.");

  const roomId = normalizeRoomId(body.roomId);
  if (!roomId) return bad("invalid", "That doesn't look like a room code.");

  const deviceId = cleanString(body.deviceId, 64, "Device id");
  if (!deviceId.ok) return deviceId;
  if (!deviceId.value) return bad("invalid", "Device id is required.");

  const name = cleanString(body.name, config.maxNameLength, "Device name");
  if (!name.ok) return name;
  if (!name.value) return bad("invalid", "Device name is required.");

  const password = cleanString(
    body.password,
    config.maxPasswordLength,
    "Password",
  );
  if (!password.ok) return password;

  return {
    ok: true,
    value: {
      roomId,
      deviceId: deviceId.value,
      name: name.value,
      password: password.value || undefined,
    },
  };
}

export interface SignalInput {
  to: string;
  data: unknown;
}

export function parseSignal(
  payload: unknown,
  maxBytes: number,
): ValidationResult<SignalInput> {
  const body = asRecord(payload);
  if (!body) return bad("invalid", "Malformed signal.");

  const to = cleanString(body.to, 64, "Peer id");
  if (!to.ok) return to;
  if (!to.value) return bad("invalid", "Signal target is required.");

  const data = body.data;
  if (data !== null && data !== undefined && typeof data !== "object") {
    return bad("invalid", "Signal payload is required.");
  }

  let size = 0;
  try {
    size = JSON.stringify(data).length;
  } catch {
    return bad("invalid", "Signal payload is not serialisable.");
  }
  if (size > maxBytes) {
    return bad("invalid", "Signal payload is too large.");
  }

  return { ok: true, value: { to: to.value, data } };
}
