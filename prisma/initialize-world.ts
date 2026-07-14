import { initializeExistingNations } from "../apps/api/src/services/worldService.js";
import { prisma } from "../apps/api/src/prisma.js";

async function main() {
  const result = await initializeExistingNations();
  console.log(`Shared world ready. Placed ${result.placedNationIds.length} existing nation(s).`);
}

main().finally(() => prisma.$disconnect());
