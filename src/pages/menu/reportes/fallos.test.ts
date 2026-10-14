// The six report screens and the server's sentence — B3, the client half.
//
// Since B3 the six fixed reports answer 429 with a sentence written for the
// person ("Espere un momento…"), and all six screens used to catch it as
// "Error al generar el reporte". `ReportEstadoRedSec.test.tsx` drives that
// through the interface on the one screen whose Generar needs no date, and
// `ReportGeneralSec.test.tsx` drives the other half of the defect: the rows
// that survived a failure and went into a file under the wrong dates.
//
// The remaining four need two calendar dates and, for Recorrido, a tramo,
// and the calendar can only be driven through a mocked picker. The screens'
// own tests do that for what they pin; the catch of Generar they leave to
// this, which reads the six as text, in the style
// `ReportRecorrido.test.tsx` already uses for its export. Not a substitute for
// rendering, and said so; but the exact mutation it exists for — "drop
// `mensajeDeError`, keep the generic toast", or "keep the stale rows" — fails
// here in every one of the six, and a seventh screen added without either
// would fail the moment it is listed.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Each screen, with what its catch must clear so no stale rows outlive a failure. */
const PANTALLAS: Record<string, readonly string[]> = {
  "ReportGeneralSec.tsx": ["setList([])", "setApplied(null)"],
  "ReportTramoSec.tsx": ["setList([])", "setApplied(null)"],
  "ReportRecorrido.tsx": ["setList([])", "setApplied(null)"],
  "ReportEstadoRedSec.tsx": ["setFilas([])", "setGenerated(false)"],
  "ReportObsFrecuenciaSec.tsx": ["setRows([])", "setGenerated(false)"],
  "ReportTiemposSec.tsx": ["setFilas([])", "setDescartados(0)", "setGenerated(false)"],
};

/**
 * The `catch` of `handleGenerar`, from `catch (error)` to its `finally`.
 *
 * Recorrido has an inner `try/catch` around its routing call, and it is
 * skipped only because that one is written `catch {` with no binding. Give it
 * a parameter and this slices the routing block instead — and then fails
 * loudly on the first assertion, which is the safe direction.
 */
const catchDeGenerar = (fichero: string, fuente: string): string => {
  const generar = fuente.indexOf("const handleGenerar");
  if (generar === -1) throw new Error(`${fichero}: no tiene handleGenerar`);
  const inicio = fuente.indexOf("catch (error)", generar);
  if (inicio === -1) throw new Error(`${fichero}: handleGenerar no tiene un catch con el error a mano`);
  const fin = fuente.indexOf("finally", inicio);
  if (fin === -1) throw new Error(`${fichero}: el catch de handleGenerar no tiene finally`);
  return fuente.slice(inicio, fin);
};

describe.each(Object.entries(PANTALLAS))("%s, when Generar fails", (fichero, limpieza) => {
  const fuente = readFileSync(join(__dirname, fichero), "utf8");
  const bloque = catchDeGenerar(fichero, fuente);

  it("hands the error to mensajeDeError, with the screen's own sentence as the fallback", () => {
    expect(bloque).toMatch(/toast\.error\(mensajeDeError\(error, "[^"]+"\)\)/);
    // And nothing else in the block toasts a bare string: the mutation is
    // usually an addition next to the reader, not a replacement of it.
    expect(bloque).not.toMatch(/toast\.error\("/);
    // From `api/descarga`, not re-exported through `reporte.api`: the screen
    // tests replace that module with a factory of one function, and a reader
    // imported through it would arrive `undefined` inside a `catch`.
    expect(fuente).toMatch(/import \{ mensajeDeError \} from "\.\.\/\.\.\/\.\.\/api\/descarga"/);
  });

  it("takes the previous rows down", () => {
    for (const linea of limpieza) expect(bloque, `${fichero}: falta ${linea}`).toContain(linea);
  });
});

describe("ReportRecorrido.tsx, when a re-run it fired on its own fails", () => {
  const fuente = readFileSync(join(__dirname, "ReportRecorrido.tsx"), "utf8");

  // The generator drew this line first: a failed Generar clears, a failed
  // re-run the person did not ask for keeps the rows they were reading. The
  // two re-runs here fire after an incident is resolved or revised from a map
  // popup, and the popups are not reachable from jsdom — the map library is
  // mocked away in the screen's own test — so this is text, and says so.
  it("keeps the rows: both popup callbacks ask for keepOnError, and the catch honours it", () => {
    const callbacks = fuente.match(/onSuccess=\{regenerar\}/g) ?? [];
    expect(callbacks).toHaveLength(2);
    // `regenerar` is what keeps the rows on failure, and hands over the applied filter.
    expect(fuente).toMatch(/const regenerar = \(\) => \{ if \(applied\) void handleGenerar\(true, applied\); \};/);
    expect(fuente).not.toMatch(/onSuccess=\{handleGenerar\}/);
    expect(catchDeGenerar("ReportRecorrido.tsx", fuente))
      .toMatch(/if \(!keepOnError\) \{\s*setList\(\[\]\);\s*setApplied\(null\);/);
  });

  // The button would otherwise hand the click event over as `keepOnError`,
  // and a truthy event is a Generar that never clears.
  it("Generar itself does not keep them", () => {
    expect(fuente).toMatch(/onClick=\{\(\) => void handleGenerar\(\)\}/);
    expect(fuente).not.toMatch(/onClick=\{handleGenerar\}/);
  });
});
