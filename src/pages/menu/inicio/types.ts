import { DashboardEvento, DashboardPoste } from "../../../api/dashboard.api";

export type Period = "fortnight" | "month" | "quarter" | "year" | "all" | "custom";
export type MapTab = "postes" | "pendientes" | "solucionados";

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
  postesConEventos: number;
  eventosTotal: number;
  eventosResueltosTotal: number;
  pendGlobal: number;
  postesCurr: number;
  postesRevisadosCurr: number;
  postesRevisadosPrev: number;
  postesPendientesRevisadosCurr: number;
  postesSolucionadosCurr: number;
  postesSolucionadosPrev: number;
  postesActivosCurr: number;
  postesActivosPrev: number;
}

export type MapMarker =
  | { lat: number; lng: number; label: string; isPoste: true; item: DashboardPoste }
  | { lat: number; lng: number; label: string; isPoste: false; item: DashboardEvento };
