import { useEffect, useMemo, useRef, useState } from "react";
import type { CiudadDeRed, TramoConCifras } from "../../../../api/Tramo.api";
import type { PosteInterface } from "../../../../interfaces/interfaces";
import { fromLatLngTuple, type LatLng } from "../../../../components/map/mapGeo";
import { fetchOrsRoute } from "../../../../lib/orsRoute";
import { ordenarTramo } from "../../../../lib/tramoOrden";
import { extremosDelTramo } from "./redGeo";

/**
 * What the map has to draw for the selected tramo. `pendiente` covers every
 * case in which there is nothing to draw yet: no tramo, an end without a
 * position, poles or the answer still on their way, a city being dragged.
 */
export type RutaDelTramo =
  | { estado: "pendiente" }
  | { estado: "sinRuta" }
  | { estado: "lista"; puntos: LatLng[] };

const PENDIENTE: RutaDelTramo = { estado: "pendiente" };
const SIN_RUTA: RutaDelTramo = { estado: "sinRuta" };

/**
 * The road route of the selected tramo, asked the way the pole detail asks it:
 * one end, the tramo's poles in the order the cable visits them, the other end.
 *
 * It asks once the tramo's poles have finished loading, so that it does not ask
 * first without them and then with them, and never while one of the tramo's
 * cities is being dragged (the position it would ask about is about to change).
 * Routes are kept for the life of the page, keyed by the waypoints sent: the
 * same tramo selected again spends no request, and a reload that changes its
 * ends or poles produces other waypoints and so asks again.
 */
export function useRutaDelTramo({ tramo, ciudades, postes, cargandoPostes }: {
  tramo: TramoConCifras | undefined;
  ciudades: CiudadDeRed[];
  postes: PosteInterface[];
  /** The tramo's poles are still being loaded; false too for a role that cannot see poles. */
  cargandoPostes: boolean;
}): RutaDelTramo {
  // Stored positions.
  const extremos = useMemo(
    () => (tramo ? extremosDelTramo(tramo, ciudades) : null),
    [tramo, ciudades],
  );
  const orden = useMemo(
    () => (extremos ? ordenarTramo(postes, extremos[0], extremos[1]) : null),
    [extremos, postes],
  );
  const waypoints = orden ? orden.waypoints : null;
  const clave = waypoints ? JSON.stringify(waypoints) : null;

  // Fewer than two waypoints is not a route (the ordering drops an end that does
  // not lie near its own poles): there is nothing to ask.
  const preguntable = waypoints !== null && waypoints.length >= 2;
  const listo = preguntable && !cargandoPostes;

  const [respuestas, setRespuestas] = useState<Map<string, RutaDelTramo>>(new Map());
  const conocida = clave !== null && respuestas.has(clave);

  // The waypoints that came back without a route. A `null` is "no road" or a
  // failure that may pass, so it is not remembered like a route: the set is
  // emptied as soon as the selected tramo changes (deselecting, or going to
  // another one), and the next selection asks again. While the selection stays,
  // a key in the set is not asked again, or a failing service would be hit on
  // every render. Keys are added, never replaced, and by the waypoints that were
  // asked rather than by the selection that asked: a `null` that lands late, for
  // a tramo no longer selected or for a key the current one shares, marks that
  // key and nothing else.
  const [fallos, setFallos] = useState<Set<string>>(new Set());
  const [idVisto, setIdVisto] = useState<number | null>(tramo?.id ?? null);
  if ((tramo?.id ?? null) !== idVisto) {
    setIdVisto(tramo?.id ?? null);
    setFallos(new Set());
  }
  const fallida = clave !== null && fallos.has(clave);

  // Questions still out. An answer is kept under the waypoints it was asked for,
  // so one that lands after the person moved to another tramo cannot be drawn on
  // it: it waits in `respuestas` for the tramo it belongs to, and coming back to
  // that tramo while it is out does not ask a second time.
  const enVuelo = useRef(new Set<string>());
  useEffect(() => {
    if (!listo || clave === null || conocida || fallida || orden === null || enVuelo.current.has(clave)) return;
    enVuelo.current.add(clave);
    void fetchOrsRoute(orden.waypoints).then((ruta) => {
      enVuelo.current.delete(clave);
      if (!ruta) {
        setFallos((previos) => new Set(previos).add(clave));
        return;
      }
      const respuesta: RutaDelTramo = { estado: "lista", puntos: ruta.map(fromLatLngTuple) };
      setRespuestas((previas) => new Map(previas).set(clave, respuesta));
    });
  // `orden` is what `clave` is made of: the key says when it changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, clave, conocida, fallida]);

  if (waypoints === null || clave === null) return PENDIENTE;
  if (!preguntable) return SIN_RUTA;
  if (!listo) return PENDIENTE;
  return respuestas.get(clave) ?? (fallida ? SIN_RUTA : PENDIENTE);
}
