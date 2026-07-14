import type { Server } from "socket.io";

type RealtimeEventName =
  | "nation:post-created"
  | "nation:post-updated"
  | "nation:post-deleted"
  | "event:generated"
  | "event:choice-resolved"
  | "nation:turn-advanced"
  | "location:upgrade-started"
  | "location:upgrade-completed"
  | "location:upgrade-cancelled"
  | "technology:unlocked"
  | "technology:age-changed"
  | "world:territory-claimed"
  | "infrastructure:project-started"
  | "infrastructure:project-completed"
  | "infrastructure:project-cancelled"
  | "infrastructure:link-disabled"
  | "settlement:updated"
  | "settlement:population-grown"
  | "settlement:population-lost"
  | "settlement:project-completed"
  | "settlement:upgraded"
  | "settlement:stability-changed"
  | "settlement:shortage-started"
  | "settlement:shortage-ended"
  | "territory:claim-started"
  | "territory:claim-cancelled"
  | "territory:tiles-claimed"
  | "outpost:project-started"
  | "outpost:established"
  | "outpost:supply-changed"
  | "civilian:unit-moved"
  | "civilian:unit-created"
  | "settlement:founding-started"
  | "settlement:founded"
  | "agent:moved"
  | "agent:action-completed"
  | "agent:assigned"
  | "military:unit-moved"
  | "inbox:thread-created"
  | "inbox:message-created"
  | "inbox:offer-updated";

let io: Server | null = null;

export function setRealtimeServer(server: Server) {
  io = server;
}

export function emitRealtime<TPayload>(eventName: RealtimeEventName, payload: TPayload) {
  if (!io) return;
  const record = (payload && typeof payload === "object" ? payload : { payload }) as Record<string, unknown>;
  const nationId = typeof record.nationId === "string" ? record.nationId : undefined;
  const entityId =
    typeof record.postId === "string"
      ? record.postId
      : typeof record.activeEventId === "string"
        ? record.activeEventId
        : undefined;
  const envelope = {
    version: 1 as const,
    type: eventName,
    nationId,
    entityId,
    occurredAt: new Date().toISOString(),
    data: payload
  };

  if (nationId) io.to(`nation:${nationId}`).emit(eventName, envelope);
  const post = record.post as { visibility?: string } | undefined;
  if (eventName.startsWith("nation:post-") && post?.visibility === "PUBLIC") {
    io.to("public:feed").emit(eventName, envelope);
  }
}
