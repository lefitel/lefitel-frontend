import { DashboardEvento, DashboardPoste } from "../../../api/dashboard.api";

export type Period = "fortnight" | "month" | "quarter" | "year" | "all";
export type MapTab = "postes" | "pendientes" | "solucionados";

export const PERIOD_LABELS: Record<Period, string> = {
  fortnight: "15 días",
  month: "Este mes",
  quarter: "3 meses",
  year: "Este año",
  all: "Todo",
};

export const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export interface KpiData {
  postesTotal: number;
  postesConIncidencias: number;
  eventosTotal: number;
  eventosResueltosTotal: number;
  postesCurr: number;
  postesPrev: number;
  pendGlobal: number;
  pendCurr: number;
  pendPrev: number;
  solCurr: number;
  solPrev: number;
  resRateCurr: number;
  resRatePrev: number;
  openedCurr: number;
  openedPrev: number;
  reviewedCurr: number;
  reviewedPrev: number;
  reviewedSolved: number;
  reviewedPending: number;
}

export type MapMarker =
  | { lat: number; lng: number; label: string; isPoste: true; item: DashboardPoste }
  | { lat: number; lng: number; label: string; isPoste: false; item: DashboardEvento };
