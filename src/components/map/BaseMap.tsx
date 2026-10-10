import { Map, type MapLayerMouseEvent } from "@vis.gl/react-maplibre";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useTheme } from "../theme-provider";
import { styleForTheme } from "./mapStyle";
import type { LatLng } from "./mapGeo";

/**
 * Tell MapLibre where its worker lives, instead of letting it guess.
 *
 * Left alone, it builds the worker's URL as `new URL("./maplibre-gl-worker.mjs",
 * import.meta.url)` — relative to wherever its own module ended up. That guess is
 * wrong twice over here: in development Vite pre-bundles the dependency into
 * `.vite/deps/`, where no worker file exists, and in a production build the
 * bundler cannot see through the computed filename, so it never emits the worker
 * at all. Both fail the same way, with the map asking for a file that is not
 * there.
 *
 * `?worker&url` hands the import to Vite as a worker entry: it is served in
 * development and *bundled* with a hashed name in the build, and either way this
 * is the real URL.
 *
 * It was plain `?url` once, and that shipped a build where no map loaded. `?url`
 * copies the file byte for byte, and the first statement of MapLibre's worker is
 * `import … from "./maplibre-gl-shared.mjs"` — a sibling nothing emitted. In
 * development the sibling sits beside it in `node_modules`, so it only failed in
 * the built app, where the hosting rewrite answers the missing file with
 * `index.html`. The worker has to go through the bundler so its imports go with
 * it; `worker.format` in `vite.config.ts` keeps it an ES module, which is how
 * MapLibre starts it.
 */
setWorkerUrl(workerUrl);

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
