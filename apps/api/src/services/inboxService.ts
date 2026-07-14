import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type {
  CreateConversationInput,
  DiplomaticOffer,
  DiplomaticOfferStatus,
  NationConversation,
  NationConversationSummary,
  NationInboxPage,
  NationMessage,
  SendNationMessageInput
} from "@statecraft/shared";
import { getConfig } from "../config.js";
import { conflict, forbidden, notFound } from "../errors.js";
import { prisma } from "../prisma.js";
import { getFallbackNation } from "./fallbackDemo.js";
import { runSerializable } from "./transactions.js";

type MemoryParticipant = { nationId: string; lastReadAt: string | null; archivedAt: string | null };
const memoryConversations: NationConversation[] = [];
const memoryParticipants = new Map<string, MemoryParticipant[]>();

const nationSelect = {
  id: true,
  name: true,
  flagUrl: true,
  primaryColor: true,
  secondaryColor: true,
  accentColor: true,
  emblemSymbol: true
} satisfies Prisma.NationSelect;
const conversationInclude = Prisma.validator<Prisma.NationConversationInclude>()({
  participants: { include: { nation: { select: nationSelect } } },
  messages: { include: { senderNation: { select: nationSelect } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  offers: {
    include: {
      proposerNation: { select: nationSelect },
      recipientNation: { select: nationSelect }
    },
    orderBy: { createdAt: "asc" }
  }
});
type ConversationRecord = Prisma.NationConversationGetPayload<{ include: typeof conversationInclude }>;

const iso = (value: Date | string | null | undefined) =>
  value instanceof Date ? value.toISOString() : (value ?? null);

function fallbackCorrespondent(nationId: string) {
  const nation = getFallbackNation(nationId);
  if (!nation) throw notFound("Nation not found");
  return {
    id: nation.id,
    name: nation.name,
    flagUrl: nation.flagUrl,
    primaryColor: nation.primaryColor ?? "#2f6f73",
    secondaryColor: nation.secondaryColor ?? "#f0c96d",
    accentColor: nation.accentColor ?? "#f3efe3",
    emblemSymbol: nation.emblemSymbol ?? "Star"
  };
}

function serializeMessage(message: ConversationRecord["messages"][number]): NationMessage {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderNation: message.senderNation,
    bodyMarkdown: message.bodyMarkdown,
    createdAt: message.createdAt.toISOString(),
    editedAt: iso(message.editedAt)
  };
}

function serializeOffer(offer: ConversationRecord["offers"][number]): DiplomaticOffer {
  return {
    id: offer.id,
    conversationId: offer.conversationId,
    messageId: offer.messageId,
    proposerNation: offer.proposerNation,
    recipientNation: offer.recipientNation,
    type: offer.type,
    title: offer.title,
    termsMarkdown: offer.termsMarkdown,
    status: offer.status,
    respondedAt: iso(offer.respondedAt),
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString()
  };
}

function serializeConversation(record: ConversationRecord, nationId: string): NationConversation {
  const participant = record.participants.find((item) => item.nationId === nationId);
  const messages = record.messages.map(serializeMessage);
  const offers = record.offers.map(serializeOffer);
  return {
    id: record.id,
    kind: record.kind,
    subject: record.subject,
    correspondents: record.participants.map((item) => item.nation),
    lastMessage: messages.at(-1) ?? null,
    pendingOffer: [...offers].reverse().find((offer) => offer.status === "PENDING") ?? null,
    unread: !participant?.lastReadAt || record.lastMessageAt > participant.lastReadAt,
    archived: Boolean(participant?.archivedAt),
    lastMessageAt: record.lastMessageAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    messages,
    offers
  };
}

function memorySummary(conversation: NationConversation, nationId: string): NationConversationSummary {
  const participant = memoryParticipants.get(conversation.id)?.find((item) => item.nationId === nationId);
  const { messages: _messages, offers: _offers, ...summary } = conversation;
  return {
    ...summary,
    unread: !participant?.lastReadAt || conversation.lastMessageAt > participant.lastReadAt,
    archived: Boolean(participant?.archivedAt)
  };
}

function encodeCursor(item: NationConversationSummary) {
  return Buffer.from(JSON.stringify([item.lastMessageAt, item.id])).toString("base64url");
}

function decodeCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    return Array.isArray(value) && typeof value[0] === "string" && typeof value[1] === "string"
      ? { lastMessageAt: value[0], id: value[1] }
      : null;
  } catch {
    return null;
  }
}

export async function getNationInbox(
  nationId: string,
  input: { archived?: boolean; cursor?: string; limit?: number } = {}
): Promise<NationInboxPage> {
  const limit = Math.max(1, Math.min(50, input.limit ?? 20));
  const cursor = decodeCursor(input.cursor);
  if (getConfig().DATA_MODE === "memory") {
    if (!getFallbackNation(nationId)) throw notFound("Nation not found");
    const all = memoryConversations
      .filter((conversation) => memoryParticipants.get(conversation.id)?.some((item) => item.nationId === nationId))
      .map((conversation) => memorySummary(conversation, nationId))
      .filter((conversation) => conversation.archived === Boolean(input.archived))
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt) || b.id.localeCompare(a.id));
    const start = cursor ? Math.max(0, all.findIndex((item) => item.id === cursor.id) + 1) : 0;
    const conversations = all.slice(start, start + limit);
    return {
      nationId,
      conversations,
      unreadCount: all.filter((item) => item.unread).length,
      nextCursor: start + limit < all.length && conversations.length ? encodeCursor(conversations.at(-1)!) : null
    };
  }
  const where: Prisma.NationConversationWhereInput = {
    participants: { some: { nationId, archivedAt: input.archived ? { not: null } : null } },
    ...(cursor
      ? {
          OR: [
            { lastMessageAt: { lt: new Date(cursor.lastMessageAt) } },
            { lastMessageAt: new Date(cursor.lastMessageAt), id: { lt: cursor.id } }
          ]
        }
      : {})
  };
  const records = await prisma.nationConversation.findMany({
    where,
    include: conversationInclude,
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take: limit + 1
  });
  const conversations = records.slice(0, limit).map((record) => serializeConversation(record, nationId));
  const memberships = await prisma.conversationParticipant.findMany({
    where: { nationId, archivedAt: null },
    include: { conversation: { select: { lastMessageAt: true } } }
  });
  const unreadCount = memberships.filter(
    (item) => !item.lastReadAt || item.conversation.lastMessageAt > item.lastReadAt
  ).length;
  return {
    nationId,
    conversations,
    unreadCount,
    nextCursor: records.length > limit && conversations.length ? encodeCursor(conversations.at(-1)!) : null
  };
}

export async function getNationConversation(nationId: string, conversationId: string) {
  if (getConfig().DATA_MODE === "memory") {
    const conversation = memoryConversations.find((item) => item.id === conversationId);
    if (!conversation) throw notFound("Conversation not found");
    if (!memoryParticipants.get(conversationId)?.some((item) => item.nationId === nationId)) throw forbidden();
    return { ...conversation, ...memorySummary(conversation, nationId) };
  }
  const record = await prisma.nationConversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude
  });
  if (!record) throw notFound("Conversation not found");
  if (!record.participants.some((item) => item.nationId === nationId)) throw forbidden();
  return serializeConversation(record, nationId);
}

export async function createNationConversation(nationId: string, input: CreateConversationInput) {
  if (nationId === input.recipientNationId) throw conflict("A nation cannot message itself.");
  if (input.kind === "DIRECT" && input.offer) throw conflict("Diplomatic offers require a diplomatic conversation.");
  if (input.kind === "DIPLOMATIC" && !input.offer) throw conflict("A diplomatic conversation requires an offer.");
  if (getConfig().DATA_MODE === "memory") {
    const sender = fallbackCorrespondent(nationId);
    const recipient = fallbackCorrespondent(input.recipientNationId);
    const createdAt = new Date().toISOString();
    const conversationId = randomUUID();
    const message: NationMessage = {
      id: randomUUID(),
      conversationId,
      senderNation: sender,
      bodyMarkdown: input.bodyMarkdown,
      createdAt
    };
    const offer: DiplomaticOffer | null = input.offer
      ? {
          id: randomUUID(),
          conversationId,
          messageId: message.id,
          proposerNation: sender,
          recipientNation: recipient,
          ...input.offer,
          status: "PENDING",
          createdAt,
          updatedAt: createdAt
        }
      : null;
    const conversation: NationConversation = {
      id: conversationId,
      kind: input.kind,
      subject: input.subject,
      correspondents: [sender, recipient],
      lastMessage: message,
      pendingOffer: offer,
      unread: false,
      archived: false,
      lastMessageAt: createdAt,
      createdAt,
      messages: [message],
      offers: offer ? [offer] : []
    };
    memoryConversations.push(conversation);
    memoryParticipants.set(conversationId, [
      { nationId, lastReadAt: createdAt, archivedAt: null },
      { nationId: input.recipientNationId, lastReadAt: null, archivedAt: null }
    ]);
    return conversation;
  }
  const recipient = await prisma.nation.findUnique({ where: { id: input.recipientNationId }, select: { id: true } });
  if (!recipient) throw notFound("Recipient nation not found");
  const conversationId = await runSerializable(async (client) => {
    const conversation = await client.nationConversation.create({
      data: {
        kind: input.kind,
        subject: input.subject,
        createdByNationId: nationId,
        participants: { create: [{ nationId, lastReadAt: new Date() }, { nationId: input.recipientNationId }] }
      }
    });
    const message = await client.nationMessage.create({
      data: { conversationId: conversation.id, senderNationId: nationId, bodyMarkdown: input.bodyMarkdown }
    });
    if (input.offer)
      await client.diplomaticOffer.create({
        data: {
          conversationId: conversation.id,
          messageId: message.id,
          proposerNationId: nationId,
          recipientNationId: input.recipientNationId,
          type: input.offer.type,
          title: input.offer.title,
          termsMarkdown: input.offer.termsMarkdown
        }
      });
    await client.nationConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt }
    });
    return conversation.id;
  });
  return getNationConversation(nationId, conversationId);
}

export async function sendNationMessage(nationId: string, conversationId: string, input: SendNationMessageInput) {
  await getNationConversation(nationId, conversationId);
  if (getConfig().DATA_MODE === "memory") {
    const conversation = memoryConversations.find((item) => item.id === conversationId)!;
    const createdAt = new Date().toISOString();
    const message: NationMessage = {
      id: randomUUID(),
      conversationId,
      senderNation: fallbackCorrespondent(nationId),
      bodyMarkdown: input.bodyMarkdown,
      createdAt
    };
    conversation.messages.push(message);
    conversation.lastMessage = message;
    conversation.lastMessageAt = createdAt;
    const participant = memoryParticipants.get(conversationId)!.find((item) => item.nationId === nationId)!;
    participant.lastReadAt = createdAt;
    participant.archivedAt = null;
    return message;
  }
  return runSerializable(async (client) => {
    const message = await client.nationMessage.create({
      data: { conversationId, senderNationId: nationId, bodyMarkdown: input.bodyMarkdown },
      include: { senderNation: { select: nationSelect } }
    });
    await client.nationConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt }
    });
    await client.conversationParticipant.update({
      where: { conversationId_nationId: { conversationId, nationId } },
      data: { lastReadAt: message.createdAt, archivedAt: null }
    });
    return serializeMessage(message);
  });
}

export async function updateConversationMembership(
  nationId: string,
  conversationId: string,
  input: { read?: boolean; archived?: boolean }
) {
  await getNationConversation(nationId, conversationId);
  if (getConfig().DATA_MODE === "memory") {
    const participant = memoryParticipants.get(conversationId)!.find((item) => item.nationId === nationId)!;
    if (input.read) participant.lastReadAt = new Date().toISOString();
    if (typeof input.archived === "boolean") participant.archivedAt = input.archived ? new Date().toISOString() : null;
    return getNationConversation(nationId, conversationId);
  }
  await prisma.conversationParticipant.update({
    where: { conversationId_nationId: { conversationId, nationId } },
    data: {
      ...(input.read ? { lastReadAt: new Date() } : {}),
      ...(typeof input.archived === "boolean" ? { archivedAt: input.archived ? new Date() : null } : {})
    }
  });
  return getNationConversation(nationId, conversationId);
}

export async function respondToDiplomaticOffer(
  nationId: string,
  offerId: string,
  status: Extract<DiplomaticOfferStatus, "ACCEPTED" | "DECLINED" | "WITHDRAWN">
) {
  if (getConfig().DATA_MODE === "memory") {
    const conversation = memoryConversations.find((item) => item.offers.some((offer) => offer.id === offerId));
    const offer = conversation?.offers.find((item) => item.id === offerId);
    if (!offer) throw notFound("Diplomatic offer not found");
    if (!memoryParticipants.get(conversation!.id)?.some((item) => item.nationId === nationId)) throw forbidden();
    if (offer.status !== "PENDING") throw conflict("This diplomatic offer has already been resolved.");
    if (status === "WITHDRAWN" ? offer.proposerNation.id !== nationId : offer.recipientNation.id !== nationId)
      throw forbidden();
    offer.status = status;
    offer.respondedAt = new Date().toISOString();
    offer.updatedAt = offer.respondedAt;
    conversation!.pendingOffer = null;
    return offer;
  }
  const offer = await prisma.diplomaticOffer.findUnique({ where: { id: offerId } });
  if (!offer) throw notFound("Diplomatic offer not found");
  await getNationConversation(nationId, offer.conversationId);
  if (offer.status !== "PENDING") throw conflict("This diplomatic offer has already been resolved.");
  if (status === "WITHDRAWN" ? offer.proposerNationId !== nationId : offer.recipientNationId !== nationId)
    throw forbidden();
  const updated = await prisma.diplomaticOffer
    .update({
      where: { id: offerId, status: "PENDING" },
      data: { status, respondedAt: new Date() },
      include: { proposerNation: { select: nationSelect }, recipientNation: { select: nationSelect } }
    })
    .catch(() => {
      throw conflict("This diplomatic offer has already been resolved.");
    });
  return serializeOffer(updated);
}

export async function inboxConversationNationIds(conversationId: string) {
  if (getConfig().DATA_MODE === "memory")
    return memoryParticipants.get(conversationId)?.map((item) => item.nationId) ?? [];
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { nationId: true }
  });
  return participants.map((item) => item.nationId);
}
