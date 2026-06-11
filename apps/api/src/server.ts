import "dotenv/config";
import { buildApp } from "./app.js";
import { isDatabaseUnavailable } from "./services/fallbackDemo.js";
import { seedEventTemplates } from "./services/eventEngineService.js";
import { prisma } from "./prisma.js";

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

const app = await buildApp();

// Authored templates are code-owned; the database rows are a cache. Sync on
// boot so template edits (new templates, new choice effects) reach existing
// databases. Skipped silently in no-database fallback mode.
try {
  await seedEventTemplates();
  app.log.info("Event templates synced to database.");
} catch (error) {
  if (!isDatabaseUnavailable(error)) throw error;
  app.log.warn("Database unavailable; running with in-memory fallback state.");
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
