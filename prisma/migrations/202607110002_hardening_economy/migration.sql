-- CreateEnum
CREATE TYPE "EconomyLedgerKind" AS ENUM ('TREASURY', 'RESOURCE', 'POPULATION', 'CAPACITY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "MilitaryUnit" ADD COLUMN "readiness" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "MilitaryUnit" ADD COLUMN "supply" INTEGER NOT NULL DEFAULT 100;

-- Existing prototype data may contain duplicate history rows. Keep the first
-- authoritative link and detach later duplicates before adding the invariant.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "activeEventId" ORDER BY "createdAt", "id") AS position
  FROM "ResolvedEvent"
  WHERE "activeEventId" IS NOT NULL
)
UPDATE "ResolvedEvent" SET "activeEventId" = NULL
WHERE "id" IN (SELECT "id" FROM ranked WHERE position > 1);

-- CreateTable
CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NationPostTag" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "NationPostTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NationEconomy" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "treasury" INTEGER NOT NULL DEFAULT 1000,
  "population" INTEGER NOT NULL DEFAULT 1000000,
  "industrialCapacity" INTEGER NOT NULL DEFAULT 50,
  "administrativeCapacity" INTEGER NOT NULL DEFAULT 50,
  "lastProcessedTurn" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NationEconomy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResourceStockpile" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "type" "ResourceType" NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "capacity" INTEGER NOT NULL DEFAULT 1000,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResourceStockpile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EconomyLedgerEntry" (
  "id" TEXT NOT NULL,
  "nationId" TEXT NOT NULL,
  "turn" INTEGER NOT NULL,
  "kind" "EconomyLedgerKind" NOT NULL,
  "resourceType" "ResourceType",
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EconomyLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE UNIQUE INDEX "NationPostTag_postId_value_key" ON "NationPostTag"("postId", "value");
CREATE INDEX "NationPostTag_value_postId_idx" ON "NationPostTag"("value", "postId");
CREATE UNIQUE INDEX "NationEconomy_nationId_key" ON "NationEconomy"("nationId");
CREATE UNIQUE INDEX "ResourceStockpile_nationId_type_key" ON "ResourceStockpile"("nationId", "type");
CREATE INDEX "ResourceStockpile_nationId_idx" ON "ResourceStockpile"("nationId");
CREATE INDEX "EconomyLedgerEntry_nationId_turn_idx" ON "EconomyLedgerEntry"("nationId", "turn");
CREATE UNIQUE INDEX "ResolvedEvent_activeEventId_key" ON "ResolvedEvent"("activeEventId");

-- Backfill normalized tags from the Step 5 JSON representation.
INSERT INTO "NationPostTag" ("id", "postId", "value")
SELECT CONCAT('tag_', md5(post."id" || ':' || LOWER(tag.value))), post."id", LOWER(tag.value)
FROM "NationPost" post
CROSS JOIN LATERAL jsonb_array_elements_text(post."tagsJson") AS tag(value)
ON CONFLICT ("postId", "value") DO NOTHING;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NationPostTag" ADD CONSTRAINT "NationPostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NationPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NationEconomy" ADD CONSTRAINT "NationEconomy_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceStockpile" ADD CONSTRAINT "ResourceStockpile_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EconomyLedgerEntry" ADD CONSTRAINT "EconomyLedgerEntry_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "Nation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
