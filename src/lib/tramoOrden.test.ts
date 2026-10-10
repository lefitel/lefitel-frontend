// The line of a stretch has to pass through its poles one after another.
//
// It did not for pole 2425: San Pablo and Trinidad are both stored at
// -63.166498, -63.166498 — the map's own example longitude, in both fields — so
// the old sort along the line from city A to city B measured every pole as
// zero and left the 94 of them in the order they were registered.

import { describe, expect, it } from "vitest";
import { ordenarTramo } from "./tramoOrden";

type Poste = { name: string; lat: number; lng: number };
const poste = (name: string, lat: number, lng: number): Poste => ({ name, lat, lng });
const nombres = (ps: Poste[]) => ps.map((p) => p.name).join(" ");

/** Poles along a road heading west, about a kilometre apart, handed over out of order. */
const RECTA = [
  poste("p3", -15.0, -64.03), poste("p1", -15.0, -64.01), poste("p5", -15.0, -64.05),
  poste("p2", -15.0, -64.02), poste("p4", -15.0, -64.04),
];
const ESTE = { lat: -15.0, lng: -64.0 };
const OESTE = { lat: -15.0, lng: -64.06 };
/** What thirteen cities hold instead of a position. */
const RELLENO = { lat: -63.166498, lng: -63.166498 };

describe("the order of a stretch's poles", () => {
  it("runs from city A to city B", () => {
    const t = ordenarTramo(RECTA, ESTE, OESTE);

    expect(nombres(t.postes)).toBe("p1 p2 p3 p4 p5");
    expect(t.linea[0]).toEqual([ESTE.lat, ESTE.lng]);
    expect(t.linea.at(-1)).toEqual([OESTE.lat, OESTE.lng]);
    expect(t.linea).toHaveLength(7);
    // The routing service takes longitude first.
    expect(t.waypoints[0]).toEqual([ESTE.lng, ESTE.lat]);
  });

  it("still goes pole to pole when both cities hold the placeholder", () => {
    const t = ordenarTramo(RECTA, RELLENO, RELLENO);

    // West to east: with no city to start from, the same stretch always reads
    // the same way.
    expect(nombres(t.postes)).toBe("p5 p4 p3 p2 p1");
    // And the line is not drawn out to a point in the Southern Ocean.
    expect(t.inicio).toBeNull();
    expect(t.fin).toBeNull();
    expect(t.linea).toHaveLength(5);
    expect(t.descartados).toEqual([]);
  });

  it("starts at the far end from the one city that can be trusted", () => {
    const t = ordenarTramo(RECTA, RELLENO, OESTE);

    expect(nombres(t.postes)).toBe("p1 p2 p3 p4 p5");
    expect(t.inicio).toBeNull();
    expect(t.fin).toEqual(OESTE);
  });

  it("follows a bend, which a straight line between the cities cannot", () => {
    // East along one road, then north along another, the far city straight
    // north of the last pole. Projected on the diagonal from A to B the two
    // arms interleave: e2 and n1 measure the same.
    const curva = [
      poste("n2", -14.98, -64.0), poste("e1", -15.0, -64.03), poste("n1", -14.99, -64.0),
      poste("e3", -15.0, -64.01), poste("e2", -15.0, -64.02), poste("n3", -14.97, -64.0),
    ];
    const t = ordenarTramo(curva, { lat: -15.0, lng: -64.04 }, { lat: -14.96, lng: -64.0 });

    expect(nombres(t.postes)).toBe("e1 e2 e3 n1 n2 n3");
  });

  it("leaves out a pole that is nowhere near the stretch", () => {
    const lejos = poste("lejos", 15.0, -64.03); // the sign of its latitude lost
    const conCiudades = ordenarTramo([...RECTA, lejos], ESTE, OESTE);
    const sinCiudades = ordenarTramo([...RECTA, lejos], RELLENO, RELLENO);

    for (const t of [conCiudades, sinCiudades]) {
      expect(t.postes).toHaveLength(5);
      expect(nombres(t.descartados)).toBe("lejos");
      expect(t.linea.every(([lat]) => lat < 0)).toBe(true);
    }
  });

  it("keeps a real pole that merely stands far from the next one registered", () => {
    // Poles are registered as incidents happen: forty kilometres to the next
    // one is a gap in the register, not a mistake.
    const aislado = poste("aislado", -15.0, -64.45);
    const t = ordenarTramo([...RECTA, aislado], ESTE, { lat: -15.0, lng: -64.5 });

    expect(nombres(t.postes)).toBe("p1 p2 p3 p4 p5 aislado");
    expect(t.descartados).toEqual([]);
  });

  it("ignores poles with no position, and survives a stretch with none", () => {
    const sinPosicion = { name: "x", lat: 0, lng: 0 };

    expect(nombres(ordenarTramo([...RECTA, sinPosicion], ESTE, OESTE).postes)).toBe("p1 p2 p3 p4 p5");
    expect(ordenarTramo<Poste>([], ESTE, OESTE).linea).toEqual([[ESTE.lat, ESTE.lng], [OESTE.lat, OESTE.lng]]);
  });
});
