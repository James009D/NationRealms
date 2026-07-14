import type {
  CharacterAgent,
  InfrastructureLink,
  InfrastructureLocationBenefit,
  TechnologyEffects
} from "@statecraft/shared";

type NetworkLocation = { id: string; type: string };

export function calculateInfrastructureNetworkBenefits(
  links: Array<Pick<InfrastructureLink, "id" | "type" | "level" | "enabled" | "fromLocationId" | "toLocationId">>,
  locations: NetworkLocation[],
  agents: CharacterAgent[] = [],
  technologyEffects: TechnologyEffects = {}
): InfrastructureLocationBenefit[] {
  const enabled = links.filter((link) => link.enabled);
  const adjacency = new Map<string, Set<string>>();
  for (const link of enabled) {
    if (!adjacency.has(link.fromLocationId)) adjacency.set(link.fromLocationId, new Set());
    if (!adjacency.has(link.toLocationId)) adjacency.set(link.toLocationId, new Set());
    adjacency.get(link.fromLocationId)!.add(link.toLocationId);
    adjacency.get(link.toLocationId)!.add(link.fromLocationId);
  }
  const capitalId = locations.find((location) => location.type === "CAPITAL")?.id;
  const capitalNetwork = new Set<string>();
  if (capitalId) {
    const queue = [capitalId];
    capitalNetwork.add(capitalId);
    while (queue.length) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current) ?? []) {
        if (capitalNetwork.has(next)) continue;
        capitalNetwork.add(next);
        queue.push(next);
      }
    }
  }
  return locations.map((location) => {
    const direct = enabled.filter((link) => link.fromLocationId === location.id || link.toLocationId === location.id);
    let treasuryPercent = 0;
    let resourcePercent = 0;
    const reasons: string[] = [];
    for (const link of direct) {
      const base = (link.type === "RAIL" ? 4 : link.type === "SEA_LANE" ? 3 : 2) + link.level * 2;
      treasuryPercent += base;
      resourcePercent += base;
      reasons.push(`${link.type.replace("_", " ")} level ${link.level} corridor +${base}%`);
      if (link.type === "SEA_LANE" && location.type === "PORT") {
        treasuryPercent += 3;
        resourcePercent += 3;
        reasons.push("Sea-lane port trade +3%");
      }
      const endpointIds = new Set([link.fromLocationId, link.toLocationId]);
      for (const minister of agents.filter(
        (agent) =>
          agent.role === "TRADE_MINISTER" &&
          agent.assignment === "GOVERNING" &&
          Boolean(agent.assignedLocationId && endpointIds.has(agent.assignedLocationId))
      )) {
        treasuryPercent += minister.level * 4;
        resourcePercent += minister.level * 2;
        reasons.push(`${minister.name} trade administration +${minister.level * 4}% treasury`);
      }
    }
    const connectedToCapital = Boolean(capitalId && capitalNetwork.has(location.id));
    if (connectedToCapital && location.id !== capitalId) {
      treasuryPercent += 3;
      resourcePercent += 3;
      reasons.push("Capital trade access +3%");
    }
    if (direct.length && technologyEffects.infrastructureOutputPercent) {
      treasuryPercent += technologyEffects.infrastructureOutputPercent;
      resourcePercent += technologyEffects.infrastructureOutputPercent;
      reasons.push(`Infrastructure technology +${technologyEffects.infrastructureOutputPercent}%`);
    }
    return {
      locationId: location.id,
      connectedToCapital,
      treasuryPercent: Math.min(25, treasuryPercent),
      resourcePercent: Math.min(25, resourcePercent),
      militaryRecoveryBonus: connectedToCapital && location.type === "MILITARY_BASE" ? 3 : 0,
      reasons
    };
  });
}
