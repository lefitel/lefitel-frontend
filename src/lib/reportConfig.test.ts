import { describe, it, expect } from "vitest";
import type { CatalogRoot, FilterCondition, ReportConfig } from "../api/generador.api";
import {
  MAX_COLUMNS,
  addColumn,
  addFilter,
  changeRoot,
  defaultOperator,
  describeConfig,
  emptyConfig,
  findField,
  formatValue,
  isSummary,
  moveColumn,
  removeColumn,
  removeFilter,
  renameColumn,
  setColumnAgg,
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
    config = toggleGroupBy(config, "poste.tramo");
    config = toggleSort(config, "poste.tramo");
    const after = removeColumn(config, 0);
    expect(after.groupBy).toEqual([]);
    expect(after.sort).toEqual([]);
  });

  it("keeps grouping when another column still uses the path", () => {
    let config: ReportConfig = {
      ...emptyConfig("evento"),
      columns: [{ path: "date", agg: "min" }, { path: "date", agg: "max" }],
    };
    config = toggleGroupBy(config, "date");
    const after = removeColumn(config, 0);
    expect(after.groupBy).toEqual(["date"]);
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
    let config = toggleGroupBy(withColumns("poste.tramo"), "poste.tramo");
    expect(config.groupBy).toEqual(["poste.tramo"]);
    config = toggleGroupBy(config, "poste.tramo");
    expect(config.groupBy).toEqual([]);
  });

  it("strips the aggregate from a column when it becomes grouped", () => {
    // The server rejects a column that is both grouped and aggregated.
    const config = toggleGroupBy(
      { ...emptyConfig("evento"), columns: [{ path: "state", agg: "count" }] },
      "state",
    );
    expect(config.columns[0]).not.toHaveProperty("agg");
  });

  it("reports summary mode only when something is grouped", () => {
    expect(isSummary(emptyConfig("evento"))).toBe(false);
    expect(isSummary(toggleGroupBy(withColumns("state"), "state"))).toBe(true);
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
    config = toggleGroupBy(config, "poste.tramo");
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
    const config = toggleGroupBy(withColumns("poste.tramo", "description"), "poste.tramo");
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
    expect(formatValue(42, "number")).toBe("42");
    expect(formatValue(3.14159, "number")).toBe("3.14");
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
    const config = toggleGroupBy(withColumns("poste.tramo"), "poste.tramo");
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
