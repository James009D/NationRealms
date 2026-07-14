import type { StrategicMapViewport, WorldTile } from "@statecraft/shared";
import { formatEnum } from "../../format";
import { MAP_ASSETS, MapSprite } from "./mapAssets";

export function StrategicMapGrid({
  viewport,
  activeNationId,
  tileSize,
  selectedTileId,
  suppressClicks,
  onSelectTile
}: {
  viewport: StrategicMapViewport;
  activeNationId: string;
  tileSize: number;
  selectedTileId?: string;
  suppressClicks: () => boolean;
  onSelectTile: (tile: WorldTile, element: HTMLElement) => void;
}) {
  return (
    <div
      className="strategic-map-grid"
      role="grid"
      style={{
        width: (viewport.bounds.maxX - viewport.bounds.minX + 1) * tileSize,
        height: (viewport.bounds.maxY - viewport.bounds.minY + 1) * tileSize
      }}
    >
      {viewport.tiles.map((tile) => {
        const contents = viewport.contentsByTileId[tile.id]!;
        const locations = contents.locationIds
          .map((id) => viewport.locations.find((item) => item.id === id)!)
          .filter(Boolean);
        const units = contents.militaryUnitIds
          .map((id) => viewport.units.find((item) => item.id === id)!)
          .filter(Boolean);
        const agents = contents.characterAgentIds
          .map((id) => viewport.agents.find((item) => item.id === id)!)
          .filter(Boolean);
        const civilians = contents.civilianUnitIds
          .map((id) => viewport.civilianUnits.find((item) => item.id === id)!)
          .filter(Boolean);
        const primaryLocation =
          locations.find((item) => ["CAPITAL", "CITY", "TOWN"].includes(item.type)) ?? locations[0];
        const route = contents.infrastructureLinkIds.length > 0;
        const claim = contents.claimIds.length > 0;
        return (
          <button
            aria-label={`${formatEnum(tile.terrain)} tile ${tile.x}, ${tile.y}`}
            className={`strategic-tile ${tile.ownerNationId ? "is-owned" : ""} ${tile.ownerNationId === activeNationId ? "is-friendly" : ""} ${tile.id === selectedTileId ? "is-selected" : ""} ${route ? "has-route" : ""} ${claim ? "has-claim" : ""}`}
            data-tile-id={tile.id}
            key={tile.id}
            onClick={(event) => {
              if (!suppressClicks()) onSelectTile(tile, event.currentTarget);
            }}
            style={{
              left: (tile.x - viewport.bounds.minX) * tileSize,
              top: (tile.y - viewport.bounds.minY) * tileSize,
              width: tileSize,
              height: tileSize
            }}
            tabIndex={-1}
            title={`${formatEnum(tile.terrain)}${tile.resourceDeposit ? `, ${formatEnum(tile.resourceDeposit)}` : ""}`}
            type="button"
          >
            <MapSprite className="strategic-tile__terrain" href={MAP_ASSETS.terrain[tile.terrain]} />
            <span className="strategic-tile__ownership" />
            {route ? <span className="strategic-tile__route" /> : null}
            {tile.resourceDeposit ? (
              <span className="strategic-marker strategic-marker--resource" title={formatEnum(tile.resourceDeposit)}>
                <MapSprite href={MAP_ASSETS.resource[tile.resourceDeposit]} />
              </span>
            ) : null}
            {primaryLocation ? (
              <span className="strategic-marker strategic-marker--location" title={primaryLocation.name}>
                <MapSprite href={MAP_ASSETS.location[primaryLocation.type]} />
                {locations.length > 1 ? <b>{locations.length}</b> : null}
              </span>
            ) : null}
            {units.length ? (
              <span className="strategic-marker strategic-marker--unit" title={`${units.length} military unit(s)`}>
                <MapSprite href={MAP_ASSETS.unit[units[0]!.type]} />
                {units.length > 1 ? <b>{units.length}</b> : null}
              </span>
            ) : null}
            {agents.length ? (
              <span className="strategic-marker strategic-marker--agent" title={`${agents.length} character(s)`}>
                <MapSprite href={MAP_ASSETS.agent[agents[0]!.role]} />
                {agents.length > 1 ? <b>{agents.length}</b> : null}
              </span>
            ) : null}
            {civilians.length ? (
              <span className="strategic-marker strategic-marker--civilian" title={`${civilians.length} colonist(s)`}>
                <MapSprite href={MAP_ASSETS.colonist} />
                {civilians.length > 1 ? <b>{civilians.length}</b> : null}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
