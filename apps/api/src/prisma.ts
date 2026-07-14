import { PrismaClient } from "@prisma/client";
import { getConfig } from "./config.js";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createForcedFallbackPrisma() {
  const unavailable = new Error("Can't reach database server (forced fallback).");

  const modelProxy = new Proxy(
    {},
    {
      get() {
        return async () => {
          throw unavailable;
        };
      }
    }
  );

  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "$disconnect" || property === "$connect") {
          return async () => undefined;
        }

        if (typeof property === "string" && property.startsWith("$")) {
          return async () => {
            throw unavailable;
          };
        }

        return modelProxy;
      }
    }
  ) as PrismaClient;
}

export const prisma =
  getConfig().DATA_MODE === "memory"
    ? createForcedFallbackPrisma()
    : (globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
      }));

if (getConfig().NODE_ENV !== "production" && getConfig().DATA_MODE === "postgres") {
  globalForPrisma.prisma = prisma;
}
