import { useEffect } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { boundsOf, hasCoords, toLngLat, type LatLng } from "./mapGeo";

interface FitOptions {
  coords: LatLng[];
  /** When false, the map centres on `center` at `zoom` instead of fitting. */
  fit: boolean;
  center: LatLng;
  zoom: number;
}

/**
 * Replaces the four near-identical helper components the screens each had for
 * this: fit the view to a set of points, or fall back to centring on one.
 */
export function useFitCoords({ coords, fit, center, zoom }: FitOptions): void {
  const { current: map } = useMap();

  const bounds = boundsOf(coords);
  // The screens rebuild this array on every render, so depending on it would
  // refit the map continuously. The box it produces is four numbers and only
  // changes when the area to show actually changes, which is the real trigger.
  const boundsKey = bounds ? bounds.flat().join(",") : "";

  useEffect(() => {
    if (!map) return;

    if (fit && bounds) {
      map.fitBounds(bounds, { padding: 40, duration: 0 });
      return;
    }
    if (hasCoords(center)) {
      map.flyTo({ center: toLngLat(center), zoom, duration: 0 });
    }
  // `bounds` is derived from `boundsKey` on the same render, so the key covers it.
  // The key only belongs in the list when `fit` is actually going to read it:
  // otherwise a box change (e.g. `coords` growing while a pin is placed, or a
  // late API response widening it) would refire this effect and fly the view
  // away from a `center` that never moved.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fit, fit ? boundsKey : "", center.lat, center.lng, zoom]);
}

/**
 * The hook has to run inside the map to reach it, so it needs a component to
 * live in. Every detail screen used to carry its own copy of this — three
 * files, three names, one body. Now there is one.
 */
export function FitView(props: {
  coords: LatLng[];
  fit: boolean;
  center: LatLng;
  zoom: number;
}): null {
  useFitCoords(props);
  return null;
}
