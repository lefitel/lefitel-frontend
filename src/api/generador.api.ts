import axios from "axios";
import { nombreDeFichero } from "./descarga";
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

/**
 * What a value means, beyond its type. Sent by the server so presentation
 * decisions — colouring a row by criticality — never depend on guessing from
 * a label the user can rename.
 */
export type FieldSemantic = "criticality" | "state";

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
  semantic?: FieldSemantic;
  /** Already a summary of its own row (a count); grouping by it is rejected. */
  aggregate?: boolean;
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

/** Caps published by the server, so both sides cannot drift apart. */
export interface CatalogLimits {
  maxColumns: number;
  maxConditions: number;
  maxSorts: number;
  maxRows: number;
  maxDepth: number;
  maxFilterValue: number;
}

/**
 * A report somebody can press instead of building one.
 *
 * Comes from the server with the catalog, not from a constant here: a template
 * is a handful of catalog paths, and a copy of those in this repo is the same
 * duplication that put two spellings of "máximo" and two copies of the caps on
 * two sides. The server prunes each one to whoever is asking, so what arrives is
 * always runnable, and a test there refuses any template the builder cannot
 * build.
 */
export interface ReportTemplate {
  key: string;
  name: string;
  description: string;
  config: ReportConfig;
}

export interface Catalog {
  roots: CatalogRoot[];
  limits: CatalogLimits;
  /**
   * Optional because an older server does not send it. The gallery simply does
   * not appear rather than the page failing to load.
   */
  templates?: ReportTemplate[];
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
  columns: {
    key: string;
    label: string;
    kind: FieldKind;
    semantic?: FieldSemantic;
    /** Where this column came from, so the table can sort by its own headers. */
    path: string;
    agg?: AggFn;
  }[];
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
  /**
   * How many pieces of the stored configuration the server left out because
   * this account may not use them.
   *
   * The server prunes on the way out — a shared report used to publish the
   * paths of the fields the catalog hides, filter values included — so the
   * client can no longer tell what is missing by comparing against the
   * catalog. This is the count it needs to say so out loud.
   */
  omitted?: number;
}

/** One page of saved reports, plus how many there are in all. */
export interface SavedReportPage {
  rows: SavedReport[];
  total: number;
  limit: number;
  offset: number;
}

export interface SaveReportPayload {
  name: string;
  description?: string | null;
  config: ReportConfig;
  visibility?: "private" | "shared";
  favorite?: boolean;
}

// ─── Calls ───────────────────────────────────────────────────────────────────

export const getCatalogo = (): Promise<Catalog> =>
  axios.get(urlApi + urlGenerador + "catalogo").then((r) => r.data);

export const runReporte = (config: ReportConfig): Promise<ReportResult> =>
  axios.post(urlApi + urlGenerador + "consulta", config).then((r) => r.data);

/**
 * How many rows the report would return, without reading any of them.
 *
 * Asked while somebody is still typing a filter value, which is why it is a
 * different endpoint with a budget four times larger: knowing a filter leaves
 * 118 rows and not 40.000 changes the decision *before* it is taken, and asking
 * the full query at that rate would spend the limit that keeps one person from
 * holding the database for everyone.
 */
export const contarReporte = (
  config: ReportConfig,
  signal?: AbortSignal,
): Promise<{ total: number }> =>
  axios
    .post(urlApi + urlGenerador + "conteo", config, { signal })
    .then((r) => r.data);

export const getReportesGuardados = (
  page: { limit?: number; offset?: number } = {},
): Promise<SavedReportPage> =>
  axios
    .get(urlApi + urlGenerador + "reportes", {
      params: { limit: page.limit, offset: page.offset },
    })
    .then((r) => r.data);

export const crearReporte = (payload: SaveReportPayload): Promise<SavedReport> =>
  axios.post(urlApi + urlGenerador + "reportes", payload).then((r) => r.data);

export const actualizarReporte = (
  id: number,
  payload: Partial<SaveReportPayload>,
): Promise<SavedReport> =>
  axios.put(urlApi + urlGenerador + `reportes/${id}`, payload).then((r) => r.data);

export const eliminarReporte = (id: number): Promise<{ message: string }> =>
  axios.delete(urlApi + urlGenerador + `reportes/${id}`).then((r) => r.data);

export const duplicarReporte = (id: number): Promise<SavedReport> =>
  axios.post(urlApi + urlGenerador + `reportes/${id}/duplicar`, {}).then((r) => r.data);

// ─── Export ──────────────────────────────────────────────────────────────────

export type ExportFormat = "excel" | "pdf";

export interface ExportOptions {
  format: ExportFormat;
  title: string;
  subtitle?: string | null;
  /** Embed the photographs. Ignored for PDF. */
  photos?: boolean;
}

export interface ExportedFile {
  blob: Blob;
  filename: string;
}

/** Last resort when Content-Disposition does not arrive. */
const FALLBACK_NAME: Record<ExportFormat, string> = {
  excel: "reporte.xlsx",
  pdf: "reporte.pdf",
};

/**
 * Reads the name the server chose, with this module's own fallback.
 *
 * The reading itself lives in `descarga.ts` now, because the three list exports
 * need exactly the same thing and a second copy of an RFC-5987 regex is a
 * second place for accents to stop surviving. What stayed here is the fallback:
 * "reporte.xlsx" is the right guess for this screen and the wrong one for a
 * directory of staff.
 */
export function filenameFromDisposition(header: unknown, format: ExportFormat): string {
  return nombreDeFichero(header, FALLBACK_NAME[format]);
}

/**
 * Builds the file on the server and downloads it.
 *
 * The configuration travels, not the rows: the browser used to download the
 * whole result set as JSON only to rebuild the file from it, and to fetch one
 * photograph per row over HTTP.
 */
export const exportarReporte = async (
  config: ReportConfig,
  options: ExportOptions,
  extras: { signal?: AbortSignal; onProgress?: (received: number, total?: number) => void } = {},
): Promise<ExportedFile> => {
  const response = await axios.post(
    urlApi + urlGenerador + "exportar",
    { config, ...options },
    {
      responseType: "blob",
      signal: extras.signal,
      onDownloadProgress: (event) => {
        extras.onProgress?.(event.loaded, event.total);
      },
    },
  );

  return {
    blob: response.data as Blob,
    filename: filenameFromDisposition(response.headers["content-disposition"], options.format),
  };
};

// Both moved to `descarga.ts` with the three list exports, which need them for
// the same reason this screen does: a failed download arrives as a Blob and its
// message has to be read out of it. Re-exported rather than relocated at the
// call sites, so that the twelve `mensajeDeError(...)` in the generator screen
// keep importing from the module they already import everything else from.
export { mensajeDeError, mensajeDeErrorAsync } from "./descarga";
