import axios, { AxiosRequestConfig } from "axios";

// One envelope, one reader, and one place where a truncated answer stops.
//
// Since C3 every listing in the API answers the same shape:
//
//     { data: [], total: 0, page: 1, limit: 50 }
//
// Before it there were three shapes across seventeen addresses — fourteen bare
// arrays, two envelopes and one envelope missing half its fields — and no reader
// of this folder could tell which without opening the controller.
//
// **The firewall is about shape, not arithmetic, and that distinction is the
// whole file.** The obvious check is `data.length < total`, and it misses the
// case that matters: against a server without C3, the fourteen bare-array
// endpoints send no `total` at all, so `0 < undefined` is `false` and the guard
// waves through an answer it cannot even read. Fourteen screens would then paint
// an empty list with no toast, no console line and no error — the failure mode
// §3.3 of the standard names as the worst this arc could cause. So a response
// that is not `{ data: Array, total: number }` is refused outright, before any
// comparison.
//
// The other half is the same defect from the opposite side. `limit=all` against
// a server without C3 is `Number("all") || 50`, which is **fifty** — a 200, a
// valid envelope, and an Excel with fifty of seventeen hundred poles, headed
// "Reporte de Postes", on its way to a client with nothing in the file saying
// so. That is why `todasLasFilas` insists on having been given everything.

/** The envelope, and the only shape a listing answers with. */
export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  limit: number | "all";
}

/** One filter the tables send: a column and the text typed into it. */
export interface FiltroActivo {
  column: string;
  value: string;
}

/**
 * What every listing accepts.
 *
 * One declaration where there were two identical ones — `GetPosteParams` and
 * `GetEventoParams`, field for field the same. **What it cannot express is which
 * columns each endpoint actually knows**: the pole list filters by `name` alone
 * and sorts by four columns; the incident list filters by five and sorts by
 * nine. Neither answers an error for a column it does not recognise — it ignores
 * it — so a wrong column name gives back *everything* with the filter drawn as
 * active on screen. That is a server-side gap, noted here because this type is
 * where somebody will look for the answer and not find it.
 */
export interface ListParams {
  page?: number;
  limit?: number | "all";
  archived?: boolean;
  filters?: FiltroActivo[];
  sortBy?: string[];
  sortOrder?: string[];
}

/** `ListParams` as query parameters, with the array pairs Express expects. */
export const comoParametros = (p: ListParams = {}): Record<string, unknown> => ({
  ...(p.page !== undefined ? { page: p.page } : {}),
  ...(p.limit !== undefined ? { limit: p.limit } : {}),
  ...(p.archived ? { archived: true } : {}),
  ...(p.filters?.length
    ? {
      filterColumn: p.filters.map((f) => f.column),
      filterValue: p.filters.map((f) => f.value),
    }
    : {}),
  ...(p.sortBy?.length ? { sortBy: p.sortBy, sortOrder: p.sortOrder } : {}),
});

/** True for a body that is really the envelope, and not merely truthy. */
const esSobre = <T>(cuerpo: unknown): cuerpo is Paginado<T> => {
  const c = cuerpo as Paginado<T> | null;
  return !!c && Array.isArray(c.data) && typeof c.total === "number";
};

/**
 * A listing, refusing anything that is not the envelope.
 *
 * The refusal is an exception and not an empty list on purpose: a screen that
 * receives `[]` draws "no hay resultados", which is a statement about the data.
 * Every caller here has a `.catch`, or is about to get one.
 */
export const pedirListado = async <T>(
  url: string,
  parametros?: Record<string, unknown>,
): Promise<Paginado<T>> => {
  const config: AxiosRequestConfig | undefined = parametros ? { params: parametros } : undefined;
  const { data } = await axios.get(url, config);
  if (!esSobre<T>(data)) {
    throw new Error(
      `La respuesta de ${url} no tiene la forma de un listado. ` +
      "Puede ser un servidor sin actualizar; no se puede saber si faltan filas.",
    );
  }
  return data;
};

/**
 * Every row of a collection, or an error — never some of them.
 *
 * This is what the fourteen callers that used `?export=true` ask for now. Eight
 * of those fourteen never exported anything: they used the parameter to mean
 * "give me all the rows", which is what it always was, and what `limit=all` says
 * out loud.
 *
 * The count check is the second half of the firewall and it is not redundant
 * with `pedirListado`: a well-formed envelope carrying fifty of seventeen
 * hundred rows is exactly what an un-migrated server answers to `limit=all`, and
 * it is indistinguishable from a complete one except by this comparison.
 */
export const todasLasFilas = async <T>(
  url: string,
  parametros: Record<string, unknown> = {},
): Promise<T[]> => {
  const sobre = await pedirListado<T>(url, { ...parametros, limit: "all" });
  if (sobre.data.length < sobre.total) {
    throw new Error(
      `Se pidieron todas las filas de ${url} y llegaron ${sobre.data.length} de ${sobre.total}. ` +
      "No se puede construir nada con una lista incompleta.",
    );
  }
  return sobre.data;
};
