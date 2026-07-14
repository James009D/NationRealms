-- CreateEnum
CREATE TYPE "GovernmentType" AS ENUM ('DEMOCRACY', 'REPUBLIC', 'MONARCHY', 'DICTATORSHIP', 'COUNCIL', 'THEOCRACY', 'DEMOCRATIC_REPUBLIC', 'CONSTITUTIONAL_MONARCHY', 'FEDERAL_UNION', 'SOCIALIST_REPUBLIC', 'TECHNOCRACY', 'MILITARY_DIRECTORATE', 'CORPORATE_STATE', 'TRIBAL_CONFEDERATION', 'CITY_STATE_LEAGUE');

-- CreateEnum
CREATE TYPE "EconomyType" AS ENUM ('MIXED', 'MARKET', 'PLANNED', 'SUBSISTENCE', 'COMMAND', 'MIXED_MARKET', 'PLANNED_ECONOMY', 'FREE_MARKET', 'RESOURCE_EXTRACTION', 'AGRARIAN', 'INDUSTRIAL', 'POST_INDUSTRIAL', 'COMMAND_ECONOMY', 'TRADE_BASED', 'TECHNOLOGICAL');

-- CreateEnum
CREATE TYPE "FoundingOrigin" AS ENUM ('OLD_KINGDOM', 'REVOLUTIONARY_REPUBLIC', 'COLONIAL_SUCCESSOR', 'FRONTIER_SETTLEMENT', 'MERCHANT_LEAGUE', 'MILITARY_JUNTA', 'SPIRITUAL_COMMONWEALTH', 'INDUSTRIAL_UNION', 'TECHNOCRATIC_PROJECT', 'NOMADIC_CONFEDERATION');

-- CreateEnum
CREATE TYPE "NationPostType" AS ENUM ('NEWS', 'SPEECH', 'GOVERNMENT_UPDATE', 'IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'DRAFT');

-- CreateEnum
CREATE TYPE "PostContentFormat" AS ENUM ('MARKDOWN', 'PLAIN_TEXT');

-- CreateEnum
CREATE TYPE "PostSourceType" AS ENUM ('PLAYER', 'EVENT');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('ECONOMY', 'POLITICS', 'ENVIRONMENT', 'SECURITY', 'DIPLOMACY', 'CULTURE', 'STABILITY', 'LIBERTY', 'AUTHORITY', 'MILITARY', 'TECHNOLOGY', 'PUBLIC_TRUST', 'MAP_LOCATION', 'AGENT', 'ROLEPLAY_NEWS');

-- CreateEnum
CREATE TYPE "ActiveEventStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MapLocationType" AS ENUM ('CAPITAL', 'CITY', 'TOWN', 'PORT', 'MILITARY_BASE', 'MINE', 'FARM', 'RESOURCE_SITE');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('FOOD', 'IRON', 'OIL', 'RARE_EARTH', 'TIMBER', 'FISH', 'ENERGY');

-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('HEAD_OF_STATE', 'GENERAL', 'GOVERNOR', 'DIPLOMAT', 'ENGINEER', 'INTELLIGENCE', 'TRADE_MINISTER', 'SCIENTIST_ADVISOR');

-- CreateEnum
CREATE TYPE "AgentAssignment" AS ENUM ('IDLE', 'GOVERNING', 'COMMANDING', 'GUARDING', 'SPEAKING', 'IMPROVING');

-- CreateEnum
CREATE TYPE "MilitaryUnitType" AS ENUM ('INFANTRY', 'ARMOR', 'NAVAL', 'AIR', 'ARTILLERY', 'SUPPORT', 'RECON');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "demonym" TEXT,
    "motto" TEXT NOT NULL,
    "governmentType" "GovernmentType" NOT NULL,
    "economyType" "EconomyType" NOT NULL,
    "foundingOrigin" "FoundingOrigin" NOT NULL DEFAULT 'REVOLUTIONARY_REPUBLIC',
    "cultureSummary" TEXT NOT NULL,
    "description" TEXT,
    "capitalName" TEXT NOT NULL,
    "flagUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#2f6f73',
    "secondaryColor" TEXT NOT NULL DEFAULT '#f0c96d',
    "accentColor" TEXT NOT NULL DEFAULT '#f3efe3',
    "emblemSymbol" TEXT NOT NULL DEFAULT 'Star',
    "cultureTraitsJson" JSONB NOT NULL DEFAULT '[]',
    "ideologyJson" JSONB NOT NULL DEFAULT '{}',
    "currentTurn" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NationStats" (
    "id" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "economy" INTEGER NOT NULL,
    "stability" INTEGER NOT NULL,
    "liberty" INTEGER NOT NULL,
    "authority" INTEGER NOT NULL,
    "military" INTEGER NOT NULL,
    "technology" INTEGER NOT NULL,
    "environment" INTEGER NOT NULL,
    "publicTrust" INTEGER NOT NULL,

    CONSTRAINT "NationStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NationPost" (
    "id" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "type" "NationPostType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "format" "PostContentFormat" NOT NULL DEFAULT 'MARKDOWN',
    "sourceType" "PostSourceType" NOT NULL DEFAULT 'PLAYER',
    "sourceEventHistoryId" TEXT,
    "mediaUrl" TEXT,
    "visibility" "PostVisibility" NOT NULL DEFAULT 'PUBLIC',
    "tagsJson" JSONB NOT NULL DEFAULT '[]',
    "excerpt" TEXT,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NationPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "EventCategory" NOT NULL,
    "tagsJson" JSONB NOT NULL DEFAULT '[]',
    "eligibilityJson" JSONB NOT NULL DEFAULT '{}',
    "choicesJson" JSONB NOT NULL,
    "effectsJson" JSONB NOT NULL DEFAULT '{}',
    "weight" INTEGER NOT NULL DEFAULT 10,
    "cooldownTurns" INTEGER,
    "followUpEventKeysJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveEvent" (
    "id" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "eventTemplateId" TEXT NOT NULL,
    "status" "ActiveEventStatus" NOT NULL DEFAULT 'ACTIVE',
    "selectedChoiceId" TEXT,
    "resultSummary" TEXT,
    "generatedTurn" INTEGER NOT NULL DEFAULT 1,
    "expiresTurn" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ActiveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolvedEvent" (
    "id" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "eventTemplateId" TEXT NOT NULL,
    "activeEventId" TEXT,
    "title" TEXT NOT NULL,
    "selectedChoiceId" TEXT NOT NULL,
    "selectedChoiceLabel" TEXT NOT NULL,
    "resultSummary" TEXT NOT NULL,
    "effectsJson" JSONB NOT NULL,
    "turn" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResolvedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapLocation" (
    "id" TEXT NOT NULL,
    "nationId" TEXT,
    "name" TEXT NOT NULL,
    "type" "MapLocationType" NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "resourceType" "ResourceType",
    "population" INTEGER,
    "developmentLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterAgent" (
    "id" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AgentRole" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "loyalty" INTEGER NOT NULL DEFAULT 50,
    "health" INTEGER NOT NULL DEFAULT 100,
    "traitsJson" JSONB NOT NULL,
    "skillsJson" JSONB NOT NULL,
    "assignment" "AgentAssignment" NOT NULL DEFAULT 'IDLE',
    "assignedLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilitaryUnit" (
    "id" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MilitaryUnitType" NOT NULL,
    "strength" INTEGER NOT NULL,
    "movement" INTEGER NOT NULL,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "locationId" TEXT,
    "commanderAgentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilitaryUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Nation_userId_idx" ON "Nation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NationStats_nationId_key" ON "NationStats"("nationId");

-- CreateIndex
CREATE INDEX "NationPost_nationId_createdAt_idx" ON "NationPost"("nationId", "createdAt");

-- CreateIndex
CREATE INDEX "NationPost_sourceType_publishedAt_idx" ON "NationPost"("sourceType", "publishedAt");

-- CreateIndex
CREATE INDEX "NationPost_visibility_publishedAt_idx" ON "NationPost"("visibility", "publishedAt");

-- CreateIndex
CREATE INDEX "NationPost_sourceEventHistoryId_idx" ON "NationPost"("sourceEventHistoryId");

-- CreateIndex
CREATE UNIQUE INDEX "EventTemplate_key_key" ON "EventTemplate"("key");

-- CreateIndex
CREATE INDEX "ActiveEvent_nationId_status_idx" ON "ActiveEvent"("nationId", "status");

-- CreateIndex
CREATE INDEX "ActiveEvent_eventTemplateId_idx" ON "ActiveEvent"("eventTemplateId");

-- CreateIndex
CREATE INDEX "ResolvedEvent_nationId_turn_idx" ON "ResolvedEvent"("nationId", "turn");

-- CreateIndex
CREATE INDEX "ResolvedEvent_eventTemplateId_idx" ON "ResolvedEvent"("eventTemplateId");

-- CreateIndex
CREATE INDEX "ResolvedEvent_activeEventId_idx" ON "ResolvedEvent"("activeEventId");

-- CreateIndex
CREATE INDEX "MapLocation_nationId_idx" ON "MapLocation"("nationId");

-- CreateIndex
CREATE INDEX "MapLocation_x_y_idx" ON "MapLocation"("x", "y");

-- CreateIndex
CREATE INDEX "CharacterAgent_nationId_idx" ON "CharacterAgent"("nationId");

-- CreateIndex
CREATE INDEX "CharacterAgent_assignedLocationId_idx" ON "CharacterAgent"("assignedLocationId");

-- CreateIndex
CREATE INDEX "MilitaryUnit_nationId_idx" ON "MilitaryUnit"("nationId");

-- CreateIndex
CREATE INDEX "MilitaryUnit_locationId_idx" ON "MilitaryUnit"("locationId");

-- CreateIndex
CREATE INDEX "MilitaryUnit_commanderAgentId_idx" ON "MilitaryUnit"("commanderAgentId");

-- AddForeignKey
ALTER TABLE "Nation" ADD CONSTRAINT "Nation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NationStats" ADD CONSTRAINT "NationStats_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NationPost" ADD CONSTRAINT "NationPost_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NationPost" ADD CONSTRAINT "NationPost_sourceEventHistoryId_fkey" FOREIGN KEY ("sourceEventHistoryId") REFERENCES "ResolvedEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveEvent" ADD CONSTRAINT "ActiveEvent_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveEvent" ADD CONSTRAINT "ActiveEvent_eventTemplateId_fkey" FOREIGN KEY ("eventTemplateId") REFERENCES "EventTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolvedEvent" ADD CONSTRAINT "ResolvedEvent_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolvedEvent" ADD CONSTRAINT "ResolvedEvent_eventTemplateId_fkey" FOREIGN KEY ("eventTemplateId") REFERENCES "EventTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolvedEvent" ADD CONSTRAINT "ResolvedEvent_activeEventId_fkey" FOREIGN KEY ("activeEventId") REFERENCES "ActiveEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapLocation" ADD CONSTRAINT "MapLocation_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterAgent" ADD CONSTRAINT "CharacterAgent_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterAgent" ADD CONSTRAINT "CharacterAgent_assignedLocationId_fkey" FOREIGN KEY ("assignedLocationId") REFERENCES "MapLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilitaryUnit" ADD CONSTRAINT "MilitaryUnit_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilitaryUnit" ADD CONSTRAINT "MilitaryUnit_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "MapLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilitaryUnit" ADD CONSTRAINT "MilitaryUnit_commanderAgentId_fkey" FOREIGN KEY ("commanderAgentId") REFERENCES "CharacterAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
