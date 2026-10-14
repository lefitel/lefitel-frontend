import type { LatLng } from "../../../../components/map/mapGeo";
import type { TramoConCifras } from "../../../../api/Tramo.api";

/**
 * `ciudadNueva` is not a tool of its own: it is a step inside `tramoNuevo`, for
 * the tramo whose city does not exist yet. It is entered from the tramo being
 * drawn and it goes back to it, with what had been picked still picked.
 */
export type Modo = "seleccionar" | "tramoNuevo" | "ciudadNueva";

export interface EstadoRed {
  modo: Modo;
  /** Cities picked for a new tramo: none, one or two ids, never the same twice. */
  elegidas: number[];
  /** Where the new city would go. */
  borrador: LatLng | null;
}

export const ESTADO_INICIAL: EstadoRed = { modo: "seleccionar", elegidas: [], borrador: null };

export type Accion =
  | { tipo: "modo"; modo: Modo; desde?: number } // `desde`: start a new tramo from this city
  | { tipo: "elegir"; id: number } // map click on a city in tramoNuevo
  | { tipo: "fijar"; hueco: 0 | 1; id: number | null } // the card's two selectors
  | { tipo: "ciudadParaTramo" } // from the tramo being drawn: go and place the city it lacks
  | { tipo: "volverAlTramo"; nueva?: number } // back to that tramo, with the new city picked if one was made
  | { tipo: "borrador"; punto: LatLng }
  | { tipo: "terminar" }; // back to "seleccionar", everything cleared

export function reducir(estado: EstadoRed, accion: Accion): EstadoRed {
  switch (accion.tipo) {
    case "modo":
      return {
        modo: accion.modo,
        elegidas: accion.desde === undefined ? [] : [accion.desde],
        borrador: null,
      };
    case "elegir": {
      if (estado.modo !== "tramoNuevo") return estado;
      const { id } = accion;
      if (estado.elegidas.includes(id)) return { ...estado, elegidas: estado.elegidas.filter((e) => e !== id) };
      if (estado.elegidas.length < 2) return { ...estado, elegidas: [...estado.elegidas, id] };
      return { ...estado, elegidas: [estado.elegidas[0], id] };
    }
    case "fijar": {
      const huecos: (number | null)[] = [estado.elegidas[0] ?? null, estado.elegidas[1] ?? null];
      huecos[accion.hueco] = accion.id;
      // The same city cannot fill both: the one just placed wins, the other slot empties.
      const otro = accion.hueco === 0 ? 1 : 0;
      if (accion.id !== null && huecos[otro] === accion.id) huecos[otro] = null;
      return { ...estado, elegidas: huecos.filter((h): h is number => h !== null) };
    }
    case "ciudadParaTramo":
      // What was picked is kept: it is the tramo this city is for.
      return estado.modo === "tramoNuevo" ? { ...estado, modo: "ciudadNueva", borrador: null } : estado;
    case "volverAlTramo": {
      if (estado.modo !== "ciudadNueva") return estado;
      const { nueva } = accion;
      // The new city takes a free slot; with both taken it replaces the second,
      // as a click on a third city does.
      const elegidas = nueva === undefined || estado.elegidas.includes(nueva)
        ? estado.elegidas
        : estado.elegidas.length < 2 ? [...estado.elegidas, nueva] : [estado.elegidas[0], nueva];
      return { modo: "tramoNuevo", elegidas, borrador: null };
    }
    case "borrador":
      return estado.modo === "ciudadNueva" ? { ...estado, borrador: accion.punto } : estado;
    case "terminar":
      return ESTADO_INICIAL;
  }
}

/** The ids of a tramo's two cities, or null if the response did not carry them. */
export function idsDe(t: TramoConCifras): [number, number] | null {
  const par: unknown = t.ciudades;
  if (!Array.isArray(par) || par.length !== 2) return null;
  const a = (par[0] as { id?: unknown } | null | undefined)?.id;
  const b = (par[1] as { id?: unknown } | null | undefined)?.id;
  return typeof a === "number" && typeof b === "number" ? [a, b] : null;
}

/** The live tramo between two cities, whichever way round. */
export function tramoEntre(tramos: TramoConCifras[], a: number, b: number): TramoConCifras | undefined {
  return tramos.find((t) => {
    const ids = idsDe(t);
    return ids !== null && ((ids[0] === a && ids[1] === b) || (ids[0] === b && ids[1] === a));
  });
}

export function tramosDeCiudad(tramos: TramoConCifras[], idCiudad: number): TramoConCifras[] {
  return tramos.filter((t) => idsDe(t)?.includes(idCiudad) === true);
}
