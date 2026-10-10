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

/**
 * Whether a point has somewhere to be drawn.
 *
 * 0,0 is how the database marks "this row has no coordinates yet", and that was
 * the whole question: is there a value. A value is not a place. A decimal point
 * lost in the typing stored a pole at latitude -22.048.385.017, and that one
 * pole cost its whole stretch — the screens that draw a stretch send all of its
 * poles to the routing endpoint, which refuses the request over a single
 * impossible point, so the road route fell back to a straight line for every
 * pole on it. Six of 1.541 poles carried one. They also went into the bounds a
 * map is fitted to, and into the layer the operations map draws.
 *
 * The screens asked the same thing by hand, as `p.lat && p.lng`, in twelve
 * places; they ask this now. The server refuses such a pair on saving
 * (`coordenadasInvalidas`); this is what keeps the ones already stored from
 * taking their neighbours with them.
 */
export function hasCoords(p: { lat?: number | null; lng?: number | null } | null | undefined): boolean {
  if (!p) return false;
  const { lat, lng } = p;
  return (
    typeof lat === "number" && typeof lng === "number" &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat !== 0 && lng !== 0 &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
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
