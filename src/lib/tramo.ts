// Reading a tramo. The server names it and orders its two ends; this file is
// the one place the client takes that apart, so that no screen grows its own
// way of turning a pole into "City A <something> City B" again — there were
// five.
//
// The one deliberate exception is `components/TramoEnlazado`, which writes the
// two city names to make each one a link. It does so only when the result is
// exactly `tramo.nombre`; otherwise it shows the server's name as it came.

import type { CiudadDeTramo, Tramo } from "../interfaces/interfaces";

export interface Punto {
  lat: number;
  lng: number;
}

/** The name of a pole's tramo, or nothing for a pole that came without one. */
export const nombreDelTramo = (poste: { tramo?: Tramo | null } | null | undefined): string =>
  poste?.tramo?.nombre ?? "";

/** What a map popup calls either city of a tramo: a tramo has no start and no end. */
export const ETIQUETA_EXTREMO = "Extremo del tramo";

/** A city as a point, when it has one. Some were never placed on the map. */
export const puntoDe = (ciudad: CiudadDeTramo | null | undefined): Punto | null => {
  const lat = ciudad?.lat;
  const lng = ciudad?.lng;
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng }
    : null;
};

/**
 * The two ends as points, in the order of the name.
 *
 * Always two slots: `ordenarTramo` takes one end and the other, and a missing
 * end has to stay missing in its own place rather than shift the other one.
 */
export const extremosDibujables = (tramo: Tramo | null | undefined): [Punto | null, Punto | null] =>
  [puntoDe(tramo?.ciudades?.[0]), puntoDe(tramo?.ciudades?.[1])];
