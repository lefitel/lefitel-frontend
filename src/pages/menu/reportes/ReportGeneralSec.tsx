import { useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import axios from "axios";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import { SesionContext } from "../../../context/SesionContext";
import { getReporteGeneral } from "../../../api/reporte.api";
import { getCiudad } from "../../../api/Ciudad.api";
import { CiudadInterface, EventoInterface, ReporteInterface, RevicionInterface } from "../../../interfaces/interfaces";
import { url } from "../../../api/url";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { DatePicker } from "../../../components/ui/date-picker";
import { Combobox } from "../../../components/ui/combobox";
import { Badge } from "../../../components/ui/badge";
import { Loader2Icon, FileSpreadsheetIcon, FileTextIcon, FileIcon, ChevronDownIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import DataTable from "../../../components/table/DataTable";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "../../../assets/images/logo.png";

// ─── Excel export ─────────────────────────────────────────────────────────────

const PRIMARY: [number, number, number] = [0, 31, 93];

const getImgBuffer = async (src: string): Promise<ArrayBuffer | null> => {
  try {
    const res = await axios.get(src, { responseType: "arraybuffer" });
    return res.data as ArrayBuffer;
  } catch {
    return null;
  }
};

const latestRevision = (revicions: RevicionInterface[] | null | undefined): Date => {
  const revs = revicions ?? [];
  return revs.reduce((max, rev) => {
    const d = new Date(rev.date);
    return d > max ? d : max;
  }, new Date(0));
};

// Columns:  A=#  B=Nmr Poste  C=Propietario  D=Lat  E=Lng  F=Tramo
//           G=Fecha  H=Hora  I=Desc  J=Prioritario  K=Revisiones  L=Foto evento
//           M=Fecha sol  N=Hora sol  O=Desc sol  P=Foto solución
const COL_COUNT = 16;
const COL_IMG_EVT = 12;  // L (1-indexed)
const COL_IMG_SOL = 16;  // P

const exportExcelGeneral = async (list: EventoInterface[], fechaInicio: Date, fechaFin: Date) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Lefitel";
  wb.created = new Date();
  const ws = wb.addWorksheet("Reporte");

  ws.columns = [
    { key: "num", width: 5 },
    { key: "poste", width: 14 },
    { key: "prop", width: 18 },
    { key: "lat", width: 10 },
    { key: "lng", width: 10 },
    { key: "tramo", width: 28 },
    { key: "fecha", width: 12 },
    { key: "hora", width: 10 },
    { key: "desc", width: 30 },
    { key: "prioritario", width: 11 },
    { key: "revs", width: 10 },
    { key: "foto", width: 14 },
    { key: "fechaSol", width: 12 },
    { key: "horaSol", width: 10 },
    { key: "descSol", width: 30 },
    { key: "fotoSol", width: 14 },
  ];

  // ── Logos ──────────────────────────────────────────────────────────────────
  const [lefitelBuf, tigoBuf] = await Promise.all([
    getImgBuffer("/logo.png"),
    getImgBuffer("/tigo.png"),
  ]);
  if (lefitelBuf) {
    ws.addImage(wb.addImage({ buffer: lefitelBuf, extension: "png" }), {
      tl: { col: 0, row: 0 }, ext: { width: 70, height: 50 },
    });
  }
  if (tigoBuf) {
    ws.addImage(wb.addImage({ buffer: tigoBuf, extension: "png" }), {
      tl: { col: COL_COUNT - 1, row: 0 }, ext: { width: 70, height: 50 },
    });
  }

  // ── Title rows (1-2) ───────────────────────────────────────────────────────
  ws.addRow([]); // row 1 — filled below after merge
  ws.addRow([]); // row 2

  ws.mergeCells(1, 1, 1, COL_COUNT);
  ws.mergeCells(2, 1, 2, COL_COUNT);

  const titleCell = ws.getCell("A1");
  titleCell.value = "RESUMEN DE REPORTES LEFITEL S.R.L.";
  titleCell.font = { bold: true, size: 22, color: { argb: "FF001F5D" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  const dateCell = ws.getCell("A2");
  dateCell.value = `${fechaInicio.toLocaleDateString("es-ES")} — ${fechaFin.toLocaleDateString("es-ES")}`;
  dateCell.font = { size: 13, color: { argb: "FF374151" } };
  dateCell.alignment = { vertical: "middle", horizontal: "center" };

  ws.getRow(1).height = 40;
  ws.getRow(2).height = 22;

  // ── Group header row (3) ────────────────────────────────────────────────────
  ws.addRow([]); // row 3
  ws.mergeCells(3, 2, 3, 6);   // B-F → Poste
  ws.mergeCells(3, 7, 3, 12);  // G-L → Evento
  ws.mergeCells(3, 13, 3, 16); // M-P → Solución

  const groupColors: Record<string, string> = {
    Poste: "FFE06666",
    Evento: "FF6FA8DC",
    Solución: "FFE2AC3F",
  };

  ws.getCell(3, 2).value = "Poste";
  ws.getCell(3, 7).value = "Evento";
  ws.getCell(3, 13).value = "Solución";

  [2, 7, 13].forEach((col, idx) => {
    const label = ["Poste", "Evento", "Solución"][idx];
    const cell = ws.getCell(3, col);
    cell.value = label;
    cell.font = { bold: true, size: 13, color: { argb: "FF000000" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: groupColors[label] } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Fill remaining cells in group row with matching colors for visual span
  const groupFillRanges: Array<[number, number, string]> = [
    [3, 7, "FFE06666"],   // cols 3-7: Poste
    [8, 12, "FF6FA8DC"],  // cols 8-12: Evento
    [14, 16, "FFE2AC3F"], // cols 14-16: Solución
  ];
  groupFillRanges.forEach(([from, to, argb]) => {
    for (let c = from; c <= to; c++) {
      ws.getCell(3, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    }
  });

  ws.getRow(3).height = 20;

  // ── Column header row (4) ───────────────────────────────────────────────────
  const headerRow = ws.addRow([
    "#", "Nmr Poste", "Propietario", "Latitud", "Longitud", "Tramo",
    "Fecha", "Hora", "Descripción", "Prioritario", "Revisiones", "Foto Evento",
    "Fecha Solución", "Hora Solución", "Descripción Solución", "Foto Solución",
  ]);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5D" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 20;

  // ── Data rows (starting at row 5) ─────────────────────────────────────────
  const DATA_START = 5;

  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const revs = e.revicions ?? [];
    const lastRev = latestRevision(revs);
    const sol = e.solucions?.[0] ?? null;

    const row = ws.addRow([
      i + 1,
      e.poste?.name ?? "",
      e.poste?.propietario?.name ?? "",
      e.poste?.lat ?? "",
      e.poste?.lng ?? "",
      `${e.poste?.ciudadA?.name ?? ""} - ${e.poste?.ciudadB?.name ?? ""}`,
      revs.length > 0 ? lastRev.toLocaleDateString("es-ES") : "",
      revs.length > 0 ? lastRev.toLocaleTimeString("es-ES") : "",
      e.description ?? "",
      e.priority ? "SÍ" : "NO",
      revs.length,
      "", // event image — embedded below
      sol ? new Date(sol.date).toLocaleDateString("es-ES") : "",
      sol ? new Date(sol.date).toLocaleTimeString("es-ES") : "",
      sol?.description ?? "",
      "", // solution image — embedded below
    ]);

    row.height = 75;
    row.alignment = { vertical: "middle", wrapText: true };

    const excelRow = DATA_START + i;

    // Row fill color
    const hasSolImage = !!(sol?.image);
    let fillArgb: string;
    if (hasSolImage) fillArgb = "FF91C8A1";
    else if (revs.length >= 5) fillArgb = "FFDD0031";
    else if (revs.length > 1) fillArgb = "FFFF5500";
    else fillArgb = "FFF6BF12";

    for (let c = 1; c <= COL_COUNT; c++) {
      ws.getCell(excelRow, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
    }

    // Embed event image
    if (e.image) {
      const imgBuf = await getImgBuffer(`${url}${e.image}`);
      if (imgBuf) {
        const ext = e.image.toLowerCase().endsWith(".png") ? "png" : "jpeg";
        ws.addImage(wb.addImage({ buffer: imgBuf, extension: ext }), {
          tl: { col: COL_IMG_EVT - 1, row: excelRow - 1 } as ExcelJS.Anchor,
          br: { col: COL_IMG_EVT, row: excelRow } as ExcelJS.Anchor,
        });
      }
    }

    // Embed solution image
    if (sol?.image) {
      const imgBuf = await getImgBuffer(`${url}${sol.image}`);
      if (imgBuf) {
        const ext = sol.image.toLowerCase().endsWith(".png") ? "png" : "jpeg";
        ws.addImage(wb.addImage({ buffer: imgBuf, extension: ext }), {
          tl: { col: COL_IMG_SOL - 1, row: excelRow - 1 } as ExcelJS.Anchor,
          br: { col: COL_IMG_SOL, row: excelRow } as ExcelJS.Anchor,
        });
      }
    }
  }

  // ── Borders and alignment for rows 3+ ──────────────────────────────────────
  const lastRow = DATA_START + list.length - 1;
  for (let r = 3; r <= lastRow; r++) {
    for (let c = 1; c <= COL_COUNT; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: { style: "medium", color: { argb: "FF9CA3AF" } },
        left: { style: "medium", color: { argb: "FF9CA3AF" } },
        bottom: { style: "medium", color: { argb: "FF9CA3AF" } },
        right: { style: "medium", color: { argb: "FF9CA3AF" } },
      };
      if (!cell.alignment) {
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      }
    }
  }

  const dateStr = new Date().toLocaleDateString("es-ES").replace(/\//g, "-");
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `reporte_general_${dateStr}.xlsx`);
};

// ─── CSV / PDF export ─────────────────────────────────────────────────────────

const PDF_HEADERS = [
  "#", "Nmr Poste", "Propietario", "Tramo", "Fecha Rev.",
  "Descripción", "Prioritario", "Revisiones", "Estado", "Fecha Sol.", "Desc. Sol.",
];

const toRowsGeneral = (list: EventoInterface[]) =>
  list.map((e, i) => {
    const lastRev = latestRevision(e.revicions);
    const sol = e.solucions?.[0] ?? null;
    return [
      String(i + 1),
      e.poste?.name ?? "",
      e.poste?.propietario?.name ?? "",
      `${e.poste?.ciudadA?.name ?? ""} - ${e.poste?.ciudadB?.name ?? ""}`,
      (e.revicions?.length ?? 0) > 0 ? lastRev.toLocaleDateString("es-ES") : "",
      e.description ?? "",
      e.priority ? "SÍ" : "NO",
      String(e.revicions?.length ?? 0),
      e.state ? "Solucionado" : "Pendiente",
      sol ? new Date(sol.date).toLocaleDateString("es-ES") : "",
      sol?.description ?? "",
    ];
  });

const exportCsvGeneral = (list: EventoInterface[]) => {
  const esc = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [
    PDF_HEADERS.map(esc).join(","),
    ...toRowsGeneral(list).map((r) => r.map(esc).join(",")),
  ];
  const dateStr = new Date().toLocaleDateString("es-ES").replace(/\//g, "-");
  saveAs(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }), `reporte_general_${dateStr}.csv`);
};

const exportPdfGeneral = async (list: EventoInterface[], fechaInicio: Date, fechaFin: Date) => {
  const res = await fetch(logoUrl);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, 28, "F");
  doc.addImage(dataUrl, "PNG", 10, 4, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...PRIMARY);
  doc.text("LEFITEL", 34, 12);
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
    head: [PDF_HEADERS],
    body: toRowsGeneral(list),
    styles: { fontSize: 6.5, cellPadding: { top: 2, right: 2, bottom: 2, left: 2 }, valign: "middle", textColor: [30, 40, 60] },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 244, 255] },
    margin: { left: 10, right: 10 },
    tableLineColor: [208, 216, 239],
    tableLineWidth: 0.2,
  });

  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5); doc.setTextColor(160, 170, 190);
    doc.setDrawColor(208, 216, 239);
    doc.line(10, 208, W - 10, 208);
    doc.text("Lefitel", 10, 212);
    doc.text(`Página ${i} de ${pageCount}`, W - 10, 212, { align: "right" });
  }

  const dateStr = new Date().toLocaleDateString("es-ES").replace(/\//g, "-");
  doc.save(`reporte_general_${dateStr}.pdf`);
};

// ─── Row color helpers ────────────────────────────────────────────────────────

const getRowBg = (row: EventoInterface): string => {
  if ((row.solucions?.length ?? 0) > 0) return "!bg-[#83D861] hover:!bg-[#98DF7C] dark:!bg-[#4a8a3a]";
  if ((row.revicions?.length ?? 0) >= 5) return "!bg-[#FF5278] hover:!bg-[#FF6F8E] dark:!bg-[#8a1530]";
  if ((row.revicions?.length ?? 0) >= 2) return "!bg-[#FF9966] hover:!bg-[#FFAA80] dark:!bg-[#8a4020]";
  return "!bg-[#FAD971] hover:!bg-[#FADF89] dark:!bg-[#7a6a10]";
};

// ─── Component ────────────────────────────────────────────────────────────────

const ReportGeneralSec = () => {
  const { sesion } = useContext(SesionContext);
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>(undefined);
  const [fechaFin, setFechaFin] = useState<Date | undefined>(undefined);
  const [tramoInicial, setTramoInicial] = useState<number | null>(null);
  const [tramoFinal, setTramoFinal] = useState<number | null>(null);
  const [listCiudad, setListCiudad] = useState<CiudadInterface[]>([]);
  const [estado, setEstado] = useState<"todos" | "pendiente" | "solucionado">("todos");
  const [prioridad, setPrioridad] = useState<"todos" | "si" | "no">("todos");
  const [list, setList] = useState<EventoInterface[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getCiudad(sesion.token).then(setListCiudad).catch(() => toast.error("Error al cargar las ciudades"));
  }, [sesion.token]);

  const handleGenerar = async () => {
    if (!fechaInicio || !fechaFin) return toast.warning("Selecciona un rango de fechas");
    if (fechaInicio > fechaFin) return toast.warning("La fecha de inicio debe ser anterior a la fecha de fin");

    const inicio = new Date(fechaInicio); inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fechaFin); fin.setHours(23, 59, 59, 0);
    const filtro: ReporteInterface = { fechaInicial: inicio, fechaFinal: fin, TramoInicial: null, TramoFinal: null };

    setLoading(true);
    try {
      let data = await getReporteGeneral(filtro, sesion.token);

      if (tramoInicial && tramoFinal)
        data = data.filter((e) =>
          (e.poste?.id_ciudadA === tramoInicial && e.poste?.id_ciudadB === tramoFinal) ||
          (e.poste?.id_ciudadA === tramoFinal && e.poste?.id_ciudadB === tramoInicial)
        );
      if (estado === "pendiente") data = data.filter((e) => !e.state);
      if (estado === "solucionado") data = data.filter((e) => e.state);
      if (prioridad === "si") data = data.filter((e) => e.priority);
      if (prioridad === "no") data = data.filter((e) => !e.priority);

      if (data.length === 0) {
        toast.warning("No hay datos para el rango seleccionado");
        setList([]);
      } else {
        setList(data);
        toast.success(`${data.length} ${data.length === 1 ? "evento encontrado" : "eventos encontrados"}`);
      }
    } catch {
      toast.error("Error al generar el reporte");
    } finally {
      setLoading(false);
    }
  };

  const handleLimpiar = () => {
    setList([]);
    setFechaInicio(undefined);
    setFechaFin(undefined);
    setTramoInicial(null);
    setTramoFinal(null);
    setEstado("todos");
    setPrioridad("todos");
  };

  const handleExport = async (format: "excel" | "csv" | "pdf") => {
    if (!fechaInicio || !fechaFin) return;
    setExporting(true);
    try {
      if (format === "excel") await exportExcelGeneral(list, fechaInicio, fechaFin);
      else if (format === "csv") exportCsvGeneral(list);
      else await exportPdfGeneral(list, fechaInicio, fechaFin);
    } catch {
      toast.error("Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo<ColumnDef<EventoInterface>[]>(() => [
    {
      id: "num",
      header: "#",
      enableSorting: false,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.index + 1}</span>,
    },
    {
      id: "poste",
      header: "Nmr Poste",
      accessorFn: (row) => row.poste?.name,
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.poste?.name ?? "—"}</span>,
    },
    {
      id: "propietario",
      header: "Propietario",
      accessorFn: (row) => row.poste?.propietario?.name,
      cell: ({ row }) => <span className="text-sm">{row.original.poste?.propietario?.name ?? "—"}</span>,
    },
    {
      id: "tramo",
      header: "Tramo",
      accessorFn: (row) => `${row.poste?.ciudadA?.name} - ${row.poste?.ciudadB?.name}`,
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap">
          {row.original.poste?.ciudadA?.name ?? "—"} → {row.original.poste?.ciudadB?.name ?? "—"}
        </span>
      ),
    },
    {
      id: "fecha",
      header: "Última revisión",
      cell: ({ row }) => {
        const max = latestRevision(row.original.revicions);
        return max.getTime() === 0
          ? <span className="text-xs text-muted-foreground">—</span>
          : <span className="text-xs whitespace-nowrap">{max.toLocaleDateString("es-ES")}</span>;
      },
    },
    {
      id: "description",
      header: "Descripción",
      accessorKey: "description",
      cell: ({ row }) => (
        <span className="text-xs line-clamp-2 max-w-50">{row.original.description}</span>
      ),
    },
    {
      id: "priority",
      header: "Prioritario",
      accessorKey: "priority",
      cell: ({ row }) => (
        <span className="text-xs">{row.original.priority ? "SÍ" : "NO"}</span>
      ),
    },
    {
      id: "revicions",
      header: "Revisiones",
      accessorFn: (row) => row.revicions?.length ?? 0,
      cell: ({ row }) => (
        <span className="text-sm font-semibold">{row.original.revicions?.length ?? 0}</span>
      ),
    },
    {
      id: "image",
      header: "Foto evento",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.image ? (
          <img
            src={`${url}${row.original.image}`}
            className="h-14 w-14 object-cover rounded"
            loading="lazy"
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (row) => row.state,
      cell: ({ row }) => (
        <Badge variant={row.original.state ? "default" : "outline"} className="text-xs whitespace-nowrap">
          {row.original.state ? "Solucionado" : "Pendiente"}
        </Badge>
      ),
    },
    {
      id: "fechaSol",
      header: "Fecha solución",
      cell: ({ row }) => {
        const sol = row.original.solucions?.[0];
        return sol
          ? <span className="text-xs whitespace-nowrap">{new Date(sol.date).toLocaleDateString("es-ES")}</span>
          : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "descSol",
      header: "Descripción solución",
      cell: ({ row }) => {
        const sol = row.original.solucions?.[0];
        return sol
          ? <span className="text-xs line-clamp-2 max-w-45">{sol.description}</span>
          : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "imageSol",
      header: "Foto solución",
      enableSorting: false,
      cell: ({ row }) => {
        const sol = row.original.solucions?.[0];
        return sol?.image ? (
          <img
            src={`${url}${sol.image}`}
            className="h-14 w-14 object-cover rounded"
            loading="lazy"
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
  ], []);

  // ─── Render ───────────────────────────────────────────────────────────────────

  const pendientes = list.filter((e) => !e.state).length;
  const solucionados = list.filter((e) => e.state).length;
  const criticos = list.filter((e) => (e.revicions?.length ?? 0) >= 5).length;
  const prioritarios = list.filter((e) => e.priority).length;

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-muted/60">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle>Reporte General</CardTitle>
          <CardDescription>
            Eventos con revisión en el rango de fechas seleccionado. Incluye datos de poste, evento y solución.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Fecha de inicio</Label>
              <DatePicker value={fechaInicio} onSelect={setFechaInicio} placeholder="Inicio" />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de fin</Label>
              <DatePicker value={fechaFin} onSelect={setFechaFin} placeholder="Fin" />
            </div>
            <div className="space-y-1.5">
              <Label>Tramo desde <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Combobox
                options={listCiudad.filter((c) => c.id !== tramoFinal).map((c) => ({ value: String(c.id), label: c.name }))}
                value={tramoInicial ? String(tramoInicial) : ""}
                onValueChange={(v) => setTramoInicial(v ? Number(v) : null)}
                placeholder="Todas las ciudades"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tramo hasta <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Combobox
                options={listCiudad.filter((c) => c.id !== tramoInicial).map((c) => ({ value: String(c.id), label: c.name }))}
                value={tramoFinal ? String(tramoFinal) : ""}
                onValueChange={(v) => setTramoFinal(v ? Number(v) : null)}
                placeholder="Todas las ciudades"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as typeof estado)}>
                <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="solucionado">Solucionados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={prioridad} onValueChange={(v) => setPrioridad(v as typeof prioridad)}>
                <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="si">Solo prioritarios</SelectItem>
                  <SelectItem value="no">No prioritarios</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleGenerar} disabled={loading} className="h-10 px-6">
              {loading ? <Loader2Icon className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheetIcon className="h-4 w-4 mr-2" />}
              Generar
            </Button>
            {list.length > 0 && (
              <Button variant="outline" onClick={handleLimpiar} className="h-10 px-6">
                Limpiar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {list.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{list.length} {list.length === 1 ? "evento" : "eventos"}</Badge>
            <Badge variant="outline" className="text-amber-600">{pendientes} pendientes</Badge>
            <Badge variant="outline" className="text-green-600">{solucionados} solucionados</Badge>
            <Badge variant="outline" className="text-red-600">{criticos} críticos</Badge>
            {prioritarios > 0 && <Badge variant="destructive">{prioritarios} prioritarios</Badge>}
          </div>
          <Card className="shadow-sm border-muted/60">
            <CardContent className="p-4">
              <DataTable
                data={list}
                loading={false}
                columns={columns}
                hasPaginated={true}
                getRowClassName={getRowBg}
                initialColumnVisibility={{ createdAt: false, updatedAt: false, deletedAt: false }}
                actions={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-1.5" disabled={exporting}>
                        {exporting
                          ? <Loader2Icon className="h-4 w-4 animate-spin" />
                          : <FileIcon className="h-4 w-4 text-muted-foreground" />}
                        {exporting ? "Exportando…" : "Exportar"}
                        <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem className="gap-2" onClick={() => void handleExport("excel")}>
                        <FileSpreadsheetIcon className="h-4 w-4 text-emerald-600" />
                        Excel (.xlsx)
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2" onClick={() => void handleExport("csv")}>
                        <FileTextIcon className="h-4 w-4 text-blue-500" />
                        CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2" onClick={() => void handleExport("pdf")}>
                        <FileIcon className="h-4 w-4 text-red-500" />
                        PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ReportGeneralSec;
