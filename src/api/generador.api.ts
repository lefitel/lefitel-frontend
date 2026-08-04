import axios from "axios";
import { urlApi } from "./url";

const urlGenerador = "generador/";

// ─── Catalog ─────────────────────────────────────────────────────────────────

export type FieldKind = "string" | "number" | "boolean" | "date" | "image";

export type Operator =
  | "eq" | "neq"
  | "gt" | "gte" | "lt" | "lte"
  | "between"
  | "in"
  | "like"
  | "isnull" | "notnull";

export type AggFn = "count" | "sum" | "avg" | "min" | "max";

export interface CatalogField {
  /** Dotted path from the root, used in the configuration. */
  path: string;
  label: string;
  kind: FieldKind;
  /** Where the field comes from, e.g. "Evento › Poste › Ciudad A". */
  group: string;
  operators: Operator[];
  aggregates: AggFn[];
  calculated?: boolean;
}

export interface CatalogRoot {
  key: string;
  label: string;
  /** What one row of the report represents. */
  rowMeaning: string;
  fields: CatalogField[];
  /** Relations with many records, reachable only through an aggregate. */
  aggregateOnly: { path: string; label: string; group: string }[];
}

export interface Catalog {
  roots: CatalogRoot[];
}

// ─── Report configuration ────────────────────────────────────────────────────

export interface ColumnSpec {
  path: string;
  agg?: AggFn;
  label?: string;
}

export interface FilterCondition {
  path: string;
  operator: Operator;
  value?: unknown;
}

export interface ExistsCondition {
  exists: string;
  where?: FilterGroup;
  negate?: boolean;
}

export interface FilterGroup {
  op: "and" | "or";
  conditions: (FilterCondition | ExistsCondition | FilterGroup)[];
}

export interface SortSpec {
  path: string;
  dir: "asc" | "desc";
  agg?: AggFn;
}

export interface ReportConfig {
  root: string;
  columns: ColumnSpec[];
  filters?: FilterGroup;
  groupBy?: string[];
  sort?: SortSpec[];
  limit?: number;
  offset?: number;
}

export interface ReportResult {
  columns: { key: string; label: string; kind: FieldKind }[];
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Saved reports ───────────────────────────────────────────────────────────

export interface SavedReport {
  id: number;
  name: string;
  description: string | null;
  config: ReportConfig;
  id_usuario: number;
  visibility: "private" | "shared";
  favorite: boolean;
  createdAt?: string;
  updatedAt?: string;
  usuario?: { id: number; name?: string; lastname?: string } | null;
}

export interface SaveReportPayload {
  name: string;
  description?: string | null;
  config: ReportConfig;
  visibility?: "private" | "shared";
  favorite?: boolean;
}

// ─── Calls ───────────────────────────────────────────────────────────────────

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export const getCatalogo = (token: string): Promise<Catalog> =>
  axios.get(urlApi + urlGenerador + "catalogo", auth(token)).then((r) => r.data);

export const runReporte = (config: ReportConfig, token: string): Promise<ReportResult> =>
  axios.post(urlApi + urlGenerador + "consulta", config, auth(token)).then((r) => r.data);

export const getReportesGuardados = (token: string): Promise<SavedReport[]> =>
  axios.get(urlApi + urlGenerador + "reportes", auth(token)).then((r) => r.data);

export const crearReporte = (payload: SaveReportPayload, token: string): Promise<SavedReport> =>
  axios.post(urlApi + urlGenerador + "reportes", payload, auth(token)).then((r) => r.data);

export const actualizarReporte = (
  id: number,
  payload: Partial<SaveReportPayload>,
  token: string,
): Promise<SavedReport> =>
  axios.put(urlApi + urlGenerador + `reportes/${id}`, payload, auth(token)).then((r) => r.data);

export const eliminarReporte = (id: number, token: string): Promise<{ message: string }> =>
  axios.delete(urlApi + urlGenerador + `reportes/${id}`, auth(token)).then((r) => r.data);

export const duplicarReporte = (id: number, token: string): Promise<SavedReport> =>
  axios.post(urlApi + urlGenerador + `reportes/${id}/duplicar`, {}, auth(token)).then((r) => r.data);

/** Extracts the server's message, which is written for the user, not the developer. */
export const mensajeDeError = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  return fallback;
};
