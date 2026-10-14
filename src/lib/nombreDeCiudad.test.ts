import { describe, expect, it } from "vitest";
import { nombreDeCiudad } from "./nombreDeCiudad";

describe("nombreDeCiudad", () => {
  it("gives the name as it is stored", () => {
    expect(nombreDeCiudad({ id: 4, name: "Camargo" })).toBe("Camargo");
  });

  it("falls back to #<id>, the way the server names a tramo, when the city has no name", () => {
    expect(nombreDeCiudad({ id: 4, name: null })).toBe("#4");
    expect(nombreDeCiudad({ id: 4, name: undefined })).toBe("#4");
  });

  it("treats a blank name as no name", () => {
    expect(nombreDeCiudad({ id: 4, name: "   " })).toBe("#4");
  });
});
