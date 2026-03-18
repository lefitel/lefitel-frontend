import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  AdssInterface,
  AdssPosteInterface,
  CiudadInterface,
  EventoInterface,
  EventoObsInterface,
  MaterialInterface,
  ObsInterface,
  PropietarioInterface,
} from "../../interfaces/interfaces";
import logoUrl from "../../assets/images/logo.png";

// ─── Palette ──────────────────────────────────────────────────────────────────
const CLR = {
  navy:       "FF001F5D",
  navyMid:    "FF1F3864",
  white:      "FFFFFFFF",
  groupProp:  "FFBDD7EE",
  groupMat:   "FFE8B4B8",
  groupAdss:  "FFFFE599",
  groupCoord: "FFF5F5DC",
  groupObs:   "FFD4EDDA",
  groupPrio:  "FFFDE8D0",  // for Prioritario "1" cells
  hdrBg:      "FF92CDDC",
  dateBg:     "FFF0F4FF",
  border:     "FFD0D7EF",
  borderDark: "FF9CA3AF",
  text:       "FF1F2937",
  textMuted:  "FF6B7280",
  rowAlt:     "FFF9FAFB",
} as const;

const PRIMARY: [number, number, number] = [0, 31, 93];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeTimestamp = () => {
  const now = new Date();
  return `${now.toLocaleDateString("es-ES").replace(/\//g, "-")}_${now.getHours().toString().padStart(2, "0")}-${now.getMinutes().toString().padStart(2, "0")}-${now.getSeconds().toString().padStart(2, "0")}`;
};

const borderThin   = (argb: string): ExcelJS.Border => ({ style: "thin",   color: { argb } });
const borderMedium = (argb: string): ExcelJS.Border => ({ style: "medium", color: { argb } });

const applyUniformBorder = (cell: ExcelJS.Cell, argb: string, style: "thin" | "medium" = "thin") => {
  const b = style === "thin" ? borderThin(argb) : borderMedium(argb);
  cell.border = { top: b, left: b, bottom: b, right: b };
};

// ─── Excel ────────────────────────────────────────────────────────────────────
//
// Layout (explicit row numbers):
//   Row 1       Title
//   Row 2       Tramo metadata
//   Row 3       Fecha metadata
//   Row 4       Elaborado por metadata
//   Row 5       Group headers
//   Row 6       Column headers (frozen, auto-filter)
//   Row 7+      Data
//   Last row    Totals (navy bg, white text)

export interface TramoExcelParams {
  list:            EventoInterface[];
  listPropietario: PropietarioInterface[];
  listMaterial:    MaterialInterface[];
  listAdss:        AdssInterface[];
  listObs:         ObsInterface[];
  listCiudad:      CiudadInterface[];
  tramoInicial:    number | null;
  tramoFinal:      number | null;
  fechaInicio:     Date;
  fechaFin:        Date;
}

export const exportExcelTramo = async (p: TramoExcelParams) => {
  const {
    list, listPropietario, listMaterial, listAdss, listObs,
    listCiudad, tramoInicial, tramoFinal, fechaInicio, fechaFin,
  } = p;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Lefitel";
  wb.created = new Date();
  const ws = wb.addWorksheet("Reporte Por Tramo");

  // ── Column layout ──────────────────────────────────────────────────────────
  const nProp = listPropietario.length;
  const nMat  = listMaterial.length;
  const nAdss = listAdss.length;
  const nObs  = listObs.length;
  const totalCols = 3 + nProp + nMat + nAdss + 2 + nObs;

  const colWidths: number[] = [5, 15, 5];
  for (let i = 0; i < nProp + nMat + nAdss; i++) colWidths.push(5);
  colWidths.push(10, 10); // Latitud, Longitud
  for (let i = 0; i < nObs; i++) colWidths.push(5);

  ws.columns = colWidths.map((w, i) => ({ key: `c${i + 1}`, width: w }));

  // ── Group section ranges (1-indexed columns) ───────────────────────────────
  const propStart = 4;
  const propEnd   = 3 + nProp;
  const matStart  = propEnd + 1;
  const matEnd    = propEnd + nMat;
  const adssStart = matEnd + 1;
  const adssEnd   = matEnd + nAdss;
  const latCol    = adssEnd + 1;
  const lngCol    = adssEnd + 2;
  const obsStart  = adssEnd + 3;
  const obsEnd    = adssEnd + 2 + nObs;

  const TITLE_ROW  = 1;
  const META_START = 2;
  const GROUP_ROW  = 5;
  const HEADER_ROW = 6;
  const DATA_START = 7;

  // Map each column to its group fill color (used for "1" cells)
  const colGroupColor = new Map<number, string>();
  colGroupColor.set(3, CLR.groupPrio);  // Prioritario
  for (let c = propStart; c <= propEnd; c++) colGroupColor.set(c, CLR.groupProp);
  for (let c = matStart;  c <= matEnd;  c++) colGroupColor.set(c, CLR.groupMat);
  for (let c = adssStart; c <= adssEnd; c++) colGroupColor.set(c, CLR.groupAdss);
  for (let c = obsStart;  c <= obsEnd;  c++) colGroupColor.set(c, CLR.groupObs);

  // ── Row 1: Title ────────────────────────────────────────────────────────────
  ws.mergeCells(TITLE_ROW, 1, TITLE_ROW, totalCols);
  {
    const cell     = ws.getCell(TITLE_ROW, 1);
    cell.value     = "PLANILLA DE EVENTOS NACIONAL";
    cell.font      = { bold: true, size: 18, color: { argb: CLR.navy } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: CLR.dateBg } };
  }
  ws.getRow(TITLE_ROW).height = 40;

  // ── Rows 2-4: Metadata ─────────────────────────────────────────────────────
  const cA = listCiudad.find((c) => c.id === tramoInicial);
  const cB = listCiudad.find((c) => c.id === tramoFinal);
  const tramoLabel = cA && cB ? `${cA.name} — ${cB.name}` : "Total";

  const META_ROWS: Array<[string, string]> = [
    ["Tramo:",         tramoLabel],
    ["Fecha:",         `${fechaInicio.toLocaleDateString("es-ES")} — ${fechaFin.toLocaleDateString("es-ES")}`],
    ["Elaborado por:", "Lefitel"],
  ];

  const metaLabelEnd = Math.min(5, totalCols);

  META_ROWS.forEach(([label, value], idx) => {
    const r = META_START + idx;
    ws.mergeCells(r, 1, r, metaLabelEnd);
    ws.mergeCells(r, metaLabelEnd + 1, r, totalCols);
    const labelCell     = ws.getCell(r, 1);
    labelCell.value     = label;
    labelCell.font      = { bold: true, size: 12, color: { argb: CLR.text } };
    labelCell.alignment = { vertical: "middle" };
    const valCell       = ws.getCell(r, metaLabelEnd + 1);
    valCell.value       = value;
    valCell.font        = { size: 12, color: { argb: CLR.textMuted } };
    valCell.alignment   = { vertical: "middle" };
    ws.getRow(r).height = 20;
  });

  // ── Row 5: Group headers ────────────────────────────────────────────────────
  const groupDefs: Array<[string, number, number, string]> = [];
  if (nProp > 0) groupDefs.push(["Propietario",   propStart, propEnd,  CLR.groupProp]);
  if (nMat  > 0) groupDefs.push(["Material",      matStart,  matEnd,   CLR.groupMat]);
  if (nAdss > 0) groupDefs.push(["Adss",          adssStart, adssEnd,  CLR.groupAdss]);
  groupDefs.push(            ["Coordenadas",   latCol,    lngCol,   CLR.groupCoord]);
  if (nObs  > 0) groupDefs.push(["Observaciones", obsStart,  obsEnd,   CLR.groupObs]);

  for (let c = 1; c <= 3; c++) {
    const cell = ws.getCell(GROUP_ROW, c);
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    applyUniformBorder(cell, CLR.border);
  }

  for (const [label, from, to, argb] of groupDefs) {
    if (from <= to) ws.mergeCells(GROUP_ROW, from, GROUP_ROW, to);
    for (let c = from; c <= to; c++) {
      const cell = ws.getCell(GROUP_ROW, c);
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb } };
      applyUniformBorder(cell, CLR.border);
    }
    const labelCell     = ws.getCell(GROUP_ROW, from);
    labelCell.value     = label;
    labelCell.font      = { bold: true, size: 11, color: { argb: CLR.text } };
    labelCell.alignment = { vertical: "middle", horizontal: "center" };
  }
  ws.getRow(GROUP_ROW).height = 22;

  // ── Row 6: Column headers ───────────────────────────────────────────────────
  const headers: string[] = [
    "#", "Poste", "Prioritario",
    ...listPropietario.map((x) => x.name),
    ...listMaterial.map((x) => x.name),
    ...listAdss.map((x) => x.name),
    "Latitud", "Longitud",
    ...listObs.map((x) => x.name),
  ];

  const WIDE_LABELS = new Set(["Poste", "Latitud", "Longitud"]);

  for (let c = 1; c <= totalCols; c++) {
    const label  = headers[c - 1];
    const isWide = WIDE_LABELS.has(label);
    const cell   = ws.getCell(HEADER_ROW, c);
    cell.value   = label;
    cell.font    = { bold: true, color: { argb: CLR.navyMid }, size: 10 };
    cell.fill    = { type: "pattern", pattern: "solid", fgColor: { argb: CLR.hdrBg } };
    cell.alignment = {
      vertical:   "middle",
      horizontal: "center",
      wrapText:   isWide,
      ...(isWide ? {} : { textRotation: 90 }),
    };
    cell.border = {
      top:    borderThin(CLR.border),
      left:   borderThin(CLR.border),
      bottom: borderMedium("FF3A5BA0"),
      right:  borderThin(CLR.border),
    };
  }
  ws.getRow(HEADER_ROW).height = 150;

  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: totalCols } };
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: HEADER_ROW, topLeftCell: `A${DATA_START}` }];

  // ── Data rows ──────────────────────────────────────────────────────────────
  for (let i = 0; i < list.length; i++) {
    const e       = list[i];
    const dataRow = DATA_START + i;
    const isLast  = i === list.length - 1;
    const isAlt   = i % 2 === 1;

    const rowValues: (string | number)[] = [
      i + 1,
      e.poste?.name ?? "",
      e.priority ? "1" : "",
      ...listPropietario.map((prop) => e.poste?.propietario?.id === prop.id ? "1" : ""),
      ...listMaterial.map((mat)  => e.poste?.material?.id === mat.id ? "1" : ""),
      ...listAdss.map((adss) =>
        ((e.poste?.adsspostes ?? []) as AdssPosteInterface[]).some((ap) => ap.id_adss === adss.id) ? "1" : ""
      ),
      e.poste?.lat ?? "",
      e.poste?.lng ?? "",
      ...listObs.map((obs) =>
        (e.eventoObs ?? []).some((eo: EventoObsInterface) => eo.id_obs === obs.id) ? "1" : ""
      ),
    ];

    ws.getRow(dataRow).height = 18;

    for (let ci = 0; ci < rowValues.length; ci++) {
      const c    = ci + 1;
      const val  = rowValues[ci];
      const cell = ws.getCell(dataRow, c);
      cell.value = val;
      cell.font  = { size: 10, color: { argb: CLR.text } };
      cell.alignment = { vertical: "middle", horizontal: "center" };

      // Fill: group color for "1" cells, alternating gray otherwise
      if (val === "1" && colGroupColor.has(c)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colGroupColor.get(c)! } };
        cell.font = { size: 10, bold: true, color: { argb: CLR.text } };
      } else if (isAlt) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CLR.rowAlt } };
      }
      // empty even rows: no fill (white)

      cell.border = {
        top:    borderThin(CLR.border),
        left:   borderThin(CLR.border),
        right:  borderThin(CLR.border),
        bottom: isLast ? borderMedium(CLR.borderDark) : borderThin(CLR.border),
      };
    }
  }

  // ── Totals row ─────────────────────────────────────────────────────────────
  const totalRow = DATA_START + list.length;
  ws.getRow(totalRow).height = 20;

  // Compute totals for each column
  const totalValues: (string | number)[] = [
    "",  // col 1: # (empty — label is in merged col 1-2)
    list.length,  // col 2: total postes
    list.filter((e) => e.priority).length,  // col 3: prioritarios
    ...listPropietario.map((prop) =>
      list.filter((e) => e.poste?.propietario?.id === prop.id).length
    ),
    ...listMaterial.map((mat) =>
      list.filter((e) => e.poste?.material?.id === mat.id).length
    ),
    ...listAdss.map((adss) =>
      list.filter((e) =>
        ((e.poste?.adsspostes ?? []) as AdssPosteInterface[]).some((ap) => ap.id_adss === adss.id)
      ).length
    ),
    "",  // Latitud — no total
    "",  // Longitud — no total
    ...listObs.map((obs) =>
      list.filter((e) =>
        (e.eventoObs ?? []).some((eo: EventoObsInterface) => eo.id_obs === obs.id)
      ).length
    ),
  ];

  // Merge cols 1-2 for "TOTAL" label
  ws.mergeCells(totalRow, 1, totalRow, 2);
  ws.getCell(totalRow, 1).value     = "TOTAL";
  ws.getCell(totalRow, 1).font      = { bold: true, size: 10, color: { argb: CLR.white } };
  ws.getCell(totalRow, 1).alignment = { vertical: "middle", horizontal: "left" };
  ws.getCell(totalRow, 1).fill      = { type: "pattern", pattern: "solid", fgColor: { argb: CLR.navyMid } };
  ws.getCell(totalRow, 1).border    = {
    top: borderMedium(CLR.borderDark), left: borderThin(CLR.border),
    bottom: borderMedium(CLR.borderDark), right: borderThin(CLR.border),
  };

  for (let ci = 1; ci < totalValues.length; ci++) {
    const c    = ci + 1;
    const cell = ws.getCell(totalRow, c);
    cell.value = totalValues[ci];
    cell.font  = { bold: true, size: 10, color: { argb: CLR.white } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: CLR.navyMid } };
    cell.border = {
      top:    borderMedium(CLR.borderDark),
      left:   borderThin(CLR.border),
      bottom: borderMedium(CLR.borderDark),
      right:  borderThin(CLR.border),
    };
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `reporte_tramo_${makeTimestamp()}.xlsx`);
};

// ─── CSV ──────────────────────────────────────────────────────────────────────

export const PDF_HEADERS_TRAMO = [
  "#", "Poste", "Prioritario", "Propietario", "Material", "Adss", "Latitud", "Longitud", "Observaciones",
];

export const toRowsTramo = (
  list:     EventoInterface[],
  listAdss: AdssInterface[],
  listObs:  ObsInterface[],
) =>
  list.map((e, i) => {
    const matchedAdss = listAdss
      .filter((a) => ((e.poste?.adsspostes ?? []) as AdssPosteInterface[]).some((ap) => ap.id_adss === a.id))
      .map((a) => a.name).join(", ");
    const matchedObs = listObs
      .filter((o) => (e.eventoObs ?? []).some((eo: EventoObsInterface) => eo.id_obs === o.id))
      .map((o) => o.name).join(", ");
    return [
      String(i + 1),
      e.poste?.name ?? "",
      e.priority ? "SÍ" : "NO",
      e.poste?.propietario?.name ?? "",
      e.poste?.material?.name ?? "",
      matchedAdss,
      e.poste?.lat != null ? String(e.poste.lat.toFixed(4)) : "",
      e.poste?.lng != null ? String(e.poste.lng.toFixed(4)) : "",
      matchedObs,
    ];
  });

export const exportCsvTramo = (
  list:     EventoInterface[],
  listAdss: AdssInterface[],
  listObs:  ObsInterface[],
) => {
  const esc = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [
    PDF_HEADERS_TRAMO.map(esc).join(","),
    ...toRowsTramo(list, listAdss, listObs).map((r) => r.map(esc).join(",")),
  ];
  saveAs(
    new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }),
    `reporte_tramo_${makeTimestamp()}.csv`,
  );
};

// ─── PDF ──────────────────────────────────────────────────────────────────────

export const exportPdfTramo = async (
  list:            EventoInterface[],
  listAdss:        AdssInterface[],
  listObs:         ObsInterface[],
  listPropietario: PropietarioInterface[],
  listMaterial:    MaterialInterface[],
  fechaInicio:     Date,
  fechaFin:        Date,
  tramoInicial:    number | null,
  tramoFinal:      number | null,
  listCiudad:      CiudadInterface[],
) => {
  const res  = await fetch(logoUrl);
  const blob = await res.blob();
  const logoDataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  const cA = listCiudad.find((c) => c.id === tramoInicial);
  const cB = listCiudad.find((c) => c.id === tramoFinal);
  const tramoLabel = cA && cB ? `${cA.name} — ${cB.name}` : "Total";
  const rangeStr   = `${fechaInicio.toLocaleDateString("es-ES")} — ${fechaFin.toLocaleDateString("es-ES")}`;

  // ── Dynamic column metadata ─────────────────────────────────────────────────
  type GroupKey = "prio" | "prop" | "mat" | "adss" | "coord" | "obs";
  const GROUP_META: Record<GroupKey, { label: string; color: [number, number, number] }> = {
    prio:  { label: "",              color: [253, 232, 208] },
    prop:  { label: "Propietario",   color: [189, 215, 238] },
    mat:   { label: "Material",      color: [232, 180, 184] },
    adss:  { label: "Adss",          color: [255, 229, 153] },
    coord: { label: "Coord.",        color: [245, 245, 220] },
    obs:   { label: "Observaciones", color: [212, 237, 218] },
  };

  interface DynCol {
    label:    string;
    group:    GroupKey;
    getValue: (e: EventoInterface) => string;
    getTotal: (l: EventoInterface[]) => string;
    width?:   number; // override width (e.g. coord)
  }

  const dynCols: DynCol[] = [
    {
      label: "Prio.", group: "prio" as GroupKey,
      getValue: (e: EventoInterface) => e.priority ? "✓" : "",
      getTotal: (l: EventoInterface[]) => String(l.filter((e) => e.priority).length),
    },
    ...listPropietario.map((p) => ({
      label: p.name, group: "prop" as GroupKey,
      getValue: (e: EventoInterface) => e.poste?.propietario?.id === p.id ? "✓" : "",
      getTotal: (l: EventoInterface[]) => String(l.filter((e) => e.poste?.propietario?.id === p.id).length),
    })),
    ...listMaterial.map((m) => ({
      label: m.name, group: "mat" as GroupKey,
      getValue: (e: EventoInterface) => e.poste?.material?.id === m.id ? "✓" : "",
      getTotal: (l: EventoInterface[]) => String(l.filter((e) => e.poste?.material?.id === m.id).length),
    })),
    ...listAdss.map((a) => ({
      label: a.name, group: "adss" as GroupKey,
      getValue: (e: EventoInterface) => ((e.poste?.adsspostes ?? []) as AdssPosteInterface[]).some((ap) => ap.id_adss === a.id) ? "✓" : "",
      getTotal: (l: EventoInterface[]) => String(l.filter((e) => ((e.poste?.adsspostes ?? []) as AdssPosteInterface[]).some((ap) => ap.id_adss === a.id)).length),
    })),
    {
      label: "Latitud", group: "coord" as GroupKey, width: 16,
      getValue: (e: EventoInterface) => e.poste?.lat != null ? e.poste.lat.toFixed(4) : "",
      getTotal: () => "",
    },
    {
      label: "Longitud", group: "coord" as GroupKey, width: 16,
      getValue: (e: EventoInterface) => e.poste?.lng != null ? e.poste.lng.toFixed(4) : "",
      getTotal: () => "",
    },
    ...listObs.map((o) => ({
      label: o.name, group: "obs" as GroupKey,
      getValue: (e: EventoInterface) => (e.eventoObs ?? []).some((eo: EventoObsInterface) => eo.id_obs === o.id) ? "✓" : "",
      getTotal: (l: EventoInterface[]) => String(l.filter((e) => (e.eventoObs ?? []).some((eo: EventoObsInterface) => eo.id_obs === o.id)).length),
    })),
  ];

  // ── Horizontal chunking ─────────────────────────────────────────────────────
  // Fixed cols: # (5) + Poste (22) = 27mm
  const FIXED_W      = 27;
  const AVAIL        = 277 - FIXED_W; // 238mm
  const fixedOverride = dynCols.reduce((s, c) => s + (c.width ?? 0), 0);
  const varCount      = dynCols.filter((c) => !c.width).length;
  const DYN_W         = varCount > 0 ? Math.max(7, Math.floor((AVAIL - fixedOverride) / varCount)) : 7;

  // Greedy pack: use actual column widths to decide page breaks
  const chunks: DynCol[][] = [];
  if (dynCols.length === 0) {
    chunks.push([]);
  } else {
    let current: DynCol[] = [];
    let usedW = 0;
    for (const col of dynCols) {
      const w = col.width ?? DYN_W;
      if (usedW + w > AVAIL && current.length > 0) {
        chunks.push(current);
        current = [];
        usedW   = 0;
      }
      current.push(col);
      usedW += w;
    }
    if (current.length > 0) chunks.push(current);
  }

  // ── Doc setup ───────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W   = 297;

  const drawHeader = (chunkIdx: number) => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, 28, "F");
    doc.addImage(logoDataUrl, "PNG", 10, 4, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...PRIMARY);
    doc.text("LEFITEL", 34, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 90, 110);
    const part = chunks.length > 1 ? ` — Parte ${chunkIdx + 1}/${chunks.length}` : "";
    doc.text(`Reporte Por Tramo — ${tramoLabel}${part}`, 34, 18);
    doc.setFontSize(8); doc.setTextColor(150, 160, 175);
    doc.text(rangeStr, W - 14, 18, { align: "right" });
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 28, W, 1.5, "F");
  };

  // ── Render each chunk ───────────────────────────────────────────────────────
  for (let ci = 0; ci < chunks.length; ci++) {
    if (ci > 0) doc.addPage();
    drawHeader(ci);

    const chunk = chunks[ci];

    // Group header row with colSpan per consecutive same-group runs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupRow: any[] = [{ content: "" }, { content: "" }];
    let gi = 0;
    while (gi < chunk.length) {
      const gKey  = chunk[gi].group;
      const gMeta = GROUP_META[gKey];
      let span    = 1;
      while (gi + span < chunk.length && chunk[gi + span].group === gKey) span++;
      groupRow.push({
        content: gMeta.label, colSpan: span,
        styles: { fillColor: gMeta.color, fontStyle: "bold", halign: "center", textColor: [30, 40, 60] },
      });
      gi += span;
    }

    const headerRow = ["#", "Poste", ...chunk.map((c) => c.label)];

    const rows = list.map((e, i) => [
      String(i + 1),
      e.poste?.name ?? "",
      ...chunk.map((c) => c.getValue(e)),
    ]);

    const totalsRow = [
      "TOTAL", String(list.length),
      ...chunk.map((c) => c.getTotal(list)),
    ];

    // Column styles for this chunk
    const colStyles: Record<number, { cellWidth: number; halign?: "center" | "left" | "right" }> = {
      0: { cellWidth: 5 },
      1: { cellWidth: 22 },
    };
    chunk.forEach((col, idx) => {
      colStyles[2 + idx] = { cellWidth: col.width ?? DYN_W, halign: "center" };
    });

    autoTable(doc, {
      startY: 33,
      head: [groupRow, headerRow],
      body: [...rows, totalsRow],
      styles: { fontSize: 6, cellPadding: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 }, valign: "middle", textColor: [30, 40, 60], lineColor: [208, 216, 239], lineWidth: 0.15 },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6 },
      columnStyles: colStyles,
      didParseCell: (data) => {
        const c      = data.column.index;
        const dynIdx = c - 2;
        const col    = dynIdx >= 0 ? chunk[dynIdx] : null;

        if (data.section === "head" && data.row.index === 1 && col) {
          data.cell.styles.fillColor    = GROUP_META[col.group].color;
          data.cell.styles.textColor    = [30, 40, 60];
          data.cell.text                = []; // cleared — drawn rotated in didDrawCell
          data.cell.styles.minCellHeight = 30;
        }

        if (data.section === "body") {
          if (data.row.index === rows.length) {
            data.cell.styles.fillColor = [31, 56, 100];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = "bold";
            return;
          }
          const val = data.cell.text[0];
          if (val === "✓" && col) {
            data.cell.styles.fillColor = GROUP_META[col.group].color;
          } else if (data.row.index % 2 === 1) {
            data.cell.styles.fillColor = [249, 250, 251];
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section !== "head" || data.row.index !== 1) return;
        const dynIdx = data.column.index - 2;
        const col    = dynIdx >= 0 ? chunk[dynIdx] : null;
        if (!col) return;
        const cx = data.cell.x + data.cell.width  / 2;
        const cy = data.cell.y + data.cell.height - 2;
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 40, 60);
        doc.text(col.label, cx, cy, { angle: 90 });
      },
      margin: { left: 10, right: 10 },
      tableLineColor: [208, 216, 239],
      tableLineWidth: 0.2,
    });
  }

  // ── Footer on all pages ─────────────────────────────────────────────────────
  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5); doc.setTextColor(160, 170, 190);
    doc.setDrawColor(208, 216, 239);
    doc.line(10, 203, W - 10, 203);
    doc.text("Lefitel", 10, 207);
    doc.text(`Página ${i} de ${pageCount}`, W - 10, 207, { align: "right" });
  }

  doc.save(`reporte_tramo_${makeTimestamp()}.pdf`);
};
