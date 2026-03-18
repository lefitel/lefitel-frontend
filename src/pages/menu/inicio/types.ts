import { EventoInterface, PosteInterface } from "../../../interfaces/interfaces";

export type Period = "month" | "quarter" | "year" | "all";
export type MapTab = "postes" | "pendientes" | "solucionados";

export const PERIOD_LABELS: Record<Period, string> = {
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
}

export type MapMarker =
  | { lat: number; lng: number; label: string; isPoste: true; item: PosteInterface }
  | { lat: number; lng: number; label: string; isPoste: false; item: EventoInterface };
