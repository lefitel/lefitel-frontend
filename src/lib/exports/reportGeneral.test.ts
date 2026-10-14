// The General report's rows, and the one cell that used to be built from two
// city names.
//
// The server stopped sending `ciudadA`/`ciudadB` on a pole and sends its
// `tramo` instead. The cell is that tramo's name as the server built it; it is
// never put together here, so a tramo whose cities were renamed reads the same
// in the file as it does on every screen.

import { describe, it, expect } from "vitest";
import { PDF_HEADERS_GENERAL, toRowsGeneral } from "./reportGeneral";
import type { EventoInterface } from "../../interfaces/interfaces";

const TRAMO = {
  id: 14, nombre: "Potosí – Sucre",
  ciudades: [{ id: 11, name: "Potosí", lat: null, lng: null }, { id: 12, name: "Sucre", lat: null, lng: null }],
  id_departamento: null, departamento: null, archivado: false,
};

const evento = (poste: Record<string, unknown> | undefined) =>
  ({
    id: 1, description: "Cable caído", date: new Date("2026-02-01"), state: false, priority: false,
    image: "", id_poste: 5, id_usuario: 1, poste, revisions: [], solucions: [],
  }) as unknown as EventoInterface;

const COLUMNA_TRAMO = PDF_HEADERS_GENERAL.indexOf("Tramo");

describe("toRowsGeneral, the tramo cell", () => {
  it("is the name the server built for the pole's tramo", () => {
    const [fila] = toRowsGeneral([evento({ id: 5, name: "P-5", lat: -19, lng: -65, id_tramo: 14, tramo: TRAMO })]);

    expect(fila[COLUMNA_TRAMO]).toBe("Potosí – Sucre");
  });

  it("is empty for a pole that came without a tramo, not a dash between two blanks", () => {
    const [sin] = toRowsGeneral([evento({ id: 5, name: "P-5", lat: -19, lng: -65 })]);
    const [sinPoste] = toRowsGeneral([evento(undefined)]);

    expect(sin[COLUMNA_TRAMO]).toBe("");
    expect(sinPoste[COLUMNA_TRAMO]).toBe("");
  });

  it("writes one column per header", () => {
    const [fila] = toRowsGeneral([evento({ id: 5, name: "P-5", tramo: TRAMO })]);

    expect(fila).toHaveLength(PDF_HEADERS_GENERAL.length);
  });
});
