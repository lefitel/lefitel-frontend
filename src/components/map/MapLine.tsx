import { Source, Layer } from "@vis.gl/react-maplibre";
import type { Feature, LineString } from "geojson";
import { toLngLatList, type LatLng } from "./mapGeo";

interface MapLineProps {
  /** MapLibre names its sources and layers; two lines sharing an id collide. */
  id: string;
  positions: LatLng[];
  color?: string;
  width?: number;
  opacity?: number;
}

export default function MapLine({
  id, positions, color = "#596BAB", width = 3, opacity = 0.7,
}: MapLineProps) {
  if (positions.length < 2) return null;

  const data: Feature<LineString> = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: toLngLatList(positions) },
  };

  return (
    <Source id={id} type="geojson" data={data}>
      <Layer
        id={`${id}-line`}
        type="line"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{ "line-color": color, "line-width": width, "line-opacity": opacity }}
      />
    </Source>
  );
}
