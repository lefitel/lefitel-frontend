const ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

/**
 * Requests a road-following route from OpenRouteService.
 * If a waypoint is too far from any road (error 2010), it is automatically
 * removed and the request is retried until the route succeeds or only the
 * start/end points remain (in which case null is returned).
 *
 * @param waypoints  Array of [lng, lat] coordinates (ORS order)
 * @param apiKey     ORS API key
 * @returns          Array of [lat, lng] coordinates (Leaflet order), or null on failure
 */
export async function fetchOrsRoute(
  waypoints: number[][],
  apiKey: string,
): Promise<[number, number][] | null> {
  let wps = [...waypoints];

  while (wps.length >= 2) {
    const res = await fetch(ORS_URL, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: wps, radiuses: wps.map(() => -1) }),
    });

    if (res.ok) {
      const geojson = await res.json();
      const coords = geojson.features[0].geometry.coordinates as [number, number][];
      return coords.map(([lng, lat]) => [lat, lng]);
    }

    const data = await res.json().catch(() => null);

    // Error 2010: specific waypoint is too far from any road — remove it and retry
    if (data?.error?.code === 2010) {
      const match = (data.error.message as string).match(/coordinate\s+(\d+)/i);
      if (match) {
        const idx = parseInt(match[1]);
        // Protect start and end: if the problematic point is the first or last, give up
        if (idx === 0 || idx === wps.length - 1) return null;
        wps = wps.filter((_, i) => i !== idx);
        continue;
      }
    }

    // Any other error
    return null;
  }

  return null;
}
