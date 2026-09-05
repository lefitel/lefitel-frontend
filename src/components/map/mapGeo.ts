import type { FeatureCollection, Point } from "geojson";

/** A point as the rest of this codebase writes it: latitude first, by name. */
export type LatLng = { lat: number; lng: number };

/** A point to be drawn on a map, with the data behind it. */
export type MapPointData<T> = LatLng & {
  id: string | number;
  color: string;
  item: T;
};

/**
 * MapLibre takes coordinates as [longitude, latitude]; Leaflet took them the
 * other way round. This module is the only place allowed to write a raw pair,
 * so a swap can only ever happen here — and the tests above watch this spot.
 */
export function toLngLat(p: LatLng): [number, number] {
  return [p.lng, p.lat];
}

export function toLngLatList(ps: LatLng[]): [number, number][] {
  return ps.map(toLngLat);
}

/** Reads a Leaflet-shaped [lat, lng] tuple back into a named pair. */
export function fromLatLngTuple(t: [number, number]): LatLng {
  return { lat: t[0], lng: t[1] };
}

/** 0,0 is how the database marks "this row has no coordinates yet". */
export function hasCoords(p: Partial<LatLng> | null | undefined): boolean {
  if (!p) return false;
  return (p.lat ?? 0) !== 0 && (p.lng ?? 0) !== 0;
}

/** Southwest and northeast corners, as MapLibre's fitBounds expects them. */
export function boundsOf(ps: LatLng[]): [[number, number], [number, number]] | null {
  const valid = ps.filter(hasCoords);
  if (valid.length < 2) return null;

  const lats = valid.map((p) => p.lat);
  const lngs = valid.map((p) => p.lng);

  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

export function pointsToFeatureCollection<T>(
  points: MapPointData<T>[],
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: points.filter(hasCoords).map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: toLngLat(p) },
      properties: { id: p.id, color: p.color },
    })),
  };
}
