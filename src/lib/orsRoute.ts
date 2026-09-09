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
export async function fetchOrsRoute(
  waypoints: number[][],
): Promise<[number, number][] | null> {
  try {
    const { data } = await axios.post<{ coordenadas: [number, number][] | null }>(
      `${urlApi}ruta/query`,
      { waypoints },
    );
    return data.coordenadas ?? null;
  } catch {
    // Never throws. The four screens each carry their own `.catch` today, but a
    // fifth written without one would leave the map undrawn rather than drawn
    // straight — and "no route" is not an error worth interrupting anybody for.
    return null;
  }
}
