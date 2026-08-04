// Pure logic for building a report configuration.
//
// Deliberately free of React: every rule here is exercised directly in tests,
// so the components only have to render what these functions decide.

import type {
  AggFn,
  CatalogField,
  CatalogRoot,
  FilterCondition,
  FilterGroup,
  Operator,
  ReportConfig,
} from "../api/generador.api";

/** Mirrors the server-side caps so the UI can warn before a request is rejected. */
export const MAX_COLUMNS = 60;
export const MAX_CONDITIONS = 100;
export const MAX_SORTS = 10;
export const DEFAULT_LIMIT = 100;

export const emptyConfig = (root: string): ReportConfig => ({
  root,
  columns: [],
  filters: { op: "and", conditions: [] },
  groupBy: [],
  sort: [],
  limit: DEFAULT_LIMIT,
  offset: 0,
});

/** A report is a summary when it groups; then every column must be grouped or aggregated. */
export const isSummary = (config: ReportConfig): boolean => (config.groupBy?.length ?? 0) > 0;

export const findField = (root: CatalogRoot | undefined, path: string): CatalogField | undefined =>
  root?.fields.find((f) => f.path === path);

/** Sensible starting operator for each type, so a new filter is usable immediately. */
export const defaultOperator = (kind: CatalogField["kind"]): Operator => {
  switch (kind) {
    case "string": return "like";
    case "date": return "between";
    case "boolean": return "eq";
    case "image": return "notnull";
    default: return "eq";
  }
};

export const operatorNeedsValue = (operator: Operator): boolean =>
  operator !== "isnull" && operator !== "notnull";

export const operatorNeedsTwoValues = (operator: Operator): boolean => operator === "between";

// ─── Columns ─────────────────────────────────────────────────────────────────

export function addColumn(config: ReportConfig, path: string, agg?: AggFn): ReportConfig {
  if (config.columns.length >= MAX_COLUMNS) return config;
  // The same field can legitimately appear twice with different aggregates
  // (min and max of the same value), but not twice identically.
  const duplicate = config.columns.some((c) => c.path === path && c.agg === agg);
  if (duplicate) return config;
  return { ...config, columns: [...config.columns, { path, ...(agg ? { agg } : {}) }] };
}

export function removeColumn(config: ReportConfig, index: number): ReportConfig {
  const columns = config.columns.filter((_, i) => i !== index);
  const removed = config.columns[index];
  if (!removed) return config;
  // Dropping a column that was also grouped or sorted would leave dangling
  // references the server rejects, so clean them up together.
  const stillUsed = columns.some((c) => c.path === removed.path);
  return {
    ...config,
    columns,
    groupBy: stillUsed ? config.groupBy : (config.groupBy ?? []).filter((p) => p !== removed.path),
    sort: stillUsed ? config.sort : (config.sort ?? []).filter((s) => s.path !== removed.path),
  };
}

export function moveColumn(config: ReportConfig, from: number, to: number): ReportConfig {
  if (from === to) return config;
  if (from < 0 || to < 0 || from >= config.columns.length || to >= config.columns.length) {
    return config;
  }
  const columns = [...config.columns];
  const [moved] = columns.splice(from, 1);
  columns.splice(to, 0, moved);
  return { ...config, columns };
}

export function renameColumn(config: ReportConfig, index: number, label: string): ReportConfig {
  const columns = config.columns.map((c, i) => {
    if (i !== index) return c;
    const trimmed = label.trim();
    // An empty override means "use the catalog label" rather than an empty header.
    const { label: _drop, ...rest } = c;
    return trimmed === "" ? rest : { ...rest, label: trimmed };
  });
  return { ...config, columns };
}

export function setColumnAgg(config: ReportConfig, index: number, agg?: AggFn): ReportConfig {
  const columns = config.columns.map((c, i) => {
    if (i !== index) return c;
    const { agg: _drop, ...rest } = c;
    return agg ? { ...rest, agg } : rest;
  });
  return { ...config, columns };
}

// ─── Grouping ────────────────────────────────────────────────────────────────

export function toggleGroupBy(config: ReportConfig, path: string): ReportConfig {
  const current = config.groupBy ?? [];
  const grouped = current.includes(path);
  const groupBy = grouped ? current.filter((p) => p !== path) : [...current, path];

  // A grouped column cannot also carry an aggregate; strip it so the config
  // stays valid while the user toggles.
  const columns = config.columns.map((c) =>
    !grouped && c.path === path && c.agg ? { path: c.path, ...(c.label ? { label: c.label } : {}) } : c,
  );

  return { ...config, groupBy, columns };
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

export function toggleSort(config: ReportConfig, path: string, agg?: AggFn): ReportConfig {
  const current = config.sort ?? [];
  const existing = current.find((s) => s.path === path);
  if (!existing) {
    if (current.length >= MAX_SORTS) return config;
    return { ...config, sort: [...current, { path, dir: "asc", ...(agg ? { agg } : {}) }] };
  }
  // asc → desc → off, which is what a header click cycle is expected to do.
  if (existing.dir === "asc") {
    return {
      ...config,
      sort: current.map((s) => (s.path === path ? { ...s, dir: "desc" as const } : s)),
    };
  }
  return { ...config, sort: current.filter((s) => s.path !== path) };
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export const isFilterGroup = (node: unknown): node is FilterGroup =>
  typeof node === "object" && node !== null && Array.isArray((node as FilterGroup).conditions);

export const isExists = (node: unknown): boolean =>
  typeof node === "object" && node !== null && typeof (node as { exists?: string }).exists === "string";

export function addFilter(config: ReportConfig, field: CatalogField): ReportConfig {
  const filters = config.filters ?? { op: "and", conditions: [] };
  if (filters.conditions.length >= MAX_CONDITIONS) return config;
  const condition: FilterCondition = {
    path: field.path,
    operator: defaultOperator(field.kind),
  };
  return { ...config, filters: { ...filters, conditions: [...filters.conditions, condition] } };
}

export function updateFilter(
  config: ReportConfig,
  index: number,
  patch: Partial<FilterCondition>,
): ReportConfig {
  const filters = config.filters ?? { op: "and", conditions: [] };
  const conditions = filters.conditions.map((c, i) => {
    if (i !== index || isFilterGroup(c) || isExists(c)) return c;
    const next = { ...(c as FilterCondition), ...patch };
    // Changing the operator invalidates a value shaped for the previous one.
    if (patch.operator && patch.operator !== (c as FilterCondition).operator) {
      delete next.value;
    }
    return next;
  });
  return { ...config, filters: { ...filters, conditions } };
}

export function removeFilter(config: ReportConfig, index: number): ReportConfig {
  const filters = config.filters ?? { op: "and", conditions: [] };
  return {
    ...config,
    filters: { ...filters, conditions: filters.conditions.filter((_, i) => i !== index) },
  };
}

export function setFilterJoin(config: ReportConfig, op: "and" | "or"): ReportConfig {
  const filters = config.filters ?? { op: "and", conditions: [] };
  return { ...config, filters: { ...filters, op } };
}

// ─── Root ────────────────────────────────────────────────────────────────────

/**
 * Switching the detail level changes which paths exist, so anything the new
 * root does not offer is dropped rather than sent and rejected.
 */
export function changeRoot(config: ReportConfig, root: CatalogRoot): ReportConfig {
  const valid = new Set(root.fields.map((f) => f.path));
  const aggregable = new Set(root.aggregateOnly.map((a) => a.path));
  const keeps = (path: string) => valid.has(path) || aggregable.has(path);

  const filters = config.filters ?? { op: "and", conditions: [] };
  return {
    ...config,
    root: root.key,
    columns: config.columns.filter((c) => keeps(c.path)),
    groupBy: (config.groupBy ?? []).filter(keeps),
    sort: (config.sort ?? []).filter((s) => keeps(s.path)),
    filters: {
      ...filters,
      conditions: filters.conditions.filter((c) =>
        isFilterGroup(c) || isExists(c) ? false : keeps((c as FilterCondition).path),
      ),
    },
    offset: 0,
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Local pre-flight check. The server validates again and is the authority; this
 * exists so the user sees the problem while building instead of after asking
 * for the report.
 */
export function validateConfig(config: ReportConfig, root: CatalogRoot | undefined): string[] {
  const problems: string[] = [];

  if (!root) {
    problems.push("Elija un nivel de detalle para el reporte.");
    return problems;
  }
  if (config.columns.length === 0) {
    problems.push("El reporte necesita al menos una columna.");
  }
  if (config.columns.length > MAX_COLUMNS) {
    problems.push(`El reporte tiene demasiadas columnas (máximo ${MAX_COLUMNS}).`);
  }

  const grouped = new Set(config.groupBy ?? []);
  if (grouped.size > 0) {
    for (const column of config.columns) {
      const field = findField(root, column.path);
      const label = column.label ?? field?.label ?? column.path;
      if (grouped.has(column.path)) {
        if (column.agg) {
          problems.push(`"${label}" está agrupada, así que no puede llevar además un resumen.`);
        }
        continue;
      }
      if (!column.agg) {
        problems.push(`Agrupó el reporte, así que "${label}" necesita un resumen o hay que quitarla.`);
      }
    }
  } else {
    for (const column of config.columns) {
      const isAggregateOnly = root.aggregateOnly.some((a) => column.path.startsWith(a.path));
      if (column.agg && !isAggregateOnly) {
        const field = findField(root, column.path);
        problems.push(
          `"${column.label ?? field?.label ?? column.path}" usa un resumen, pero el reporte no está agrupado.`,
        );
      }
    }
  }

  for (const [index, node] of (config.filters?.conditions ?? []).entries()) {
    if (isFilterGroup(node) || isExists(node)) continue;
    const condition = node as FilterCondition;
    const field = findField(root, condition.path);
    const label = field?.label ?? condition.path;
    if (!operatorNeedsValue(condition.operator)) continue;
    const value = condition.value;
    const empty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && (value.length === 0 || value.some((v) => v === "" || v == null)));
    if (empty) problems.push(`El filtro ${index + 1} sobre "${label}" no tiene valor.`);
  }

  return problems;
}

// ─── Display ─────────────────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat("es-BO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Renders a cell for display. Nulls read as an em-dash rather than "null". */
export function formatValue(value: unknown, kind: CatalogField["kind"]): string {
  if (value === null || value === undefined || value === "") return "—";

  switch (kind) {
    case "boolean":
      return value === true || value === "true" ? "Sí" : "No";
    case "date": {
      const date = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date);
    }
    case "number": {
      const n = Number(value);
      if (Number.isNaN(n)) return String(value);
      // Averages come back fractional; whole numbers should not grow decimals.
      return Number.isInteger(n) ? String(n) : n.toFixed(2);
    }
    default:
      return String(value);
  }
}

/** One-line summary of what the report will return, for the header. */
export function describeConfig(config: ReportConfig, root: CatalogRoot | undefined): string {
  if (!root) return "Sin configurar";
  const parts = [root.rowMeaning.toLowerCase()];
  if (isSummary(config)) {
    const names = (config.groupBy ?? [])
      .map((p) => findField(root, p)?.label ?? p)
      .join(", ");
    parts[0] = `agrupado por ${names}`;
  }
  parts.push(`${config.columns.length} columna${config.columns.length === 1 ? "" : "s"}`);
  const filterCount = config.filters?.conditions.length ?? 0;
  if (filterCount > 0) parts.push(`${filterCount} filtro${filterCount === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
