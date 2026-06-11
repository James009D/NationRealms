import type { Server } from "socket.io";

type RealtimeEventName =
  | "nation:post-created"
  | "event:generated"
  | "event:choice-resolved"
  | "agent:assigned"
  | "military:unit-moved";

let io: Server | null = null;

export function setRealtimeServer(server: Server) {
  io = server;
}

export function emitRealtime<TPayload>(eventName: RealtimeEventName, payload: TPayload) {
  io?.emit(eventName, {
    ...((payload && typeof payload === "object" ? payload : { payload }) as object),
    emittedAt: new Date().toISOString()
  });
}
