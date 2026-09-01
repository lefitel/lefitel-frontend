// A download button gives you what the screen is showing.
//
// The Recorrido screen has a severity filter and a status filter, and the CSV
// button sits in the same header row as both. It was handed `list` — everything
// the query returned — instead of `filteredList`, the rows actually drawn
// underneath. Narrow to three critical events, press CSV, get four hundred
// rows, and nothing anywhere says the file is not what you were looking at.
// Somebody sends that file to a client.
//
// This is a source-level assertion, not a behavioural one, and that is a
// deliberate trade. Driving it through the interface means rendering Leaflet, a
// routing request and four endpoints to observe a single argument; the argument
// is the whole defect. The check is narrow on purpose: it does not try to
// understand the filtering, only that no export on this screen is fed the raw
// list.
//
// `criticality.test.ts` covers the bands the filter now uses, which is the
// other half — that `filteredList` contains the right rows in the first place.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(join(__dirname, "ReportRecorrido.tsx"), "utf8");

describe("el CSV del recorrido exporta lo que hay en pantalla", () => {
  it("recibe la lista filtrada, no la completa", () => {
    const calls = SOURCE.match(/exportCsv\([^)]*\)/g) ?? [];

    // One call site. If a second appears, it has to be looked at, not assumed.
    expect(calls.filter((c) => !c.startsWith("exportCsv(rowsOnScreen"))).toHaveLength(1);

    for (const call of calls) {
      if (call.startsWith("exportCsv(rowsOnScreen")) continue; // the definition
      expect(call, "el botón de CSV debe recibir filteredList").toContain("filteredList");
      expect(call).not.toMatch(/exportCsv\(\s*list\b/);
    }
  });

  it("el botón dice cuántas filas se va a llevar", () => {
    // Without this the person cannot tell a filtered download from a full one
    // until they open the file.
    expect(SOURCE).toMatch(/title=\{`Descargar \$\{filteredList\.length\}/);
  });

  it("no se puede pedir un fichero vacío", () => {
    expect(SOURCE).toMatch(/disabled=\{filteredList\.length === 0\}/);
  });
});
