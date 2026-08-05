import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportResult } from "../../api/generador.api";
import { formatValue } from "../reportConfig";
import { reportFileName } from "./dynamicExcel";

const PRIMARY: [number, number, number] = [0, 31, 93];
const MUTED: [number, number, number] = [107, 114, 128];

/** Criticality 1 is catastrophic and 9 is maintenance, matching the Excel. */
const CRITICALITY_RGB: Record<number, [number, number, number]> = {
  1: [250, 215, 215], 2: [253, 232, 208], 3: [253, 240, 218], 4: [254, 249, 224],
  5: [242, 248, 224], 6: [228, 245, 233], 7: [224, 243, 243], 8: [224, 240, 248],
  9: [232, 238, 248],
};

/** Millimetres a column needs to stay readable. Below this, text goes vertical. */
const MIN_COLUMN_MM = 18;
/** Always A4 landscape: A3 does not fit in an office printer. */
const PAGE = { orientation: "l" as const, format: "a4", usableMm: 297 - 16 };

/**
 * Splits the columns into groups that fit the page width.
 *
 * Choosing orientation by column count alone produced a 60-column A3 with
 * 3.5 mm columns, a header 103 mm tall and titles broken one letter per line.
 * The exporters already in production trim the same way and label the parts.
 */
export function chunkColumns<T>(columns: T[], perPage = Math.floor(PAGE.usableMm / MIN_COLUMN_MM)): T[][] {
  if (columns.length === 0) return [[]];
  const size = Math.max(1, perPage);
  const chunks: T[][] = [];
  for (let i = 0; i < columns.length; i += size) chunks.push(columns.slice(i, i + size));
  return chunks;
}

/**
 * Replaces characters the standard PDF fonts cannot encode.
 *
 * jsPDF's built-in Helvetica is WinAnsi. A single emoji made the whole cell
 * come out as raw UTF-16 bytes, so one character typed from a phone rendered
 * an entire description unreadable.
 */
export function toWinAnsi(text: string): string {
  const replacements: Record<string, string> = {
    "✓": "Si", "✔": "Si", "✕": "No", "✗": "No", "→": "->", "←": "<-",
    "≥": ">=", "≤": "<=", "–": "-", "—": "-", "…": "...", "•": "-",
  };
  let out = "";
  for (const ch of text) {
    if (replacements[ch] !== undefined) { out += replacements[ch]; continue; }
    const code = ch.codePointAt(0) ?? 0;
    out += code <= 0xff ? ch : "?";
  }
  return out;
}

export interface DynamicPdfOptions {
  title: string;
  subtitle?: string;
}

export function exportDynamicPdf(result: ReportResult, options: DynamicPdfOptions): void {
  const { columns, rows } = result;
  const doc = new jsPDF({ orientation: PAGE.orientation, unit: "mm", format: PAGE.format });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const groups = chunkColumns(columns);
  const criticalityKey = columns.find((c) => c.semantic === "criticality")?.key;
  const partial = rows.length < result.total;

  const title = toWinAnsi(options.title);
  const meta = toWinAnsi([
    options.subtitle,
    partial ? `PARCIAL: ${rows.length} de ${result.total} registros` : `${rows.length} registros`,
    `Generado el ${new Date().toLocaleDateString("es-BO")}`,
  ].filter(Boolean).join("  ·  "));

  groups.forEach((group, groupIndex) => {
    if (groupIndex > 0) doc.addPage();

    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, pageWidth, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    const heading = groups.length > 1
      ? `${title}  (parte ${groupIndex + 1} de ${groups.length})`
      : title;
    doc.text(heading, 10, 11, { maxWidth: pageWidth - 20 });

    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(meta, 10, 23, { maxWidth: pageWidth - 20 });

    autoTable(doc, {
      startY: 27,
      head: [group.map((c) => toWinAnsi(c.label))],
      body: rows.map((row) =>
        group.map((c) =>
          c.kind === "image"
            ? (row[c.key] ? "Si" : "-")
            : toWinAnsi(formatValue(row[c.key], c.kind)),
        ),
      ),
      styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak", textColor: [31, 41, 55] },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 246, 251] },
      columnStyles: Object.fromEntries(
        group.map((c, i) => [i, c.kind === "number" ? { halign: "right" as const } : {}]),
      ),
      margin: { left: 8, right: 8, bottom: 14 },
      // Colour by criticality, matching the spreadsheet.
      didParseCell: (data) => {
        if (data.section !== "body" || !criticalityKey) return;
        const level = Number(rows[data.row.index]?.[criticalityKey]);
        const rgb = Number.isInteger(level) ? CRITICALITY_RGB[level] : undefined;
        if (rgb) data.cell.styles.fillColor = rgb;
      },
      didDrawPage: () => {
        const page = doc.internal.pages.length - 1;
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(title, 8, pageHeight - 6, { maxWidth: pageWidth / 2 });
        doc.text(`Pagina ${page}`, pageWidth - 8, pageHeight - 6, { align: "right" });
      },
    });
  });

  doc.save(reportFileName(options.title, "pdf"));
}
