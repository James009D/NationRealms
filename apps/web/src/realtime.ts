import { io, type Socket } from "socket.io-client";
import type { ActiveEvent, EventResolutionResult, NationPost } from "@statecraft/shared";

const SOCKET_URL = import.meta.env.VITE_API_URL || undefined;

let socket: Socket | null = null;

function getSocket() {
  socket ??= io(SOCKET_URL, {
    transports: ["websocket", "polling"]
  });

  return socket;
}

export type RealtimePayloads = {
  "nation:post-created": {
    nationId: string;
    post: NationPost;
    emittedAt: string;
  };
  "event:generated": {
    nationId: string;
    activeEvent: ActiveEvent;
    emittedAt: string;
  };
  "event:choice-resolved": {
    activeEventId: string;
    result: EventResolutionResult;
    emittedAt: string;
  };
};

export function subscribeToRealtimeEvent<TEvent extends keyof RealtimePayloads>(
  eventName: TEvent,
  handler: (payload: RealtimePayloads[TEvent]) => void
) {
  const activeSocket = getSocket();
  const untypedSocket = activeSocket as {
    on(eventName: string, listener: (...args: unknown[]) => void): void;
    off(eventName: string, listener: (...args: unknown[]) => void): void;
  };
  const listener = handler as (...args: unknown[]) => void;
  untypedSocket.on(eventName, listener);

  return () => {
    untypedSocket.off(eventName, listener);
  };
}
