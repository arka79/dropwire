"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  RoomSession,
  emptyRoomState,
  type Notice,
  type RoomViewState,
} from "@/lib/room/session";
import type { IncomingOffer } from "@/lib/webrtc/transfer";

export interface RoomActions {
  sendFiles(files: File[], target?: string | "all"): number;
  hasConnectedPeer(): boolean;
  pauseTransfer(id: string): void;
  resumeTransfer(id: string): void;
  cancelTransfer(id: string): void;
  retryTransfer(id: string): void;
  pauseAll(): void;
  resumeAll(): void;
  cancelAll(): void;
  acceptIncoming(id: string): Promise<boolean>;
  rejectIncoming(id: string): void;
  updateLocalName(name: string): void;
  retryConnection(peerId?: string): void;
  dismissNotice(id: string): void;
  dismissTransfer(id: string): void;
  dismissFinished(): void;
  notify(kind: Notice["kind"], title: string, body?: string): void;
}

export function useRoomSession(
  roomId: string,
  password?: string,
  attempt = 0,
) {
  const [state, setState] = useState<RoomViewState>(() => emptyRoomState());
  const sessionRef = useRef<RoomSession | null>(null);

  useEffect(() => {
    const session = new RoomSession({ roomId, password });
    sessionRef.current = session;
    const unsubscribe = session.subscribe(() => setState(session.getState()));
    void session.start();
    return () => {
      unsubscribe();
      session.destroy();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [roomId, password, attempt]);

  const actions = useMemo<RoomActions>(
    () => ({
      sendFiles: (files, target = "all") =>
        sessionRef.current?.sendFiles(files, target) ?? 0,
      hasConnectedPeer: () => sessionRef.current?.hasConnectedPeer() ?? false,
      pauseTransfer: (id) => sessionRef.current?.pauseTransfer(id),
      resumeTransfer: (id) => sessionRef.current?.resumeTransfer(id),
      cancelTransfer: (id) => sessionRef.current?.cancelTransfer(id),
      retryTransfer: (id) => sessionRef.current?.retryTransfer(id),
      pauseAll: () => sessionRef.current?.pauseAll(),
      resumeAll: () => sessionRef.current?.resumeAll(),
      cancelAll: () => sessionRef.current?.cancelAll(),
      acceptIncoming: (id) =>
        sessionRef.current?.acceptIncoming(id) ?? Promise.resolve(false),
      rejectIncoming: (id) => sessionRef.current?.rejectIncoming(id),
      updateLocalName: (name) => sessionRef.current?.updateLocalName(name),
      retryConnection: (peerId) => sessionRef.current?.retryConnection(peerId),
      dismissNotice: (id) => sessionRef.current?.dismissNotice(id),
      dismissTransfer: (id) => sessionRef.current?.dismissTransfer(id),
      dismissFinished: () => sessionRef.current?.dismissFinished(),
      notify: (kind, title, body) => sessionRef.current?.pushNotice(kind, title, body),
    }),
    [],
  );

  return { state, actions };
}

export type { RoomViewState, Notice, IncomingOffer };
