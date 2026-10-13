import type { Paginado } from "../api/listado";
import type { BitacoraInterface } from "../interfaces/interfaces";

/**
 * Several reads of the same log, as one timeline: newest first, each line once.
 *
 * **Why it is cut.** Each read is a first page, so each stops somewhere — and
 * not at the same line. Past the point where the shortest-reaching one stops,
 * the lines of that read are missing while the others' are still there, and a
 * timeline with silent gaps reads as "nothing happened". So it ends at the
 * newest line any truncated read stopped on: everything shown is complete.
 *
 * By `id` and not by date: the log only ever appends, both reads are ordered by
 * it, and two lines written in the same millisecond still have an order.
 */
export function fusionarBitacora(lecturas: Paginado<BitacoraInterface>[]): BitacoraInterface[] {
  const porId = new Map<number, BitacoraInterface>();
  let corte = 0;

  for (const { data, total } of lecturas) {
    const ids = data.map((f) => f.id).filter((id): id is number => typeof id === "number");
    for (const fila of data) {
      // The read that names the author wins: one of them does not send it.
      if (typeof fila.id === "number" && (!porId.has(fila.id) || fila.usuario)) porId.set(fila.id, fila);
    }
    if (total > data.length && ids.length > 0) corte = Math.max(corte, Math.min(...ids));
  }

  return [...porId.values()]
    .filter((f) => (f.id as number) >= corte)
    .sort((a, b) => (b.id as number) - (a.id as number));
}
