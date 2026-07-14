-- Foundation Step 7: branching technology research.
CREATE TYPE "TechnologyUnlockSource" AS ENUM ('FOUNDATIONAL', 'RESEARCHED');

CREATE TABLE "NationTechnologyState" (
    "id" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "researchPoints" INTEGER NOT NULL DEFAULT 0,
    "lifetimeResearch" INTEGER NOT NULL DEFAULT 0,
    "baselineTechnologyLevel" INTEGER NOT NULL,
    "lastProcessedTurn" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NationTechnologyState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnologyUnlock" (
    "id" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "nodeKey" TEXT NOT NULL,
    "source" "TechnologyUnlockSource" NOT NULL,
    "unlockedTurn" INTEGER NOT NULL,
    "researchCost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TechnologyUnlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnologyLedgerEntry" (
    "id" TEXT NOT NULL,
    "nationId" TEXT NOT NULL,
    "turn" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "nodeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TechnologyLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NationTechnologyState_nationId_key" ON "NationTechnologyState"("nationId");
CREATE UNIQUE INDEX "TechnologyUnlock_nationId_nodeKey_key" ON "TechnologyUnlock"("nationId", "nodeKey");
CREATE INDEX "TechnologyUnlock_nationId_unlockedTurn_idx" ON "TechnologyUnlock"("nationId", "unlockedTurn");
CREATE INDEX "TechnologyLedgerEntry_nationId_turn_idx" ON "TechnologyLedgerEntry"("nationId", "turn");

ALTER TABLE "NationTechnologyState" ADD CONSTRAINT "NationTechnologyState_nationId_fkey"
  FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnologyUnlock" ADD CONSTRAINT "TechnologyUnlock_nationId_fkey"
  FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnologyLedgerEntry" ADD CONSTRAINT "TechnologyLedgerEntry_nationId_fkey"
  FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "NationTechnologyState" (
  "id", "nationId", "researchPoints", "lifetimeResearch", "baselineTechnologyLevel", "lastProcessedTurn", "updatedAt"
)
SELECT
  'tech-' || n."id", n."id", 0, 0, s."technology", n."currentTurn", CURRENT_TIMESTAMP
FROM "Nation" n
JOIN "NationStats" s ON s."nationId" = n."id"
ON CONFLICT ("nationId") DO NOTHING;
