import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireNationOwner } from "../auth/principal.js";
import { emitRealtime } from "../realtime.js";
import {
  createNationConversation,
  getNationConversation,
  getNationInbox,
  inboxConversationNationIds,
  respondToDiplomaticOffer,
  sendNationMessage,
  updateConversationMembership
} from "../services/inboxService.js";

const nationParams = z.object({ nationId: z.string().min(1) });
const messageBody = z.object({ bodyMarkdown: z.string().trim().min(1).max(5000) });
const offerSchema = z.object({
  type: z.enum(["GENERAL_PROPOSAL", "TRADE_PROPOSAL", "NON_AGGRESSION_PROPOSAL", "ALLIANCE_PROPOSAL", "AID_REQUEST"]),
  title: z.string().trim().min(1).max(120),
  termsMarkdown: z.string().trim().min(1).max(3000)
});

function emitPrivate(
  eventName: "inbox:thread-created" | "inbox:message-created" | "inbox:offer-updated",
  nationIds: string[],
  data: Record<string, unknown>
) {
  for (const nationId of nationIds) emitRealtime(eventName, { nationId, ...data });
}

export async function registerInboxRoutes(app: FastifyInstance) {
  app.get("/api/nations/:nationId/inbox", async (request) => {
    const { nationId } = nationParams.parse(request.params);
    await requireNationOwner(request, nationId);
    const query = z
      .object({
        archived: z
          .enum(["true", "false"])
          .optional()
          .transform((value) => value === "true"),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).optional()
      })
      .parse(request.query);
    return getNationInbox(nationId, query);
  });
  app.post("/api/nations/:nationId/inbox/conversations", async (request, reply) => {
    const { nationId } = nationParams.parse(request.params);
    await requireNationOwner(request, nationId);
    const input = z
      .object({
        recipientNationId: z.string().min(1),
        subject: z.string().trim().min(1).max(120),
        bodyMarkdown: z.string().trim().min(1).max(5000),
        kind: z.enum(["DIRECT", "DIPLOMATIC"]),
        offer: offerSchema.optional()
      })
      .parse(request.body);
    const conversation = await createNationConversation(nationId, input);
    const nationIds = conversation.correspondents.map((nation) => nation.id);
    emitPrivate("inbox:thread-created", nationIds, { conversationId: conversation.id, conversation });
    return reply.code(201).send(conversation);
  });
  app.get("/api/nations/:nationId/inbox/conversations/:conversationId", async (request) => {
    const { nationId, conversationId } = z
      .object({ nationId: z.string(), conversationId: z.string() })
      .parse(request.params);
    await requireNationOwner(request, nationId);
    return getNationConversation(nationId, conversationId);
  });
  app.post("/api/nations/:nationId/inbox/conversations/:conversationId/messages", async (request, reply) => {
    const { nationId, conversationId } = z
      .object({ nationId: z.string(), conversationId: z.string() })
      .parse(request.params);
    await requireNationOwner(request, nationId);
    const message = await sendNationMessage(nationId, conversationId, messageBody.parse(request.body));
    emitPrivate("inbox:message-created", await inboxConversationNationIds(conversationId), { conversationId, message });
    return reply.code(201).send(message);
  });
  app.patch("/api/nations/:nationId/inbox/conversations/:conversationId", async (request) => {
    const { nationId, conversationId } = z
      .object({ nationId: z.string(), conversationId: z.string() })
      .parse(request.params);
    await requireNationOwner(request, nationId);
    const input = z
      .object({ read: z.boolean().optional(), archived: z.boolean().optional() })
      .refine((value) => value.read !== undefined || value.archived !== undefined)
      .parse(request.body);
    return updateConversationMembership(nationId, conversationId, input);
  });
  app.post("/api/nations/:nationId/inbox/offers/:offerId/respond", async (request) => {
    const { nationId, offerId } = z.object({ nationId: z.string(), offerId: z.string() }).parse(request.params);
    await requireNationOwner(request, nationId);
    const { status } = z.object({ status: z.enum(["ACCEPTED", "DECLINED", "WITHDRAWN"]) }).parse(request.body);
    const offer = await respondToDiplomaticOffer(nationId, offerId, status);
    emitPrivate("inbox:offer-updated", await inboxConversationNationIds(offer.conversationId), {
      conversationId: offer.conversationId,
      offer
    });
    return offer;
  });
}
