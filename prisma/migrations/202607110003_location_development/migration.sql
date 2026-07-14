-- Foundation Step 6: queued location development projects.
CREATE TYPE "LocationUpgradeStatus" AS ENUM ('QUEUED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "LocationUpgradeProject" (
    "id" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" "LocationUpgradeStatus" NOT NULL DEFAULT 'QUEUED',
    "fromLevel" INTEGER NOT NULL,
    "targetLevel" INTEGER NOT NULL,
    "startedTurn" INTEGER NOT NULL,
    "completesTurn" INTEGER NOT NULL,
    "treasuryCost" INTEGER NOT NULL,
    "resourceCostsJson" JSONB NOT NULL DEFAULT '{}',
    "engineerAgentId" TEXT,
    "costDiscountPercent" INTEGER NOT NULL DEFAULT 0,
    "durationReduction" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "LocationUpgradeProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LocationUpgradeProject_nationId_status_idx" ON "LocationUpgradeProject"("nationId", "status");
CREATE INDEX "LocationUpgradeProject_locationId_status_idx" ON "LocationUpgradeProject"("locationId", "status");
CREATE INDEX "LocationUpgradeProject_engineerAgentId_status_idx" ON "LocationUpgradeProject"("engineerAgentId", "status");

ALTER TABLE "LocationUpgradeProject" ADD CONSTRAINT "LocationUpgradeProject_nationId_fkey"
  FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocationUpgradeProject" ADD CONSTRAINT "LocationUpgradeProject_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "MapLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocationUpgradeProject" ADD CONSTRAINT "LocationUpgradeProject_engineerAgentId_fkey"
  FOREIGN KEY ("engineerAgentId") REFERENCES "CharacterAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
