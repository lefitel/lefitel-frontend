import axios from "axios";
import { nombreDeFichero } from "./descarga";
import { urlApi } from "./url";

const urlGenerador = "generator/";

// ─── Catalog ─────────────────────────────────────────────────────────────────

export type FieldKind = "string" | "number" | "boolean" | "date" | "image";

export type Operator =
  | "eq" | "neq"
  | "gt" | "gte" | "lt" | "lte"
  | "between"
  | "in"
  | "like"
  | "isnull" | "notnull"
  // Dates only: "falls inside this named period". The value is a `Period`.
  | "period";

/**
 * A stretch of time named relative to the day the report runs — "la semana
 * pasada", "este mes". The server turns it into two instants each time, which
 * is what lets a saved report stay current. Mirrors the server's own type; the
 * list actually offered, with its labels, arrives in `Catalog.periods`.
 */
export type Period =
  | "hoy"
  | "ayer"
  | "ultimos_7_dias"
  | "ultimos_30_dias"
  | "esta_semana"
  | "semana_pasada"
  | "este_mes"
  | "mes_pasado";

/** One named period, with the words to show for it. */
export interface CatalogPeriod {
  key: Period;
  label: string;
}

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
  /** Where the field comes from, e.g. "Evento › Poste › Tramo". */
  group: string;
  operators: Operator[];
  aggregates: AggFn[];
  calculated?: boolean;
  semantic?: FieldSemantic;
  /** Already a summary of its own row (a count); grouping by it is rejected. */
  aggregate?: boolean;
  /**
   * Names the list of values this field can hold, when it has a closed one —
   * the owners, the materials, the cities. Look it up in `Catalog.optionLists`.
   *
   * **A key with no list there is normal and means a text box**: the list may
   * have outgrown the server's cap, or the server may be an older one that does
   * not send them at all.
   */
  optionList?: string;
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
  /**
   * The values each closed-list field can hold, keyed by what a field's
   * `optionList` names. One entry per list and not per path, because the same
   * list is reached by many: an owner hangs off a pole, off an event's pole and
   * off a revision's event's pole.
   *
   * Optional for the same reason as the templates, and missing entries are
   * normal even when it arrives — see `CatalogField.optionList`.
   */
  optionLists?: Record<string, string[]>;
  /**
   * The periods the «está en el periodo» operator accepts, in the order to
   * list them. Optional for the same reason as the two above; a server that
   * does not send them does not offer the operator either.
   */
  periods?: CatalogPeriod[];
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
  /**
   * What the configuration's paths are, for the ones the catalog does not list.
   *
   * The picker offers less than the server runs, and a report can name a valid
   * path that is not in `Catalog.roots`. Without this it would open as a column
   * with no name and be pruned as unknown. Absent from an older server, and
   * from the answer to a save.
   */
  extraFields?: CatalogField[];
  /** The same, for to-many relations the report counts or filters on. */
  extraRelations?: CatalogRoot["aggregateOnly"];
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
  axios.get(urlApi + urlGenerador + "catalog").then((r) => r.data);

/**
 * The rows themselves. Takes a signal for the same reason the count does: this
 * is the expensive one, and a query nobody is waiting for any more should stop
 * being worked on rather than merely stop being read.
 */
export const runReporte = (
  config: ReportConfig,
  signal?: AbortSignal,
): Promise<ReportResult> =>
  axios.post(urlApi + urlGenerador + "query", config, { signal }).then((r) => r.data);

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
    .post(urlApi + urlGenerador + "count", config, { signal })
    .then((r) => r.data);

export const getReportesGuardados = (
  page: { limit?: number; offset?: number } = {},
): Promise<SavedReportPage> =>
  axios
    .get(urlApi + urlGenerador + "reportes", {
      params: { limit: page.limit, offset: page.offset },
    })
    .then((r) => r.data);

/**
 * One saved report, by id — what a link from the Bitácora asks for.
 *
 * The list above is paginated, so the report a link names may not be on the
 * page that is loaded. The server answers 404 when it is gone and 403 when it
 * is private to somebody else, and records that refusal.
 */
export const getReporteGuardado = (id: number): Promise<SavedReport> =>
  axios.get(urlApi + urlGenerador + `reportes/${id}`).then((r) => r.data);

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
  axios.post(urlApi + urlGenerador + `reportes/${id}/duplicate`, {}).then((r) => r.data);

// ─── Export ──────────────────────────────────────────────────────────────────

export type ExportFormat = "excel" | "pdf";

export interface ExportOptions {
  format: ExportFormat;
  title: string;
  subtitle?: string | null;
  /** Embed the photographs. Ignored for PDF. */
  photos?: boolean;
  /**
   * How much of the report goes in the file.
   *
   * Omitted means the whole of it, which is what this endpoint has always done:
   * it reads from the first row whichever page is on screen. "page" honours the
   * configuration's own `limit` and `offset` instead.
   */
  scope?: "all" | "page";
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
    urlApi + urlGenerador + "export",
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
