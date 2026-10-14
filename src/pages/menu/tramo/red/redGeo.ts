import type { CiudadDeRed, TramoConCifras } from "../../../../api/Tramo.api";
import type { CiudadDeTramo } from "../../../../interfaces/interfaces";
import { hasCoords, type LatLng } from "../../../../components/map/mapGeo";
import { idsDe, tramosDeCiudad } from "./redEstado";

type ConPosicion = Pick<CiudadDeRed, "id" | "lat" | "lng">;

/**
 * The city at one end of a tramo: the live list's entry, or else the position the
 * tramo itself carries. A live tramo may end in an archived city, which the list
 * (live cities only) does not hold.
 */
function extremo(
  porId: Map<number, CiudadDeRed>,
  t: TramoConCifras,
  indice: 0 | 1,
): ConPosicion | undefined {
  const propio: CiudadDeTramo | null | undefined = t.ciudades[indice];
  return (propio ? porId.get(propio.id) : undefined) ?? propio ?? undefined;
}

/** Where a city is, as stored, or null when it has none to draw. */
function posicion(c: ConPosicion | undefined): LatLng | null {
  return c && hasCoords(c) ? { lat: c.lat as number, lng: c.lng as number } : null;
}

/**
 * The two ends of a tramo as they can be drawn, or null when either has no
 * position (or the tramo does not hold two cities).
 */
export function extremosDelTramo(
  t: TramoConCifras,
  ciudades: CiudadDeRed[],
): [LatLng, LatLng] | null {
  if (!idsDe(t)) return null;
  const porId = new Map(ciudades.map((c) => [c.id, c]));
  const a = posicion(extremo(porId, t, 0));
  const b = posicion(extremo(porId, t, 1));
  return a && b ? [a, b] : null;
}

/**
 * What the view should frame: the selected tramo's two ends, or the selected
 * city with the cities it is joined to, otherwise every city. Reads stored
 * positions only, so dragging a city never changes it.
 */
export function encuadre(args: {
  tramos: TramoConCifras[];
  ciudades: CiudadDeRed[];
  tramoSel: number | null;
  ciudadSel: number | null;
}): LatLng[] {
  const { tramos, ciudades, tramoSel, ciudadSel } = args;
  const porId = new Map(ciudades.map((c) => [c.id, c]));

  let elegidas: (ConPosicion | undefined)[];
  if (tramoSel !== null) {
    const t = tramos.find((x) => x.id === tramoSel);
    elegidas = t && idsDe(t) ? [extremo(porId, t, 0), extremo(porId, t, 1)] : ciudades;
  } else if (ciudadSel !== null) {
    elegidas = [porId.get(ciudadSel)];
    for (const t of tramosDeCiudad(tramos, ciudadSel)) {
      const ids = idsDe(t);
      if (ids) elegidas.push(extremo(porId, t, ids[0] === ciudadSel ? 1 : 0));
    }
  } else {
    elegidas = ciudades;
  }

  return elegidas.flatMap((c) => {
    const p = posicion(c);
    return p ? [p] : [];
  });
}
