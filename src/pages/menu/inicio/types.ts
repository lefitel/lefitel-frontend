import { DashboardEvento, DashboardPoste } from "../../../api/dashboard.api";

export type Period = "fortnight" | "month" | "quarter" | "year" | "all" | "custom";
export type MapTab = "postes" | "pendientes" | "solucionados";

/**
 * Which department the map is narrowed to: every one, a department by id, or
 * the poles that have none — a tramo may not have been given one yet.
 */
export type MapDepartamento = "all" | "none" | number;

export const PERIOD_LABELS: Record<Period, string> = {
  fortnight: "15 días",
  month: "Este mes",
  quarter: "3 meses",
  year: "Este año",
  all: "Todo",
  custom: "Personalizado",
};

export interface CustomRange {
  start: Date;
  end: Date;
}

export const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export interface KpiData {
  postesTotal: number;
  postesConIncidencias: number;
  eventosTotal: number;
  eventosResueltosTotal: number;
  pendGlobal: number;
  postesCurr: number;
  postesPrev: number;
  postesRevisadosCurr: number;
  postesRevisadosPrev: number;
  postesPendientesRevisadosCurr: number;
  /** Distinct poles with a repair in the period. Feeds Postes Activos only. */
  postesSolucionadosCurr: number;
  /** Repairs in the period, by the date of the solution — the chart's rule. */
  eventosSolucionadosCurr: number;
  eventosSolucionadosPrev: number;
  postesActivosCurr: number;
  postesActivosPrev: number;
}

export type MapMarker =
  | { lat: number; lng: number; label: string; isPoste: true; item: DashboardPoste }
  | { lat: number; lng: number; label: string; isPoste: false; item: DashboardEvento };
