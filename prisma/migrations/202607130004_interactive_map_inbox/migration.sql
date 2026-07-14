CREATE TYPE "ConversationKind" AS ENUM ('DIRECT', 'DIPLOMATIC');
CREATE TYPE "DiplomaticOfferType" AS ENUM ('GENERAL_PROPOSAL', 'TRADE_PROPOSAL', 'NON_AGGRESSION_PROPOSAL', 'ALLIANCE_PROPOSAL', 'AID_REQUEST');
CREATE TYPE "DiplomaticOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

CREATE TABLE "NationConversation" (
    "id" TEXT NOT NULL,
    "kind" "ConversationKind" NOT NULL DEFAULT 'DIRECT',
    "subject" TEXT NOT NULL,
    "createdByNationId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NationConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderNationId" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    CONSTRAINT "NationMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiplomaticOffer" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "proposerNationId" TEXT NOT NULL,
    "recipientNationId" TEXT NOT NULL,
    "type" "DiplomaticOfferType" NOT NULL,
    "title" TEXT NOT NULL,
    "termsMarkdown" TEXT NOT NULL,
    "status" "DiplomaticOfferStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiplomaticOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NationConversation_lastMessageAt_id_idx" ON "NationConversation"("lastMessageAt", "id");
CREATE INDEX "NationConversation_createdByNationId_idx" ON "NationConversation"("createdByNationId");
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_nationId_key" ON "ConversationParticipant"("conversationId", "nationId");
CREATE INDEX "ConversationParticipant_nationId_archivedAt_idx" ON "ConversationParticipant"("nationId", "archivedAt");
CREATE INDEX "NationMessage_conversationId_createdAt_id_idx" ON "NationMessage"("conversationId", "createdAt", "id");
CREATE INDEX "NationMessage_senderNationId_idx" ON "NationMessage"("senderNationId");
CREATE UNIQUE INDEX "DiplomaticOffer_messageId_key" ON "DiplomaticOffer"("messageId");
CREATE INDEX "DiplomaticOffer_conversationId_status_idx" ON "DiplomaticOffer"("conversationId", "status");
CREATE INDEX "DiplomaticOffer_recipientNationId_status_idx" ON "DiplomaticOffer"("recipientNationId", "status");
CREATE INDEX "DiplomaticOffer_proposerNationId_status_idx" ON "DiplomaticOffer"("proposerNationId", "status");

ALTER TABLE "NationConversation" ADD CONSTRAINT "NationConversation_createdByNationId_fkey" FOREIGN KEY ("createdByNationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "NationConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NationMessage" ADD CONSTRAINT "NationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "NationConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NationMessage" ADD CONSTRAINT "NationMessage_senderNationId_fkey" FOREIGN KEY ("senderNationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiplomaticOffer" ADD CONSTRAINT "DiplomaticOffer_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "NationConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiplomaticOffer" ADD CONSTRAINT "DiplomaticOffer_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "NationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiplomaticOffer" ADD CONSTRAINT "DiplomaticOffer_proposerNationId_fkey" FOREIGN KEY ("proposerNationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiplomaticOffer" ADD CONSTRAINT "DiplomaticOffer_recipientNationId_fkey" FOREIGN KEY ("recipientNationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
