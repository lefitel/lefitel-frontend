import type { CiudadDeRed, TramoConCifras } from "../../../../api/Tramo.api";
import { departamentoDeValor } from "./departamentoValor";
import { idsDe, type EstadoRed } from "./redEstado";

/** No department filter. Any other value is one `departamentoValor` writes. */
export const TODOS = "todos";

/** What narrows the tramos besides the name typed in the search box. */
export interface FiltrosLista {
  departamento: string;
}

export const SIN_FILTROS: FiltrosLista = { departamento: TODOS };

/** Whether a tramo belongs under the department filter. */
export const tramoEncaja = (t: TramoConCifras, filtros: FiltrosLista): boolean =>
  filtros.departamento === TODOS || t.id_departamento === departamentoDeValor(filtros.departamento);

/**
 * The cities the map draws under the department filter: those at either end
 * of a tramo that fits it.
 *
 * The map has no line for a tramo nobody has selected, so cities are all a
 * filter can take off it. Two things stay whatever the filter says:
 *
 * - what is selected, and both ends of a selected tramo — the address can name
 *   one from outside the filter, and a card open on something the map does not
 *   show reads as a broken screen;
 * - everything, while a tramo is being added: a new tramo may join two
 *   departments, and a city that cannot be seen cannot be picked.
 */
export function ciudadesDelMapa({ tramos, ciudades, filtros, estado, tramoSel, ciudadSel }: {
  tramos: TramoConCifras[];
  ciudades: CiudadDeRed[];
  filtros: FiltrosLista;
  estado: EstadoRed;
  tramoSel: number | null;
  ciudadSel: number | null;
}): CiudadDeRed[] {
  if (filtros.departamento === TODOS) return ciudades;
  if (estado.modo !== "seleccionar") return ciudades;

  const visibles = new Set<number>();
  for (const t of tramos) {
    if (t.id !== tramoSel && !tramoEncaja(t, filtros)) continue;
    for (const id of idsDe(t) ?? []) visibles.add(id);
  }
  if (ciudadSel !== null) visibles.add(ciudadSel);
  return ciudades.filter((c) => visibles.has(c.id));
}
