import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ReportResult } from "../../api/generador.api";
import { getCriticalityMeta } from "../criticality";

// The hand-written exporters (reportGeneral, reportTramo) hard-code their column
// map. This one receives whatever columns the user chose and builds the layout
// at run time, keeping the same visual language: navy header, banded rows,
// frozen headings and colour by criticality.

const CLR = {
  navy: "FF001F5D",
  white: "FFFFFFFF",
  headerBg: "FF001F5D",
  band: "FFF4F6FB",
  border: "FFD0D7EF",
  text: "FF1F2937",
  muted: "FF6B7280",
} as const;

/** Criticality 1 is catastrophic and 9 is maintenance; keep the same reading. */
const CRITICALITY_FILL: Record<number, string> = {
  1: "FFFAD7D7",
  2: "FFFDE8D0",
  3: "FFFDF0DA",
  4: "FFFEF9E0",
  5: "FFF2F8E0",
  6: "FFE4F5E9",
  7: "FFE0F3F3",
  8: "FFE0F0F8",
  9: "FFE8EEF8",
};

const thin = { style: "thin" as const, color: { argb: CLR.border } };

const timestamp = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
};

/** Excel keeps dates as dates so the user can sort and filter them as such. */
const cellValue = (raw: unknown, kind: string): string | number | Date | null => {
  if (raw === null || raw === undefined || raw === "") return null;
  switch (kind) {
    case "number": {
      const n = Number(raw);
      return Number.isNaN(n) ? String(raw) : n;
    }
    case "date": {
      const d = new Date(String(raw));
      return Number.isNaN(d.getTime()) ? String(raw) : d;
    }
    case "boolean":
      return raw === true || raw === "true" ? "Sí" : "No";
    case "image":
      // Never write the stored path. Photos are served from an unauthenticated
      // static root, so a raw path turns the spreadsheet into a list of
      // publicly fetchable field photographs. The PDF already prints "Sí".
      return "Sí";
    default:
      return String(raw);
  }
};

export interface DynamicExportOptions {
  /** Report name, used as the sheet title and the file name. */
  title: string;
  /** One-line description of what the report contains. */
  subtitle?: string;
}

export async function exportDynamicExcel(
  result: ReportResult,
  options: DynamicExportOptions,
): Promise<void> {
  const { columns, rows } = result;
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Reporte", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  const lastCol = Math.max(1, columns.length);

  // Row 1: title. Row 2: subtitle. Row 3: blank. Row 4: headers. Row 5+: data.
  sheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = options.title;
  titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: CLR.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CLR.navy } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(2, 1, 2, lastCol);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = options.subtitle
    ? `${options.subtitle}  ·  ${rows.length} de ${result.total} registros  ·  Generado el ${new Date().toLocaleDateString("es-BO")}`
    : `${rows.length} de ${result.total} registros  ·  Generado el ${new Date().toLocaleDateString("es-BO")}`;
  subtitleCell.font = { name: "Segoe UI", size: 9, color: { argb: CLR.muted } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(2).height = 18;

  const headerRow = sheet.getRow(4);
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: CLR.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CLR.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: column.kind === "number" ? "right" : "left", wrapText: true };
    cell.border = { top: thin, left: thin, bottom: thin, right: thin };
  });
  headerRow.height = 22;

  // Colour whole rows by criticality when the report happens to include it.
  const criticalityKey = columns.find((c) =>
    c.label.toLowerCase().includes("criticidad"),
  )?.key;

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    const level = criticalityKey ? Number(row[criticalityKey]) : NaN;
    const fill = Number.isFinite(level) ? CRITICALITY_FILL[level] : undefined;

    columns.forEach((column, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1);
      cell.value = cellValue(row[column.key], column.kind);
      cell.font = { name: "Segoe UI", size: 10, color: { argb: CLR.text } };
      cell.border = { top: thin, left: thin, bottom: thin, right: thin };
      cell.alignment = {
        vertical: "top",
        horizontal: column.kind === "number" ? "right" : "left",
        wrapText: column.kind === "string",
      };
      if (column.kind === "date") cell.numFmt = "dd/mm/yyyy";
      const background = fill ?? (rowIndex % 2 === 1 ? CLR.band : undefined);
      if (background) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: background } };
      }
    });
  });

  // Width from the longest visible value, bounded so one long description does
  // not push everything else off screen.
  columns.forEach((column, index) => {
    const longest = rows.reduce((max, row) => {
      const text = row[column.key];
      const length = text === null || text === undefined ? 0 : String(text).length;
      return Math.max(max, length);
    }, column.label.length);
    sheet.getColumn(index + 1).width = Math.min(48, Math.max(10, longest + 2));
  });

  if (columns.length > 0 && rows.length > 0) {
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: lastCol } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = options.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 60);
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${safeName}_${timestamp()}.xlsx`,
  );
}

/** Exposed for tests and for the PDF exporter, which needs the same reading. */
export const criticalityLabel = (level: unknown): string =>
  getCriticalityMeta(typeof level === "number" ? level : null).label;
