import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CharacterAgent,
  LocationDevelopmentView,
  MapLocation,
  NationalSettlementSummary,
  StrategicMapViewport,
  WorldTile
} from "@statecraft/shared";
import { getStrategicMapViewport, type ApiMilitaryUnit } from "../../api";
import { subscribeToRealtimeEvent } from "../../realtime";
import { StrategicMapGrid } from "./StrategicMapGrid";
import { StrategicTileInspector } from "./StrategicTileInspector";

const WORLD_WIDTH = 96;
const WORLD_HEIGHT = 64;
const MIN_TILE_SIZE = 28;
const MAX_TILE_SIZE = 72;
const DRAG_THRESHOLD = 6;

type StrategicMapProps = {
  nationId: string;
  nationName: string;
  locations: MapLocation[];
  development: LocationDevelopmentView | null;
  agents: CharacterAgent[];
  units: ApiMilitaryUnit[];
  settlements?: NationalSettlementSummary | null;
  selectedLocationId?: string;
  onSelectLocation: (location: MapLocation | null) => void;
};

function viewportBounds(center: { x: number; y: number }) {
  const minX = Math.max(0, Math.min(WORLD_WIDTH - 40, center.x - 19));
  const minY = Math.max(0, Math.min(WORLD_HEIGHT - 40, center.y - 19));
  return { minX, minY, maxX: minX + 39, maxY: minY + 39 };
}

export function StrategicMap(props: StrategicMapProps) {
  const { nationId, locations } = props;
  const capital = locations.find((location) => location.type === "CAPITAL") ?? locations[0];
  const [center, setCenter] = useState(() => ({ x: capital?.x ?? 20, y: capital?.y ?? 20 }));
  const [tileSize, setTileSize] = useState(48);
  const [viewport, setViewport] = useState<StrategicMapViewport | null>(null);
  const [selectedTile, setSelectedTile] = useState<WorldTile | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 12, y: 12 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surfaceSize, setSurfaceSize] = useState({ width: 900, height: 600 });
  const surfaceRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const bounds = useMemo(() => viewportBounds(center), [center]);

  const refresh = useCallback(async () => {
    try {
      const next = await getStrategicMapViewport(nationId, bounds);
      setViewport(next);
      setSelectedTile((current) => next.tiles.find((tile) => tile.id === current?.id) ?? current);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The strategic map could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [bounds, nationId]);

  useEffect(() => {
    setLoading(true);
    refresh().catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSurfaceSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (selectedTile && inspectorRef.current && !inspectorRef.current.contains(event.target as Node))
        setSelectedTile(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTile(null);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedTile]);

  useEffect(() => {
    const names = [
      "nation:turn-advanced",
      "territory:claim-started",
      "territory:claim-cancelled",
      "territory:tiles-claimed",
      "outpost:project-started",
      "outpost:established",
      "outpost:supply-changed",
      "civilian:unit-moved",
      "civilian:unit-created",
      "settlement:founding-started",
      "settlement:founded",
      "agent:moved",
      "agent:action-completed",
      "agent:assigned",
      "military:unit-moved",
      "infrastructure:project-completed"
    ] as const;
    const unsubscribes = names.map((name) =>
      subscribeToRealtimeEvent(
        name,
        (payload) => {
          if (payload.nationId === nationId) refresh().catch(() => undefined);
        },
        nationId
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [nationId, refresh]);

  const stagePosition = useMemo(() => {
    if (!viewport) return { x: 0, y: 0 };
    const width = (viewport.bounds.maxX - viewport.bounds.minX + 1) * tileSize;
    const height = (viewport.bounds.maxY - viewport.bounds.minY + 1) * tileSize;
    const rawX = surfaceSize.width / 2 - (center.x - viewport.bounds.minX + 0.5) * tileSize + dragOffset.x;
    const rawY = surfaceSize.height / 2 - (center.y - viewport.bounds.minY + 0.5) * tileSize + dragOffset.y;
    return {
      x:
        width <= surfaceSize.width
          ? (surfaceSize.width - width) / 2
          : Math.min(0, Math.max(surfaceSize.width - width, rawX)),
      y:
        height <= surfaceSize.height
          ? (surfaceSize.height - height) / 2
          : Math.min(0, Math.max(surfaceSize.height - height, rawY))
    };
  }, [center, dragOffset, surfaceSize, tileSize, viewport]);

  function beginDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (Math.hypot(x, y) >= DRAG_THRESHOLD) {
      start.moved = true;
      setIsDragging(true);
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
    if (start.moved) {
      setSelectedTile(null);
      setDragOffset({ x, y });
    }
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (start.moved) {
      const x = event.clientX - start.x;
      const y = event.clientY - start.y;
      suppressClickRef.current = true;
      setCenter((current) => ({
        x: Math.max(0, Math.min(WORLD_WIDTH - 1, current.x - Math.round(x / tileSize))),
        y: Math.max(0, Math.min(WORLD_HEIGHT - 1, current.y - Math.round(y / tileSize)))
      }));
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function selectTile(tile: WorldTile, element: HTMLElement) {
    const surface = surfaceRef.current;
    if (!surface) return;
    const surfaceRect = surface.getBoundingClientRect();
    const tileRect = element.getBoundingClientRect();
    const preferredX = tileRect.right - surfaceRect.left + 10;
    const preferredY = tileRect.top - surfaceRect.top;
    setPopupPosition({
      x: Math.max(12, Math.min(surfaceRect.width - 390, preferredX)),
      y: Math.max(12, Math.min(surfaceRect.height - 500, preferredY))
    });
    setSelectedTile(tile);
  }

  function centerCapital() {
    if (capital) setCenter({ x: capital.x, y: capital.y });
    setSelectedTile(null);
  }

  return (
    <section
      className="strategic-map strategic-map--interactive"
      id="strategic-map"
      aria-label="Interactive strategic world map"
    >
      <div className="strategic-map__hud">
        <div>
          <strong>Strategic map</strong>
          <span>Drag to pan · wheel to zoom · select any tile</span>
        </div>
        <div className="strategic-map__camera-controls">
          <button
            type="button"
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => setTileSize((size) => Math.max(MIN_TILE_SIZE, size - 4))}
          >
            -
          </button>
          <button
            type="button"
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => setTileSize((size) => Math.min(MAX_TILE_SIZE, size + 4))}
          >
            +
          </button>
          <button type="button" title="Center on capital" onClick={centerCapital}>
            Center
          </button>
        </div>
      </div>
      {error ? (
        <p className="map-error" role="alert">
          {error}
        </p>
      ) : null}
      <div
        className={`strategic-map__surface ${isDragging ? "is-dragging" : ""}`}
        data-camera-x={center.x}
        data-camera-y={center.y}
        onKeyDown={(event) => {
          const delta = event.shiftKey ? 5 : 1;
          if (event.key === "ArrowLeft") setCenter((value) => ({ ...value, x: Math.max(0, value.x - delta) }));
          else if (event.key === "ArrowRight")
            setCenter((value) => ({ ...value, x: Math.min(WORLD_WIDTH - 1, value.x + delta) }));
          else if (event.key === "ArrowUp") setCenter((value) => ({ ...value, y: Math.max(0, value.y - delta) }));
          else if (event.key === "ArrowDown")
            setCenter((value) => ({ ...value, y: Math.min(WORLD_HEIGHT - 1, value.y + delta) }));
          else return;
          event.preventDefault();
          setSelectedTile(null);
        }}
        onPointerCancel={endDrag}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onWheel={(event) => {
          event.preventDefault();
          setTileSize((size) => Math.max(MIN_TILE_SIZE, Math.min(MAX_TILE_SIZE, size + (event.deltaY < 0 ? 4 : -4))));
          setSelectedTile(null);
        }}
        ref={surfaceRef}
        role="application"
        aria-label="Interactive strategic world map"
        tabIndex={0}
      >
        {viewport ? (
          <div
            className="strategic-map__stage"
            style={{ transform: `translate3d(${stagePosition.x}px, ${stagePosition.y}px, 0)` }}
          >
            <StrategicMapGrid
              activeNationId={nationId}
              onSelectTile={selectTile}
              selectedTileId={selectedTile?.id}
              suppressClicks={() => suppressClickRef.current}
              tileSize={tileSize}
              viewport={viewport}
            />
          </div>
        ) : null}
        {loading ? <div className="strategic-map__loading">Loading world...</div> : null}
        {selectedTile && viewport ? (
          <div
            ref={(element) => {
              inspectorRef.current = element;
            }}
          >
            <StrategicTileInspector
              nationId={nationId}
              viewport={viewport}
              tile={selectedTile}
              position={popupPosition}
              onClose={() => setSelectedTile(null)}
              onRefresh={refresh}
            />
          </div>
        ) : null}
      </div>
      <div className="strategic-map__legend" aria-label="Map symbols">
        <span>Settlement</span>
        <span>Resource</span>
        <span>Military</span>
        <span>Character</span>
        <span>Colonist</span>
        <span>Infrastructure</span>
      </div>
    </section>
  );
}
