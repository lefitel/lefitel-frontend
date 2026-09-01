// The nine levels have one home, and it is this file.
//
// `criticality` is an integer in the database and nothing else: the labels
// ("Catastrófico", "Ferretería suelta") and the colours exist only in source.
// So every copy of the scale is a place where the same number can come to mean
// something different, and one already had: the dashboard kept its own table
// running red → yellow while this one runs red → blue, which painted level 6
// "Fricción" green on the event page and amber on the home screen, and level 9
// "Mantenimiento" blue in one place and yellow in the other. A technician
// reading the colour instead of the number got two severities for the same
// incident depending on which screen they came in through.
//
// A test per component would only pin the components that exist today, and the
// way this recurs is somebody writing a fresh `{1: "bg-red-…"}` in the next
// one. So the assertion is about the shape of the source: outside this file,
// nothing may map a level to a colour.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  CRITICALITY_BANDS, CRITICALITY_BAND_OPTIONS, CRITICALITY_LEVELS,
  getCriticalityMeta, matchesCriticalityBand, UNCLASSIFIED_META,
} from "./criticality";

const SRC = join(__dirname, "..");

/** Where the scale is allowed to live. */
const CANONICAL = "lib/criticality.ts";

/**
 * Surfaces that render their own palette from something other than a level, and
 * so are not copies of this scale:
 *
 * - `landing/parts/fiction.ts` is invented data for the marketing page. It
 *   names levels, but nothing there reaches a real record.
 */
const ALLOWED = ["pages/landing/parts/fiction.ts"];

/**
 * An object entry keying a bare 1-9 to a colour: `1: "bg-red-500/15 …"`,
 * `4: "#EA580C"`, `9: 'text-yellow-500'`.
 *
 * Deliberately narrow. It catches the literal table, which is how the
 * divergence actually happened, and does not try to catch a chain of
 * `if (c <= 3) return "#DC2626"` — that shape needs judgement about legends,
 * not a regex, and `ReportRecorrido` still has one.
 */
const LEVEL_TO_COLOUR = /^\s*[1-9]\s*:\s*["'`]\s*(bg-|text-|border-|#)/m;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) return [];
    return [full];
  });
}

describe("la escala de criticidad vive en un solo sitio", () => {
  it("ningún otro fichero mapea un nivel a un color", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => {
        const rel = relative(SRC, file).split("\\").join("/");
        if (rel === CANONICAL || ALLOWED.includes(rel)) return false;
        return LEVEL_TO_COLOUR.test(readFileSync(file, "utf8"));
      })
      .map((file) => relative(SRC, file).split("\\").join("/"));

    expect(offenders).toEqual([]);
  });
});

describe("getCriticalityMeta", () => {
  it("cubre los nueve niveles con etiqueta propia", () => {
    expect(CRITICALITY_LEVELS.map((c) => c.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(new Set(CRITICALITY_LEVELS.map((c) => c.label)).size).toBe(9);
  });

  it("trata como sin clasificar lo que no es un nivel", () => {
    // A value outside 1-9 reaches the interface as "Sin clasificar" rather than
    // as a colour nobody chose. The database has no CHECK on the column, so
    // this is reachable by any write that bypasses the model.
    for (const level of [null, undefined, 0, 10, -3, 47]) {
      expect(getCriticalityMeta(level)).toBe(UNCLASSIFIED_META);
    }
  });

  it("da a cada nivel un color, y en las dos variantes de tema", () => {
    for (const meta of CRITICALITY_LEVELS) {
      expect(meta.bgClass).toBeTruthy();
      expect(meta.borderClass).toBeTruthy();
      // Without a dark variant the 600/700 weights all but vanish on a dark
      // background, which is the reason the file carries both.
      expect(meta.textClass).toMatch(/dark:/);
    }
  });
});

// ─── Bandas ───────────────────────────────────────────────────────────────────
//
// The bands are the second way the scale used to fork. The screens each wrote
// the ranges out by hand — `c <= 3` on one, `c >= 4 && c <= 5` on another — so
// "críticas" was not guaranteed to mean the same rows twice. They are now one
// list, and `value` is also the literal the API accepts as a filter, which is
// the part these tests are really guarding: a rename here without the matching
// rename in `evento.controller.ts` silently returns everything.

describe("las bandas de gravedad", () => {
  it("cubren los nueve niveles sin huecos ni solapes", () => {
    const covered = CRITICALITY_BANDS
      .flatMap((b) => (b.range ? Array.from({ length: b.range[1] - b.range[0] + 1 }, (_, i) => b.range[0] + i) : []))
      .sort((a, b) => a - b);

    expect(covered).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(new Set(covered).size).toBe(9);
  });

  it("clasifica cada nivel en una sola banda", () => {
    for (const { level } of CRITICALITY_LEVELS) {
      const hits = CRITICALITY_BANDS.filter((b) => matchesCriticalityBand(level, b.value));
      expect(hits.map((b) => b.value), `nivel ${level}`).toHaveLength(1);
    }
  });

  it("«sin clasificar» es la ausencia de nivel, no un rango", () => {
    expect(matchesCriticalityBand(null, "sin")).toBe(true);
    expect(matchesCriticalityBand(undefined, "sin")).toBe(true);
    for (const { level } of CRITICALITY_LEVELS) {
      expect(matchesCriticalityBand(level, "sin"), `nivel ${level}`).toBe(false);
    }
  });

  it("«todas» incluye también lo que no tiene nivel", () => {
    expect(matchesCriticalityBand(null, "all")).toBe(true);
    expect(matchesCriticalityBand(1, "all")).toBe(true);
  });

  it("los valores son los que entiende la API", () => {
    // Mirrored by CRITICALITY_BANDS in api/src/controllers/evento.controller.ts
    // and asserted there by evento.list.test.ts. Renaming one side alone turns
    // the filter into a no-op: the server drops a band it does not know, and
    // the screen keeps showing every row under a label that promises fewer.
    expect(CRITICALITY_BANDS.map((b) => b.value))
      .toEqual(["criticas", "altas", "medias", "bajas", "sin"]);
  });

  it("el selector empieza por «Todas» y no repite ningún valor", () => {
    expect(CRITICALITY_BAND_OPTIONS[0].value).toBe("all");
    const values = CRITICALITY_BAND_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
