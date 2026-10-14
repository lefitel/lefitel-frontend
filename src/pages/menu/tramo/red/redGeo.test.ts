import { describe, expect, it } from "vitest";
import type { CiudadDeRed, TramoConCifras } from "../../../../api/Tramo.api";
import { encuadre, extremosDelTramo } from "./redGeo";

const CIUDADES: CiudadDeRed[] = [
  { id: 1, name: "Uno", lat: -17, lng: -65, image: null },
  { id: 2, name: "Dos", lat: -18, lng: -64, image: null },
  { id: 3, name: "Tres", lat: -19, lng: -63, image: null },
  { id: 4, name: "Cuatro", lat: -20, lng: -62, image: null },
  { id: 5, name: "Sin sitio", lat: null, lng: null, image: null },
];

const tramo = (id: number, a: number, b: number): TramoConCifras => ({
  id, nombre: `${a}-${b}`, id_departamento: null, departamento: null, archivado: false,
  ciudades: [{ id: a, name: null, lat: null, lng: null }, { id: b, name: null, lat: null, lng: null }],
});

// A live tramo may end in an archived city, which `ciudades` (live ones only) lacks:
// the tramo itself carries where that end is.
const ARCHIVADA = { id: 9, name: "Archivada", lat: -30, lng: -70 };
const conExtremo = (id: number, viva: number, archivada: typeof ARCHIVADA): TramoConCifras => ({
  ...tramo(id, viva, archivada.id),
  ciudades: [{ id: viva, name: null, lat: null, lng: null }, archivada],
});

const TRAMOS = [tramo(10, 1, 2), tramo(11, 2, 3), tramo(12, 3, 5), tramo(13, 3, 4)];

const T = (id: number) => TRAMOS.find((t) => t.id === id)!;

describe("extremosDelTramo", () => {
  it("answers the two ends in the tramo's order, and null when an end has no coordinates", () => {
    expect(extremosDelTramo(T(10), CIUDADES)).toEqual([{ lat: -17, lng: -65 }, { lat: -18, lng: -64 }]);
    expect(extremosDelTramo(T(12), CIUDADES)).toBeNull();
  });
});

describe("a tramo that ends in an archived city", () => {
  const tramos = [conExtremo(20, 1, ARCHIVADA)];

  it("takes that end from the position the tramo carries", () => {
    expect(extremosDelTramo(tramos[0], CIUDADES)).toEqual([{ lat: -17, lng: -65 }, { lat: -30, lng: -70 }]);
  });

  it("prefers the live list over what the tramo carries", () => {
    const vieja = { ...ARCHIVADA, id: 2, lat: -1, lng: -2 };

    expect(extremosDelTramo(conExtremo(21, 1, vieja), CIUDADES)).toEqual([{ lat: -17, lng: -65 }, { lat: -18, lng: -64 }]);
  });

  it("answers null when the carried position is missing too", () => {
    const sinSitio = conExtremo(22, 1, { ...ARCHIVADA, lat: null as unknown as number, lng: null as unknown as number });

    expect(extremosDelTramo(sinSitio, CIUDADES)).toBeNull();
  });

  it("is framed by its two ends when it is selected", () => {
    expect(encuadre({ tramos, ciudades: CIUDADES, tramoSel: 20, ciudadSel: null })).toEqual([
      { lat: -17, lng: -65 }, { lat: -30, lng: -70 },
    ]);
  });

  it("puts the archived end in the frame of the live city it is joined to", () => {
    const puntos = encuadre({ tramos, ciudades: CIUDADES, tramoSel: null, ciudadSel: 1 });

    expect(puntos).toHaveLength(2);
    expect(puntos).toContainEqual({ lat: -17, lng: -65 });
    expect(puntos).toContainEqual({ lat: -30, lng: -70 });
  });
});

describe("encuadre", () => {
  const args = { tramos: TRAMOS, ciudades: CIUDADES };

  it("frames the two ends of the selected tramo", () => {
    expect(encuadre({ ...args, tramoSel: 11, ciudadSel: null })).toEqual([
      { lat: -18, lng: -64 }, { lat: -19, lng: -63 },
    ]);
  });

  it("frames the selected city and the cities it is joined to", () => {
    const puntos = encuadre({ ...args, tramoSel: null, ciudadSel: 2 });
    expect(puntos).toHaveLength(3);
    expect(puntos).toContainEqual({ lat: -18, lng: -64 });
    expect(puntos).toContainEqual({ lat: -17, lng: -65 });
    expect(puntos).toContainEqual({ lat: -19, lng: -63 });
    expect(puntos).not.toContainEqual({ lat: -20, lng: -62 });
  });

  it("frames every city that has coordinates when nothing is selected", () => {
    const puntos = encuadre({ ...args, tramoSel: null, ciudadSel: null });
    expect(puntos).toHaveLength(4);
    expect(puntos).not.toContainEqual({ lat: null, lng: null });
  });

  it("frames every city when the selected tramo id is not in the list", () => {
    expect(encuadre({ ...args, tramoSel: 999, ciudadSel: null })).toHaveLength(4);
  });

  it("frames nothing when the selected city id is not in the list (as it stands)", () => {
    expect(encuadre({ ...args, tramoSel: null, ciudadSel: 999 })).toEqual([]);
  });
});
