import { describe, expect, it } from "vitest";
import type { TramoConCifras } from "../../../../api/Tramo.api";
import { ESTADO_INICIAL, reducir, tramoEntre, tramosDeCiudad, type EstadoRed } from "./redEstado";

const nuevo = (cambios: Partial<EstadoRed> = {}): EstadoRed => ({ ...ESTADO_INICIAL, modo: "tramoNuevo", ...cambios });

describe("reducir: modo", () => {
  it("clears the chosen cities and the draft", () => {
    const sucio: EstadoRed = { modo: "seleccionar", elegidas: [1, 2], borrador: { lat: 1, lng: 2 } };
    expect(reducir(sucio, { tipo: "modo", modo: "ciudadNueva" })).toEqual({
      modo: "ciudadNueva", elegidas: [], borrador: null,
    });
  });


  it("leaves the starting city as the only chosen one when `desde` is given", () => {
    const s = reducir(ESTADO_INICIAL, { tipo: "modo", modo: "tramoNuevo", desde: 7 });
    expect(s.modo).toBe("tramoNuevo");
    expect(s.elegidas).toEqual([7]);
  });
});

describe("reducir: elegir", () => {
  it("adds a city while fewer than two are chosen", () => {
    const uno = reducir(nuevo(), { tipo: "elegir", id: 1 });
    expect(uno.elegidas).toEqual([1]);
    expect(reducir(uno, { tipo: "elegir", id: 2 }).elegidas).toEqual([1, 2]);
  });

  it("removes a city that was already chosen", () => {
    expect(reducir(nuevo({ elegidas: [1, 2] }), { tipo: "elegir", id: 1 }).elegidas).toEqual([2]);
  });

  it("replaces the second one when two are chosen and a third is clicked", () => {
    expect(reducir(nuevo({ elegidas: [1, 2] }), { tipo: "elegir", id: 3 }).elegidas).toEqual([1, 3]);
  });

  it("does nothing outside tramoNuevo", () => {
    const s: EstadoRed = { ...ESTADO_INICIAL, modo: "seleccionar", elegidas: [5] };
    expect(reducir(s, { tipo: "elegir", id: 1 })).toEqual(s);
    const c: EstadoRed = { ...ESTADO_INICIAL, modo: "ciudadNueva" };
    expect(reducir(c, { tipo: "elegir", id: 1 })).toEqual(c);
  });
});

describe("reducir: fijar", () => {
  it("sets a city in an empty slot", () => {
    expect(reducir(nuevo(), { tipo: "fijar", hueco: 0, id: 4 }).elegidas).toEqual([4]);
    expect(reducir(nuevo({ elegidas: [4] }), { tipo: "fijar", hueco: 1, id: 5 }).elegidas).toEqual([4, 5]);
  });

  it("replaces the city of the slot it is given", () => {
    expect(reducir(nuevo({ elegidas: [4, 5] }), { tipo: "fijar", hueco: 1, id: 9 }).elegidas).toEqual([4, 9]);
    expect(reducir(nuevo({ elegidas: [4, 5] }), { tipo: "fijar", hueco: 0, id: 9 }).elegidas).toEqual([9, 5]);
  });

  it("clears a slot with null, leaving no null behind", () => {
    expect(reducir(nuevo({ elegidas: [4, 5] }), { tipo: "fijar", hueco: 0, id: null }).elegidas).toEqual([5]);
    expect(reducir(nuevo({ elegidas: [4, 5] }), { tipo: "fijar", hueco: 1, id: null }).elegidas).toEqual([4]);
  });

  it("leaves a single city when the same one is put in both slots", () => {
    expect(reducir(nuevo({ elegidas: [4, 5] }), { tipo: "fijar", hueco: 1, id: 4 }).elegidas).toEqual([4]);
    expect(reducir(nuevo({ elegidas: [4, 5] }), { tipo: "fijar", hueco: 0, id: 5 }).elegidas).toEqual([5]);
  });
});

describe("reducir: borrador y arrastre", () => {
  it("sets the draft only in ciudadNueva", () => {
    const punto = { lat: -17.4, lng: -66.1 };
    const en = reducir({ ...ESTADO_INICIAL, modo: "ciudadNueva" }, { tipo: "borrador", punto });
    expect(en.borrador).toEqual(punto);
    const fuera = reducir(nuevo(), { tipo: "borrador", punto });
    expect(fuera.borrador).toBeNull();
  });

});

// A new city is a step of the tramo that lacks it: it is entered from that
// tramo and every way out of it leads back there.
describe("reducir: la ciudad que le falta a un tramo", () => {
  const enCiudad = (cambios: Partial<EstadoRed> = {}): EstadoRed => ({ ...ESTADO_INICIAL, modo: "ciudadNueva", ...cambios });

  it("goes to place a city from the tramo being drawn, keeping what was picked", () => {
    expect(reducir(nuevo({ elegidas: [4] }), { tipo: "ciudadParaTramo" })).toEqual(enCiudad({ elegidas: [4] }));
  });

  it("is not entered from anywhere but a new tramo", () => {
    expect(reducir(ESTADO_INICIAL, { tipo: "ciudadParaTramo" })).toBe(ESTADO_INICIAL);
  });

  it("goes back to the tramo as it was when no city was made, and drops the draft", () => {
    const antes = enCiudad({ elegidas: [4], borrador: { lat: 1, lng: 2 } });
    expect(reducir(antes, { tipo: "volverAlTramo" })).toEqual(nuevo({ elegidas: [4] }));
  });

  it("goes back with the new city in the free slot", () => {
    expect(reducir(enCiudad(), { tipo: "volverAlTramo", nueva: 8 }).elegidas).toEqual([8]);
    expect(reducir(enCiudad({ elegidas: [4] }), { tipo: "volverAlTramo", nueva: 8 }).elegidas).toEqual([4, 8]);
  });

  it("replaces the second city when both were taken, as a click on a third does", () => {
    expect(reducir(enCiudad({ elegidas: [4, 1] }), { tipo: "volverAlTramo", nueva: 8 }).elegidas).toEqual([4, 8]);
  });

  it("does not pick the same city twice when the one named was already picked", () => {
    // «Usarla en el tramo» on a name that turned out to exist.
    expect(reducir(enCiudad({ elegidas: [4] }), { tipo: "volverAlTramo", nueva: 4 }).elegidas).toEqual([4]);
  });

  it("is ignored outside the new-city step: a late answer cannot start a tramo", () => {
    expect(reducir(ESTADO_INICIAL, { tipo: "volverAlTramo", nueva: 8 })).toBe(ESTADO_INICIAL);
    const dibujando = nuevo({ elegidas: [4] });
    expect(reducir(dibujando, { tipo: "volverAlTramo", nueva: 8 })).toBe(dibujando);
  });
});

describe("reducir: terminar", () => {
  it("goes back to the initial state with everything cleared", () => {
    const sucio = nuevo({ elegidas: [1, 2], borrador: { lat: 1, lng: 1 } });
    expect(reducir(sucio, { tipo: "terminar" })).toEqual(ESTADO_INICIAL);
  });
});

const ciudad = (id: number) => ({ id, name: `C${id}`, lat: 0, lng: 0 });
const tramo = (id: number, a: number, b: number): TramoConCifras => ({
  id, nombre: `T${id}`, id_departamento: null, departamento: null, archivado: false,
  ciudades: [ciudad(a), ciudad(b)],
});

describe("tramoEntre", () => {
  const tramos = [tramo(1, 10, 20), tramo(2, 10, 30), tramo(3, 40, 50)];

  it("finds the pair whichever way round it is asked", () => {
    expect(tramoEntre(tramos, 10, 20)?.id).toBe(1);
    expect(tramoEntre(tramos, 20, 10)?.id).toBe(1);
  });

  it("does not confuse a tramo that shares only one city", () => {
    expect(tramoEntre(tramos, 20, 30)).toBeUndefined();
    expect(tramoEntre(tramos, 10, 99)).toBeUndefined();
  });

  it("skips a tramo whose cities are malformed instead of throwing", () => {
    const roto = { ...tramo(9, 1, 2), ciudades: undefined } as unknown as TramoConCifras;
    expect(tramoEntre([roto, ...tramos], 10, 20)?.id).toBe(1);
  });
});

describe("tramosDeCiudad", () => {
  it("returns every tramo that touches the city, at either end", () => {
    const tramos = [tramo(1, 10, 20), tramo(2, 30, 10), tramo(3, 40, 50)];
    expect(tramosDeCiudad(tramos, 10).map((t) => t.id)).toEqual([1, 2]);
    expect(tramosDeCiudad(tramos, 50).map((t) => t.id)).toEqual([3]);
    expect(tramosDeCiudad(tramos, 99)).toEqual([]);
  });
});
