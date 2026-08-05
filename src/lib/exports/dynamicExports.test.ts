import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import type { ReportResult } from "../../api/generador.api";

// Capture what would have been written to disk.
const saved: { blob: Blob; name: string }[] = [];
vi.mock("file-saver", () => ({
  saveAs: (blob: Blob, name: string) => { saved.push({ blob, name }); },
}));

const { exportDynamicExcel, cellValue, toZonedExcelDate, reportFileName } = await import("./dynamicExcel");
const { exportDynamicPdf, chunkColumns, toWinAnsi } = await import("./dynamicPdf");

const result = (over: Partial<ReportResult> = {}): ReportResult => ({
  columns: [
    { key: "c0", label: "Descripción", kind: "string" },
    { key: "c1", label: "Fecha", kind: "date" },
    { key: "c2", label: "Criticidad del evento", kind: "number", semantic: "criticality" },
  ],
  rows: [
    { c0: "Poste inclinado", c1: "2026-03-15T02:00:00.000Z", c2: 1 },
    { c0: null, c1: null, c2: 9 },
  ],
  total: 2,
  limit: 100,
  offset: 0,
  ...over,
});

/** Reads back the workbook that was handed to saveAs. */
async function readBack(): Promise<ExcelJS.Worksheet> {
  const buffer = await saved[saved.length - 1].blob.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb.worksheets[0];
}

beforeEach(() => { saved.length = 0; });

describe("cellValue", () => {
  it("keeps numbers numeric and rejects the non-finite ones", () => {
    // Infinity is not a valid xsd:double; Excel reports the file as damaged.
    expect(cellValue(42, "number")).toBe(42);
    // Kept as the original text rather than the invalid xsd:double "Infinity".
    expect(cellValue("1e400", "number")).toBe("1e400");
    expect(typeof cellValue("1e400", "number")).toBe("string");
  });

  it("never writes a stored image path", () => {
    // Photos are served unauthenticated, so a path is a public URL.
    expect(cellValue("/1778185422691_foto.webp", "image")).toBe("Sí");
  });

  it("renders booleans the same way the screen does", () => {
    expect(cellValue(true, "boolean")).toBe("Sí");
    expect(cellValue(0, "boolean")).toBe("No");
  });

  it("leaves an unparseable date as text rather than a wrong date", () => {
    expect(cellValue("no es fecha", "date")).toBe("no es fecha");
  });

  it("falls back to text for dates outside Excel's range", () => {
    expect(typeof cellValue("0001-01-01T00:00:00Z", "date")).toBe("string");
    expect(cellValue("2026-03-15T12:00:00Z", "date")).toBeInstanceOf(Date);
  });

  it("treats empty values as empty cells", () => {
    for (const empty of [null, undefined, ""]) {
      expect(cellValue(empty, "string")).toBeNull();
    }
  });
});

describe("toZonedExcelDate", () => {
  it("shifts an instant so the sheet shows the report's zone", () => {
    // 02:00 UTC is the previous day in La Paz. Written raw, the spreadsheet
    // said 15/03 while the preview and the PDF said 14/03.
    const shifted = toZonedExcelDate(new Date("2026-03-15T02:00:00.000Z"));
    expect(shifted?.getUTCDate()).toBe(14);
    expect(shifted?.getUTCMonth()).toBe(2);
  });

  it("returns null outside Excel's representable range", () => {
    expect(toZonedExcelDate(new Date("0001-01-01T00:00:00Z"))).toBeNull();
  });
});

describe("exportDynamicExcel", () => {
  it("colours rows from the declared semantic, not from the label", async () => {
    await exportDynamicExcel(result(), { title: "Prueba" });
    const sheet = await readBack();
    // Row 5 is the first data row; criticality 1 is the catastrophic tint.
    const fill = sheet.getCell(5, 1).fill as ExcelJS.FillPattern;
    expect(fill.fgColor?.argb).toBe("FFFAD7D7");
  });

  it("ignores a column merely called criticality", async () => {
    await exportDynamicExcel(
      result({
        columns: [
          { key: "c0", label: "Revisiones con criticidad", kind: "number" },
          { key: "c1", label: "Nombre", kind: "string" },
        ],
        rows: [{ c0: 1, c1: "x" }],
      }),
      { title: "Prueba" },
    );
    const sheet = await readBack();
    const fill = sheet.getCell(5, 1).fill as ExcelJS.FillPattern | undefined;
    // First data row: banding starts on the second, so no fill at all.
    expect(fill?.fgColor?.argb).toBeUndefined();
  });

  it("marks a partial export in the subtitle", async () => {
    await exportDynamicExcel(result({ total: 4300 }), { title: "Prueba" });
    const sheet = await readBack();
    expect(String(sheet.getCell(2, 1).value)).toContain("PARCIAL: 2 de 4300");
  });

  it("does not cry partial when everything is there", async () => {
    await exportDynamicExcel(result(), { title: "Prueba" });
    const sheet = await readBack();
    expect(String(sheet.getCell(2, 1).value)).not.toContain("PARCIAL");
  });

  it("gives every data row an explicit height", async () => {
    // Without one, wrapText grows a row to Excel's 409-point maximum.
    await exportDynamicExcel(result(), { title: "Prueba" });
    const sheet = await readBack();
    expect(sheet.getRow(5).height).toBe(30);
  });

  it("sizes date columns for what is displayed, not the ISO string", async () => {
    await exportDynamicExcel(result(), { title: "Prueba" });
    const sheet = await readBack();
    // "15/03/2026" is ten characters; the raw value is twenty-four.
    expect(sheet.getColumn(2).width).toBeLessThanOrEqual(14);
  });

  it("survives zero rows and a single column", async () => {
    await exportDynamicExcel(
      { columns: [{ key: "c0", label: "Solo", kind: "string" }], rows: [], total: 0, limit: 100, offset: 0 },
      { title: "Vacío" },
    );
    const sheet = await readBack();
    expect(sheet.getCell(4, 1).value).toBe("Solo");
    expect(sheet.autoFilter).toBeFalsy();
  });

  it("names the file with a timestamp down to the second", async () => {
    await exportDynamicExcel(result(), { title: "Mensual" });
    expect(saved[0].name).toMatch(/^Mensual_\d{2}-\d{2}-\d{4}_\d{2}-\d{2}-\d{2}\.xlsx$/);
  });
});

describe("chunkColumns", () => {
  it("splits a wide report into readable parts", () => {
    const columns = Array.from({ length: 60 }, (_, i) => i);
    const chunks = chunkColumns(columns);
    expect(chunks.length).toBeGreaterThan(1);
    // No part may exceed what fits at the minimum readable width.
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(15);
    expect(chunks.flat()).toEqual(columns);
  });

  it("leaves a narrow report in one piece", () => {
    expect(chunkColumns([1, 2, 3])).toEqual([[1, 2, 3]]);
  });

  it("returns one empty group for no columns", () => {
    expect(chunkColumns([])).toEqual([[]]);
  });
});

describe("toWinAnsi", () => {
  it("keeps Spanish text untouched", () => {
    expect(toWinAnsi("Descripción «áéíóú» ñÑ °")).toBe("Descripción «áéíóú» ñÑ °");
  });

  it("transliterates the symbols the reports use", () => {
    expect(toWinAnsi("✓ pendiente → resuelto")).toBe("Si pendiente -> resuelto");
    expect(toWinAnsi("—")).toBe("-");
  });

  it("replaces what the font cannot encode instead of corrupting the cell", () => {
    // A single emoji used to turn the whole string into raw UTF-16 bytes.
    expect(toWinAnsi("poste 😀 caído")).toBe("poste ? caído");
    expect(toWinAnsi("中文")).toBe("??");
  });
});

describe("exportDynamicPdf", () => {
  it("names both exports the same way", () => {
    expect(reportFileName("Mensual", "pdf"))
      .toMatch(/^Mensual_\d{2}-\d{2}-\d{4}_\d{2}-\d{2}-\d{2}\.pdf$/);
    expect(reportFileName("Con/barras:y*asteriscos", "xlsx"))
      .toMatch(/^Con barras y asteriscos_/);
    expect(reportFileName("///", "pdf")).toMatch(/^Reporte_/);
  });

  it("does not throw on a wide report", () => {
    const columns = Array.from({ length: 60 }, (_, i) => ({
      key: `c${i}`, label: `Columna número ${i} bastante larga`, kind: "string" as const,
    }));
    const rows = [Object.fromEntries(columns.map((c) => [c.key, "valor"]))];
    expect(() => exportDynamicPdf({ columns, rows, total: 1, limit: 100, offset: 0 }, { title: "Ancho" }))
      .not.toThrow();
  });

  it("does not throw on an empty report", () => {
    expect(() => exportDynamicPdf(
      { columns: [{ key: "c0", label: "Solo", kind: "string" }], rows: [], total: 0, limit: 100, offset: 0 },
      { title: "Vacío" },
    )).not.toThrow();
  });
});
