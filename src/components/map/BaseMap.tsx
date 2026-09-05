import { Map, type MapLayerMouseEvent } from "@vis.gl/react-maplibre";
import { useTheme } from "../theme-provider";
import { styleForTheme } from "./mapStyle";
import type { LatLng } from "./mapGeo";

interface BaseMapProps {
  center: LatLng;
  zoom: number;
  className?: string;
  style?: React.CSSProperties;
  /** Fired with the geographic point the user clicked. */
  onMapClick?: (p: LatLng) => void;
  children?: React.ReactNode;
}

/**
 * Every map on the site starts here. It owns the two things no screen should
 * have to think about: which OpenFreeMap style the current theme wants, and
 * the fact that MapLibre speaks [lng, lat] while the rest of the app speaks
 * { lat, lng }.
 */
export default function BaseMap({
  center, zoom, className, style, onMapClick, children,
}: BaseMapProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div className={className} style={style ?? { height: "100%", width: "100%" }}>
      <Map
        initialViewState={{ longitude: center.lng, latitude: center.lat, zoom }}
        mapStyle={styleForTheme(resolvedTheme)}
        style={{ width: "100%", height: "100%" }}
        onClick={onMapClick
          ? (e: MapLayerMouseEvent) => onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng })
          : undefined}
        attributionControl={{ compact: false }}
      >
        {children}
      </Map>
    </div>
  );
}
