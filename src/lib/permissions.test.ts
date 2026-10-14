import { describe, it, expect } from "vitest";
import { MODULOS, PERMISOS } from "./permissions";

describe("the module list", () => {
  it("mirrors the server's tramos module, right under ciudades", () => {
    expect(PERMISOS.tramos).toEqual(["ver", "crear", "editar", "archivar"]);
    expect(MODULOS.indexOf("tramos")).toBeGreaterThan(-1);
    expect(MODULOS.indexOf("tramos")).toBe(MODULOS.indexOf("ciudades") + 1);
  });
});
