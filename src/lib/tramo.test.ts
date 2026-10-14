import { describe, it, expect } from "vitest";
import { extremosDibujables, nombreDelTramo, puntoDe } from "./tramo";
import type { Tramo } from "../interfaces/interfaces";

const tramo = (extra: Partial<Tramo> = {}): Tramo => ({
  id: 14,
  nombre: "Potosí – Sucre",
  ciudades: [
    { id: 7, name: "Potosí", lat: -19.58, lng: -65.75 },
    { id: 3, name: "Sucre", lat: -19.04, lng: -65.26 },
  ],
  id_departamento: null,
  departamento: null,
  archivado: false,
  ...extra,
});

describe("nombreDelTramo", () => {
  it("shows the name the server sent, untouched", () => {
    expect(nombreDelTramo({ tramo: tramo() })).toBe("Potosí – Sucre");
  });

  it("is empty for a pole that came without its tramo, rather than throwing", () => {
    expect(nombreDelTramo({ tramo: null })).toBe("");
    expect(nombreDelTramo({})).toBe("");
    expect(nombreDelTramo(null)).toBe("");
  });
});

describe("puntoDe", () => {
  it("is a point only when both coordinates are real numbers", () => {
    expect(puntoDe({ id: 1, name: "A", lat: -19, lng: -65 })).toEqual({ lat: -19, lng: -65 });
    expect(puntoDe({ id: 1, name: "A", lat: null, lng: -65 })).toBeNull();
    expect(puntoDe({ id: 1, name: "A", lat: Number.NaN, lng: -65 })).toBeNull();
    expect(puntoDe(null)).toBeNull();
  });
});

describe("extremosDibujables", () => {
  it("hands back the two ends in the order of the name", () => {
    expect(extremosDibujables(tramo())).toEqual([{ lat: -19.58, lng: -65.75 }, { lat: -19.04, lng: -65.26 }]);
  });

  it("keeps the slot of an end that cannot be drawn, as null", () => {
    const t = tramo({ ciudades: [{ id: 7, name: "Potosí", lat: null, lng: null }, { id: 3, name: "Sucre", lat: -19.04, lng: -65.26 }] });
    expect(extremosDibujables(t)).toEqual([null, { lat: -19.04, lng: -65.26 }]);
  });

  it("is two nulls with no tramo", () => {
    expect(extremosDibujables(null)).toEqual([null, null]);
    expect(extremosDibujables(undefined)).toEqual([null, null]);
  });
});
