import type { CSSProperties } from "react";
import {
  TERRAIN_DEFINITIONS,
  type InfrastructureLink,
  type MapLocation,
  type SettlementView,
  type WorldTile
} from "@statecraft/shared";
import { formatEnum, locationMarker } from "../format";

export type MapLayer =
  | "TERRAIN"
  | "POLITICAL"
  | "REGIONS"
  | "POPULATION"
  | "FOOD"
  | "STABILITY"
  | "TRANSPORT"
  | "SUPPLY"
  | "RESOURCES"
  | "INFRASTRUCTURE"
  | "MILITARY"
  | "DEVELOPMENT"
  | "CHARACTERS";

export function MapGrid({
  locations,
  tiles,
  links = [],
  constructionRoutes = [],
  selectedLocationId,
  selectedTileId,
  onSelect,
  onSelectTile,
  onSelectLink,
  layer = "POLITICAL",
  unitLocationIds = [],
  agentLocationIds = [],
  projectLocationIds = [],
  settlements = []
}: {
  locations: MapLocation[];
  tiles?: WorldTile[];
  links?: InfrastructureLink[];
  constructionRoutes?: Array<{ type: InfrastructureLink["type"]; routeTileIds: string[] }>;
  selectedLocationId?: string;
  selectedTileId?: string;
  onSelect: (location: MapLocation) => void;
  onSelectTile?: (tile: WorldTile) => void;
  onSelectLink?: (link: InfrastructureLink) => void;
  layer?: MapLayer;
  unitLocationIds?: string[];
  agentLocationIds?: string[];
  projectLocationIds?: string[];
  settlements?: SettlementView[];
}) {
  const renderedTiles = tiles?.length
    ? tiles
    : locations.map(
        (location) =>
          location.worldTile ??
          ({
            id: location.worldTileId ?? `legacy-${location.id}`,
            worldMapId: "legacy",
            x: location.x,
            y: location.y,
            terrain: location.terrain ?? "PLAINS",
            elevation: 50,
            fertility: 50,
            resourceDeposit: location.resourceType,
            ownerNationId: location.nationId
          } satisfies WorldTile)
      );
  const minX = renderedTiles.length ? Math.min(...renderedTiles.map((tile) => tile.x)) : 0;
  const maxX = renderedTiles.length ? Math.max(...renderedTiles.map((tile) => tile.x)) : 9;
  const minY = renderedTiles.length ? Math.min(...renderedTiles.map((tile) => tile.y)) : 0;
  const maxY = renderedTiles.length ? Math.max(...renderedTiles.map((tile) => tile.y)) : 9;
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const tilesByCoordinate = new Map(renderedTiles.map((tile) => [`${tile.x}:${tile.y}`, tile]));
  const locationsByCoordinate = new Map(locations.map((location) => [`${location.x}:${location.y}`, location]));
  const routeByTile = new Map<string, InfrastructureLink>();
  for (const link of links.filter((item) => item.enabled))
    for (const tile of link.routeTiles) routeByTile.set(tile.id, link);
  const constructionTypeByTile = new Map<string, InfrastructureLink["type"]>();
  for (const project of constructionRoutes)
    for (const tileId of project.routeTileIds) constructionTypeByTile.set(tileId, project.type);
  const unitLocations = new Set(unitLocationIds);
  const agentLocations = new Set(agentLocationIds);
  const projectLocations = new Set(projectLocationIds);
  const cells = Array.from({ length: width * height }, (_, index) => {
    const x = minX + (index % width);
    const y = minY + Math.floor(index / width);
    const tile = tilesByCoordinate.get(`${x}:${y}`);
    if (!tile) return <div className="map-cell map-cell--void" key={`${x}-${y}`} aria-hidden="true" />;
    const location = locationsByCoordinate.get(`${x}:${y}`);
    const settlement = location ? settlements.find((item) => item.locationId === location.id) : undefined;
    const terrain = TERRAIN_DEFINITIONS[tile.terrain];
    const route = routeByTile.get(tile.id);
    const routeType = route?.type;
    const constructionType = constructionTypeByTile.get(tile.id);
    const className = `map-cell map-cell--terrain-${tile.terrain.toLowerCase()} map-cell--layer-${layer.toLowerCase()} ${tile.ownerNationId ? "map-cell--claimed" : ""} ${tile.controlLevel ? `map-cell--control-${tile.controlLevel.toLowerCase()}` : ""} ${location ? "map-cell--location" : ""} ${settlement ? "map-cell--settlement" : ""} ${location?.id === selectedLocationId || tile.id === selectedTileId ? "map-cell--selected" : ""} ${routeType ? `map-cell--route-${routeType.toLowerCase()}` : ""} ${constructionType ? "map-cell--route-construction" : ""}`;
    const regionHue = tile.regionId
      ? [...tile.regionId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360
      : 0;
    const style = tile.regionId ? ({ "--region-hue": regionHue } as CSSProperties) : undefined;
    const content = (
      <>
        {location ? <span className="map-marker">{locationMarker(location.type)}</span> : null}
        {location ? <span className="map-label">{location.name}</span> : null}
        {settlement && layer === "POPULATION" ? (
          <span className="map-layer-value" title={`${settlement.populationLevel} population levels`}>
            {settlement.populationLevel}
          </span>
        ) : null}
        {settlement && layer === "FOOD" ? (
          <span className="map-layer-value" title={formatEnum(settlement.food.security)}>
            {settlement.food.production - settlement.food.consumption >= 0 ? "+" : ""}
            {settlement.food.production - settlement.food.consumption}
          </span>
        ) : null}
        {settlement && layer === "STABILITY" ? (
          <span className="map-layer-value" title="Settlement stability">
            {settlement.stability.value}
          </span>
        ) : null}
        {settlement && layer === "TRANSPORT" ? (
          <span className="map-layer-value" title={formatEnum(settlement.region.transportationLevel)}>
            {settlement.region.transportationLevel.slice(0, 2)}
          </span>
        ) : null}
        {settlement && layer === "SUPPLY" ? (
          <span className="map-layer-value" title="Regional network reliability">
            {settlement.region.networkReliability}%
          </span>
        ) : null}
        {layer === "RESOURCES" && tile.resourceDeposit ? (
          <span className="map-deposit" title={formatEnum(tile.resourceDeposit)}>
            ◆
          </span>
        ) : null}
        {layer === "INFRASTRUCTURE" && routeType ? (
          <span className="map-route" title={formatEnum(routeType)}>
            ━
          </span>
        ) : null}
        {layer === "INFRASTRUCTURE" && !routeType && constructionType ? (
          <span
            className="map-route map-route--construction"
            title={`${formatEnum(constructionType)} under construction`}
          >
            --
          </span>
        ) : null}
        <span className="map-badges" aria-hidden="true">
          {layer === "MILITARY" && location && unitLocations.has(location.id) ? <i>▲</i> : null}
          {layer === "CHARACTERS" && location && agentLocations.has(location.id) ? <i>●</i> : null}
          {layer === "DEVELOPMENT" && location && projectLocations.has(location.id) ? <i>⌛</i> : null}
        </span>
      </>
    );
    const label = location
      ? `${location.name}, ${formatEnum(location.type)}`
      : `${terrain.label} at ${x}, ${y}${tile.resourceDeposit ? `, ${formatEnum(tile.resourceDeposit)}` : ""}`;
    return location || (route && onSelectLink) || onSelectTile ? (
      <button
        className={className}
        style={style}
        key={tile.id}
        type="button"
        onClick={() =>
          location ? onSelect(location) : route && onSelectLink ? onSelectLink(route) : onSelectTile?.(tile)
        }
        aria-label={label}
        title={`${terrain.label}: ${terrain.description}`}
      >
        {content}
      </button>
    ) : (
      <div
        className={className}
        style={style}
        key={tile.id}
        aria-label={label}
        title={`${terrain.label}: ${terrain.description}`}
      >
        {content}
      </div>
    );
  });
  return (
    <div
      className="map-grid"
      role="grid"
      aria-label={`World map, ${formatEnum(layer)} layer`}
      style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`, aspectRatio: `${width} / ${height}` }}
    >
      {cells}
    </div>
  );
}
