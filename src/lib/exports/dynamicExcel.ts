import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { FieldKind, ReportResult } from "../../api/generador.api";
import { REPORT_TIME_ZONE, formatValue } from "../reportConfig";

// The hand-written exporters (reportGeneral, reportTramo) hard-code their column
// map. This one receives whatever columns the user chose and builds the layout
// at run time, keeping the same visual language: navy header, banded rows,
// frozen headings and colour by criticality.

const CLR = {
  navy: "FF001F5D",
  white: "FFFFFFFF",
  band: "FFF4F6FB",
  border: "FFD0D7EF",
  text: "FF1F2937",
  muted: "FF6B7280",
} as const;

/** Criticality 1 is catastrophic and 9 is maintenance; keep the same reading. */
const CRITICALITY_FILL: Record<number, string> = {
  1: "FFFAD7D7", 2: "FFFDE8D0", 3: "FFFDF0DA", 4: "FFFEF9E0", 5: "FFF2F8E0",
  6: "FFE4F5E9", 7: "FFE0F3F3", 8: "FFE0F0F8", 9: "FFE8EEF8",
};

const thin = { style: "thin" as const, color: { argb: CLR.border } };

/** Excel's own limits, not ours. */
const MAX_CELL_TEXT = 32_767;
const MIN_DATE_SERIAL = 1;
const MAX_DATE_SERIAL = 2_958_465;

/**
 * File name for an exported report: title, then a timestamp down to the second
 * so two exports in the same minute do not collide.
 */
export function reportFileName(title: string, extension: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const stamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  // Strip the forbidden characters, then check for anything left: a title of
  // only slashes used to become "---" rather than falling back.
  const cleaned = title.replace(/[\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  const base = (cleaned || "Reporte").slice(0, 60);
  return `${base}_${stamp}.${extension}`;
}

const zoneParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hour12: false,
});

/**
 * Shifts an instant so ExcelJS writes the wall-clock time of the report's zone.
 *
 * ExcelJS converts a Date to a serial with `25569 + t / 86400000`, which is
 * UTC. The preview and the PDF format in America/La_Paz. An event stored at
 * 02:00 UTC therefore showed 05/08 in the spreadsheet and 04/08 everywhere
 * else — same report, two dates.
 */
export function toZonedExcelDate(d: Date): Date | null {
  // Range-check the instant itself: Intl cannot be trusted to round-trip years
  // outside the common era window, and it silently returned 1901 for year 1.
  const rawSerial = 25569 + d.getTime() / 86_400_000;
  if (!Number.isFinite(rawSerial) || rawSerial < MIN_DATE_SERIAL || rawSerial > MAX_DATE_SERIAL) {
    return null;
  }
  const parts = Object.fromEntries(
    zoneParts.formatToParts(d).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;
  const shifted = new Date(Date.UTC(
    parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second,
  ));
  return shifted;
}

/** Excel keeps dates and numbers native so the user can sort and filter them. */
const cellValue = (raw: unknown, kind: FieldKind): string | number | Date | null => {
  if (raw === null || raw === undefined || raw === "") return null;
  switch (kind) {
    case "number": {
      const n = Number(raw);
      // Infinity is not a valid xsd:double: Excel reports the file as damaged.
      return Number.isFinite(n) ? n : String(raw).slice(0, MAX_CELL_TEXT);
    }
    case "date": {
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) return String(raw).slice(0, MAX_CELL_TEXT);
      return toZonedExcelDate(d) ?? String(raw).slice(0, MAX_CELL_TEXT);
    }
    case "boolean":
      return formatValue(raw, "boolean");
    case "image":
      // Never write the stored path. Photos are served from an unauthenticated
      // static root, so a raw path turns the spreadsheet into a list of
      // publicly fetchable field photographs. The PDF already prints "Sí".
      return "Sí";
    default:
      return String(raw).slice(0, MAX_CELL_TEXT);
  }
};

/** Width from what the reader sees, not from the raw value. */
const displayWidth = (raw: unknown, kind: FieldKind): number => {
  if (raw === null || raw === undefined) return 0;
  switch (kind) {
    case "date": return 10;          // dd/mm/yyyy
    case "boolean": return 3;        // Sí / No
    case "image": return 3;
    default: return String(raw).length;
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
  const sheet = workbook.addWorksheet("Reporte", { views: [{ state: "frozen", ySplit: 4 }] });

  const lastCol = Math.max(1, columns.length);

  // Row 1 title, row 2 subtitle, row 3 blank, row 4 headers, row 5+ data.
  sheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = options.title;
  titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: CLR.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CLR.navy } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(2, 1, 2, lastCol);
  const partial = rows.length < result.total;
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = [
    options.subtitle,
    partial ? `PARCIAL: ${rows.length} de ${result.total} registros` : `${rows.length} registros`,
    `Generado el ${new Date().toLocaleDateString("es-BO")}`,
  ].filter(Boolean).join("  ·  ");
  subtitleCell.font = { name: "Segoe UI", size: 9, color: { argb: CLR.muted }, bold: partial };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(2).height = 18;

  // Column widths first: the header height depends on them.
  const widths = columns.map((column, index) => {
    const longest = rows.reduce(
      (max, row) => Math.max(max, displayWidth(row[column.key], column.kind)),
      column.label.length,
    );
    const width = Math.min(48, Math.max(10, longest + 2));
    sheet.getColumn(index + 1).width = width;
    return width;
  });

  const headerRow = sheet.getRow(4);
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: CLR.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CLR.navy } };
    cell.alignment = {
      vertical: "middle",
      horizontal: column.kind === "number" ? "right" : "left",
      wrapText: true,
    };
    cell.border = { top: thin, left: thin, bottom: thin, right: thin };
  });
  // Tall enough for the longest header to wrap instead of being clipped.
  const headerLines = columns.reduce(
    (max, c, i) => Math.max(max, Math.ceil(c.label.length / Math.max(1, widths[i]))),
    1,
  );
  headerRow.height = Math.min(90, Math.max(22, headerLines * 14));

  // The server marks which column carries criticality, so the colour no longer
  // depends on finding the word inside a label the user can rename.
  const criticalityKey = columns.find((c) => c.semantic === "criticality")?.key;

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    const level = criticalityKey ? Number(row[criticalityKey]) : NaN;
    const fill = Number.isInteger(level) ? CRITICALITY_FILL[level] : undefined;

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
    // Fixed height: with wrapText and no height, one long description grows to
    // Excel's 409-point maximum and swallows the screen.
    excelRow.height = 30;
  });

  if (columns.length > 0 && rows.length > 0) {
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: lastCol } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    reportFileName(options.title, "xlsx"),
  );
}

export { cellValue };
