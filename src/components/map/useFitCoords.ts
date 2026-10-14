import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { boundsOf, hasCoords, toLngLat, type LatLng } from "./mapGeo";

interface FitOptions {
  coords: LatLng[];
  /** When false, the map centres on `center` at `zoom` instead of fitting. */
  fit: boolean;
  center: LatLng;
  zoom: number;
  /**
   * Milliseconds the view takes to travel when what it shows changes. Unset,
   * it jumps, which is what a map that is only ever placed once wants. The
   * first placement always jumps: a map should not open mid-flight.
   */
  duration?: number;
  /**
   * Fit or centre again even though nothing the effect reads has changed. The
   * view is placed when the box (or the centre and zoom) changes; a caller that
   * wants the same place shown again (the same selection chosen a second time,
   * with the user having panned away) bumps this number. Unset, nothing changes.
   */
  nonce?: number;
}

/**
 * Replaces the four near-identical helper components the screens each had for
 * this: fit the view to a set of points, or fall back to centring on one.
 */
export function useFitCoords({ coords, fit, center, zoom, duration = 0, nonce = 0 }: FitOptions): void {
  const { current: map } = useMap();
  const placed = useRef(false);

  const bounds = boundsOf(coords);
  // The screens rebuild this array on every render, so depending on it would
  // refit the map continuously. The box it produces is four numbers and only
  // changes when the area to show actually changes, which is the real trigger.
  const boundsKey = bounds ? bounds.flat().join(",") : "";

  useEffect(() => {
    if (!map) return;
    // Somebody who asked their system for less motion gets the jump.
    const quieto = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = placed.current && !quieto ? duration : 0;

    if (fit && bounds) {
      map.fitBounds(bounds, { padding: 40, duration: ms });
      placed.current = true;
      return;
    }
    if (hasCoords(center)) {
      map.flyTo({ center: toLngLat(center), zoom, duration: ms });
      placed.current = true;
    }
  // `bounds` is derived from `boundsKey` on the same render, so the key covers it.
  // The key only belongs in the list when `fit` is actually going to read it:
  // otherwise a box change (e.g. `coords` growing while a pin is placed, or a
  // late API response widening it) would refire this effect and fly the view
  // away from a `center` that never moved.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fit, fit ? boundsKey : "", center.lat, center.lng, zoom, nonce]);
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
  duration?: number;
  nonce?: number;
}): null {
  useFitCoords(props);
  return null;
}
