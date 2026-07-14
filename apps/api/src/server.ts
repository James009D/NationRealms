import "dotenv/config";
import { buildApp } from "./app.js";
import { seedEventTemplates } from "./services/eventEngineService.js";
import { prisma } from "./prisma.js";
import { getConfig } from "./config.js";

const config = getConfig();
const port = config.API_PORT;
const host = config.API_HOST;

const app = await buildApp();

if (config.DATA_MODE === "postgres") {
  await seedEventTemplates();
  app.log.info("Event templates synced to database.");
} else {
  app.log.warn("DATA_MODE=memory: all changes are ephemeral and will be lost when the API stops.");
}

async function shutdown() {
  await app.close();
  await prisma.$disconnect();
}

process.on("SIGINT", () => {
  shutdown()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
});

process.on("SIGTERM", () => {
  shutdown()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
});

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}
