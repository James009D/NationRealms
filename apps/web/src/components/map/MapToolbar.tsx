import type { MapLayer } from "../MapGrid";

const layers: Array<{ value: MapLayer; label: string; icon: string }> = [
  { value: "REGIONS", label: "Regions", icon: "R" },
  { value: "POPULATION", label: "Population", icon: "P" },
  { value: "FOOD", label: "Food", icon: "F" },
  { value: "STABILITY", label: "Stability", icon: "S" },
  { value: "TRANSPORT", label: "Transport", icon: "T" },
  { value: "SUPPLY", label: "Supply", icon: "%" },
  { value: "TERRAIN", label: "Terrain", icon: "▧" },
  { value: "POLITICAL", label: "Political", icon: "⚑" },
  { value: "RESOURCES", label: "Resources", icon: "◆" },
  { value: "INFRASTRUCTURE", label: "Infrastructure", icon: "━" },
  { value: "MILITARY", label: "Military", icon: "▲" },
  { value: "DEVELOPMENT", label: "Development", icon: "↑" },
  { value: "CHARACTERS", label: "Characters", icon: "●" }
];

export function MapToolbar({
  layer,
  onLayerChange,
  onCenter,
  onPan
}: {
  layer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  onCenter: () => void;
  onPan?: (dx: number, dy: number) => void;
}) {
  return (
    <div className="map-toolbar">
      <div className="map-layer-control" role="group" aria-label="Map layer">
        {layers.map((item) => (
          <button
            aria-pressed={layer === item.value}
            className={layer === item.value ? "is-active" : ""}
            key={item.value}
            onClick={() => onLayerChange(item.value)}
            title={item.label}
            type="button"
          >
            <span aria-hidden="true">{item.icon}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </div>
      {onPan ? (
        <div className="map-pan-control" role="group" aria-label="Pan map">
          <button type="button" onClick={() => onPan(0, -1)} title="Pan north">
            ↑
          </button>
          <button type="button" onClick={() => onPan(-1, 0)} title="Pan west">
            ←
          </button>
          <button type="button" onClick={() => onPan(1, 0)} title="Pan east">
            →
          </button>
          <button type="button" onClick={() => onPan(0, 1)} title="Pan south">
            ↓
          </button>
        </div>
      ) : null}
      <button className="map-center-button" onClick={onCenter} title="Center on capital" type="button">
        <span aria-hidden="true">⌖</span>
        <small>Center</small>
      </button>
    </div>
  );
}
