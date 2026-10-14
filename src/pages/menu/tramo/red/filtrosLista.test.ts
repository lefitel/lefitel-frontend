import { describe, expect, it } from "vitest";
import type { CiudadDeRed, TramoConCifras } from "../../../../api/Tramo.api";
import { ESTADO_INICIAL, type EstadoRed } from "./redEstado";
import { SIN_FILTROS, ciudadesDelMapa, tramoEncaja, type FiltrosLista } from "./filtrosLista";

const POTOSI = { id: 5, name: "Potosí" };
const CHUQUISACA = { id: 6, name: "Chuquisaca" };

const ciudad = (id: number, name: string): CiudadDeRed => ({ id, name, lat: -19, lng: -65, image: null });
const OLIVOS = ciudad(1, "Olivos");
const SUCRE = ciudad(2, "Sucre");
const NORTE = ciudad(3, "Norte");
const CAMARGO = ciudad(4, "Camargo");
// In no tramo at all.
const SUELTA = ciudad(9, "Suelta");
const CIUDADES = [OLIVOS, SUCRE, NORTE, CAMARGO, SUELTA];

const tramo = (id: number, a: CiudadDeRed, b: CiudadDeRed, dep: { id: number; name: string } | null): TramoConCifras => ({
  id, nombre: `${a.name} – ${b.name}`, ciudades: [a, b], id_departamento: dep?.id ?? null, departamento: dep, archivado: false,
});

const TRAMOS = [
  tramo(1, OLIVOS, SUCRE, null),
  tramo(2, CAMARGO, SUCRE, CHUQUISACA),
  tramo(3, NORTE, OLIVOS, POTOSI),
];

const por = (departamento: string): FiltrosLista => ({ ...SIN_FILTROS, departamento });

const nombres = (cambios: Partial<Parameters<typeof ciudadesDelMapa>[0]> = {}) =>
  ciudadesDelMapa({
    tramos: TRAMOS, ciudades: CIUDADES, filtros: SIN_FILTROS, estado: ESTADO_INICIAL, tramoSel: null, ciudadSel: null,
    ...cambios,
  }).map((c) => c.name);

describe("tramoEncaja", () => {
  it("lets every tramo through with no filter", () => {
    expect(TRAMOS.every((t) => tramoEncaja(t, SIN_FILTROS))).toBe(true);
  });

  it("keeps one department, or the tramos with none", () => {
    expect(TRAMOS.filter((t) => tramoEncaja(t, por("6"))).map((t) => t.id)).toEqual([2]);
    expect(TRAMOS.filter((t) => tramoEncaja(t, por("ninguno"))).map((t) => t.id)).toEqual([1]);
  });
});

describe("ciudadesDelMapa", () => {
  it("is the whole network with no department filter, a city in no tramo included", () => {
    expect(nombres()).toEqual(["Olivos", "Sucre", "Norte", "Camargo", "Suelta"]);
  });

  it("leaves only the cities at the ends of the tramos that fit", () => {
    expect(nombres({ filtros: por("6") })).toEqual(["Sucre", "Camargo"]);
    expect(nombres({ filtros: por("5") })).toEqual(["Olivos", "Norte"]);
    expect(nombres({ filtros: por("ninguno") })).toEqual(["Olivos", "Sucre"]);
  });

  it("keeps both ends of the selected tramo, though the filter leaves it out", () => {
    // Opened from the address, or selected before the filter was set.
    expect(nombres({ filtros: por("6"), tramoSel: 3 })).toEqual(["Olivos", "Sucre", "Norte", "Camargo"]);
  });

  it("keeps the selected city, though no tramo that fits touches it", () => {
    expect(nombres({ filtros: por("6"), ciudadSel: 9 })).toEqual(["Sucre", "Camargo", "Suelta"]);
  });

  it.each<[string, EstadoRed]>([
    ["a tramo is being added", { ...ESTADO_INICIAL, modo: "tramoNuevo" }],
    ["the city it lacks is being placed", { ...ESTADO_INICIAL, modo: "ciudadNueva" }],
  ])("shows the whole network while %s", (_, estado) => {
    // A new tramo may join two departments: a city that is hidden cannot be picked.
    expect(nombres({ filtros: por("6"), estado })).toHaveLength(CIUDADES.length);
  });
});
