import { Source, Layer } from "@vis.gl/react-maplibre";
import type { Feature, LineString } from "geojson";
import { useTheme } from "../theme-provider";
import { ROUTE_PAINT } from "./mapConstants";
import { toLngLatList, type LatLng } from "./mapGeo";

interface MapLineProps {
  /** MapLibre names its sources and layers; two lines sharing an id collide. */
  id: string;
  positions: LatLng[];
  /** Leave unset to follow the theme, which is what every route on a map wants. */
  color?: string;
  width?: number;
  opacity?: number;
  /**
   * The id of a layer already on the map to draw this line underneath. Unset,
   * the line goes on top of everything, which is where a layer added later lands.
   * The layer named must exist when this one is added, or MapLibre refuses it.
   */
  beforeId?: string;
}

export default function MapLine({ id, positions, color, width = 3, opacity, beforeId }: MapLineProps) {
  const { resolvedTheme } = useTheme();
  if (positions.length < 2) return null;

  const themed = ROUTE_PAINT[resolvedTheme === "dark" ? "dark" : "light"];
  const data: Feature<LineString> = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: toLngLatList(positions) },
  };

  return (
    <Source id={id} type="geojson" data={data}>
      <Layer
        id={`${id}-line`}
        beforeId={beforeId}
        type="line"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": color ?? themed.color,
          "line-width": width,
          "line-opacity": opacity ?? themed.opacity,
        }}
      />
    </Source>
  );
}
