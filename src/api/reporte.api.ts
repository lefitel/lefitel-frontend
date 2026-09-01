import axios from "axios";
import { urlApi, urlReporte } from "./url";
import { EventoInterface, ReporteInterface } from "../interfaces/interfaces";

export const getReporteGeneral = (
  filtro: ReporteInterface
): Promise<EventoInterface[]> => {
  return axios
    .put(urlApi + urlReporte + "general", filtro)
    .then((r) => r.data);
};

export const getReporteTramo = (
  filtro: ReporteInterface
): Promise<EventoInterface[]> => {
  return axios
    .put(urlApi + urlReporte + "tramo", filtro)
    .then((r) => r.data);
};

export const getReporteRecorrido = (
  filtro: ReporteInterface
): Promise<EventoInterface[]> => {
  return axios
    .put(urlApi + urlReporte + "recorrido", filtro)
    .then((r) => r.data);
};

// ─── Nuevos endpoints ─────────────────────────────────────────────────────────

export interface EstadoRedRow {
  ciudadAId: number;
  ciudadBId: number;
  ciudadAName: string;
  ciudadBName: string;
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
  ciudadAId: number | null;
  ciudadBId: number | null;
  ciudadAName: string;
  ciudadBName: string;
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
  filtro: { fechaInicial?: Date; fechaFinal?: Date }
): Promise<EstadoRedRow[]> => {
  return axios
    .put(urlApi + urlReporte + "estado-red", filtro)
    .then((r) => r.data);
};

export const getObsFrecuencia = (
  filtro: { fechaInicial: Date; fechaFinal: Date }
): Promise<ObsFrecuenciaRow[]> => {
  return axios
    .put(urlApi + urlReporte + "obs-frecuencia", filtro)
    .then((r) => r.data);
};

export const getTiemposResumen = (
  filtro: { fechaInicial: Date; fechaFinal: Date }
): Promise<TiemposResumen> => {
  return axios
    .put(urlApi + urlReporte + "tiempos-resumen", filtro)
    .then((r) => r.data);
};
