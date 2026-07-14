-- Foundation Step 8: shared world terrain and national infrastructure.
CREATE TYPE "TerrainType" AS ENUM ('OCEAN', 'COAST', 'PLAINS', 'FOREST', 'HILLS', 'MOUNTAIN', 'DESERT', 'WETLAND', 'TUNDRA');
CREATE TYPE "InfrastructureType" AS ENUM ('ROAD', 'RAIL', 'SEA_LANE');
CREATE TYPE "InfrastructureProjectStatus" AS ENUM ('QUEUED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "WorldMap" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "seed" TEXT NOT NULL,
  "width" INTEGER NOT NULL DEFAULT 96,
  "height" INTEGER NOT NULL DEFAULT 64,
  "generationVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorldMap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldTile" (
  "id" TEXT NOT NULL,
  "worldMapId" TEXT NOT NULL,
  "x" INTEGER NOT NULL,
  "y" INTEGER NOT NULL,
  "terrain" "TerrainType" NOT NULL,
  "elevation" INTEGER NOT NULL,
  "fertility" INTEGER NOT NULL,
  "resourceDeposit" "ResourceType",
  "ownerNationId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorldTile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MapLocation" ADD COLUMN "worldTileId" TEXT;

CREATE TABLE "InfrastructureLink" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "fromLocationId" TEXT NOT NULL,
  "toLocationId" TEXT NOT NULL,
  "type" "InfrastructureType" NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "upkeepTreasury" INTEGER NOT NULL DEFAULT 0,
  "upkeepEnergy" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InfrastructureLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InfrastructureLinkTile" (
  "id" TEXT NOT NULL,
  "linkId" TEXT NOT NULL,
  "tileId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  CONSTRAINT "InfrastructureLinkTile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InfrastructureProject" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "linkId" TEXT,
  "fromLocationId" TEXT NOT NULL,
  "toLocationId" TEXT NOT NULL,
  "type" "InfrastructureType" NOT NULL,
  "targetLevel" INTEGER NOT NULL,
  "status" "InfrastructureProjectStatus" NOT NULL DEFAULT 'QUEUED',
  "startedTurn" INTEGER NOT NULL,
  "completesTurn" INTEGER NOT NULL,
  "treasuryCost" INTEGER NOT NULL,
  "resourceCostsJson" JSONB NOT NULL DEFAULT '{}',
  "routeTileIdsJson" JSONB NOT NULL DEFAULT '[]',
  "engineerAgentId" TEXT,
  "costDiscountPercent" INTEGER NOT NULL DEFAULT 0,
  "durationReduction" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "InfrastructureProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorldTile_worldMapId_x_y_key" ON "WorldTile"("worldMapId", "x", "y");
CREATE INDEX "WorldTile_ownerNationId_idx" ON "WorldTile"("ownerNationId");
CREATE INDEX "WorldTile_worldMapId_terrain_idx" ON "WorldTile"("worldMapId", "terrain");
CREATE INDEX "WorldTile_worldMapId_resourceDeposit_idx" ON "WorldTile"("worldMapId", "resourceDeposit");
CREATE UNIQUE INDEX "MapLocation_worldTileId_key" ON "MapLocation"("worldTileId");
CREATE UNIQUE INDEX "InfrastructureLink_nationId_fromLocationId_toLocationId_type_key" ON "InfrastructureLink"("nationId", "fromLocationId", "toLocationId", "type");
CREATE INDEX "InfrastructureLink_nationId_enabled_idx" ON "InfrastructureLink"("nationId", "enabled");
CREATE UNIQUE INDEX "InfrastructureLinkTile_linkId_sequence_key" ON "InfrastructureLinkTile"("linkId", "sequence");
CREATE UNIQUE INDEX "InfrastructureLinkTile_linkId_tileId_key" ON "InfrastructureLinkTile"("linkId", "tileId");
CREATE INDEX "InfrastructureLinkTile_tileId_idx" ON "InfrastructureLinkTile"("tileId");
CREATE INDEX "InfrastructureProject_nationId_status_idx" ON "InfrastructureProject"("nationId", "status");
CREATE INDEX "InfrastructureProject_linkId_status_idx" ON "InfrastructureProject"("linkId", "status");
CREATE INDEX "InfrastructureProject_engineerAgentId_status_idx" ON "InfrastructureProject"("engineerAgentId", "status");

ALTER TABLE "WorldTile" ADD CONSTRAINT "WorldTile_worldMapId_fkey" FOREIGN KEY ("worldMapId") REFERENCES "WorldMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldTile" ADD CONSTRAINT "WorldTile_ownerNationId_fkey" FOREIGN KEY ("ownerNationId") REFERENCES "Nation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MapLocation" ADD CONSTRAINT "MapLocation_worldTileId_fkey" FOREIGN KEY ("worldTileId") REFERENCES "WorldTile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InfrastructureLink" ADD CONSTRAINT "InfrastructureLink_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfrastructureLink" ADD CONSTRAINT "InfrastructureLink_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "MapLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfrastructureLink" ADD CONSTRAINT "InfrastructureLink_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "MapLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfrastructureLinkTile" ADD CONSTRAINT "InfrastructureLinkTile_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "InfrastructureLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfrastructureLinkTile" ADD CONSTRAINT "InfrastructureLinkTile_tileId_fkey" FOREIGN KEY ("tileId") REFERENCES "WorldTile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfrastructureProject" ADD CONSTRAINT "InfrastructureProject_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfrastructureProject" ADD CONSTRAINT "InfrastructureProject_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "InfrastructureLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InfrastructureProject" ADD CONSTRAINT "InfrastructureProject_engineerAgentId_fkey" FOREIGN KEY ("engineerAgentId") REFERENCES "CharacterAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
