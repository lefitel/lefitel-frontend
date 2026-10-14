import axios from "axios";
import { urlApi } from "../api/url";

/**
 * The road-following route between a tramo's points, asked of our own API.
 *
 * **This used to call OpenRouteService straight from the browser**, with the
 * provider's key read as `import.meta.env.VITE_ORS_API_KEY`. Vite writes every
 * `VITE_*` value literally into the bundle, so that key shipped — readable — in
 * the JavaScript served from www.osefi.net, three times over. It could not be
 * made secret there: OpenRouteService offers no referrer or domain restriction,
 * unlike the map keys that are public by design. Moving the call behind
 * `POST /api/ruta/query` is what makes it a secret, and the key now lives only
 * in the server's environment.
 *
 * Two things came free with the move. The retry that drops a waypoint ORS
 * cannot reach now happens server-side, so a tramo with five awkward poles is
 * one round trip from here instead of six. And every failure is written down:
 * an exhausted quota, a revoked key and a stretch with no roads used to be the
 * same straight line drawn in somebody's browser and recorded nowhere.
 *
 * @param waypoints  `[lng, lat]` pairs, ORS's order and GeoJSON's.
 * @returns          `[lat, lng]` pairs for the map, or `null` when there is no
 *                   route — every caller draws its straight-line fallback then.
 */
/**
 * How many poles between the two ends may travel with the request.
 *
 * Forty-eight, plus the two ends, is the fifty OpenRouteService accepts per
 * directions request — the provider's published limit, and the same number the
 * server checks before spending a call to be told 400.
 */
const MAX_INTERMEDIOS = 48;

/**
 * The tramo as ORS will accept it: both ends, and an even sample of the poles
 * in between when there are too many.
 *
 * **This lived in `ReportRecorrido.tsx` and only there**, which is why the pole
 * detail, the incident detail and the pole form never drew a real road route
 * for a tramo of more than forty-eight poles: they sent the lot, ORS refused
 * the whole request, and the screen fell back to a straight line with nothing
 * anywhere saying why. Doing it here is what makes it impossible for the next
 * screen to forget.
 *
 * The sampling formula is the report's own, unchanged, so the line that report
 * has been drawing stays exactly the same line.
 */
function recortarIntermedios(waypoints: number[][]): number[][] {
  if (waypoints.length <= 2) return waypoints;
  const medio = waypoints.slice(1, -1);
  if (medio.length <= MAX_INTERMEDIOS) return waypoints;
  const muestra = medio.filter((_, i) => i % Math.ceil(medio.length / MAX_INTERMEDIOS) === 0);
  return [waypoints[0], ...muestra, waypoints[waypoints.length - 1]];
}

export async function fetchOrsRoute(
  waypoints: number[][],
): Promise<[number, number][] | null> {
  // Fewer than two points is not a route, and not worth a request to be told so.
  if (waypoints.length < 2) return null;
  try {
    const { data } = await axios.post<{ coordenadas: [number, number][] | null }>(
      `${urlApi}ruta/query`,
      { waypoints: recortarIntermedios(waypoints) },
    );
    return data.coordenadas ?? null;
  } catch {
    // Never throws, so a caller needs no `.catch` of its own: some screens carry
    // one from before this, and the network map's hook carries none. A caller
    // that did forget would leave the map undrawn rather than drawn straight,
    // and "no route" is not an error worth interrupting anybody for.
    return null;
  }
}
