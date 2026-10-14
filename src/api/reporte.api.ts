import axios from "axios";
import { urlApi, urlReporte } from "./url";
import { EventoInterface, ReporteInterface, Tramo } from "../interfaces/interfaces";

// `GET` with the filter in the URL, not `PUT` with it in a body — §3.1 of the
// API standard. The six reports read and write nothing at all, and a `PUT` that
// changes nothing misleads every cache, proxy and retry between here and the
// server.
//
// Three properties of `params` this depends on, all of them asserted in
// `reporte.api.test.ts` rather than assumed, because each one would break the
// reports in a different and quiet way:
//
//   - **a `Date` is serialised as an ISO string.** The server parses it back;
//     anything else — a locale string, `[object Object]` — is an invalid date,
//     which it now refuses with a 400 instead of turning into a 500.
//   - **`null` and `undefined` are dropped.** The screens leave the `tramo` key
//     out when none is chosen; were one to slip through as `null`, it must not
//     travel as the text "null", which the server refuses as a whole filter.
//   - **`false` travels as `false`, not as nothing.** `excludeOld` is the one
//     value where the difference is invisible: dropped, the server would read
//     its default, which happens to be the same — until the day the default
//     changes and every client silently disagrees with it.

export const getReporteGeneral = (
  filtro: ReporteInterface
): Promise<EventoInterface[]> => {
  return axios
    .get(urlApi + urlReporte + "general", { params: filtro })
    .then((r) => r.data);
};

export const getReporteTramo = (
  filtro: ReporteInterface
): Promise<EventoInterface[]> => {
  return axios
    .get(urlApi + urlReporte + "tramo", { params: filtro })
    .then((r) => r.data);
};

export const getReporteRecorrido = (
  filtro: ReporteInterface
): Promise<EventoInterface[]> => {
  return axios
    .get(urlApi + urlReporte + "recorrido", { params: filtro })
    .then((r) => r.data);
};

// ─── Nuevos endpoints ─────────────────────────────────────────────────────────

export interface EstadoRedRow {
  tramo: Tramo;
  totalPostes: number;
  conPendientes: number;
  totalPendientes: number;
  totalEventos: number;
  pctSalud: number;
}

export interface ObsFrecuenciaRow {
  tipoObs: string;
  obs: string;
  criticality: number | null;
  count: number;
  pct: number;
}

export interface TiempoTramoRow {
  tramo: Tramo;
  /** Eventos que entran en el promedio, ya sin los descartados. */
  count: number;
  avgDias: number;
  minDias: number;
  maxDias: number;
  /** Visitas de media que costó cerrar cada evento del tramo. */
  avgVisitas: number;
}

export interface TiemposResumen {
  tramos: TiempoTramoRow[];
  /**
   * Eventos dejados fuera por tener la reparación fechada antes que la avería.
   * Se informan en vez de contarse como cero días, que es lo que hacían antes.
   */
  descartados: number;
}

export const getEstadoRed = (
  filtro: { fechaInicial?: Date; fechaFinal?: Date; tramo?: number }
): Promise<EstadoRedRow[]> => {
  return axios
    .get(urlApi + urlReporte + "estado-red", { params: filtro })
    .then((r) => r.data);
};

export const getObsFrecuencia = (
  filtro: { fechaInicial: Date; fechaFinal: Date; tramo?: number }
): Promise<ObsFrecuenciaRow[]> => {
  return axios
    .get(urlApi + urlReporte + "frecuencia-obs", { params: filtro })
    .then((r) => r.data);
};

export const getTiemposResumen = (
  filtro: { fechaInicial: Date; fechaFinal: Date; tramo?: number }
): Promise<TiemposResumen> => {
  return axios
    .get(urlApi + urlReporte + "resumen-tiempos", { params: filtro })
    .then((r) => r.data);
};
