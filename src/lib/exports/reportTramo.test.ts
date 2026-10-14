// The rows the Por Tramo export writes, and the order they come out in.
//
// This file had 2.99% coverage before C2 — effectively none — and C2 changes
// what it is handed: the five catalogue lists now arrive from
// `/api/reporte/opciones` instead of five separate endpoints. The server orders
// every one of them by `id DESC`, exactly as the endpoints it replaces did, so
// the migration is invisible **as long as nobody sorts them on the way in**.
//
// That is the regression worth a test here. A `.sort((a, b) => a.name
// .localeCompare(b.name))` added to a dropdown for perfectly good reasons — and
// applied to the same array the exporter is handed — reorders the ADSS and the
// observations inside every cell of the CSV and the PDF. Two exports of the
// same report would then disagree with each other, with nothing on screen to
// explain it.
//
// What is deliberately **not** tested: that the header row and the value row
// stay aligned. Both are built from the same array in the same pass, so a
// misalignment is not reachable — a test for it would only restate the loop.

import { describe, it, expect } from "vitest";
import { toRowsTramo, PDF_HEADERS_TRAMO, etiquetaDeTramo } from "./reportTramo";
import { EventoInterface, Tramo } from "../../interfaces/interfaces";

/** As the endpoint serves them: `id DESC`, and just the two columns. */
const ADSS = [{ id: 9, name: "Retención" }, { id: 3, name: "Preformado" }];
const OBS = [{ id: 8, name: "Poste inclinado" }, { id: 2, name: "Cable suelto" }];

/** One incident carrying both ADSS and both observations. */
const EVENTO = {
  id: 1, priority: true, description: "", date: new Date("2026-02-01"),
  state: false, image: "", id_poste: 40, id_usuario: 1,
  poste: {
    name: "P-001", lat: -18.01462, lng: -70.25361,
    propietario: { id: 2, name: "Osefi" },
    material: { id: 7, name: "Madera" },
    adsspostes: [{ id_adss: 3 }, { id_adss: 9 }],
  },
  eventoObs: [{ id_obs: 2 }, { id_obs: 8 }],
} as unknown as EventoInterface;

describe("toRowsTramo", () => {
  it("lists the ADSS and the observations in catalogue order, not incident order", () => {
    // The incident references 3 then 9, and 2 then 8. The row must follow the
    // catalogue — which is what makes two exports of the same data identical,
    // and what a sort applied to one list and not the other would break.
    const [fila] = toRowsTramo([EVENTO], ADSS, OBS);

    expect(fila[5]).toBe("Retención, Preformado");
    expect(fila[8]).toBe("Poste inclinado, Cable suelto");
  });

  it("follows a different catalogue order when the catalogue has one", () => {
    // The other direction: without this, an implementation that sorted
    // internally would pass the test above whenever the fixture happened to
    // agree with its sort.
    const [fila] = toRowsTramo([EVENTO], [...ADSS].reverse(), [...OBS].reverse());

    expect(fila[5]).toBe("Preformado, Retención");
    expect(fila[8]).toBe("Cable suelto, Poste inclinado");
  });

  it("names only what the incident actually carries", () => {
    const [fila] = toRowsTramo(
      [EVENTO],
      [...ADSS, { id: 99, name: "Nunca usado" }],
      OBS,
    );

    // Positive and not merely "does not contain": a column inserted before
    // position 5 would shift this to the material cell, which does not contain
    // "Nunca usado" either, and the test would pass having moved house.
    expect(fila[5]).toBe("Retención, Preformado");
  });

  it("writes one column per header", () => {
    // Cheap, and it is the assertion that catches a column added to the header
    // list and forgotten in the row, which shifts every value after it by one
    // and is unreadable in the resulting file rather than absent from it.
    const [fila] = toRowsTramo([EVENTO], ADSS, OBS);

    expect(fila).toHaveLength(PDF_HEADERS_TRAMO.length);
  });
});

describe("etiquetaDeTramo, the 'Tramo:' line of the file's header", () => {
  const TRAMO: Tramo = {
    id: 14, nombre: "Potosí – Sucre",
    ciudades: [{ id: 11, name: "Potosí", lat: null, lng: null }, { id: 12, name: "Sucre", lat: null, lng: null }],
    id_departamento: null, departamento: null, archivado: false,
  };

  it("is the name the server built, not two city names put together here", () => {
    expect(etiquetaDeTramo(TRAMO)).toBe("Potosí – Sucre");
  });

  it("says 'Total' when the report was generated for the whole network", () => {
    expect(etiquetaDeTramo(null)).toBe("Total");
  });

  it("keeps an archived tramo's name: it was what the rows were generated for", () => {
    expect(etiquetaDeTramo({ ...TRAMO, archivado: true })).toBe("Potosí – Sucre");
  });
});
