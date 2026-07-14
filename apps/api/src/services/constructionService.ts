import { frontierAdministrativeLoad } from "@statecraft/shared";
import { getConfig } from "../config.js";
import type { ServiceClient } from "./economyService.js";

export function constructionProjectLimit(administrativeCapacity: number) {
  return 1 + Math.floor(Math.max(0, Math.min(100, administrativeCapacity)) / 40);
}

export async function effectiveAdministrativeCapacity(
  nationId: string,
  administrativeCapacity: number,
  client?: ServiceClient
) {
  if (getConfig().DATA_MODE === "memory") {
    const { getNationTerritory } = await import("./expansionService.js");
    return (await getNationTerritory(nationId)).effectiveAdministrativeCapacity;
  }
  if (!client) throw new Error("A database client is required in PostgreSQL mode.");
  const [activeClaims, outposts, unsecuredTiles] = await Promise.all([
    client.territoryClaim.count({ where: { nationId, status: { in: ["ACTIVE", "PAUSED"] } } }),
    client.outpostState.count({ where: { nationId, status: { notIn: ["CONVERTED", "CANCELLED"] } } }),
    client.worldTile.count({ where: { ownerNationId: nationId, controlLevel: "CLAIMED" } })
  ]);
  return Math.max(0, administrativeCapacity - frontierAdministrativeLoad(activeClaims, outposts, unsecuredTiles));
}
