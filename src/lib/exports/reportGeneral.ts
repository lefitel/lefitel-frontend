import axios from "axios";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { EventoInterface, RevisionInterface } from "../../interfaces/interfaces";
import { url } from "../../api/url";
import { getEventCriticality, getCriticalityMeta } from "../criticality";
import logoUrl from "../../assets/images/logo.png";
import tigoUrl from "../../assets/images/logo_tigo.png";

// ─── Row layout ───────────────────────────────────────────────────────────────
//  Row 1  Title  (logos overlay)
//  Row 2  Date range
//  Row 3  KPI strip + color legend
//  Row 4  Group headers  (Poste / Evento / Solución)
//  Row 5  Column headers (frozen, auto-filter)
//  Row 6+ Data
const R = { TITLE: 1, DATE: 2, KPI: 3, GROUP: 4, HEADER: 5, DATA_START: 6 } as const;

// ─── Column map (1-indexed) ───────────────────────────────────────────────────
//  1  #            2  Nmr Poste    3  Propietario
//  4  Latitud*     5  Longitud*    6  Tramo
//  7  Fecha        8  Hora         9  Descripción
// 10  Criticidad  11  Prioritario 12  Revisiones  13  Estado      ← Evento group
// 14  Foto Evento
// 15  Fecha Sol   16  Hora Sol    17  Desc Sol    18  Foto Sol
//
// * vertical text, narrow column
const COL_COUNT   = 18;
const COL_IMG_EVT = 14;
const COL_IMG_SOL = 18;
const VERTICAL_COLS = new Set([4, 5]);

// ─── Palette ──────────────────────────────────────────────────────────────────
const CLR = {
  navy:       "FF001F5D",
  navyMid:    "FF1F3864",
  white:      "FFFFFFFF",
  groupPoste: "FFE8B4B8",
  groupEvt:   "FFBDD7EE",
  groupSol:   "FFFFE599",
  dataGreen:  "FFD4EDDA",
  dataRed:    "FFFAD7D7",
  dataOrange: "FFFDE8D0",
  dataYellow: "FFFEF9E0",
  dateBg:     "FFF0F4FF",
  kpiBg:      "FFF8F9FA",
  border:     "FFD0D7EF",
  text:       "FF1F2937",
  textMuted:  "FF6B7280",
} as const;

const PRIMARY: [number, number, number] = [0, 31, 93];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const latestRevision = (revisions: RevisionInterface[] | null | undefined): Date => {
  const revs = revisions ?? [];
  return revs.reduce((max, rev) => {
    const d = new Date(rev.date);
    return d > max ? d : max;
  }, new Date(0));
};

const makeTimestamp = () => {
  const now = new Date();
  return `${now.toLocaleDateString("es-ES").replace(/\//g, "-")}_${now.getHours().toString().padStart(2, "0")}-${now.getMinutes().toString().padStart(2, "0")}-${now.getSeconds().toString().padStart(2, "0")}`;
};

const getImgBuffer = async (src: string): Promise<ArrayBuffer | null> => {
  try {
    const res = await axios.get(src, { responseType: "arraybuffer" });
    return res.data as ArrayBuffer;
  } catch {
    return null;
  }
};

const compressToJpeg = (src: string, maxPx = 160, quality = 0.65): Promise<ArrayBuffer | null> =>
  axios.get(src, { responseType: "arraybuffer" })
    .then((res) => {
      const objectUrl = URL.createObjectURL(new Blob([res.data as ArrayBuffer]));
      return new Promise<ArrayBuffer | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const scale   = Math.min(maxPx / img.width, maxPx / img.height, 1);
          const canvas  = document.createElement("canvas");
          canvas.width  = Math.round(img.width  * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => blob
              ? blob.arrayBuffer().then(resolve).catch(() => resolve(null))
              : resolve(null),
            "image/jpeg",
            quality,
          );
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
        img.src = objectUrl;
      });
    })
    .catch(() => null);

const arrayBufferToBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const borderThin   = (argb: string): ExcelJS.Border => ({ style: "thin",   color: { argb } });
const borderMedium = (argb: string): ExcelJS.Border => ({ style: "medium", color: { argb } });

const applyUniformBorder = (cell: ExcelJS.Cell, argb: string, style: "thin" | "medium" = "thin") => {
  const b = style === "thin" ? borderThin(argb) : borderMedium(argb);
  cell.border = { top: b, left: b, bottom: b, right: b };
};

// ─── Excel ────────────────────────────────────────────────────────────────────

export const exportExcelGeneral = async (list: EventoInterface[], fechaInicio: Date, fechaFin: Date) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Osefi srl";
  wb.created = new Date();
  const ws = wb.addWorksheet("Reporte");

  ws.columns = [
    { key: "num",      width: 5  },  // 1
    { key: "poste",    width: 14 },  // 2
    { key: "prop",     width: 18 },  // 3
    { key: "lat",      width: 7  },  // 4  vertical
    { key: "lng",      width: 7  },  // 5  vertical
    { key: "tramo",    width: 28 },  // 6
    { key: "fecha",    width: 12 },  // 7
    { key: "hora",     width: 10 },  // 8
    { key: "desc",     width: 30 },  // 9
    { key: "prio",     width: 10 },  // 10
    { key: "revs",     width: 10 },  // 11
    { key: "estado",   width: 13 },  // 12  ← new
    { key: "foto",     width: 14 },  // 13
    { key: "fechaSol", width: 12 },  // 14
    { key: "horaSol",  width: 10 },  // 15
    { key: "descSol",  width: 30 },  // 16
    { key: "fotoSol",  width: 14 },  // 17
  ];

  // ── Logos ──────────────────────────────────────────────────────────────────
  const [osefiBuf, tigoBuf] = await Promise.all([
    getImgBuffer(logoUrl),
    getImgBuffer(tigoUrl),
  ]);
  if (osefiBuf) {
    ws.addImage(wb.addImage({ buffer: osefiBuf, extension: "png" }), {
      tl: { col: 0, row: 0 }, ext: { width: 70, height: 50 },
    });
  }
  if (tigoBuf) {
    ws.addImage(wb.addImage({ buffer: tigoBuf, extension: "png" }), {
      tl: { col: COL_COUNT - 1, row: 0 }, ext: { width: 70, height: 50 },
    });
  }

  // ── Row 1: Title ────────────────────────────────────────────────────────────
  ws.mergeCells(R.TITLE, 1, R.TITLE, COL_COUNT);
  {
    const cell     = ws.getCell(R.TITLE, 1);
    cell.value     = "RESUMEN DE REPORTES OSEFI S.R.L.";
    cell.font      = { bold: true, size: 18, color: { argb: CLR.navy } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  }
  ws.getRow(R.TITLE).height = 50;

  // ── Row 2: Date range ───────────────────────────────────────────────────────
  ws.mergeCells(R.DATE, 1, R.DATE, COL_COUNT);
  {
    const cell     = ws.getCell(R.DATE, 1);
    cell.value     = `${fechaInicio.toLocaleDateString("es-ES")} — ${fechaFin.toLocaleDateString("es-ES")}`;
    cell.font      = { italic: true, size: 11, color: { argb: CLR.textMuted } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: CLR.dateBg } };
  }
  ws.getRow(R.DATE).height = 18;

  // ── Row 3: KPI strip (left) + color legend (right) ─────────────────────────
  const total        = list.length;
  const pendientes   = list.filter((e) => !e.state).length;
  const solucionados = list.filter((e) => e.state).length;
  const criticos     = list.filter((e) => (e.revisions?.length ?? 0) >= 5).length;
  const prioritarios = list.filter((e) => e.priority).length;

  // Left: cols 1-9 merged — KPIs as rich text
  ws.mergeCells(R.KPI, 1, R.KPI, 9);
  {
    const cell = ws.getCell(R.KPI, 1);
    cell.value = {
      richText: [
        { text: "Total: ",        font: { size: 9, color: { argb: CLR.textMuted } } },
        { text: `${total}   `,    font: { size: 9, bold: true, color: { argb: CLR.text } } },
        { text: "Pendientes: ",   font: { size: 9, color: { argb: CLR.textMuted } } },
        { text: `${pendientes}   `, font: { size: 9, bold: true, color: { argb: "FFB45309" } } },
        { text: "Solucionados: ", font: { size: 9, color: { argb: CLR.textMuted } } },
        { text: `${solucionados}   `, font: { size: 9, bold: true, color: { argb: "FF16A34A" } } },
        { text: "Críticos: ",     font: { size: 9, color: { argb: CLR.textMuted } } },
        { text: `${criticos}   `, font: { size: 9, bold: true, color: { argb: "FFDC2626" } } },
        { text: "Prioritarios: ", font: { size: 9, color: { argb: CLR.textMuted } } },
        { text: `${prioritarios}`, font: { size: 9, bold: true, color: { argb: CLR.navy } } },
      ],
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: CLR.kpiBg } };
    cell.border    = { bottom: borderThin(CLR.border), right: borderThin(CLR.border) };
  }

  // Right: cols 10-17 merged — inline legend with colored Unicode squares
  ws.mergeCells(R.KPI, 10, R.KPI, COL_COUNT);
  {
    const legendItems: Array<[string, string]> = [
      [CLR.dataGreen,  "Solucionado"],
      [CLR.dataYellow, "Normal"],
      [CLR.dataOrange, "Alerta"],
      [CLR.dataRed,    "Crítico"],
    ];
    const richText: ExcelJS.RichText[] = [];
    legendItems.forEach(([argb, label], idx) => {
      richText.push({ text: "■ ", font: { size: 10, color: { argb } } });
      richText.push({ text: label, font: { size: 9, color: { argb: CLR.text } } });
      if (idx < legendItems.length - 1) {
        richText.push({ text: "   –   ", font: { size: 9, color: { argb: CLR.textMuted } } });
      }
    });
    const legendCell     = ws.getCell(R.KPI, 10);
    legendCell.value     = { richText };
    legendCell.alignment = { vertical: "middle", horizontal: "center" };
    legendCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: CLR.kpiBg } };
    legendCell.border    = { bottom: borderThin(CLR.border), right: borderThin(CLR.border) };
  }

  ws.getRow(R.KPI).height = 16;

  // ── Row 4: Group headers ────────────────────────────────────────────────────
  ws.mergeCells(R.GROUP, 2,  R.GROUP, 6);   // Poste
  ws.mergeCells(R.GROUP, 7,  R.GROUP, 13);  // Evento  (now includes Estado at col 12)
  ws.mergeCells(R.GROUP, 14, R.GROUP, 17);  // Solución

  {
    const cell = ws.getCell(R.GROUP, 1);
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    applyUniformBorder(cell, CLR.border);
  }

  const groupDefs: Array<[string, number, number, string]> = [
    ["Poste",    2,  6,  CLR.groupPoste],
    ["Evento",   7,  13, CLR.groupEvt],
    ["Solución", 14, 17, CLR.groupSol],
  ];
  for (const [label, from, to, argb] of groupDefs) {
    for (let c = from; c <= to; c++) {
      const cell = ws.getCell(R.GROUP, c);
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb } };
      applyUniformBorder(cell, CLR.border);
    }
    const labelCell     = ws.getCell(R.GROUP, from);
    labelCell.value     = label;
    labelCell.font      = { bold: true, size: 11, color: { argb: CLR.text } };
    labelCell.alignment = { vertical: "middle", horizontal: "center" };
  }
  ws.getRow(R.GROUP).height = 20;

  // ── Row 5: Column headers ───────────────────────────────────────────────────
  const HEADERS = [
    "#", "Nmr Poste", "Propietario", "Latitud", "Longitud", "Tramo",
    "Fecha rev.", "Hora rev.", "Descripción", "Prioritario", "Revisiones", "Estado",
    "Foto Evento", "Fecha Solución", "Hora Solución", "Descripción Solución", "Foto Solución",
  ];
  for (let c = 1; c <= COL_COUNT; c++) {
    const isVert = VERTICAL_COLS.has(c);
    const cell   = ws.getCell(R.HEADER, c);
    cell.value   = HEADERS[c - 1];
    cell.font    = { bold: true, color: { argb: CLR.white }, size: 10 };
    cell.fill    = { type: "pattern", pattern: "solid", fgColor: { argb: CLR.navyMid } };
    cell.alignment = {
      vertical:   "middle",
      horizontal: "center",
      wrapText:   !isVert,
      ...(isVert ? { textRotation: 90 } : {}),
    };
    cell.border = {
      top:    borderThin(CLR.border),
      left:   borderThin(CLR.border),
      bottom: borderMedium("FF3A5BA0"),
      right:  borderThin(CLR.border),
    };
  }
  ws.getRow(R.HEADER).height = 65;

  ws.autoFilter = { from: { row: R.HEADER, column: 1 }, to: { row: R.HEADER, column: COL_COUNT } };
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: R.HEADER, topLeftCell: `A${R.DATA_START}` }];

  // ── Data rows ──────────────────────────────────────────────────────────────
  for (let i = 0; i < list.length; i++) {
    const e       = list[i];
    const revs    = e.revisions ?? [];
    const lastRev = latestRevision(revs);
    const sol     = e.solucions?.[0] ?? null;
    const excelRow  = R.DATA_START + i;
    const hasAnyImg = !!(e.image || sol?.image);

    ws.getRow(excelRow).height = hasAnyImg ? 85 : 45;

    const hasSolImg = !!(sol?.image);
    const fillArgb  = hasSolImg          ? CLR.dataGreen
                    : revs.length >= 5   ? CLR.dataRed
                    : revs.length > 1    ? CLR.dataOrange
                    : CLR.dataYellow;

    const values: (string | number)[] = [
      i + 1,
      e.poste?.name              ?? "",
      e.poste?.propietario?.name ?? "",
      e.poste?.lat               ?? "",
      e.poste?.lng               ?? "",
      `${e.poste?.ciudadA?.name ?? ""} - ${e.poste?.ciudadB?.name ?? ""}`,
      revs.length > 0 ? lastRev.toLocaleDateString("es-ES") : "",
      revs.length > 0 ? lastRev.toLocaleTimeString("es-ES") : "",
      e.description ?? "",
      e.priority ? "SÍ" : "NO",
      revs.length,
      e.state ? "Solucionado" : "Pendiente",  // col 12 — Estado
      "",                                       // col 13 — Foto Evento (embedded below)
      sol ? new Date(sol.date).toLocaleDateString("es-ES") : "",
      sol ? new Date(sol.date).toLocaleTimeString("es-ES") : "",
      sol?.description ?? "",
      "",                                       // col 17 — Foto Solución (embedded below)
    ];

    for (let ci = 0; ci < values.length; ci++) {
      const c      = ci + 1;
      const isVert = VERTICAL_COLS.has(c);
      const val    = values[ci];
      const cell   = ws.getCell(excelRow, c);
      cell.value   = val;
      cell.fill    = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
      cell.font    = { size: 10, color: { argb: CLR.text } };
      cell.alignment = {
        vertical:   "middle",
        horizontal: isVert ? "center" : (typeof val === "number" ? "center" : "left"),
        wrapText:   !isVert,
        ...(isVert ? { textRotation: 90 } : {}),
      };
      applyUniformBorder(cell, CLR.border);
    }

    if (e.image) {
      const imgBuf = await compressToJpeg(`${url}${e.image}`);
      if (imgBuf) {
        ws.addImage(wb.addImage({ buffer: imgBuf, extension: "jpeg" }), {
          tl: { col: COL_IMG_EVT - 1, row: excelRow - 1 } as ExcelJS.Anchor,
          br: { col: COL_IMG_EVT,     row: excelRow     } as ExcelJS.Anchor,
        });
      }
    }
    if (sol?.image) {
      const imgBuf = await compressToJpeg(`${url}${sol.image}`);
      if (imgBuf) {
        ws.addImage(wb.addImage({ buffer: imgBuf, extension: "jpeg" }), {
          tl: { col: COL_IMG_SOL - 1, row: excelRow - 1 } as ExcelJS.Anchor,
          br: { col: COL_IMG_SOL,     row: excelRow     } as ExcelJS.Anchor,
        });
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `reporte_general_${makeTimestamp()}.xlsx`);
};

// ─── CSV ──────────────────────────────────────────────────────────────────────

export const PDF_HEADERS_GENERAL = [
  "#", "Nmr Poste", "Propietario", "Latitud", "Longitud", "Tramo",
  "Fecha rev.", "Hora rev.", "Descripción", "Criticidad", "Prioritario", "Revisiones",
  "Estado", "Foto evt.", "Fecha sol.", "Hora sol.", "Desc. sol.", "Foto sol.",
];

const formatCriticality = (e: EventoInterface): string => {
  const c = getEventCriticality(e);
  if (c == null) return "—";
  return `${c} - ${getCriticalityMeta(c).label}`;
};

export const toRowsGeneral = (list: EventoInterface[]) =>
  list.map((e, i) => {
    const lastRev = latestRevision(e.revisions);
    const sol = e.solucions?.[0] ?? null;
    const hasRevs = (e.revisions?.length ?? 0) > 0;
    return [
      String(i + 1),
      e.poste?.name ?? "",
      e.poste?.propietario?.name ?? "",
      e.poste?.lat != null ? String(e.poste.lat.toFixed(4)) : "",
      e.poste?.lng != null ? String(e.poste.lng.toFixed(4)) : "",
      `${e.poste?.ciudadA?.name ?? ""} - ${e.poste?.ciudadB?.name ?? ""}`,
      hasRevs ? lastRev.toLocaleDateString("es-ES") : "",
      hasRevs ? lastRev.toLocaleTimeString("es-ES") : "",
      e.description ?? "",
      formatCriticality(e),
      e.priority ? "SÍ" : "NO",
      String(e.revisions?.length ?? 0),
      e.state ? "Solucionado" : "Pendiente",
      e.image ? "✓" : "—",
      sol ? new Date(sol.date).toLocaleDateString("es-ES") : "",
      sol ? new Date(sol.date).toLocaleTimeString("es-ES") : "",
      sol?.description ?? "",
      sol?.image ? "✓" : "—",
    ];
  });

export const exportCsvGeneral = (list: EventoInterface[]) => {
  const esc = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [
    PDF_HEADERS_GENERAL.map(esc).join(","),
    ...toRowsGeneral(list).map((r) => r.map(esc).join(",")),
  ];
  saveAs(
    new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }),
    `reporte_general_${makeTimestamp()}.csv`,
  );
};

// ─── PDF ──────────────────────────────────────────────────────────────────────

const IMG_COL_EVT = 13; // 0-indexed
const IMG_COL_SOL = 17; // 0-indexed

export const exportPdfGeneral = async (list: EventoInterface[], fechaInicio: Date, fechaFin: Date) => {
  // ── Logo ────────────────────────────────────────────────────────────────────
  const res = await fetch(logoUrl);
  const blob = await res.blob();
  const logoDataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  // ── Pre-fetch & compress all images ─────────────────────────────────────────
  const evtImgs: (string | null)[] = [];
  const solImgs: (string | null)[] = [];
  for (const e of list) {
    const evtBuf = e.image ? await compressToJpeg(`${url}${e.image}`, 120, 0.72) : null;
    evtImgs.push(evtBuf ? arrayBufferToBase64(evtBuf) : null);
    const sol    = e.solucions?.[0] ?? null;
    const solBuf = sol?.image ? await compressToJpeg(`${url}${sol.image}`, 120, 0.72) : null;
    solImgs.push(solBuf ? arrayBufferToBase64(solBuf) : null);
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, 28, "F");
  doc.addImage(logoDataUrl, "PNG", 10, 4, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...PRIMARY);
  doc.text("OSEFI SRL", 34, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 90, 110);
  doc.text("Reporte General", 34, 18);
  const rangeStr = `${fechaInicio.toLocaleDateString("es-ES")} — ${fechaFin.toLocaleDateString("es-ES")}`;
  doc.setFontSize(8); doc.setTextColor(150, 160, 175);
  doc.text(rangeStr, W - 14, 18, { align: "right" });
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 28, W, 1.5, "F");

  autoTable(doc, {
    startY: 33,
    head: [PDF_HEADERS_GENERAL],
    body: toRowsGeneral(list),
    styles: { fontSize: 6, cellPadding: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 }, valign: "middle", textColor: [30, 40, 60] },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6 },
    columnStyles: {
      0:  { cellWidth: 5  },
      1:  { cellWidth: 14 },
      2:  { cellWidth: 14 },
      3:  { cellWidth: 13 },
      4:  { cellWidth: 13 },
      5:  { cellWidth: 24 },
      6:  { cellWidth: 14 },
      7:  { cellWidth: 13 },
      8:  { cellWidth: 28 },
      9:  { cellWidth: 10 },
      10: { cellWidth: 10 },
      11: { cellWidth: 14 },
      12: { cellWidth: 20 },
      13: { cellWidth: 14 },
      14: { cellWidth: 13 },
      15: { cellWidth: 26 },
      16: { cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const e = list[data.row.index];
      if (!e) return;
      const hasSolImg = !!(e.solucions?.[0]?.image);
      const nRevs    = e.revisions?.length ?? 0;
      const fill: [number, number, number] =
        hasSolImg  ? [212, 237, 218] :
        nRevs >= 5 ? [250, 215, 215] :
        nRevs >  1 ? [253, 232, 208] :
                     [254, 249, 224];
      data.cell.styles.fillColor = fill;
      if (data.column.index === IMG_COL_EVT || data.column.index === IMG_COL_SOL) {
        data.cell.text = [];
        const hasImg = data.column.index === IMG_COL_EVT
          ? !!evtImgs[data.row.index]
          : !!solImgs[data.row.index];
        if (hasImg) data.cell.styles.minCellHeight = 22;
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const b64 = data.column.index === IMG_COL_EVT ? evtImgs[data.row.index]
                : data.column.index === IMG_COL_SOL ? solImgs[data.row.index]
                : null;
      if (!b64) return;
      const pad = 1;
      doc.addImage(
        `data:image/jpeg;base64,${b64}`, "JPEG",
        data.cell.x + pad, data.cell.y + pad,
        data.cell.width - pad * 2, data.cell.height - pad * 2,
      );
    },
    margin: { left: 10, right: 10 },
    tableLineColor: [208, 216, 239],
    tableLineWidth: 0.2,
  });

  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5); doc.setTextColor(160, 170, 190);
    doc.setDrawColor(208, 216, 239);
    doc.line(10, 203, W - 10, 203);
    doc.text("Osefi srl", 10, 207);
    doc.text(`Página ${i} de ${pageCount}`, W - 10, 207, { align: "right" });
  }

  doc.save(`reporte_general_${makeTimestamp()}.pdf`);
};
