import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportResult } from "../../api/generador.api";
import { formatValue } from "../reportConfig";

const PRIMARY: [number, number, number] = [0, 31, 93];
const MUTED: [number, number, number] = [107, 114, 128];

/**
 * Orientation and page size follow the column count: a 4-column report on a
 * landscape A3 wastes the page, and a 20-column report on portrait A4 is
 * unreadable. Chosen once, from the shape of the data.
 */
function chooseFormat(columnCount: number): { orientation: "p" | "l"; format: string } {
  if (columnCount <= 5) return { orientation: "p", format: "a4" };
  if (columnCount <= 10) return { orientation: "l", format: "a4" };
  return { orientation: "l", format: "a3" };
}

export interface DynamicPdfOptions {
  title: string;
  subtitle?: string;
}

export function exportDynamicPdf(result: ReportResult, options: DynamicPdfOptions): void {
  const { columns, rows } = result;
  const { orientation, format } = chooseFormat(columns.length);
  const doc = new jsPDF({ orientation, unit: "mm", format });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageWidth, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(options.title, 10, 11);

  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const meta = [
    options.subtitle,
    `${rows.length} de ${result.total} registros`,
    `Generado el ${new Date().toLocaleDateString("es-BO")}`,
  ].filter(Boolean).join("  ·  ");
  doc.text(meta, 10, 23);

  autoTable(doc, {
    startY: 27,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) =>
      columns.map((c) =>
        c.kind === "image"
          ? (row[c.key] ? "Sí" : "—")
          : formatValue(row[c.key], c.kind),
      ),
    ),
    styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak", textColor: [31, 41, 55] },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 246, 251] },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, c.kind === "number" ? { halign: "right" as const } : {}]),
    ),
    margin: { left: 8, right: 8, bottom: 14 },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      const page = doc.internal.pages.length - 1;
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(options.title, 8, pageHeight - 6);
      doc.text(`Página ${page}`, pageWidth - 8, pageHeight - 6, { align: "right" });
    },
  });

  const safeName = options.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 60);
  doc.save(`${safeName}.pdf`);
}

export { chooseFormat };
