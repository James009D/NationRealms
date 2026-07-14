CREATE TYPE "TerritorialControlLevel" AS ENUM ('CLAIMED', 'SECURED');
CREATE TYPE "TerritoryClaimStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'BLOCKED');
CREATE TYPE "OutpostStatus" AS ENUM ('BUILDING', 'ACTIVE', 'INACTIVE', 'CONVERTED', 'CANCELLED');
CREATE TYPE "ExpansionProjectStatus" AS ENUM ('QUEUED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CivilianUnitType" AS ENUM ('COLONIST');
CREATE TYPE "CivilianUnitStatus" AS ENUM ('READY', 'TRAVELING', 'FOUNDING', 'RESETTLED', 'CONSUMED');
CREATE TYPE "FoundingCharter" AS ENUM ('AGRARIAN', 'COMMERCIAL', 'INDUSTRIAL', 'DEFENSIVE', 'CIVIC');
CREATE TYPE "AgentActionType" AS ENUM ('CAMP', 'FORAGE', 'HUNT', 'SURVEY', 'GOVERN', 'SPEECH', 'DEFEND', 'SPY', 'COUNTERESPIONAGE', 'DIPLOMATIC', 'INDUSTRIAL');
CREATE TYPE "AgentActionStatus" AS ENUM ('COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "AgentTargetType" AS ENUM ('TILE', 'LOCATION', 'SETTLEMENT', 'AGENT', 'UNIT', 'NATION');

ALTER TYPE "SettlementProjectType" ADD VALUE 'COLONIST_TRAINING';

ALTER TABLE "WorldTile" ADD COLUMN "controlLevel" "TerritorialControlLevel";
UPDATE "WorldTile" SET "controlLevel" = 'SECURED' WHERE "ownerNationId" IS NOT NULL;

ALTER TABLE "CharacterAgent"
  ADD COLUMN "currentWorldTileId" TEXT,
  ADD COLUMN "actionPoints" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "actionPointsTurn" INTEGER NOT NULL DEFAULT 1;
UPDATE "CharacterAgent" AS agent
SET "currentWorldTileId" = location."worldTileId",
    "actionPoints" = 2 + CASE WHEN agent."level" >= 3 THEN 1 ELSE 0 END + CASE WHEN agent."level" >= 5 THEN 1 ELSE 0 END,
    "actionPointsTurn" = nation."currentTurn"
FROM "MapLocation" AS location, "Nation" AS nation
WHERE agent."assignedLocationId" = location."id" AND agent."nationId" = nation."id";

ALTER TABLE "Settlement"
  ADD COLUMN "foundedTurn" INTEGER,
  ADD COLUMN "foundingCharter" "FoundingCharter",
  ADD COLUMN "charterExpiresTurn" INTEGER,
  ADD COLUMN "founderAgentId" TEXT,
  ADD COLUMN "originSettlementId" TEXT,
  ADD COLUMN "flavorTagsJson" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "SettlementProject"
  ADD COLUMN "reservedPopulationLevel" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reservedResidentPopulation" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "TerritoryClaim" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "anchorLocationId" TEXT NOT NULL,
  "targetTileId" TEXT NOT NULL,
  "status" "TerritoryClaimStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedTurn" INTEGER NOT NULL,
  "completedTurn" INTEGER,
  "influenceCarry" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TerritoryClaim_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TerritoryClaimTile" (
  "id" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "tileId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "influenceCost" INTEGER NOT NULL,
  "influenceProgress" INTEGER NOT NULL DEFAULT 0,
  "claimedTurn" INTEGER,
  CONSTRAINT "TerritoryClaimTile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TileSurvey" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "tileId" TEXT NOT NULL,
  "agentId" TEXT,
  "turn" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TileSurvey_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TerritoryHistoryEntry" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "tileId" TEXT NOT NULL,
  "claimId" TEXT,
  "previousOwnerNationId" TEXT,
  "newOwnerNationId" TEXT,
  "reason" TEXT NOT NULL,
  "turn" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TerritoryHistoryEntry_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OutpostState" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "parentSettlementId" TEXT NOT NULL,
  "claimId" TEXT,
  "status" "OutpostStatus" NOT NULL DEFAULT 'BUILDING',
  "startedTurn" INTEGER NOT NULL,
  "completesTurn" INTEGER NOT NULL,
  "suppliedTurns" INTEGER NOT NULL DEFAULT 0,
  "unsuppliedTurns" INTEGER NOT NULL DEFAULT 0,
  "supplyScore" INTEGER NOT NULL DEFAULT 0,
  "treasuryCost" INTEGER NOT NULL,
  "resourceCostsJson" JSONB NOT NULL DEFAULT '{}',
  "establishedTurn" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutpostState_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CivilianUnit" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "type" "CivilianUnitType" NOT NULL DEFAULT 'COLONIST',
  "name" TEXT NOT NULL,
  "status" "CivilianUnitStatus" NOT NULL DEFAULT 'READY',
  "sourceSettlementId" TEXT NOT NULL,
  "currentWorldTileId" TEXT NOT NULL,
  "populationLevel" INTEGER NOT NULL DEFAULT 1,
  "residentPopulation" INTEGER NOT NULL DEFAULT 100000,
  "health" INTEGER NOT NULL DEFAULT 100,
  "supply" INTEGER NOT NULL DEFAULT 100,
  "travelRouteTileIdsJson" JSONB NOT NULL DEFAULT '[]',
  "travelRouteIndex" INTEGER NOT NULL DEFAULT 0,
  "trainingProjectId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CivilianUnit_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SettlementFoundingProject" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "outpostId" TEXT NOT NULL,
  "colonistId" TEXT NOT NULL,
  "sourceSettlementId" TEXT NOT NULL,
  "founderAgentId" TEXT,
  "settlementName" TEXT NOT NULL,
  "charter" "FoundingCharter" NOT NULL,
  "status" "ExpansionProjectStatus" NOT NULL DEFAULT 'QUEUED',
  "startedTurn" INTEGER NOT NULL,
  "completesTurn" INTEGER NOT NULL,
  "treasuryCost" INTEGER NOT NULL,
  "resourceCostsJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "SettlementFoundingProject_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AgentTravelOrder" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "targetTileId" TEXT NOT NULL,
  "routeTileIds" JSONB NOT NULL,
  "routeIndex" INTEGER NOT NULL DEFAULT 0,
  "createdTurn" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentTravelOrder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AgentActionRecord" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "type" "AgentActionType" NOT NULL,
  "status" "AgentActionStatus" NOT NULL DEFAULT 'COMPLETED',
  "turn" INTEGER NOT NULL,
  "targetType" "AgentTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "actionPointCost" INTEGER NOT NULL,
  "summary" TEXT NOT NULL,
  "effectsJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentActionRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TerritoryClaimTile_claimId_sequence_key" ON "TerritoryClaimTile"("claimId", "sequence");
CREATE UNIQUE INDEX "TerritoryClaimTile_claimId_tileId_key" ON "TerritoryClaimTile"("claimId", "tileId");
CREATE UNIQUE INDEX "TileSurvey_nationId_tileId_key" ON "TileSurvey"("nationId", "tileId");
CREATE UNIQUE INDEX "OutpostState_locationId_key" ON "OutpostState"("locationId");
CREATE UNIQUE INDEX "OutpostState_claimId_key" ON "OutpostState"("claimId");
CREATE UNIQUE INDEX "CivilianUnit_trainingProjectId_key" ON "CivilianUnit"("trainingProjectId");
CREATE UNIQUE INDEX "AgentTravelOrder_agentId_key" ON "AgentTravelOrder"("agentId");
CREATE INDEX "TerritoryClaim_nationId_status_idx" ON "TerritoryClaim"("nationId", "status");
CREATE INDEX "TerritoryClaim_targetTileId_status_idx" ON "TerritoryClaim"("targetTileId", "status");
CREATE INDEX "TerritoryClaimTile_tileId_idx" ON "TerritoryClaimTile"("tileId");
CREATE INDEX "TileSurvey_agentId_idx" ON "TileSurvey"("agentId");
CREATE INDEX "TerritoryHistoryEntry_nationId_turn_idx" ON "TerritoryHistoryEntry"("nationId", "turn");
CREATE INDEX "TerritoryHistoryEntry_tileId_turn_idx" ON "TerritoryHistoryEntry"("tileId", "turn");
CREATE INDEX "OutpostState_nationId_status_idx" ON "OutpostState"("nationId", "status");
CREATE INDEX "CivilianUnit_nationId_status_idx" ON "CivilianUnit"("nationId", "status");
CREATE INDEX "CivilianUnit_currentWorldTileId_idx" ON "CivilianUnit"("currentWorldTileId");
CREATE INDEX "SettlementFoundingProject_nationId_status_idx" ON "SettlementFoundingProject"("nationId", "status");
CREATE INDEX "SettlementFoundingProject_outpostId_status_idx" ON "SettlementFoundingProject"("outpostId", "status");
CREATE INDEX "SettlementFoundingProject_colonistId_status_idx" ON "SettlementFoundingProject"("colonistId", "status");
CREATE INDEX "AgentActionRecord_nationId_turn_idx" ON "AgentActionRecord"("nationId", "turn");
CREATE INDEX "AgentActionRecord_agentId_turn_idx" ON "AgentActionRecord"("agentId", "turn");
CREATE INDEX "AgentActionRecord_targetId_turn_idx" ON "AgentActionRecord"("targetId", "turn");
CREATE INDEX "CharacterAgent_currentWorldTileId_idx" ON "CharacterAgent"("currentWorldTileId");
CREATE INDEX "Settlement_originSettlementId_idx" ON "Settlement"("originSettlementId");

ALTER TABLE "TerritoryClaim" ADD CONSTRAINT "TerritoryClaim_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerritoryClaim" ADD CONSTRAINT "TerritoryClaim_anchorLocationId_fkey" FOREIGN KEY ("anchorLocationId") REFERENCES "MapLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerritoryClaim" ADD CONSTRAINT "TerritoryClaim_targetTileId_fkey" FOREIGN KEY ("targetTileId") REFERENCES "WorldTile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerritoryClaimTile" ADD CONSTRAINT "TerritoryClaimTile_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "TerritoryClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerritoryClaimTile" ADD CONSTRAINT "TerritoryClaimTile_tileId_fkey" FOREIGN KEY ("tileId") REFERENCES "WorldTile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TileSurvey" ADD CONSTRAINT "TileSurvey_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TileSurvey" ADD CONSTRAINT "TileSurvey_tileId_fkey" FOREIGN KEY ("tileId") REFERENCES "WorldTile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TileSurvey" ADD CONSTRAINT "TileSurvey_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "CharacterAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TerritoryHistoryEntry" ADD CONSTRAINT "TerritoryHistoryEntry_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerritoryHistoryEntry" ADD CONSTRAINT "TerritoryHistoryEntry_tileId_fkey" FOREIGN KEY ("tileId") REFERENCES "WorldTile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerritoryHistoryEntry" ADD CONSTRAINT "TerritoryHistoryEntry_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "TerritoryClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutpostState" ADD CONSTRAINT "OutpostState_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutpostState" ADD CONSTRAINT "OutpostState_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "MapLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutpostState" ADD CONSTRAINT "OutpostState_parentSettlementId_fkey" FOREIGN KEY ("parentSettlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutpostState" ADD CONSTRAINT "OutpostState_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "TerritoryClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CivilianUnit" ADD CONSTRAINT "CivilianUnit_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CivilianUnit" ADD CONSTRAINT "CivilianUnit_sourceSettlementId_fkey" FOREIGN KEY ("sourceSettlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CivilianUnit" ADD CONSTRAINT "CivilianUnit_currentWorldTileId_fkey" FOREIGN KEY ("currentWorldTileId") REFERENCES "WorldTile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CivilianUnit" ADD CONSTRAINT "CivilianUnit_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "SettlementProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SettlementFoundingProject" ADD CONSTRAINT "SettlementFoundingProject_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementFoundingProject" ADD CONSTRAINT "SettlementFoundingProject_outpostId_fkey" FOREIGN KEY ("outpostId") REFERENCES "OutpostState"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementFoundingProject" ADD CONSTRAINT "SettlementFoundingProject_colonistId_fkey" FOREIGN KEY ("colonistId") REFERENCES "CivilianUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementFoundingProject" ADD CONSTRAINT "SettlementFoundingProject_sourceSettlementId_fkey" FOREIGN KEY ("sourceSettlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementFoundingProject" ADD CONSTRAINT "SettlementFoundingProject_founderAgentId_fkey" FOREIGN KEY ("founderAgentId") REFERENCES "CharacterAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentTravelOrder" ADD CONSTRAINT "AgentTravelOrder_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "CharacterAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentTravelOrder" ADD CONSTRAINT "AgentTravelOrder_targetTileId_fkey" FOREIGN KEY ("targetTileId") REFERENCES "WorldTile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentActionRecord" ADD CONSTRAINT "AgentActionRecord_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentActionRecord" ADD CONSTRAINT "AgentActionRecord_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "CharacterAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterAgent" ADD CONSTRAINT "CharacterAgent_currentWorldTileId_fkey" FOREIGN KEY ("currentWorldTileId") REFERENCES "WorldTile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_founderAgentId_fkey" FOREIGN KEY ("founderAgentId") REFERENCES "CharacterAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_originSettlementId_fkey" FOREIGN KEY ("originSettlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
