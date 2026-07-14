import { io, type Socket } from "socket.io-client";
import type {
  ActiveEvent,
  EventResolutionResult,
  NationPost,
  LocationUpgradeProject,
  RealtimeEnvelope,
  TurnResolution,
  TechnologyAgeDefinition,
  InfrastructureProject,
  SettlementProject,
  SettlementTurnOutcome,
  SettlementView,
  NationConversation,
  NationMessage,
  DiplomaticOffer
} from "@statecraft/shared";

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
  };
  "nation:post-updated": {
    nationId: string;
    post: NationPost;
  };
  "nation:post-deleted": {
    nationId: string;
    postId: string;
    post: NationPost;
  };
  "event:generated": {
    nationId: string;
    activeEvent: ActiveEvent;
  };
  "event:choice-resolved": {
    activeEventId: string;
    result: EventResolutionResult;
  };
  "nation:turn-advanced": { nationId: string; turn: TurnResolution };
  "location:upgrade-started": { nationId: string; project: LocationUpgradeProject };
  "location:upgrade-completed": { nationId: string; project: LocationUpgradeProject };
  "location:upgrade-cancelled": { nationId: string; project: LocationUpgradeProject };
  "technology:unlocked": { nationId: string; nodeKey: string; result: unknown };
  "technology:age-changed": {
    nationId: string;
    previousAge: TechnologyAgeDefinition;
    currentAge: TechnologyAgeDefinition;
  };
  "world:territory-claimed": { nationId: string };
  "infrastructure:project-started": { nationId: string; project: InfrastructureProject };
  "infrastructure:project-completed": { nationId: string; project: InfrastructureProject };
  "infrastructure:project-cancelled": { nationId: string; project: InfrastructureProject };
  "infrastructure:link-disabled": { nationId: string; linkId: string };
  "settlement:updated": {
    nationId: string;
    settlementId: string;
    settlement?: SettlementView;
    project?: SettlementProject;
  };
  "settlement:population-grown": { nationId: string; settlementId: string; outcome: SettlementTurnOutcome };
  "settlement:population-lost": { nationId: string; settlementId: string; outcome: SettlementTurnOutcome };
  "settlement:project-completed": { nationId: string; settlementId: string; project: SettlementProject };
  "settlement:upgraded": { nationId: string; settlementId: string };
  "settlement:stability-changed": { nationId: string; settlementId: string };
  "settlement:shortage-started": { nationId: string; settlementId: string; outcome: SettlementTurnOutcome };
  "settlement:shortage-ended": { nationId: string; settlementId: string; outcome: SettlementTurnOutcome };
  "territory:claim-started": { nationId: string; claimId: string };
  "territory:claim-cancelled": { nationId: string; claimId: string };
  "territory:tiles-claimed": { nationId: string; tileIds: string[] };
  "outpost:project-started": { nationId: string; outpostId: string };
  "outpost:established": { nationId: string; outpostId: string };
  "outpost:supply-changed": { nationId: string; outpostId: string };
  "civilian:unit-moved": { nationId: string; unitId: string };
  "civilian:unit-created": { nationId: string; unitId: string };
  "settlement:founding-started": { nationId: string; projectId: string };
  "settlement:founded": { nationId: string; settlementId: string };
  "agent:moved": { nationId: string; agentId: string };
  "agent:action-completed": { nationId: string; agentId: string };
  "agent:assigned": { nationId: string; agentId: string };
  "military:unit-moved": { nationId: string; unitId: string };
  "inbox:thread-created": { nationId: string; conversationId: string; conversation: NationConversation };
  "inbox:message-created": { nationId: string; conversationId: string; message: NationMessage };
  "inbox:offer-updated": { nationId: string; conversationId: string; offer: DiplomaticOffer };
};

export function subscribeToRealtimeEvent<TEvent extends keyof RealtimePayloads>(
  eventName: TEvent,
  handler: (payload: RealtimePayloads[TEvent]) => void,
  nationId?: string
) {
  const activeSocket = getSocket();
  const untypedSocket = activeSocket as {
    on(eventName: string, listener: (...args: unknown[]) => void): void;
    off(eventName: string, listener: (...args: unknown[]) => void): void;
  };
  const listener = ((value: unknown) => {
    const envelope = value as RealtimeEnvelope<RealtimePayloads[TEvent]>;
    handler(envelope?.version === 1 ? envelope.data : (value as RealtimePayloads[TEvent]));
  }) as (...args: unknown[]) => void;
  if (nationId) activeSocket.emit("nation:subscribe", nationId);
  untypedSocket.on(eventName, listener);

  return () => {
    untypedSocket.off(eventName, listener);
    if (nationId) activeSocket.emit("nation:unsubscribe", nationId);
  };
}
