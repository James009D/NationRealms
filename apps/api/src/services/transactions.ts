import type { Prisma } from "@prisma/client";
import { conflict } from "../errors.js";
import { prisma } from "../prisma.js";

export async function runSerializable<T>(work: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      const retryable = typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
      if (!retryable) throw error;
    }
  }
  throw conflict("The nation changed during this action. Refresh and try again.");
}
