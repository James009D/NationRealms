-- Foundation Step 9: settlements, owned regions, workforce, and settlement projects.
CREATE TYPE "InfrastructureLinkScope" AS ENUM ('MAJOR', 'REGIONAL_LEGACY');
CREATE TYPE "SettlementType" AS ENUM ('CAPITAL', 'SECONDARY');
CREATE TYPE "SettlementLevel" AS ENUM ('TOWN', 'CITY', 'MAJOR_CITY', 'METROPOLIS');
CREATE TYPE "SettlementSpecialization" AS ENUM ('AGRICULTURAL', 'INDUSTRIAL', 'COMMERCIAL', 'RESEARCH', 'MILITARY', 'ADMINISTRATIVE', 'CULTURAL', 'PORT_CITY', 'MINING', 'ENERGY');
CREATE TYPE "GovernorPriority" AS ENUM ('GROWTH', 'PRODUCTION', 'FOOD_SECURITY', 'COMMERCE', 'RESEARCH', 'MILITARY', 'STABILITY', 'BALANCED');
CREATE TYPE "TransportationLevel" AS ENUM ('ISOLATED', 'TRAILS', 'ROADS', 'IMPROVED_ROADS', 'RAIL', 'ADVANCED_NETWORK');
CREATE TYPE "SettlementProjectType" AS ENUM ('BUILDING', 'SETTLEMENT_UPGRADE', 'REGIONAL_IMPROVEMENT', 'SPECIALIZATION_CHANGE', 'NETWORK_RESTORATION');
CREATE TYPE "SettlementSpecializationSlot" AS ENUM ('PRIMARY', 'SECONDARY');
CREATE TYPE "SettlementProjectStatus" AS ENUM ('QUEUED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "SettlementJobCategory" AS ENUM ('FOOD', 'RESOURCE_SITE', 'INDUSTRY', 'COMMERCE', 'RESEARCH', 'ADMINISTRATION', 'MILITARY', 'SPECIALIST');

ALTER TYPE "MapLocationType" ADD VALUE IF NOT EXISTS 'OUTPOST';
ALTER TYPE "MapLocationType" ADD VALUE IF NOT EXISTS 'FORT';
ALTER TYPE "MapLocationType" ADD VALUE IF NOT EXISTS 'PORT_SITE';

ALTER TABLE "WorldMap" ADD COLUMN "populationPerLevel" INTEGER NOT NULL DEFAULT 100000;
ALTER TABLE "WorldTile" ADD COLUMN "regionId" TEXT;
ALTER TABLE "InfrastructureLink" ADD COLUMN "scope" "InfrastructureLinkScope" NOT NULL DEFAULT 'MAJOR';

CREATE TABLE "WorldRegion" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "transportationLevel" "TransportationLevel" NOT NULL DEFAULT 'ISOLATED',
  "networkReliability" INTEGER NOT NULL DEFAULT 100,
  "neglectTurns" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorldRegion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Settlement" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "regionId" TEXT,
  "type" "SettlementType" NOT NULL,
  "level" "SettlementLevel" NOT NULL,
  "residentPopulation" INTEGER NOT NULL,
  "populationLevel" INTEGER NOT NULL,
  "growthProgress" INTEGER NOT NULL DEFAULT 0,
  "storedFood" INTEGER NOT NULL DEFAULT 20,
  "health" INTEGER NOT NULL DEFAULT 70,
  "stability" INTEGER NOT NULL DEFAULT 60,
  "primarySpecialization" "SettlementSpecialization",
  "secondarySpecialization" "SettlementSpecialization",
  "governorPriority" "GovernorPriority" NOT NULL DEFAULT 'BALANCED',
  "governorAgentId" TEXT,
  "foodShortageTurns" INTEGER NOT NULL DEFAULT 0,
  "activatedTurn" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementWorkforceAssignment" (
  "id" TEXT NOT NULL, "settlementId" TEXT NOT NULL, "jobKey" TEXT NOT NULL,
  "category" "SettlementJobCategory" NOT NULL, "assigned" INTEGER NOT NULL DEFAULT 0,
  "targetLocationId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SettlementWorkforceAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementBuilding" (
  "id" TEXT NOT NULL, "settlementId" TEXT NOT NULL, "definitionKey" TEXT NOT NULL,
  "completedTurn" INTEGER NOT NULL, "effectiveTurn" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementBuilding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementProject" (
  "id" TEXT NOT NULL, "nationId" TEXT NOT NULL, "settlementId" TEXT NOT NULL, "regionId" TEXT,
  "engineerAgentId" TEXT, "type" "SettlementProjectType" NOT NULL,
  "specializationSlot" "SettlementSpecializationSlot", "definitionKey" TEXT NOT NULL,
  "status" "SettlementProjectStatus" NOT NULL DEFAULT 'QUEUED', "startedTurn" INTEGER NOT NULL,
  "completesTurn" INTEGER NOT NULL, "effectiveTurn" INTEGER NOT NULL, "treasuryCost" INTEGER NOT NULL,
  "resourceCostsJson" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3), CONSTRAINT "SettlementProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegionalImprovement" (
  "id" TEXT NOT NULL, "regionId" TEXT NOT NULL, "definitionKey" TEXT NOT NULL, "level" INTEGER NOT NULL DEFAULT 1,
  "completedTurn" INTEGER NOT NULL, "effectiveTurn" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegionalImprovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementHistoryEntry" (
  "id" TEXT NOT NULL, "nationId" TEXT NOT NULL, "settlementId" TEXT NOT NULL, "turn" INTEGER NOT NULL,
  "type" TEXT NOT NULL, "summary" TEXT NOT NULL, "detailsJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SettlementHistoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Settlement_locationId_key" ON "Settlement"("locationId");
CREATE UNIQUE INDEX "Settlement_regionId_key" ON "Settlement"("regionId");
CREATE UNIQUE INDEX "Settlement_governorAgentId_key" ON "Settlement"("governorAgentId");
CREATE INDEX "Settlement_nationId_idx" ON "Settlement"("nationId");
CREATE INDEX "Settlement_nationId_level_idx" ON "Settlement"("nationId", "level");
CREATE INDEX "WorldRegion_nationId_idx" ON "WorldRegion"("nationId");
CREATE INDEX "WorldTile_regionId_idx" ON "WorldTile"("regionId");
CREATE UNIQUE INDEX "SettlementWorkforceAssignment_settlementId_jobKey_key" ON "SettlementWorkforceAssignment"("settlementId", "jobKey");
CREATE INDEX "SettlementWorkforceAssignment_targetLocationId_idx" ON "SettlementWorkforceAssignment"("targetLocationId");
CREATE UNIQUE INDEX "SettlementBuilding_settlementId_definitionKey_key" ON "SettlementBuilding"("settlementId", "definitionKey");
CREATE INDEX "SettlementProject_nationId_status_idx" ON "SettlementProject"("nationId", "status");
CREATE INDEX "SettlementProject_settlementId_status_idx" ON "SettlementProject"("settlementId", "status");
CREATE UNIQUE INDEX "RegionalImprovement_regionId_definitionKey_key" ON "RegionalImprovement"("regionId", "definitionKey");
CREATE INDEX "SettlementHistoryEntry_settlementId_turn_idx" ON "SettlementHistoryEntry"("settlementId", "turn");
CREATE INDEX "SettlementHistoryEntry_nationId_turn_idx" ON "SettlementHistoryEntry"("nationId", "turn");

ALTER TABLE "WorldRegion" ADD CONSTRAINT "WorldRegion_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldTile" ADD CONSTRAINT "WorldTile_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "WorldRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "MapLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "WorldRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_governorAgentId_fkey" FOREIGN KEY ("governorAgentId") REFERENCES "CharacterAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SettlementWorkforceAssignment" ADD CONSTRAINT "SettlementWorkforceAssignment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementBuilding" ADD CONSTRAINT "SettlementBuilding_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementProject" ADD CONSTRAINT "SettlementProject_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementProject" ADD CONSTRAINT "SettlementProject_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementProject" ADD CONSTRAINT "SettlementProject_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "WorldRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SettlementProject" ADD CONSTRAINT "SettlementProject_engineerAgentId_fkey" FOREIGN KEY ("engineerAgentId") REFERENCES "CharacterAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegionalImprovement" ADD CONSTRAINT "RegionalImprovement_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "WorldRegion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementHistoryEntry" ADD CONSTRAINT "SettlementHistoryEntry_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementHistoryEntry" ADD CONSTRAINT "SettlementHistoryEntry_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WorldRegion" ("id", "nationId", "name", "transportationLevel", "networkReliability", "neglectTurns", "updatedAt")
SELECT 'region-' || l."id", l."nationId", l."name" || ' Region', 'TRAILS', 100, 0, CURRENT_TIMESTAMP
FROM "MapLocation" l WHERE l."nationId" IS NOT NULL AND l."type" IN ('CAPITAL', 'CITY', 'TOWN');

WITH secondary_population AS (
  SELECT "nationId", COALESCE(SUM(CASE WHEN "type" <> 'CAPITAL' THEN COALESCE("population", 0) ELSE 0 END), 0) AS amount
  FROM "MapLocation" WHERE "type" IN ('CAPITAL', 'CITY', 'TOWN') GROUP BY "nationId"
)
INSERT INTO "Settlement" ("id", "nationId", "locationId", "regionId", "type", "level", "residentPopulation", "populationLevel", "storedFood", "health", "stability", "activatedTurn", "updatedAt")
SELECT 'settlement-' || l."id", l."nationId", l."id", 'region-' || l."id",
  CASE WHEN l."type" = 'CAPITAL' THEN 'CAPITAL'::"SettlementType" ELSE 'SECONDARY'::"SettlementType" END,
  CASE WHEN l."type" = 'TOWN' THEN 'TOWN'::"SettlementLevel" ELSE 'CITY'::"SettlementLevel" END,
  GREATEST(1, CASE WHEN l."type" = 'CAPITAL' THEN COALESCE(e."population", l."population", 100000) - COALESCE(s.amount, 0) ELSE COALESCE(l."population", 100000) END),
  GREATEST(1, ROUND((CASE WHEN l."type" = 'CAPITAL' THEN COALESCE(e."population", l."population", 100000) - COALESCE(s.amount, 0) ELSE COALESCE(l."population", 100000) END)::numeric / 100000)::integer),
  20, 70, COALESCE(ns."stability", 60), 1, CURRENT_TIMESTAMP
FROM "MapLocation" l
LEFT JOIN "NationEconomy" e ON e."nationId" = l."nationId"
LEFT JOIN secondary_population s ON s."nationId" = l."nationId"
LEFT JOIN "NationStats" ns ON ns."nationId" = l."nationId"
WHERE l."nationId" IS NOT NULL AND l."type" IN ('CAPITAL', 'CITY', 'TOWN');

UPDATE "WorldTile" wt SET "regionId" = 'region-' || l."id"
FROM "MapLocation" l WHERE l."worldTileId" = wt."id" AND l."type" IN ('CAPITAL', 'CITY', 'TOWN');

UPDATE "InfrastructureLink" link SET "scope" = 'REGIONAL_LEGACY'
WHERE EXISTS (SELECT 1 FROM "MapLocation" l WHERE l."id" IN (link."fromLocationId", link."toLocationId") AND l."type" NOT IN ('CAPITAL', 'CITY', 'TOWN'));
