import { describe, it, expect } from "vitest";
import type { CatalogField, CatalogRoot, FilterCondition, ReportConfig } from "../api/generador.api";
import {
  MAX_COLUMNS,
  MAX_SORTS,
  addColumn,
  columnHeader,
  columnKey,
  columnKind,
  columnLimitReached,
  filterLimitReached,
  maxColumns,
  addFilter,
  changeRoot,
  defaultOperator,
  describeConfig,
  emptyConfig,
  findField,
  formatValue,
  isSummary,
  moveColumn,
  moveColumnByKey,
  removeColumn,
  removeFilter,
  renameColumn,
  sameQuery,
  sameShape,
  setColumnAgg,
  pruneToCatalog,
  sortLimitReached,
  toggleGroupBy,
  toggleSort,
  updateFilter,
  validateConfig,
} from "./reportConfig";

const evento: CatalogRoot = {
  key: "evento",
  label: "Evento",
  rowMeaning: "Una fila por evento",
  fields: [
    { path: "description", label: "Descripción", kind: "string", group: "Evento", operators: ["eq", "like", "isnull", "notnull"], aggregates: ["count"] },
    { path: "date", label: "Fecha del evento", kind: "date", group: "Evento", operators: ["between", "gte", "lte", "isnull", "notnull"], aggregates: ["count", "min", "max"] },
    { path: "state", label: "Resuelto", kind: "boolean", group: "Evento", operators: ["eq", "isnull", "notnull"], aggregates: ["count"] },
    { path: "poste.name", label: "Nº de poste", kind: "string", group: "Evento › Poste", operators: ["eq", "like"], aggregates: ["count"] },
    { path: "poste.tramo", label: "Tramo", kind: "string", group: "Evento › Poste", operators: ["eq", "like"], aggregates: ["count"], calculated: true },
    { path: "image", label: "Foto", kind: "image", group: "Evento", operators: ["isnull", "notnull"], aggregates: ["count"] },
  ],
  aggregateOnly: [{ path: "revisiones", label: "Revisiones", group: "Evento" }],
};

const poste: CatalogRoot = {
  key: "poste",
  label: "Poste",
  rowMeaning: "Una fila por poste",
  fields: [
    { path: "name", label: "Nº de poste", kind: "string", group: "Poste", operators: ["eq", "like"], aggregates: ["count"] },
    { path: "tramo", label: "Tramo", kind: "string", group: "Poste", operators: ["eq"], aggregates: ["count"], calculated: true },
  ],
  aggregateOnly: [{ path: "eventos", label: "Eventos", group: "Poste" }],
};

/** toggleGroupBy takes an index; tests still read better in terms of paths. */
const groupByPath = (config: ReportConfig, path: string): ReportConfig =>
  toggleGroupBy(config, config.columns.findIndex((c) => c.path === path));

const withColumns = (...paths: string[]): ReportConfig => ({
  ...emptyConfig("evento"),
  columns: paths.map((path) => ({ path })),
});

describe("columns", () => {
  it("adds a column", () => {
    const config = addColumn(emptyConfig("evento"), "description");
    expect(config.columns).toEqual([{ path: "description" }]);
  });

  it("ignores an exact duplicate", () => {
    const once = addColumn(emptyConfig("evento"), "description");
    expect(addColumn(once, "description").columns).toHaveLength(1);
  });

  it("allows the same field twice with different aggregates", () => {
    let config = addColumn(emptyConfig("evento"), "date", "min");
    config = addColumn(config, "date", "max");
    expect(config.columns).toHaveLength(2);
  });

  it("refuses to grow past the server cap", () => {
    let config = emptyConfig("evento");
    for (let i = 0; i < MAX_COLUMNS + 5; i++) {
      config = { ...config, columns: [...config.columns, { path: `f${i}` }] };
    }
    expect(addColumn(config, "otra").columns).toHaveLength(MAX_COLUMNS + 5);
  });

  it("removes a column", () => {
    const config = removeColumn(withColumns("a", "b", "c"), 1);
    expect(config.columns.map((c) => c.path)).toEqual(["a", "c"]);
  });

  it("drops grouping and sorting that referenced the removed column", () => {
    let config = withColumns("poste.tramo", "description");
    config = groupByPath(config, "poste.tramo");
    config = toggleSort(config, "poste.tramo");
    const after = removeColumn(config, 0);
    expect(after.groupBy).toEqual([]);
    expect(after.sort).toEqual([]);
  });

  it("keeps grouping while any column still uses the path", () => {
    let config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "poste.tramo" }, { path: "poste.tramo", label: "Otra vista" }],
    };
    config = groupByPath(config, "poste.tramo");
    const after = removeColumn(config, 0);
    expect(after.columns).toHaveLength(1);
    expect(after.groupBy).toEqual(["poste.tramo"]);
  });

  it("reorders columns", () => {
    expect(moveColumn(withColumns("a", "b", "c"), 0, 2).columns.map((c) => c.path))
      .toEqual(["b", "c", "a"]);
  });

  it("ignores an out-of-range move", () => {
    const config = withColumns("a", "b");
    expect(moveColumn(config, 0, 9)).toBe(config);
  });

  it("renames a column header", () => {
    const config = renameColumn(withColumns("a"), 0, "  Mi columna  ");
    expect(config.columns[0].label).toBe("Mi columna");
  });

  it("clears the override when renamed to blank", () => {
    let config = renameColumn(withColumns("a"), 0, "Algo");
    config = renameColumn(config, 0, "   ");
    expect(config.columns[0]).not.toHaveProperty("label");
  });

  it("sets and clears an aggregate", () => {
    let config = setColumnAgg(withColumns("date"), 0, "max");
    expect(config.columns[0].agg).toBe("max");
    config = setColumnAgg(config, 0, undefined);
    expect(config.columns[0]).not.toHaveProperty("agg");
  });
});

describe("grouping", () => {
  it("toggles a path on and off", () => {
    let config = groupByPath(withColumns("poste.tramo"), "poste.tramo");
    expect(config.groupBy).toEqual(["poste.tramo"]);
    config = groupByPath(config, "poste.tramo");
    expect(config.groupBy).toEqual([]);
  });

  it("strips the aggregate from a column when it becomes grouped", () => {
    // The server rejects a column that is both grouped and aggregated.
    const config = toggleGroupBy(
      { ...emptyConfig("evento"), columns: [{ path: "state", agg: "count" }] },
      0,
    );
    expect(config.columns[0]).not.toHaveProperty("agg");
  });

  it("collapses the duplicate that stripping an aggregate would leave", () => {
    // Grouping by a path removes the aggregate from every column sharing it.
    // With min and max of the same date that produced two identical columns,
    // indistinguishable in the interface and duplicated in the output.
    const config = toggleGroupBy(
      {
        ...emptyConfig("evento"),
        columns: [{ path: "poste.tramo" }, { path: "date", agg: "min" }, { path: "date", agg: "max" }],
      },
      1,
    );
    expect(config.groupBy).toEqual(["date"]);
    expect(config.columns).toEqual([{ path: "poste.tramo" }, { path: "date" }]);
  });

  it("ignores an index that does not exist", () => {
    const config = withColumns("state");
    expect(toggleGroupBy(config, 9)).toBe(config);
  });

  it("reports summary mode only when something is grouped", () => {
    expect(isSummary(emptyConfig("evento"))).toBe(false);
    expect(isSummary(groupByPath(withColumns("state"), "state"))).toBe(true);
  });
});

describe("sorting", () => {
  it("cycles ascending, descending, off", () => {
    let config = toggleSort(withColumns("date"), "date");
    expect(config.sort).toEqual([{ path: "date", dir: "asc" }]);
    config = toggleSort(config, "date");
    expect(config.sort).toEqual([{ path: "date", dir: "desc" }]);
    config = toggleSort(config, "date");
    expect(config.sort).toEqual([]);
  });

  it("keeps several sort criteria", () => {
    let config = toggleSort(withColumns("date", "state"), "date");
    config = toggleSort(config, "state");
    expect(config.sort).toHaveLength(2);
  });
});

describe("filters", () => {
  it("adds a filter with a type-appropriate operator", () => {
    const config = addFilter(emptyConfig("evento"), evento.fields[1]);
    expect((config.filters!.conditions[0] as FilterCondition).operator).toBe("between");
  });

  it("uses contains for text and equals for booleans", () => {
    expect(defaultOperator("string")).toBe("like");
    expect(defaultOperator("boolean")).toBe("eq");
    expect(defaultOperator("number")).toBe("eq");
  });

  it("updates a filter value", () => {
    let config = addFilter(emptyConfig("evento"), evento.fields[0]);
    config = updateFilter(config, 0, { value: "poste roto" });
    expect((config.filters!.conditions[0] as FilterCondition).value).toBe("poste roto");
  });

  it("discards the value when the operator changes", () => {
    // A value shaped for "between" is meaningless for "equals".
    let config = addFilter(emptyConfig("evento"), evento.fields[1]);
    config = updateFilter(config, 0, { value: ["2026-01-01", "2026-06-30"] });
    config = updateFilter(config, 0, { operator: "gte" });
    expect((config.filters!.conditions[0] as FilterCondition).value).toBeUndefined();
  });

  it("removes a filter", () => {
    let config = addFilter(emptyConfig("evento"), evento.fields[0]);
    config = addFilter(config, evento.fields[2]);
    config = removeFilter(config, 0);
    expect(config.filters!.conditions).toHaveLength(1);
  });
});

describe("changing the detail level", () => {
  it("drops what the new root does not offer", () => {
    let config = withColumns("description", "poste.tramo");
    config = groupByPath(config, "poste.tramo");
    config = toggleSort(config, "description");
    config = addFilter(config, evento.fields[0]);

    const after = changeRoot(config, poste);

    expect(after.root).toBe("poste");
    expect(after.columns).toEqual([]);
    expect(after.groupBy).toEqual([]);
    expect(after.sort).toEqual([]);
    expect(after.filters!.conditions).toEqual([]);
  });

  it("keeps paths the new root shares", () => {
    const config: ReportConfig = { ...emptyConfig("poste"), columns: [{ path: "tramo" }, { path: "name" }] };
    expect(changeRoot(config, poste).columns).toHaveLength(2);
  });

  it("resets pagination", () => {
    const config = { ...withColumns("description"), offset: 300 };
    expect(changeRoot(config, poste).offset).toBe(0);
  });
});

describe("validation", () => {
  it("requires at least one column", () => {
    expect(validateConfig(emptyConfig("evento"), evento))
      .toContain("El reporte necesita al menos una columna.");
  });

  it("accepts a plain detail report", () => {
    expect(validateConfig(withColumns("description", "poste.name"), evento)).toEqual([]);
  });

  it("demands an aggregate for ungrouped columns in summary mode", () => {
    const config = groupByPath(withColumns("poste.tramo", "description"), "poste.tramo");
    expect(validateConfig(config, evento).join(" ")).toMatch(/necesita un resumen/);
  });

  it("rejects an aggregate on a grouped column", () => {
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "poste.tramo", agg: "count" }],
      groupBy: ["poste.tramo"],
    };
    expect(validateConfig(config, evento).join(" ")).toMatch(/no puede llevar además un resumen/);
  });

  it("accepts a well-formed summary", () => {
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "poste.tramo" }, { path: "description", agg: "count" }],
      groupBy: ["poste.tramo"],
    };
    expect(validateConfig(config, evento)).toEqual([]);
  });

  it("rejects an aggregate outside summary mode", () => {
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "description", agg: "count" }],
    };
    expect(validateConfig(config, evento).join(" ")).toMatch(/no está agrupado/);
  });

  it("allows aggregating a to-many relation without grouping", () => {
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "description" }, { path: "revisiones", agg: "count" }],
    };
    expect(validateConfig(config, evento)).toEqual([]);
  });

  it("flags a filter with no value", () => {
    const config = addFilter(withColumns("description"), evento.fields[0]);
    expect(validateConfig(config, evento).join(" ")).toMatch(/no tiene valor/);
  });

  it("flags a half-filled range", () => {
    let config = addFilter(withColumns("description"), evento.fields[1]);
    config = updateFilter(config, 0, { value: ["2026-01-01", ""] });
    expect(validateConfig(config, evento).join(" ")).toMatch(/no tiene valor/);
  });

  it("does not demand a value for is-empty filters", () => {
    let config = addFilter(withColumns("description"), evento.fields[5]);
    config = updateFilter(config, 0, { operator: "isnull" });
    expect(validateConfig(config, evento)).toEqual([]);
  });
});

describe("sameQuery", () => {
  it("ignores which page is being requested", () => {
    const a = withColumns("description");
    expect(sameQuery(a, { ...a, offset: 300 })).toBe(true);
  });

  it("notices a different filter", () => {
    const a = withColumns("description");
    const b = addFilter(a, evento.fields[0]);
    expect(sameQuery(a, b)).toBe(false);
  });

  it("notices a different column set", () => {
    const a = withColumns("description");
    expect(sameQuery(a, addColumn(a, "state"))).toBe(false);
  });
});

describe("numeric filters", () => {
  const numeric: CatalogField = {
    path: "lat", label: "Latitud", kind: "number", group: "Evento",
    operators: ["eq", "gt", "between", "in"], aggregates: ["avg"],
  };
  const root: CatalogRoot = { ...evento, fields: [...evento.fields, numeric] };

  it("accepts a negative number", () => {
    let config = addFilter(withColumns("description"), numeric);
    config = updateFilter(config, 0, { value: "-17.5" });
    expect(validateConfig(config, root)).toEqual([]);
  });

  it("flags a half-typed number instead of sending it", () => {
    // Coercing on each keystroke turned "-" into NaN, which serialises to null.
    let config = addFilter(withColumns("description"), numeric);
    config = updateFilter(config, 0, { value: "-" });
    expect(validateConfig(config, root).join(" ")).toMatch(/no es un número válido/);
  });

  it("accepts a list of values for the in operator", () => {
    let config = addFilter(withColumns("description"), numeric);
    config = updateFilter(config, 0, { operator: "in" });
    config = updateFilter(config, 0, { value: [1, 2, 3] });
    expect(validateConfig(config, root)).toEqual([]);
  });
});

describe("unavailable fields", () => {
  it("flags a column the catalog does not offer", () => {
    // A saved report can name a field that was removed, or one this role
    // cannot see; the server would answer with an internal path name.
    const config = withColumns("usuario.name");
    expect(validateConfig(config, evento).join(" ")).toMatch(/ya no está disponible/);
  });

  it("says which column, using the name the author gave it", () => {
    // The message existed so as not to show an internal path, and then showed
    // one: "La columna \"ultimaRevision.usuario.phone\" no está disponible".
    // The catalog has nothing to offer here — that is why the problem fired —
    // so the author's own header is the only real name available.
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "usuario.phone", label: "Teléfono del técnico" }],
    };
    const said = validateConfig(config, evento).join(" ");
    expect(said).toContain("«Teléfono del técnico»");
    expect(said).not.toContain("usuario.phone");
  });

  it("does not blame the profile, because the field may simply be gone", () => {
    // "no está disponible para su perfil" sends somebody to ask for a
    // permission that would not help when the real cause is a retired field.
    const config = withColumns("usuario.name");
    expect(validateConfig(config, evento).join(" ")).not.toMatch(/su perfil/);
  });

  it("accepts a path reached through a to-many relation", () => {
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "revisiones.date", agg: "max" }],
    };
    expect(validateConfig(config, evento)).toEqual([]);
  });
});

describe("formatting", () => {
  it("renders empty values as a dash", () => {
    expect(formatValue(null, "string")).toBe("—");
    expect(formatValue(undefined, "number")).toBe("—");
    expect(formatValue("", "string")).toBe("—");
  });

  it("renders booleans in Spanish", () => {
    expect(formatValue(true, "boolean")).toBe("Sí");
    expect(formatValue(false, "boolean")).toBe("No");
  });

  it("renders dates as day/month/year", () => {
    expect(formatValue("2026-03-15T12:00:00.000Z", "date")).toMatch(/15\/03\/2026/);
  });

  it("leaves whole numbers whole and rounds averages", () => {
    // Whole numbers keep their exact form so ids stay readable as ids;
    // fractions are rounded and formatted for es-BO, which uses a comma.
    expect(formatValue(42, "number")).toBe("42");
    expect(formatValue(1234567, "number")).toBe("1234567");
    expect(formatValue(3.14159, "number")).toBe("3,14");
  });

  it("renders a date the same regardless of the browser time zone", () => {
    // Formatted in America/La_Paz, not the local zone: a timestamp stored just
    // after midnight UTC used to render as the previous day.
    expect(formatValue("2026-03-15T02:00:00.000Z", "date")).toBe("14/03/2026");
    expect(formatValue("2026-03-15T12:00:00.000Z", "date")).toBe("15/03/2026");
  });

  it("reads booleans in every shape the driver returns", () => {
    expect(formatValue(1, "boolean")).toBe("Sí");
    expect(formatValue("t", "boolean")).toBe("Sí");
    expect(formatValue(0, "boolean")).toBe("No");
  });

  it("does not pretend a non-finite number is a number", () => {
    expect(formatValue(Infinity, "number")).toBe("Infinity");
  });

  it("falls back to the raw text for an unparseable date", () => {
    expect(formatValue("no es fecha", "date")).toBe("no es fecha");
  });
});

describe("describeConfig", () => {
  it("describes a detail report", () => {
    expect(describeConfig(withColumns("description"), evento))
      .toBe("una fila por evento · 1 columna");
  });

  it("describes a grouped report", () => {
    const config = groupByPath(withColumns("poste.tramo"), "poste.tramo");
    expect(describeConfig(config, evento)).toContain("agrupado por Tramo");
  });

  it("counts filters", () => {
    const config = addFilter(withColumns("description"), evento.fields[0]);
    expect(describeConfig(config, evento)).toContain("1 filtro");
  });
});

describe("findField", () => {
  it("finds a field by path", () => {
    expect(findField(evento, "poste.tramo")?.label).toBe("Tramo");
  });

  it("returns undefined for an unknown path", () => {
    expect(findField(evento, "inventado")).toBeUndefined();
  });
});

describe("sorting — which column the criterion belongs to", () => {
  const twoDates: ReportConfig = {
    ...emptyConfig("evento"),
    columns: [
      { path: "date", agg: "min" },
      { path: "date", agg: "max" },
    ],
    groupBy: ["state"],
  };

  it("carries the column's aggregate into the criterion", () => {
    // The parameter was there from the first version and no caller ever passed
    // it, so every sort in a grouped report was refused by the server: a column
    // that is not grouped has to say how it is summarised. The button produced
    // a 400, with a message telling the person to summarise a column they had
    // already summarised.
    const sorted = toggleSort(twoDates, "date", "max");
    expect(sorted.sort).toEqual([{ path: "date", dir: "asc", agg: "max" }]);
  });

  it("tells two columns of the same field apart", () => {
    // Keyed by path alone, the minimum and the maximum were one criterion:
    // clicking either lit both arrows, and only one of them could be sorted.
    let config = toggleSort(twoDates, "date", "max");
    config = toggleSort(config, "date", "min");

    expect(config.sort).toEqual([
      { path: "date", dir: "asc", agg: "max" },
      { path: "date", dir: "asc", agg: "min" },
    ]);

    config = toggleSort(config, "date", "max");
    expect(config.sort?.find((s) => s.agg === "max")?.dir).toBe("desc");
    expect(config.sort?.find((s) => s.agg === "min")?.dir).toBe("asc");

    config = toggleSort(config, "date", "max");
    expect(config.sort).toEqual([{ path: "date", dir: "asc", agg: "min" }]);
  });

  it("reports being full instead of ignoring the click in silence", () => {
    let config = emptyConfig("evento");
    for (let i = 0; i < MAX_SORTS; i++) config = toggleSort(config, "campo" + i);

    expect(sortLimitReached(config)).toBe(true);
    expect(toggleSort(config, "uno-mas")).toBe(config);
  });

  it("follows the column when its aggregate changes", () => {
    const config = toggleSort(twoDates, "date", "max");
    const changed = setColumnAgg(config, 1, "count");

    expect(changed.sort).toEqual([{ path: "date", dir: "asc", agg: "count" }]);
  });

  it("goes away with the column it belonged to, and only that one", () => {
    let config = toggleSort(twoDates, "date", "max");
    config = toggleSort(config, "date", "min");

    const left = removeColumn(config, 1);
    expect(left.sort).toEqual([{ path: "date", dir: "asc", agg: "min" }]);
  });
});

describe("setColumnAgg", () => {
  it("refuses to make two columns identical", () => {
    // Both would render under the same React key, which makes reconciliation
    // undefined: an edit lands on the wrong twin, or focus leaves the box being
    // typed in. `addColumn` refuses an exact duplicate; this walked into one.
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "date", agg: "min" }, { path: "date", agg: "max" }],
    };

    expect(setColumnAgg(config, 1, "min")).toBe(config);
  });
});

describe("pruneToCatalog", () => {
  const withAdvanced: ReportConfig = {
    ...emptyConfig("evento"),
    columns: [{ path: "description" }],
    filters: {
      op: "and",
      conditions: [
        { path: "description", operator: "like", value: "poste" },
        {
          exists: "revisiones",
          where: { op: "and", conditions: [{ path: "date", operator: "gte", value: "2026-01-01" }] },
        },
      ],
    },
  };

  it("keeps an advanced filter whose paths are all available", () => {
    // `changeRoot` deleted every `exists` and every nested group on principle,
    // and opening a saved report ran through it even with the detail level
    // unchanged. The report silently widened, and saving persisted the loss.
    const pruned = pruneToCatalog(withAdvanced, evento);
    expect(pruned.filters?.conditions).toHaveLength(2);
  });

  it("drops an advanced filter whole rather than in pieces", () => {
    // Removing one clause of a sentence does not narrow it, it changes what it
    // says: an "exists" stripped of its date range matches rows the person
    // filtered out on purpose.
    const sinRevisiones: CatalogRoot = { ...evento, aggregateOnly: [] };
    const pruned = pruneToCatalog(withAdvanced, sinRevisiones);

    expect(pruned.filters?.conditions).toHaveLength(1);
    expect(pruned.filters?.conditions[0]).toEqual({
      path: "description",
      operator: "like",
      value: "poste",
    });
  });

  it("leaves the detail level alone", () => {
    expect(pruneToCatalog(withAdvanced, evento).root).toBe("evento");
  });
});

describe("sameQuery — key order", () => {
  it("does not mind which order the keys were written in", () => {
    // `JSON.stringify` follows insertion order and the builders disagree on
    // one: `addColumn` writes `agg` before `label`, `setColumnAgg` rebuilds it
    // after. Setting an aggregate to "promedio" and back to "suma" produced a
    // different string for an identical report, and the screen announced
    // "cambió la configuración" over a table that matched it exactly. A banner
    // that cries wolf is one nobody reads — and this is the banner that warns
    // the rows no longer match the header.
    const a: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "date", agg: "min", label: "Primera" }],
    };
    const b: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "date", label: "Primera", agg: "min" }],
    };

    expect(sameQuery(a, b)).toBe(true);
  });

  it("still notices a real difference", () => {
    const a: ReportConfig = { ...emptyConfig("evento"), columns: [{ path: "date", agg: "min" }] };
    const b: ReportConfig = { ...emptyConfig("evento"), columns: [{ path: "date", agg: "max" }] };

    expect(sameQuery(a, b)).toBe(false);
  });
});

describe("validation — the order", () => {
  it("catches a sort the server would refuse, before it is sent", () => {
    // Nothing here looked at `config.sort` at all, so the problems panel stayed
    // empty and the round trip came back 400.
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "state" }, { path: "description", agg: "count" }],
      groupBy: ["state"],
      sort: [{ path: "description", dir: "asc" }],
    };

    expect(validateConfig(config, evento).join(" ")).toMatch(/sin un resumen/);
  });

  it("accepts a sort that carries its aggregate", () => {
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "state" }, { path: "description", agg: "count" }],
      groupBy: ["state"],
      sort: [{ path: "description", dir: "asc", agg: "count" }],
    };

    expect(validateConfig(config, evento)).toEqual([]);
  });

  it("refuses to summarise a total that belongs to another entity", () => {
    // `eventos` on a report of postes is the row's own count. Reached through a
    // relation it is not, and summing it across a group squares it: 1.390
    // events reported where 1.376 exist.
    const conPrefijo: CatalogRoot = {
      ...evento,
      aggregateOnly: [
        ...evento.aggregateOnly,
        { path: "poste.eventos", label: "Eventos del poste", group: "Poste" },
      ],
    };
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "poste.tramo" }, { path: "poste.eventos", agg: "count" }],
      groupBy: ["poste.tramo"],
    };

    expect(validateConfig(config, conPrefijo).join(" ")).toMatch(/total de otra entidad/);
  });
});

describe("the caps the server publishes", () => {
  it("uses the published number and not the local copy", () => {
    // `catalog.limits` exists so the caps are not written twice, and they were
    // written twice anyway. The consequence is not theoretical: a client cap
    // higher than the server's means the warning never fires and the refusal
    // arrives from the far side; lower means the screen blocks a report the
    // server would have accepted.
    const wide = {
      root: "evento",
      columns: Array.from({ length: 5 }, (_, i) => ({ path: `c${i}` })),
    };

    expect(columnLimitReached(wide)).toBe(false);
    expect(columnLimitReached(wide, { maxColumns: 5 })).toBe(true);
    expect(maxColumns({ maxColumns: 5 })).toBe(5);
    // And with nothing published — before the catalog arrives — the local
    // fallback still answers.
    expect(maxColumns(undefined)).toBe(MAX_COLUMNS);

    const many = {
      root: "evento",
      columns: [{ path: "id" }],
      sort: [{ path: "id", dir: "asc" as const }, { path: "date", dir: "asc" as const }],
    };
    expect(sortLimitReached(many, { maxSorts: 2 })).toBe(true);
    expect(sortLimitReached(many)).toBe(false);

    const filtered = {
      root: "evento",
      columns: [{ path: "id" }],
      filters: {
        op: "and" as const,
        conditions: [{ path: "id", operator: "eq" as const, value: 1 }],
      },
    };
    expect(filterLimitReached(filtered, { maxConditions: 1 })).toBe(true);
    expect(filterLimitReached(filtered)).toBe(false);
  });

  it("describes a nested filter by how many conditions it really holds", () => {
    // The label said "1 filtro" for a sentence with three clauses, while the
    // cap it is warning about counts all three. Two numbers for one thing.
    const config = {
      root: "evento",
      columns: [{ path: "id" }],
      filters: {
        op: "and" as const,
        conditions: [
          { path: "id", operator: "eq" as const, value: 1 },
          {
            exists: "revisiones",
            where: {
              op: "and" as const,
              conditions: [{ path: "date", operator: "gte" as const, value: "2026-01-01" }],
            },
          },
        ],
      },
    };
    const root = {
      key: "evento", label: "Evento", rowMeaning: "Una fila por evento",
      fields: [], aggregateOnly: [],
    };

    expect(describeConfig(config, root)).toContain("3 filtros");
  });
});

describe("a filter value the server would refuse", () => {
  // The one rule the user used to meet only after pressing Generar: the value
  // box had no limit, the server capped it at 200, and the refusal quoted a
  // number the screen had never mentioned. Every other cap is honoured here.
  it("says so before the request leaves", () => {
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "description" }],
      filters: {
        op: "and",
        conditions: [{ path: "description", operator: "like", value: "x".repeat(201) }],
      },
    };
    const said = validateConfig(config, evento).join(" ");
    expect(said).toMatch(/demasiado largo/);
    expect(said).toContain("200");
  });

  it("accepts a value exactly at the cap", () => {
    // The server refuses above 200, so 200 itself has to pass or the two sides
    // disagree by one character.
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "description" }],
      filters: {
        op: "and",
        conditions: [{ path: "description", operator: "like", value: "x".repeat(200) }],
      },
    };
    expect(validateConfig(config, evento)).toEqual([]);
  });

  it("honours the cap the catalog publishes, not a copy of it", () => {
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "description" }],
      filters: {
        op: "and",
        conditions: [{ path: "description", operator: "like", value: "x".repeat(60) }],
      },
    };
    const said = validateConfig(config, evento, { maxFilterValue: 50 }).join(" ");
    expect(said).toMatch(/demasiado largo/);
    expect(said).toContain("50");
  });
});

describe("the header a column will come back with", () => {
  // Read by the skeleton drawn while a report runs, so the table it stands in
  // for has the headers the answer will carry. They have to be the server's
  // words: two spellings of the same summary would show as the header
  // rewriting itself the moment the rows land.
  it("uses the catalog's name for a plain field", () => {
    expect(columnHeader(evento, { path: "description" })).toBe("Descripción");
  });

  it("puts the summary after it, lower case, the way the server does", () => {
    expect(columnHeader(evento, { path: "date", agg: "max" })).toBe("Fecha del evento (máximo)");
    expect(columnHeader(evento, { path: "date", agg: "min" })).toBe("Fecha del evento (mínimo)");
  });

  it("prefers the name the author typed", () => {
    expect(columnHeader(evento, { path: "date", agg: "max", label: "Última visita" }))
      .toBe("Última visita");
    // Whitespace is not a name: the server trims it and falls back, and a
    // header of three spaces would be an unnamed column here and a named one
    // there.
    expect(columnHeader(evento, { path: "description", label: "   " })).toBe("Descripción");
  });

  it("does not say 'conteo' about something already counted", () => {
    // "Nº de revisiones (conteo)" states the same fact twice. The server drops
    // the suffix for an aggregate-only relation and so does this.
    expect(columnHeader(evento, { path: "revisiones", agg: "count" })).toBe("Nº de revisiones");
  });

  it("falls back to the path when the catalog has never heard of it", () => {
    // A saved report whose field this role cannot see. Better a dotted path
    // for the half second the skeleton lasts than an empty header.
    expect(columnHeader(evento, { path: "usuario.name" })).toBe("usuario.name");
  });
});

describe("which side of the cell a value lands on", () => {
  it("counts, sums and averages are numbers whatever they were applied to", () => {
    expect(columnKind(evento, { path: "description", agg: "count" })).toBe("number");
    expect(columnKind(evento, { path: "date", agg: "avg" })).toBe("number");
  });

  it("the smallest and the largest of a date are still dates", () => {
    // Not academic: a wrong answer here puts the skeleton's bars against one
    // edge and the rows that replace them against the other.
    expect(columnKind(evento, { path: "date", agg: "max" })).toBe("date");
  });

  it("keeps the field's own type when nothing is summarised", () => {
    expect(columnKind(evento, { path: "description" })).toBe("string");
    expect(columnKind(evento, { path: "image" })).toBe("image");
  });
});

describe("whether the table on screen can still stand for the configuration", () => {
  const base: ReportConfig = {
    ...emptyConfig("evento"),
    columns: [{ path: "description" }, { path: "date", agg: "max" }],
  };

  it("a different filter is the same shape", () => {
    // Same columns in the same order: the rows on screen are still a fair
    // picture, and taking them away over a keystroke costs the reader the row
    // they were reading.
    const filtered: ReportConfig = {
      ...base,
      filters: { op: "and", conditions: [{ path: "description", operator: "like", value: "x" }] },
    };
    expect(sameShape(base, filtered)).toBe(true);
  });

  it("a different order is the same shape", () => {
    expect(sameShape(base, { ...base, sort: [{ path: "description", dir: "asc" }] })).toBe(true);
  });

  it("a different page is the same shape", () => {
    expect(sameShape(base, { ...base, offset: 100 })).toBe(true);
  });

  it("one more column is not", () => {
    expect(sameShape(base, { ...base, columns: [...base.columns, { path: "state" }] })).toBe(false);
  });

  it("the same columns in a different order are not", () => {
    expect(sameShape(base, { ...base, columns: [base.columns[1], base.columns[0]] })).toBe(false);
  });

  it("a renamed header is not", () => {
    // The header is what the table shows; an old table under a new name is
    // showing the wrong thing just as surely as one missing a column.
    const renamed = [{ ...base.columns[0], label: "Detalle" }, base.columns[1]];
    expect(sameShape(base, { ...base, columns: renamed })).toBe(false);
  });

  it("a different summary on the same field is not", () => {
    const min = [base.columns[0], { path: "date", agg: "min" as const }];
    expect(sameShape(base, { ...base, columns: min })).toBe(false);
  });

  it("grouping is not, because it changes what a row is", () => {
    expect(sameShape(base, { ...base, groupBy: ["description"] })).toBe(false);
  });

  it("neither is a different level of detail", () => {
    // The same two paths mean different tables under "evento" and under
    // "revision": the root decides what one row is.
    expect(sameShape(base, { ...base, root: "revision" })).toBe(false);
  });

  it("an absent groupBy and an empty one are the same", () => {
    // A saved report comes back without the key; the page builds it as [].
    const { groupBy: _dropped, ...withoutKey } = base;
    expect(sameShape(withoutKey as ReportConfig, { ...base, groupBy: [] })).toBe(true);
  });
});

describe("moving a column by dragging it", () => {
  const config: ReportConfig = {
    ...emptyConfig("evento"),
    columns: [
      { path: "description" },
      { path: "date", agg: "min" },
      { path: "date", agg: "max" },
      { path: "state", label: "¿Listo?" },
    ],
  };
  const keys = () => config.columns.map(columnKey);

  it("puts the dragged column where the one it was dropped on sits", () => {
    const [first, , third] = keys();
    const moved = moveColumnByKey(config, third, first);
    expect(moved.columns.map((c) => c.agg)).toEqual(["max", undefined, "min", undefined]);
  });

  it("tells two columns of the same field apart", () => {
    // The minimum and the maximum of the same date are two columns. Keyed by
    // path alone, dragging one would move whichever came first.
    const [, min, max] = keys();
    expect(min).not.toBe(max);
    const moved = moveColumnByKey(config, min, max);
    expect(moved.columns.map((c) => c.agg)).toEqual([undefined, "max", "min", undefined]);
  });

  it("tells two copies of one field apart by their headers", () => {
    const twins: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "description" }, { path: "description", label: "Detalle" }],
    };
    const [plain, renamed] = twins.columns.map(columnKey);
    expect(plain).not.toBe(renamed);
    expect(moveColumnByKey(twins, renamed, plain).columns[0].label).toBe("Detalle");
  });

  it("does nothing when a column is dropped on itself", () => {
    const [first] = keys();
    expect(moveColumnByKey(config, first, first)).toBe(config);
  });

  it("does nothing when either end is unknown", () => {
    // A drop that lands outside the list, and a stale key from a row that was
    // removed while the pointer was down.
    const [first] = keys();
    expect(moveColumnByKey(config, first, "no-existe|")).toBe(config);
    expect(moveColumnByKey(config, "no-existe|", first)).toBe(config);
  });
});
