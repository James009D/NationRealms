import type { PrismaClient, ResourceType } from "@prisma/client";
import type { EconomySnapshot, EventChoiceEffect, StartingEconomyProfile } from "@statecraft/shared";
import { prisma } from "../prisma.js";

export type ServiceClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export const RESOURCE_TYPES: ResourceType[] = ["FOOD", "IRON", "OIL", "RARE_EARTH", "TIMBER", "FISH", "ENERGY"];

const INITIAL_RESOURCES: Record<ResourceType, number> = {
  FOOD: 500,
  IRON: 180,
  OIL: 100,
  RARE_EARTH: 40,
  TIMBER: 220,
  FISH: 120,
  ENERGY: 300
};

export async function ensureNationEconomy(
  client: ServiceClient,
  nationId: string,
  population = 1_000_000,
  profile?: StartingEconomyProfile
) {
  const economy = await client.nationEconomy.upsert({
    where: { nationId },
    create: {
      nationId,
      population: profile?.population ?? population,
      treasury: profile?.treasury ?? 1000,
      industrialCapacity: profile?.industrialCapacity ?? 50,
      administrativeCapacity: profile?.administrativeCapacity ?? 50
    },
    update: {}
  });
  await client.resourceStockpile.createMany({
    data: RESOURCE_TYPES.map((type) => ({
      nationId,
      type,
      amount: profile?.resources[type] ?? INITIAL_RESOURCES[type],
      capacity: 2000
    })),
    skipDuplicates: true
  });
  return economy;
}

export async function getEconomySnapshot(nationId: string, client: ServiceClient = prisma): Promise<EconomySnapshot> {
  await ensureNationEconomy(client, nationId);
  const [economy, resources, recentLedger] = await Promise.all([
    client.nationEconomy.findUniqueOrThrow({ where: { nationId } }),
    client.resourceStockpile.findMany({ where: { nationId }, orderBy: { type: "asc" } }),
    client.economyLedgerEntry.findMany({ where: { nationId }, orderBy: { createdAt: "desc" }, take: 20 })
  ]);
  return {
    economy: { ...economy, createdAt: economy.createdAt.toISOString(), updatedAt: economy.updatedAt.toISOString() },
    resources: resources.map((resource) => ({ ...resource, updatedAt: resource.updatedAt.toISOString() })),
    recentLedger: recentLedger.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() }))
  };
}

export async function applyEconomyEventEffects(
  client: ServiceClient,
  nationId: string,
  turn: number,
  effects: EventChoiceEffect,
  sourceId: string
) {
  await ensureNationEconomy(client, nationId);
  if (effects.treasuryChange || effects.populationChange) {
    const economy = await client.nationEconomy.findUniqueOrThrow({ where: { nationId } });
    await client.nationEconomy.update({
      where: { nationId },
      data: {
        treasury: Math.max(0, economy.treasury + (effects.treasuryChange ?? 0)),
        population: Math.max(1000, economy.population + (effects.populationChange ?? 0))
      }
    });
  }

  const ledger = [];
  if (effects.treasuryChange)
    ledger.push({
      nationId,
      turn,
      kind: "TREASURY" as const,
      amount: effects.treasuryChange,
      reason: "Event choice",
      sourceType: "EVENT",
      sourceId
    });
  if (effects.populationChange)
    ledger.push({
      nationId,
      turn,
      kind: "POPULATION" as const,
      amount: effects.populationChange,
      reason: "Event choice",
      sourceType: "EVENT",
      sourceId
    });
  for (const [type, amount] of Object.entries(effects.resourceChanges ?? {}) as Array<[ResourceType, number]>) {
    const current = await client.resourceStockpile.findUniqueOrThrow({ where: { nationId_type: { nationId, type } } });
    const next = Math.max(0, Math.min(current.capacity, current.amount + amount));
    await client.resourceStockpile.update({ where: { id: current.id }, data: { amount: next } });
    ledger.push({
      nationId,
      turn,
      kind: "RESOURCE" as const,
      resourceType: type,
      amount: next - current.amount,
      reason: "Event choice",
      sourceType: "EVENT",
      sourceId
    });
  }
  if (ledger.length) await client.economyLedgerEntry.createMany({ data: ledger });
}
