// The two numbers this panel decides, and why they moved.
//
// The colour bands used to be green ≤1 day, amber ≤7, red above. Those were
// calibrated against a figure that measured the wrong thing: days until the
// last site visit, not days until the repair. Now that the panel measures the
// repair, the real median is 31 days — every tramo would have gone red and the
// colour would have stopped carrying information. Isaias set the bands at
// green ≤15, amber ≤45.
//
// The discard notice exists because the historical data contains eventos whose
// repair is dated before the fault. They used to be clamped to "0 days", which
// is how a third of the closed eventos were published as instantaneous. They
// are dropped now, and a panel that silently drops rows is a panel that lies by
// omission — so it has to say how many, and in words that a reader who has
// never seen the database can act on.

import { describe, it, expect } from "vitest";
import { diasColor, textoDescartados } from "./ReportTiemposSec";

describe("diasColor", () => {
  it("es verde hasta quince días inclusive", () => {
    expect(diasColor(0)).toContain("green");
    expect(diasColor(15)).toContain("green");
  });

  it("pasa a ámbar en el día dieciséis", () => {
    expect(diasColor(16)).toContain("amber");
    expect(diasColor(45)).toContain("amber");
  });

  it("pasa a rojo por encima de cuarenta y cinco", () => {
    expect(diasColor(46)).toContain("red");
    expect(diasColor(400)).toContain("red");
  });

  it("la mediana real de la red no pinta el panel entero de rojo", () => {
    // 31 days is the measured median. Under the old bands this was red, which
    // is the whole reason the thresholds moved.
    expect(diasColor(31)).toContain("amber");
  });
});

describe("textoDescartados", () => {
  it("no dice nada cuando no se descartó ningún evento", () => {
    expect(textoDescartados(0)).toBeNull();
  });

  it("avisa en singular de un evento descartado", () => {
    const texto = textoDescartados(1);
    expect(texto).toContain("1 evento");
    expect(texto).not.toContain("1 eventos");
  });

  it("avisa en plural y explica el motivo sin jerga", () => {
    const texto = textoDescartados(37);
    expect(texto).toContain("37 eventos");
    // The reader has to learn WHY they are out, not just that they are.
    expect(texto).toMatch(/antes/i);
  });
});
