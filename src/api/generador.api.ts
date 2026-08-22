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
}

export interface Catalog {
  roots: CatalogRoot[];
  limits: CatalogLimits;
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
  columns: { key: string; label: string; kind: FieldKind; semantic?: FieldSemantic }[];
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

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export const getCatalogo = (token: string): Promise<Catalog> =>
  axios.get(urlApi + urlGenerador + "catalogo", auth(token)).then((r) => r.data);

export const runReporte = (config: ReportConfig, token: string): Promise<ReportResult> =>
  axios.post(urlApi + urlGenerador + "consulta", config, auth(token)).then((r) => r.data);

export const getReportesGuardados = (
  token: string,
  page: { limit?: number; offset?: number } = {},
): Promise<SavedReportPage> =>
  axios
    .get(urlApi + urlGenerador + "reportes", {
      ...auth(token),
      params: { limit: page.limit, offset: page.offset },
    })
    .then((r) => r.data);

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
 * Reads the name the server chose.
 *
 * It sends both forms: filename* percent-encoded so accents survive, and a
 * plain filename for anything that ignores RFC 5987. The header only reaches us
 * because app.ts lists it in the CORS exposedHeaders; without that the browser
 * hides it and every download would be called "reporte".
 */
export function filenameFromDisposition(header: unknown, format: ExportFormat): string {
  if (typeof header !== "string") return FALLBACK_NAME[format];
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // A malformed header must not cost the user their download.
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : FALLBACK_NAME[format];
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
  token: string,
  extras: { signal?: AbortSignal; onProgress?: (received: number, total?: number) => void } = {},
): Promise<ExportedFile> => {
  const response = await axios.post(
    urlApi + urlGenerador + "exportar",
    { config, ...options },
    {
      ...auth(token),
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

/**
 * Extracts the server's message, which is written for the user, not the developer.
 *
 * A failed download arrives as a Blob, because that is what the request asked
 * for: the JSON body is inside it and has to be read out, which is asynchronous.
 * Callers that can be a download use `mensajeDeErrorAsync`.
 */
export const mensajeDeError = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  return fallback;
};

export const mensajeDeErrorAsync = async (error: unknown, fallback: string): Promise<string> => {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text();
      const parsed = JSON.parse(text) as { message?: string };
      if (typeof parsed.message === "string" && parsed.message.trim() !== "") return parsed.message;
    } catch {
      // Not JSON, or an empty body. Fall through to the generic message.
    }
    return fallback;
  }
  return mensajeDeError(error, fallback);
};
