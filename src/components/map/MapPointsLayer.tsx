import { useEffect, useMemo, useState } from "react";
import { Source, Layer, Popup, useMap } from "@vis.gl/react-maplibre";
import type { MapMouseEvent } from "maplibre-gl";
import { pointsToFeatureCollection, type MapPointData } from "./mapGeo";

interface MapPointsLayerProps<T> {
  id: string;
  points: MapPointData<T>[];
  radius?: number;
  strokeColor?: string;
  strokeWidth?: number;
  /** Renders the card for whichever point was clicked. */
  renderPopup: (item: T) => React.ReactNode;
  popupMinWidth?: number;
}

/**
 * Draws any number of points in one WebGL layer instead of one DOM element
 * each. This is the whole reason for the MapLibre migration: the dashboard
 * asks the server for every pole and every event with no limit, so this count
 * has no ceiling and grows with the customer's database.
 *
 * Only one card exists at a time — the one for the point that was clicked.
 */
export default function MapPointsLayer<T>({
  id,
  points,
  radius = 7,
  strokeColor = "#fff",
  strokeWidth = 1.5,
  renderPopup,
  popupMinWidth = 205,
}: MapPointsLayerProps<T>) {
  const { current: map } = useMap();
  const [selected, setSelected] = useState<MapPointData<T> | null>(null);

  const data = useMemo(() => pointsToFeatureCollection(points), [points]);
  const layerId = `${id}-circles`;

  // A card belongs to a point. When the points change — an event resolved, a
  // tab switched, a pole edited — the open card must follow: refreshed if its
  // point is still there, closed if it is gone. Leaflet got this for free,
  // because the popup was a child of its marker.
  useEffect(() => {
    setSelected((current) => {
      if (!current) return null;
      return points.find((p) => p.id === current.id) ?? null;
    });
  }, [points]);

  // The click has to be registered on the map, not on the layer: a WebGL shape
  // is not an element and cannot carry its own handler.
  useEffect(() => {
    if (!map) return;

    const onClick = (e: MapMouseEvent) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: [layerId] })[0];
      if (!hit) return;
      const clicked = points.find((p) => p.id === hit.properties?.id);
      if (clicked) setSelected(clicked);
    };
    // A layer-scoped `on("click", layerId, ...)` listener is delegated:
    // MapLibre queries the layer itself and only calls the handler on a hit
    // (see `Map._createDelegatedListener` in maplibre-gl's source) — a click
    // on empty map never reaches `onClick` above at all. closeOnClick is off
    // on this Popup (the click that opens a card comes from the map itself,
    // so the default could close it in the same gesture it opens in), so
    // closing on an empty click needs this second, unfiltered listener doing
    // its own query instead.
    const onMapClick = (e: MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: [layerId] });
      if (hits.length === 0) setSelected(null);
    };
    const onEnter = () => { map.getCanvas().style.cursor = "pointer"; };
    const onLeave = () => { map.getCanvas().style.cursor = ""; };

    map.on("click", layerId, onClick);
    map.on("click", onMapClick);
    map.on("mouseenter", layerId, onEnter);
    map.on("mouseleave", layerId, onLeave);

    return () => {
      map.off("click", layerId, onClick);
      map.off("click", onMapClick);
      map.off("mouseenter", layerId, onEnter);
      map.off("mouseleave", layerId, onLeave);
      map.getCanvas().style.cursor = "";
    };
  }, [map, layerId, points]);

  return (
    <>
      <Source id={id} type="geojson" data={data}>
        <Layer
          id={layerId}
          type="circle"
          paint={{
            "circle-radius": radius,
            "circle-color": ["get", "color"],
            "circle-opacity": 0.95,
            "circle-stroke-color": strokeColor,
            "circle-stroke-width": strokeWidth,
          }}
        />
      </Source>

      {selected && (
        <Popup
          longitude={selected.lng}
          latitude={selected.lat}
          offset={radius + 4}
          closeOnClick={false}
          onClose={() => setSelected(null)}
          maxWidth="280px"
        >
          <div style={{ minWidth: popupMinWidth }}>{renderPopup(selected.item)}</div>
        </Popup>
      )}
    </>
  );
}
