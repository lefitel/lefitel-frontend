// Pure logic for building a report configuration.
//
// Deliberately free of React: every rule here is exercised directly in tests,
// so the components only have to render what these functions decide.

import type {
  AggFn,
  CatalogField,
  CatalogRoot,
  ColumnSpec,
  FilterCondition,
  FilterGroup,
  Operator,
  ReportConfig,
  SortSpec,
} from "../api/generador.api";

/**
 * The server's caps, so the UI can warn before a request is refused.
 *
 * These are a *fallback*. The server publishes the same numbers in
 * `catalog.limits` precisely so they are not written twice, and they were
 * written twice anyway: whoever changes one of them there has no reason to
 * suspect a copy lives here, and then the local warning either never fires or
 * fires over a report the server would have accepted. Every helper below takes
 * the published limits and falls back to these, which is what the screen does —
 * these apply only before a catalog has arrived, and in tests.
 */
export const MAX_COLUMNS = 60;
export const MAX_CONDITIONS = 100;
export const MAX_SORTS = 10;
export const MAX_FILTER_VALUE = 200;
export const DEFAULT_LIMIT = 100;

/**
 * The page sizes the footer offers.
 *
 * The server accepts anything from 1 to `maxRows` (50.000) and defaults a
 * request that carries no `limit` at all to 500 — which is how the six
 * templates came to page in five-hundreds while a report built by hand paged in
 * hundreds. Every configuration this screen produces now names its own, and
 * these are the values worth naming: below 25 the pager is more work than the
 * table, and above 500 a page stops being a page.
 */
export const PAGE_SIZES = [25, 50, 100, 250, 500] as const;

/**
 * A configuration with a page size on it.
 *
 * Applied wherever a configuration arrives from somewhere else — a template, a
 * saved report — because "no limit" is not a neutral value: it is a silent 500
 * from the server, and the screen would page one report differently from
 * another with nothing on it to explain why.
 */
export const withPageSize = (config: ReportConfig): ReportConfig =>
  config.limit === undefined ? { ...config, limit: DEFAULT_LIMIT } : config;

/** The subset of the published limits this module needs. */
export interface Limits {
  maxColumns?: number;
  maxConditions?: number;
  maxSorts?: number;
  maxFilterValue?: number;
}

export const maxColumns = (limits?: Limits) => limits?.maxColumns ?? MAX_COLUMNS;
export const maxConditions = (limits?: Limits) => limits?.maxConditions ?? MAX_CONDITIONS;
export const maxSorts = (limits?: Limits) => limits?.maxSorts ?? MAX_SORTS;
export const maxFilterValue = (limits?: Limits) => limits?.maxFilterValue ?? MAX_FILTER_VALUE;

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

/**
 * A total that is counted at another entity's grain.
 *
 * `revisiones` on a report of events belongs to the row: each event has its
 * own. `poste.eventos` does not — it is the poste's number, read once per event
 * of that poste, so adding it up across a group squares it. The catalog spells
 * the difference as a prefix: an aggregate-only path with a relation in front
 * of it was reached through that relation.
 */
export const isForeignTotal = (root: CatalogRoot | undefined, path: string): boolean =>
  (root?.aggregateOnly ?? []).some(
    (a) => a.path.includes(".") && (a.path === path || path.startsWith(`${a.path}.`)),
  );

/**
 * How each summary is named, in the one place everything that names one reads.
 *
 * The server keeps the same five words in `constraints.ts` and builds the
 * result's headers out of them — `${field.label} (${AGG_LABEL[agg]})`, lower
 * case inside the parentheses. `columnHeader` below reproduces that, so the
 * table drawn while a report is running carries the headers the report will
 * come back with. Two spellings of "máximo" would read as a word rewriting
 * itself under the reader the moment the rows land.
 */
export const AGG_LABEL: Record<AggFn, string> = {
  count: "Conteo",
  sum: "Suma",
  avg: "Promedio",
  min: "Mínimo",
  max: "Máximo",
};

/** The catalog's own name for a path, with no rename and no summary applied. */
export const fieldLabel = (root: CatalogRoot | undefined, path: string): string => {
  const field = findField(root, path);
  if (field) return field.label;
  const relation = (root?.aggregateOnly ?? []).find((a) => a.path === path);
  return relation ? `Nº de ${relation.label.toLowerCase()}` : path;
};

/**
 * The header this column will have in the result.
 *
 * Mirrors what the server puts in `columns[].label`: the author's own name when
 * they typed one, otherwise the catalog's name with the summary after it. A
 * counted relation takes no suffix — it is already a total, and "Nº de
 * revisiones (conteo)" says the same thing twice.
 */
export const columnHeader = (root: CatalogRoot | undefined, column: ColumnSpec): string => {
  const renamed = column.label?.trim();
  if (renamed) return renamed;
  const base = fieldLabel(root, column.path);
  if (!column.agg) return base;
  const counted = (root?.aggregateOnly ?? []).some((a) => a.path === column.path);
  return counted ? base : `${base} (${AGG_LABEL[column.agg].toLowerCase()})`;
};

/**
 * What type the result's column will hold, which is not always the field's own.
 *
 * Only needed to align a cell: counting, adding and averaging give a number
 * whatever they were applied to, while the smallest and the largest of a date
 * are still dates. Getting it wrong is visible — the skeleton would lay its
 * bars against one edge and the rows arrive against the other.
 */
export const columnKind = (
  root: CatalogRoot | undefined,
  column: ColumnSpec,
): CatalogField["kind"] => {
  if (column.agg === "count" || column.agg === "sum" || column.agg === "avg") return "number";
  return findField(root, column.path)?.kind ?? "number";
};

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

/** True when the report already carries as many columns as it may. */
export const columnLimitReached = (config: ReportConfig, limits?: Limits): boolean =>
  config.columns.length >= maxColumns(limits);

/**
 * Every condition in the tree, not just the ones at the top.
 *
 * An `exists` carries its own `where`, and a nested group carries a list, so
 * counting the outer array reports a number the server does not recognise —
 * and the server counts the tree. Two caps that disagree mean the warning never
 * fires and the refusal arrives from the far side instead.
 */
export const countConditions = (node: unknown): number => {
  if (!node || typeof node !== "object") return 1;
  if (isFilterGroup(node)) {
    return node.conditions.reduce((total, child) => total + countConditions(child), 0);
  }
  if (isExists(node)) {
    const where = (node as { where?: FilterGroup }).where;
    return 1 + (where ? countConditions(where) : 0);
  }
  return 1;
};

/** True when the report already carries as many filters as it may. */
export const filterLimitReached = (config: ReportConfig, limits?: Limits): boolean =>
  (config.filters ? countConditions(config.filters) : 0) >= maxConditions(limits);

export function addColumn(
  config: ReportConfig,
  path: string,
  agg?: AggFn,
  limits?: Limits,
): ReportConfig {
  if (columnLimitReached(config, limits)) return config;
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
  // Sorting is per column, aggregate included, so removing "Fecha (máximo)"
  // must not take the sort belonging to "Fecha (mínimo)" with it.
  const stillSortable = columns.some((c) => c.path === removed.path && c.agg === removed.agg);
  return {
    ...config,
    columns,
    groupBy: stillUsed ? config.groupBy : (config.groupBy ?? []).filter((p) => p !== removed.path),
    sort: stillSortable
      ? config.sort
      : (config.sort ?? []).filter((s) => !(s.path === removed.path && s.agg === removed.agg)),
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

/**
 * A stable identity for every column, in the order they appear.
 *
 * Dragging has to name columns by something that is not their position, since
 * the position is the thing changing. Two columns can share a path — the
 * minimum and the maximum of the same date — and two can share the path and the
 * aggregate as well, kept apart only by their headers.
 *
 * The header is deliberately not part of it, and that is a bug worth naming.
 * The identity used to include it, and the list used the identity as its React
 * key, so every keystroke in a rename box produced a new key, React discarded
 * the row and built another, and the box lost focus after one character.
 * Renaming a column was impossible: only the first letter ever landed.
 *
 * What tells duplicates apart instead is which duplicate it is — a number that
 * changes only when the columns themselves are added, removed or reordered,
 * which is exactly when a fresh identity is wanted.
 */
export function columnKeys(config: ReportConfig): string[] {
  const seen = new Map<string, number>();
  return config.columns.map((column) => {
    const base = `${column.path}|${column.agg ?? ""}`;
    const nth = seen.get(base) ?? 0;
    seen.set(base, nth + 1);
    return `${base}|${nth}`;
  });
}

/**
 * Moves the column named `from` to where the column named `to` sits.
 *
 * Pulled out of the component and expressed in keys rather than indices so the
 * part that can be tested is: the gesture itself cannot be, because the drag
 * library measures real geometry and the test environment draws nothing. This
 * is where a reorder can actually go wrong — an unknown key, a duplicate, a
 * drop on itself — and none of that needs a mouse to check.
 */
export function moveColumnByKey(config: ReportConfig, from: string, to: string): ReportConfig {
  if (from === to) return config;
  const keys = columnKeys(config);
  const source = keys.indexOf(from);
  const target = keys.indexOf(to);
  if (source === -1 || target === -1) return config;
  return moveColumn(config, source, target);
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
  const target = config.columns[index];
  if (!target) return config;
  // `addColumn` refuses an exact duplicate, and changing an aggregate could
  // walk right into one: two rows of "Fecha" both set to "mínimo" render under
  // the same React key, which makes reconciliation undefined — an edit lands on
  // the wrong twin, or focus jumps out of the box being typed in.
  const collides = config.columns.some(
    (c, i) => i !== index && c.path === target.path && c.agg === agg,
  );
  if (collides) return config;

  const columns = config.columns.map((c, i) => {
    if (i !== index) return c;
    const { agg: _drop, ...rest } = c;
    return agg ? { ...rest, agg } : rest;
  });
  // The sort criterion belongs to the column, and the column just changed
  // identity; leaving the old one behind sorts by something no longer shown.
  const sort = (config.sort ?? []).map((s) =>
    // Rebuilt, not spread: spreading kept the previous `agg` alive when the new
    // one is undefined ("Sin resumen"), which is the exact case this rewrite
    // exists to handle — the arrow went dark while the criterion stayed, and
    // the next click added a second one.
    s.path === target.path && s.agg === target.agg
      ? { path: s.path, dir: s.dir, ...(agg ? { agg } : {}) }
      : s,
  );
  return { ...config, columns, sort };
}

// ─── Grouping ────────────────────────────────────────────────────────────────

/**
 * Groups (or ungroups) by the column at `index`.
 *
 * Takes an index rather than a path because a path can appear more than once —
 * the minimum and the maximum of the same date, say. The server rejects a
 * column that is both grouped and aggregated, so grouping strips the aggregate
 * from every column sharing that path; when that leaves two identical columns,
 * they collapse into one instead of sitting there indistinguishable.
 */
export function toggleGroupBy(config: ReportConfig, index: number): ReportConfig {
  const column = config.columns[index];
  if (!column) return config;
  const path = column.path;

  const current = config.groupBy ?? [];
  const grouped = current.includes(path);
  const groupBy = grouped ? current.filter((p) => p !== path) : [...current, path];

  if (grouped) return { ...config, groupBy };

  const stripped = config.columns.map((c) =>
    c.path === path && c.agg ? { path: c.path, ...(c.label ? { label: c.label } : {}) } : c,
  );

  // Two columns are the same thing when their path and their summary match;
  // a renamed header still makes them two, and collapsing those would delete a
  // column the person put there on purpose. What the header must not do is
  // collide as a React key — see the key ColumnList builds, which includes it.
  const seen = new Set<string>();
  const columns = stripped.filter((c) => {
    const key = `${c.path}|${c.agg ?? ""}|${c.label ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Grouping strips the aggregates, so every criterion that named one of those
  // columns now names something that is not there. `removeColumn` and
  // `setColumnAgg` keep the sort in step and this did not: the arrow went dark
  // while the criterion survived in the configuration, a second click appended
  // a duplicate, and the server received an aggregated sort over a grouped
  // column — the 400 that carrying the aggregate was meant to end.
  const sort = (config.sort ?? []).filter((s) =>
    columns.some((c) => c.path === s.path && c.agg === s.agg),
  );

  return { ...config, groupBy, columns, sort };
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

/**
 * Sorts by a column, identified the way a column is identified.
 *
 * By path alone, the minimum and the maximum of the same date were the same
 * criterion: clicking sort on one lit the arrow on both, and only one of them
 * could ever be sorted. `toggleGroupBy` already takes this care — the comment
 * above it says a path can appear more than once — and sorting did not.
 *
 * The aggregate travels too. Without it the server refuses every sort in a
 * grouped report, because a column that is not grouped has to say how it is
 * summarised: the parameter existed here from the start and no caller ever
 * passed it, so the button produced a 400 every single time.
 */
export function toggleSort(
  config: ReportConfig,
  path: string,
  agg?: AggFn,
  limits?: Limits,
): ReportConfig {
  const current = config.sort ?? [];
  const same = (s: SortSpec) => s.path === path && s.agg === agg;
  const existing = current.find(same);
  if (!existing) {
    if (current.length >= maxSorts(limits)) return config;
    return { ...config, sort: [...current, { path, dir: "asc", ...(agg ? { agg } : {}) }] };
  }
  // asc → desc → off, which is what a header click cycle is expected to do.
  if (existing.dir === "asc") {
    return {
      ...config,
      sort: current.map((s) => (same(s) ? { ...s, dir: "desc" as const } : s)),
    };
  }
  return { ...config, sort: current.filter((s) => !same(s)) };
}

/** True when the report already carries as many sort criteria as it may. */
export const sortLimitReached = (config: ReportConfig, limits?: Limits): boolean =>
  (config.sort ?? []).length >= maxSorts(limits);

// ─── Filters ─────────────────────────────────────────────────────────────────

export const isFilterGroup = (node: unknown): node is FilterGroup =>
  typeof node === "object" && node !== null && Array.isArray((node as FilterGroup).conditions);

export const isExists = (node: unknown): boolean =>
  typeof node === "object" && node !== null && typeof (node as { exists?: string }).exists === "string";

export function addFilter(
  config: ReportConfig,
  field: CatalogField,
  limits?: Limits,
): ReportConfig {
  const filters = config.filters ?? { op: "and", conditions: [] };
  if (filterLimitReached(config, limits)) return config;
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

/**
 * Empties the filter list.
 *
 * The cap is a hundred conditions and the only way out was one ✕ at a time, so
 * clearing a report narrowed by a dozen of them was a dozen clicks. It rebuilds
 * the group rather than deleting the key: an absent `filters` and an empty one
 * are the same report, and every other function here reads the empty shape.
 */
export function clearFilters(config: ReportConfig): ReportConfig {
  return { ...config, filters: { op: config.filters?.op ?? "and", conditions: [] } };
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

type FilterNode = FilterCondition | FilterGroup | { exists: string; where?: FilterGroup };

/**
 * Whether a whole filter node survives, all of it or none of it.
 *
 * A plain condition stands on its own path. An advanced one — an `exists`, or a
 * nested group — is a sentence, and removing one clause of a sentence does not
 * narrow it, it changes what it says: an "eventos con alguna revisión en mayo"
 * stripped of its date range becomes "eventos con alguna revisión", which
 * returns rows the person filtered out on purpose. So those are kept whole or
 * dropped whole, and the drop is counted and announced.
 */
function nodeSurvives(node: FilterNode, keeps: (path: string) => boolean): boolean {
  // Anything malformed is dropped rather than inspected. A saved configuration
  // is JSON from a database and can be any shape at all; reading `.path` off a
  // null threw inside the click handler, so the report neither opened nor said
  // why — the row in the list just looked dead.
  if (!node || typeof node !== "object") return false;
  if (isFilterGroup(node)) {
    return node.conditions.every((c) => nodeSurvives(c as FilterNode, keeps));
  }
  if (isExists(node)) {
    const exists = node as { exists: string; where?: unknown };
    if (!keeps(exists.exists)) return false;
    if (exists.where === undefined) return true;
    return isFilterGroup(exists.where) && nodeSurvives(exists.where as FilterNode, keeps);
  }
  const { path } = node as FilterCondition;
  return typeof path === "string" && keeps(path);
}

/**
 * Drops whatever this catalog does not offer, and keeps everything else.
 *
 * Used on every saved report as it opens, because a configuration can name a
 * field that was removed, or one this role cannot see. It used to run through
 * `changeRoot` even when the detail level had not changed at all — and
 * `changeRoot` deleted every advanced filter unconditionally, whether or not
 * its paths were available. Opening a report silently widened it, the warning
 * blamed the reader's profile, and pressing "Actualizar" wrote the loss back to
 * the database for its author and for everyone it was shared with.
 */
export function pruneToCatalog(config: ReportConfig, root: CatalogRoot): ReportConfig {
  const valid = new Set(root.fields.map((f) => f.path));
  const aggregable = new Set(root.aggregateOnly.map((a) => a.path));
  const keeps = (path: string) =>
    valid.has(path) ||
    aggregable.has(path) ||
    root.aggregateOnly.some((a) => path.startsWith(`${a.path}.`));

  const filters = config.filters ?? { op: "and", conditions: [] };
  const columns = config.columns.filter((c) => keeps(c.path));
  return {
    ...config,
    columns,
    groupBy: (config.groupBy ?? []).filter(keeps),
    // A sort belongs to a column, so it goes when its column does.
    sort: (config.sort ?? []).filter(
      (s) => keeps(s.path) && columns.some((c) => c.path === s.path && c.agg === s.agg),
    ),
    filters: {
      ...filters,
      conditions: filters.conditions.filter((c) => nodeSurvives(c as FilterNode, keeps)),
    },
  };
}

/**
 * Switching the detail level changes which paths exist, so anything the new
 * root does not offer is dropped rather than sent and rejected.
 */
export function changeRoot(config: ReportConfig, root: CatalogRoot): ReportConfig {
  return { ...pruneToCatalog({ ...config, root: root.key }, root), offset: 0 };
}

/**
 * How many pieces a configuration is made of, for saying what an open lost.
 *
 * The order and the grouping count. They were left out, so a report whose sort
 * could not be kept opened with "cargado" and no warning at all, and came back
 * in a different order than its author saved — the quiet half of the same
 * defect the warning exists for.
 */
export const elementCount = (config: ReportConfig): number =>
  config.columns.length +
  (config.filters ? config.filters.conditions.length : 0) +
  (config.sort?.length ?? 0) +
  (config.groupBy?.length ?? 0);

/**
 * Whether two configurations would produce the same rows, ignoring which page
 * is being asked for. Used to tell when the table on screen no longer matches
 * the configuration above it.
 */
export function sameQuery(a: ReportConfig, b: ReportConfig): boolean {
  const strip = ({ offset: _offset, ...rest }: ReportConfig) => rest;
  return canonical(strip(a)) === canonical(strip(b));
}

/**
 * A stable string for a configuration, whatever order its keys were built in.
 *
 * `JSON.stringify` writes keys in insertion order, and the builders do not
 * agree on one: `addColumn` puts `agg` before `label`, `setColumnAgg` rebuilds
 * it after. So setting an aggregate to "promedio" and back to "suma" produced a
 * different string for an identical report, and the screen announced "cambió la
 * configuración" over a table that matched it perfectly. A banner that cries
 * wolf is a banner nobody reads — and this one is what warns that the rows no
 * longer match the header.
 */
/**
 * Whether two configurations would produce a table of the same *shape*.
 *
 * Not the same rows — the same columns, in the same order, at the same grain.
 * It answers one question: can the table already on screen still show what is
 * being built? Adding a column makes the answer no, and no amount of real data
 * in the old table helps somebody who is trying to see the new one.
 *
 * The root is part of the shape because it decides what a row *is*: the same
 * two column paths mean different tables under "evento" and under "revision".
 *
 * Filters are not, and neither is sorting. A filter changes which rows come
 * back and a sort changes their order, both leaving every column exactly where
 * it was — so the rows on screen are still a fair picture of the shape, and
 * throwing them away over a keystroke in a filter box would cost the reader the
 * row they were reading.
 */
export function sameShape(a: ReportConfig, b: ReportConfig): boolean {
  return canonical({ root: a.root, columns: a.columns, groupBy: a.groupBy ?? [] })
    === canonical({ root: b.root, columns: b.columns, groupBy: b.groupBy ?? [] });
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Local pre-flight check. The server validates again and is the authority; this
 * exists so the user sees the problem while building instead of after asking
 * for the report.
 */
export function validateConfig(
  config: ReportConfig,
  root: CatalogRoot | undefined,
  limits?: Limits,
): string[] {
  const problems: string[] = [];

  if (!root) {
    problems.push("Elija un nivel de detalle para el reporte.");
    return problems;
  }
  if (config.columns.length === 0) {
    problems.push("El reporte necesita al menos una columna.");
  }
  if (config.columns.length > maxColumns(limits)) {
    problems.push(`El reporte tiene demasiadas columnas (máximo ${maxColumns(limits)}).`);
  }

  // A saved configuration can reference a field that no longer exists, or that
  // this role cannot see. Saying so beats letting the server answer with an
  // internal path name.
  const known = new Set([
    ...root.fields.map((f) => f.path),
    ...root.aggregateOnly.map((a) => a.path),
  ]);
  for (const column of config.columns) {
    const reachable = known.has(column.path) ||
      root.aggregateOnly.some((a) => column.path.startsWith(`${a.path}.`));
    if (!reachable) {
      // The user's own name for it when they gave one: the catalog has nothing
      // to offer here — that is precisely why this problem fired — and quoting
      // a dotted internal path is what the comment above says this message
      // exists to avoid. And not "para su perfil": a field can equally have
      // been retired from the catalog, and naming the wrong cause sends
      // somebody to ask for a permission that would not help.
      problems.push(
        `La columna «${column.label ?? column.path}» ya no está disponible.`,
      );
    }
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
      } else if (isForeignTotal(root, column.path)) {
        problems.push(
          `"${label}" ya es un total de otra entidad: resumirlo en un reporte agrupado ` +
            `lo contaría una vez por fila. Quítelo, o quite la agrupación.`,
        );
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

  // The order was never checked here at all, so the sort button built a
  // configuration the server refuses on every single grouped report and the
  // user found out only after pressing Generar — with a message telling them to
  // summarise a column they had already summarised.
  for (const sort of config.sort ?? []) {
    // The same reachability rule the columns get, prefix included: `revisiones.date`
    // is a legal column, and checking membership alone made it an illegal sort —
    // so a report that opened cleanly could not be run, with a message blaming
    // the reader's profile for a field sitting in their own column list.
    const reachable =
      known.has(sort.path) ||
      root.aggregateOnly.some((a) => sort.path.startsWith(`${a.path}.`));
    if (!reachable) {
      problems.push(
        `El orden usa «${config.columns.find((c) => c.path === sort.path)?.label ?? sort.path}»,` +
        ` que ya no está disponible.`,
      );
      continue;
    }
    const label = findField(root, sort.path)?.label ?? sort.path;
    if (grouped.size > 0 && !grouped.has(sort.path) && !sort.agg) {
      problems.push(`Agrupó el reporte, así que no puede ordenar por "${label}" sin un resumen.`);
    }
    // A total that belongs to another entity counts once per row of this one,
    // so summing it across a group squares it. The server refuses it; saying so
    // here saves the round trip and explains it next to the control.
    if (grouped.size > 0 && isForeignTotal(root, sort.path)) {
      problems.push(
        `No se puede ordenar por "${label}": ya es un total de otra entidad y ` +
          `resumirlo aquí lo contaría una vez por fila.`,
      );
    }
  }

  for (const node of config.filters?.conditions ?? []) {
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
    if (empty) {
      // No ordinal: the filter rows carry no number on screen, so "El filtro 2"
      // pointed at nothing. Matches the server's own wording for the same rule.
      problems.push(`El filtro sobre «${label}» no tiene valor.`);
      continue;
    }

    // Numeric fields hold their text while being edited, so a half-typed "-"
    // or "1.2.3" has to be caught here rather than by the database.
    if (field?.kind === "number") {
      const candidates = Array.isArray(value) ? value : [value];
      const bad = candidates.some((v) => v !== null && v !== undefined && !Number.isFinite(Number(v)));
      if (bad) problems.push(`El filtro sobre «${label}» no es un número válido.`);
    }

    // The server refuses a value over its published cap and the box had no
    // limit at all, so this was the one rule the user met only *after* pressing
    // Generar, quoting a number the screen had never mentioned. Every other cap
    // is honoured before the request leaves.
    const tooLong = (Array.isArray(value) ? value : [value]).some(
      (v) => typeof v === "string" && v.length > maxFilterValue(limits),
    );
    if (tooLong) {
      problems.push(
        `El valor del filtro sobre «${label}» es demasiado largo ` +
        `(máximo ${maxFilterValue(limits)} caracteres).`,
      );
    }
  }

  return problems;
}

// ─── Display ─────────────────────────────────────────────────────────────────

/**
 * Bolivia has a single time zone and no daylight saving, so pinning it keeps
 * the screen, the PDF and the Excel telling the same date. Formatting in the
 * browser's zone showed the previous day for anything stored near midnight.
 */
export const REPORT_TIME_ZONE = "America/La_Paz";

const dateFormatter = new Intl.DateTimeFormat("es-BO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: REPORT_TIME_ZONE,
});

const numberFormatter = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 });

/** Renders a cell for display. Nulls read as an em-dash rather than "null". */
export function formatValue(value: unknown, kind: CatalogField["kind"]): string {
  if (value === null || value === undefined || value === "") return "—";

  switch (kind) {
    case "boolean":
      // Postgres drivers can hand booleans back as 1/0 or "t"/"f" depending on
      // the column and the aggregate applied to it.
      if (value === true || value === "true" || value === "t" || value === 1) return "Sí";
      return "No";
    case "date": {
      const date = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date);
    }
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      // Whole numbers keep their exact form (ids must stay readable as ids);
      // averages are rounded and grouped for the locale.
      return Number.isInteger(n) ? String(n) : numberFormatter.format(n);
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
  // Counted through the tree, like the cap is: a nested group or an existence
  // filter carries its own conditions, and describing five clauses as "1 filtro"
  // disagrees with the number the user is told they may not exceed.
  const filterCount = config.filters ? countConditions(config.filters) : 0;
  if (filterCount > 0) parts.push(`${filterCount} filtro${filterCount === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
