import type { DateString, ID } from "./index.js";

export type ConversationKind = "DIRECT" | "DIPLOMATIC";
export type DiplomaticOfferType =
  "GENERAL_PROPOSAL" | "TRADE_PROPOSAL" | "NON_AGGRESSION_PROPOSAL" | "ALLIANCE_PROPOSAL" | "AID_REQUEST";
export type DiplomaticOfferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "WITHDRAWN";

export interface CorrespondentNation {
  id: ID;
  name: string;
  flagUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  emblemSymbol: string;
}

export interface NationMessage {
  id: ID;
  conversationId: ID;
  senderNation: CorrespondentNation;
  bodyMarkdown: string;
  createdAt: DateString;
  editedAt?: DateString | null;
}

export interface DiplomaticOffer {
  id: ID;
  conversationId: ID;
  messageId: ID;
  proposerNation: CorrespondentNation;
  recipientNation: CorrespondentNation;
  type: DiplomaticOfferType;
  title: string;
  termsMarkdown: string;
  status: DiplomaticOfferStatus;
  respondedAt?: DateString | null;
  createdAt: DateString;
  updatedAt: DateString;
}

export interface NationConversationSummary {
  id: ID;
  kind: ConversationKind;
  subject: string;
  correspondents: CorrespondentNation[];
  lastMessage?: NationMessage | null;
  pendingOffer?: DiplomaticOffer | null;
  unread: boolean;
  archived: boolean;
  lastMessageAt: DateString;
  createdAt: DateString;
}

export interface NationConversation extends NationConversationSummary {
  messages: NationMessage[];
  offers: DiplomaticOffer[];
}

export interface NationInboxPage {
  nationId: ID;
  conversations: NationConversationSummary[];
  unreadCount: number;
  nextCursor?: string | null;
}

export interface CreateConversationInput {
  recipientNationId: ID;
  subject: string;
  bodyMarkdown: string;
  kind: ConversationKind;
  offer?: {
    type: DiplomaticOfferType;
    title: string;
    termsMarkdown: string;
  };
}

export interface SendNationMessageInput {
  bodyMarkdown: string;
}
