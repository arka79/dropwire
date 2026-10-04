import { io, type Socket } from "socket.io-client";

interface Ack {
  ok?: boolean;
  error?: { code?: string; message?: string };
}

/** Small helper for socket.io ack-style requests. */
export function request<T>(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`ack timeout for ${event}`));
    }, timeoutMs);

    socket.emit(event, payload, (response: T & Ack) => {
      clearTimeout(timer);
      if (response && typeof response === "object" && "ok" in response && !response.ok) {
        reject(Object.assign(new Error(`request ${event} failed`), { response }));
        return;
      }
      resolve(response);
    });
  });
}

export function connect(url: string): Socket {
  return io(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    timeout: 3000,
  });
}

export function once<T>(socket: Socket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for ${event}`)),
      timeoutMs,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

export function connected(socket: Socket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket connect timeout")), 3000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export async function waitFor(
  predicate: () => boolean,
  label: string,
  timeoutMs = 3000,
): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
