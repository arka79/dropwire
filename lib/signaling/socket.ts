import { io, type Socket } from "socket.io-client";
import type {
  CreateRoomRequest,
  JoinRoomRequest,
  SignalingEvents,
} from "../../types/signaling";
import type { RoomSnapshot } from "../../types/room";
import { SIGNALING_URL } from "../env";

export type SignalingErrorCode =
  | "not_found"
  | "expired"
  | "full"
  | "password_required"
  | "password_incorrect"
  | "invalid"
  | "rate_limited"
  | "closed"
  | "network"
  | "timeout";

export class SignalingError extends Error {
  constructor(
    readonly code: SignalingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SignalingError";
  }
}

interface AckResponse {
  ok?: boolean;
  error?: { code?: string; message?: string };
}

let sharedSocket: Socket | null = null;

export function getSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io(SIGNALING_URL || undefined, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 400,
      reconnectionDelayMax: 3000,
      timeout: 8000,
      transports: ["websocket", "polling"],
      withCredentials: false,
    });
  }
  return sharedSocket;
}

export function resetSocket(): void {
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
    sharedSocket = null;
  }
}

function request<T>(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMs = 8000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        new SignalingError(
          "timeout",
          "The signaling server didn't answer. Check your connection and try again.",
        ),
      );
    }, timeoutMs);

    socket.emit(event, payload, (response: AckResponse & Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (response?.ok) {
        resolve(response as T);
        return;
      }
      const code = (response?.error?.code ?? "invalid") as SignalingErrorCode;
      const message =
        response?.error?.message ?? "Something went wrong talking to the server.";
      reject(new SignalingError(code, message));
    });
  });
}

export class SignalingClient {
  readonly socket: Socket;

  constructor() {
    this.socket = getSocket();
  }

  connect(): void {
    if (!this.socket.connected) this.socket.connect();
  }

  disconnect(): void {
    if (this.socket.connected) this.socket.disconnect();
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  async createRoom(input: CreateRoomRequest): Promise<RoomSnapshot> {
    this.connect();
    const response = await request<{ snapshot: RoomSnapshot }>(
      this.socket,
      "room:create",
      input,
    );
    return response.snapshot;
  }

  async joinRoom(input: JoinRoomRequest): Promise<RoomSnapshot> {
    this.connect();
    const response = await request<{ snapshot: RoomSnapshot }>(
      this.socket,
      "room:join",
      input,
    );
    return response.snapshot;
  }

  async requestState(): Promise<RoomSnapshot> {
    const response = await request<{ snapshot: RoomSnapshot }>(
      this.socket,
      "room:state",
      {},
      5000,
    );
    return response.snapshot;
  }

  async leaveRoom(): Promise<void> {
    if (!this.socket.connected) return;
    try {
      await request(this.socket, "room:leave", {}, 2500);
    } catch {
      // leaving is best effort
    }
  }

  async rename(name: string): Promise<void> {
    const response = await request<{ name: string }>(
      this.socket,
      "peer:rename",
      { name },
      5000,
    );
    if (!response.name) throw new SignalingError("invalid", "Name not accepted.");
  }

  sendOffer(to: string, sdp: RTCSessionDescriptionInit): void {
    this.socket.emit("signal:offer", { to, data: sdp }, (res?: AckResponse) => {
      if (res && !res.ok) {
        console.warn("[dropwire] offer not relayed", res.error?.code);
      }
    });
  }

  sendAnswer(to: string, sdp: RTCSessionDescriptionInit): void {
    this.socket.emit("signal:answer", { to, data: sdp }, (res?: AckResponse) => {
      if (res && !res.ok) {
        console.warn("[dropwire] answer not relayed", res.error?.code);
      }
    });
  }

  sendRetry(to: string, attempt: number): void {
    this.socket.emit(
      "signal:retry",
      { to, data: { attempt } },
      (res?: AckResponse) => {
        if (res && !res.ok && res.error?.code !== "not_found") {
          console.warn("[dropwire] retry not relayed", res.error?.code);
        }
      },
    );
  }

  sendIce(to: string, candidate: RTCIceCandidateInit | null): void {
    this.socket.emit("signal:ice", { to, data: candidate }, (res?: AckResponse) => {
      if (res && !res.ok && res.error?.code !== "not_found") {
        console.warn("[dropwire] ice not relayed", res.error?.code);
      }
    });
  }

  on<K extends keyof SignalingEvents>(
    event: K,
    handler: (payload: SignalingEvents[K]) => void,
  ): () => void {
    const wrapped = (payload: SignalingEvents[K]) => handler(payload);
    this.socket.on(event as string, wrapped as never);
    return () => this.socket.off(event as string, wrapped as never);
  }

  onEvent(event: string, handler: (payload: unknown) => void): () => void {
    this.socket.on(event, handler as never);
    return () => this.socket.off(event, handler as never);
  }

  onConnect(handler: () => void): () => void {
    this.socket.on("connect", handler);
    return () => this.socket.off("connect", handler);
  }

  onDisconnect(handler: (reason: string) => void): () => void {
    const wrapped = (reason: string) => handler(reason);
    this.socket.on("disconnect", wrapped);
    return () => this.socket.off("disconnect", wrapped);
  }

  onConnectError(handler: (error: Error) => void): () => void {
    this.socket.on("connect_error", handler);
    return () => this.socket.off("connect_error", handler);
  }
}
