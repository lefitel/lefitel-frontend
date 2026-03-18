import { useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import { SesionContext } from "../../../context/SesionContext";
import { getReporteTramo } from "../../../api/reporte.api";
import { getCiudad } from "../../../api/Ciudad.api";
import {
  AdssInterface,
  AdssPosteInterface,
  CiudadInterface,
  EventoInterface,
  EventoObsInterface,
  MaterialInterface,
  ObsInterface,
  PropietarioInterface,
  ReporteInterface,
} from "../../../interfaces/interfaces";
import { getAdss } from "../../../api/Adss.api";
import { getMaterial } from "../../../api/Material.api";
import { getPropietario } from "../../../api/Propietario.api";
import { getObs } from "../../../api/Obs.api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { DatePicker } from "../../../components/ui/date-picker";
import { Combobox } from "../../../components/ui/combobox";
import { Loader2Icon, FileSpreadsheetIcon, FileTextIcon, FileIcon, ChevronDownIcon } from "lucide-react";
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

// ─── Excel export (planilla nacional) ─────────────────────────────────────────

interface TramoExcelParams {
  list: EventoInterface[];
  listPropietario: PropietarioInterface[];
  listMaterial: MaterialInterface[];
  listAdss: AdssInterface[];
  listObs: ObsInterface[];
  listCiudad: CiudadInterface[];
  tramoInicial: number | null;
  tramoFinal: number | null;
  fechaInicio: Date;
  fechaFin: Date;
}

const exportExcelTramo = async (p: TramoExcelParams) => {
  const {
    list, listPropietario, listMaterial, listAdss, listObs,
    listCiudad, tramoInicial, tramoFinal, fechaInicio, fechaFin,
  } = p;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Lefitel";
  wb.created = new Date();
  const ws = wb.addWorksheet("Reporte Por Tramo");

  // ── Build column layout ────────────────────────────────────────────────────
  // Fixed: # | Poste | Prioritario
  // Groups: Propietario | Material | Adss | Coordenadas | Observaciones
  const nProp = listPropietario.length;
  const nMat  = listMaterial.length;
  const nAdss = listAdss.length;
  const nObs  = listObs.length;
  const totalCols = 3 + nProp + nMat + nAdss + 2 + nObs; // 2 = lat + lng

  // Column widths: default 3, Poste/Lat/Lng = 15
  const colWidths: number[] = [];
  colWidths.push(3);  // #
  colWidths.push(15); // Poste
  colWidths.push(3);  // Prioritario
  for (let i = 0; i < nProp + nMat + nAdss; i++) colWidths.push(3);
  colWidths.push(15); // Latitud
  colWidths.push(15); // Longitud
  for (let i = 0; i < nObs; i++) colWidths.push(3);

  ws.columns = colWidths.map((w, i) => ({ key: `c${i + 1}`, width: w }));

  // ── Group section ranges (1-indexed columns) ──────────────────────────────
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

  const groupColors: Record<string, string> = {
    Propietario: "FF6FA8DC",
    Material:    "FFE06666",
    Adss:        "FFE2AC3F",
    Coordenadas: "FFF8EBBE",
    Observaciones: "FF7BA58D",
  };

  // ── Row 1: title (merged A1:lastCol) ─────────────────────────────────────
  ws.addRow([]);
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = "PLANILLA DE EVENTOS NACIONAL";
  titleCell.font = { bold: true, size: 20 };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 28;

  // ── Rows 2-4: metadata (A:E label, F:lastCol value) ──────────────────────
  const metaLabelEnd = Math.min(5, totalCols);
  const metaValueEnd = totalCols;

  const META_ROWS = [
    ["Tramo:", (() => {
      const cA = listCiudad.find((c) => c.id === tramoInicial);
      const cB = listCiudad.find((c) => c.id === tramoFinal);
      return cA && cB ? `${cA.name} — ${cB.name}` : "Total";
    })()],
    ["Fecha:", `${fechaInicio.toLocaleDateString("es-ES")} - ${fechaFin.toLocaleDateString("es-ES")}`],
    ["Elaborado por:", "Lefitel"],
  ];

  for (const [label, value] of META_ROWS) {
    ws.addRow([]);
    const r = ws.lastRow!.number;
    ws.mergeCells(r, 1, r, metaLabelEnd);
    ws.mergeCells(r, metaLabelEnd + 1, r, metaValueEnd);
    ws.getCell(r, 1).value = label;
    ws.getCell(r, metaLabelEnd + 1).value = value;
    [ws.getCell(r, 1), ws.getCell(r, metaLabelEnd + 1)].forEach((c) => {
      c.font = { bold: true, size: 14 };
      c.alignment = { vertical: "middle" };
    });
    ws.getRow(r).height = 22;
  }

  // ── Row 5: group header labels ─────────────────────────────────────────────
  ws.addRow([]);
  const groupRow = ws.lastRow!.number;

  const groups: Array<[string, number, number]> = [];
  if (nProp > 0) groups.push(["Propietario", propStart, propEnd]);
  if (nMat  > 0) groups.push(["Material", matStart, matEnd]);
  if (nAdss > 0) groups.push(["Adss", adssStart, adssEnd]);
  groups.push(["Coordenadas", latCol, lngCol]);
  if (nObs  > 0) groups.push(["Observaciones", obsStart, obsEnd]);

  for (const [name, start, end] of groups) {
    if (start <= end) ws.mergeCells(groupRow, start, groupRow, end);
    ws.getCell(groupRow, start).value = name;
    for (let c = start; c <= end; c++) {
      ws.getCell(groupRow, c).fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: groupColors[name] ?? "FFFFFFFF" },
      };
    }
    ws.getCell(groupRow, start).font = { bold: true, size: 13 };
    ws.getCell(groupRow, start).alignment = { vertical: "middle", horizontal: "center" };
  }
  ws.getRow(groupRow).height = 20;

  // ── Row 6: column headers (rotated 90° for narrow cols) ───────────────────
  const headers: string[] = [
    "#", "Poste", "Prioritario",
    ...listPropietario.map((x) => x.name),
    ...listMaterial.map((x) => x.name),
    ...listAdss.map((x) => x.name),
    "Latitud", "Longitud",
    ...listObs.map((x) => x.name),
  ];

  ws.addRow(headers);
  const hdrRow = ws.lastRow!.number;
  ws.getRow(hdrRow).height = 150;

  for (let c = 1; c <= totalCols; c++) {
    const cell = ws.getCell(hdrRow, c);
    const isWide = cell.value === "Poste" || cell.value === "Latitud" || cell.value === "Longitud";
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF92CDDC" } };
    cell.alignment = {
      vertical: "middle", horizontal: "center", wrapText: true,
      textRotation: isWide ? 0 : 90,
    };
    cell.border = {
      top: { style: "medium" }, left: { style: "medium" },
      bottom: { style: "medium" }, right: { style: "medium" },
    };
  }

  // ── Data rows ──────────────────────────────────────────────────────────────
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const rowData: (string | number)[] = [
      i + 1,
      e.poste?.name ?? "",
      e.priority ? "1" : "",
      ...listPropietario.map((prop) => e.poste?.propietario?.id === prop.id ? "1" : ""),
      ...listMaterial.map((mat) => e.poste?.material?.id === mat.id ? "1" : ""),
      ...listAdss.map((adss) =>
        ((e.poste?.adsspostes ?? []) as AdssPosteInterface[]).some((ap) => ap.id_adss === adss.id) ? "1" : ""
      ),
      e.poste?.lat ?? "",
      e.poste?.lng ?? "",
      ...listObs.map((obs) =>
        (e.eventoObs ?? []).some((eo: EventoObsInterface) => eo.id_obs === obs.id) ? "1" : ""
      ),
    ];

    ws.addRow(rowData);
    const dataRow = ws.lastRow!;
    dataRow.height = 15;
    dataRow.alignment = { vertical: "middle", horizontal: "center" };

    const rn = dataRow.number;
    const isLast = i === list.length - 1;
    for (let c = 1; c <= totalCols; c++) {
      ws.getCell(rn, c).border = isLast
        ? { left: { style: "thin" }, bottom: { style: "medium" }, right: { style: "thin" } }
        : { left: { style: "thin" }, bottom: { style: "dashed" }, right: { style: "thin" } };
    }
  }

  const dateStr = new Date().toLocaleDateString("es-ES").replace(/\//g, "-");
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `reporte_tramo_${dateStr}.xlsx`);
};

// ─── CSV / PDF export ─────────────────────────────────────────────────────────

const PRIMARY_T: [number, number, number] = [0, 31, 93];

const PDF_HEADERS_T = [
  "#", "Poste", "Prioritario", "Propietario", "Material", "Latitud", "Longitud", "Adss", "Observaciones",
];

const toRowsTramo = (
  list: EventoInterface[],
  listAdss: AdssInterface[],
  listObs: ObsInterface[],
) =>
  list.map((e, i) => {
    const matchedAdss = listAdss
      .filter((a) => ((e.poste?.adsspostes ?? []) as AdssPosteInterface[]).some((ap) => ap.id_adss === a.id))
      .map((a) => a.name)
      .join(", ");
    const matchedObs = listObs
      .filter((o) => (e.eventoObs ?? []).some((eo: EventoObsInterface) => eo.id_obs === o.id))
      .map((o) => o.name)
      .join(", ");
    return [
      String(i + 1),
      e.poste?.name ?? "",
      e.priority ? "SÍ" : "NO",
      e.poste?.propietario?.name ?? "",
      e.poste?.material?.name ?? "",
      e.poste?.lat != null ? String(e.poste.lat) : "",
      e.poste?.lng != null ? String(e.poste.lng) : "",
      matchedAdss,
      matchedObs,
    ];
  });

const exportCsvTramo = (
  list: EventoInterface[],
  listAdss: AdssInterface[],
  listObs: ObsInterface[],
) => {
  const esc = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [
    PDF_HEADERS_T.map(esc).join(","),
    ...toRowsTramo(list, listAdss, listObs).map((r) => r.map(esc).join(",")),
  ];
  const dateStr = new Date().toLocaleDateString("es-ES").replace(/\//g, "-");
  saveAs(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }), `reporte_tramo_${dateStr}.csv`);
};

const exportPdfTramo = async (
  list: EventoInterface[],
  listAdss: AdssInterface[],
  listObs: ObsInterface[],
  fechaInicio: Date,
  fechaFin: Date,
  tramoInicial: number | null,
  tramoFinal: number | null,
  listCiudad: CiudadInterface[],
) => {
  const res  = await fetch(logoUrl);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  const cA = listCiudad.find((c) => c.id === tramoInicial);
  const cB = listCiudad.find((c) => c.id === tramoFinal);
  const tramoLabel = cA && cB ? `${cA.name} — ${cB.name}` : "Total";

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, 28, "F");
  doc.addImage(dataUrl, "PNG", 10, 4, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...PRIMARY_T);
  doc.text("LEFITEL", 34, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 90, 110);
  doc.text(`Reporte Por Tramo — ${tramoLabel}`, 34, 18);
  const rangeStr = `${fechaInicio.toLocaleDateString("es-ES")} — ${fechaFin.toLocaleDateString("es-ES")}`;
  doc.setFontSize(8); doc.setTextColor(150, 160, 175);
  doc.text(rangeStr, W - 14, 18, { align: "right" });
  doc.setFillColor(...PRIMARY_T);
  doc.rect(0, 28, W, 1.5, "F");

  autoTable(doc, {
    startY: 33,
    head: [PDF_HEADERS_T],
    body: toRowsTramo(list, listAdss, listObs),
    styles: { fontSize: 6.5, cellPadding: { top: 2, right: 2, bottom: 2, left: 2 }, valign: "middle", textColor: [30, 40, 60] },
    headStyles: { fillColor: PRIMARY_T, textColor: [255, 255, 255], fontStyle: "bold" },
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
  doc.save(`reporte_tramo_${dateStr}.pdf`);
};

// ─── Component ────────────────────────────────────────────────────────────────

const ReportTramoSec = () => {
  const { sesion } = useContext(SesionContext);
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>(undefined);
  const [fechaFin, setFechaFin]       = useState<Date | undefined>(undefined);
  const [tramoInicial, setTramoInicial] = useState<number | null>(null);
  const [tramoFinal,   setTramoFinal]   = useState<number | null>(null);
  const [listCiudad,   setListCiudad]   = useState<CiudadInterface[]>([]);
  const [list, setList]               = useState<EventoInterface[]>([]);
  const [loading, setLoading]         = useState(false);
  const [exporting, setExporting]     = useState(false);

  const [listAdss,        setListAdss]        = useState<AdssInterface[]>([]);
  const [listMaterial,    setListMaterial]    = useState<MaterialInterface[]>([]);
  const [listPropietario, setListPropietario] = useState<PropietarioInterface[]>([]);
  const [listObs,         setListObs]         = useState<ObsInterface[]>([]);
  const [metadataLoaded,  setMetadataLoaded]  = useState(false);

  useEffect(() => {
    getCiudad(sesion.token).then(setListCiudad).catch(() => toast.error("Error al cargar las ciudades"));
  }, [sesion.token]);

  const handleGenerar = async () => {
    if (!fechaInicio || !fechaFin) return toast.warning("Selecciona un rango de fechas");
    if (fechaInicio > fechaFin)    return toast.warning("La fecha de inicio debe ser anterior a la fecha de fin");

    const inicio = new Date(fechaInicio); inicio.setHours(0, 0, 0, 0);
    const fin    = new Date(fechaFin);    fin.setHours(23, 59, 59, 0);
    const filtro: ReporteInterface = { fechaInicial: inicio, fechaFinal: fin, TramoInicial: null, TramoFinal: null };

    setLoading(true);
    try {
      if (!metadataLoaded) {
        const [adss, material, propietario, obs] = await Promise.all([
          getAdss(sesion.token),
          getMaterial(sesion.token),
          getPropietario(sesion.token),
          getObs(sesion.token),
        ]);
        setListAdss(adss);
        setListMaterial(material);
        setListPropietario(propietario);
        setListObs(obs);
        setMetadataLoaded(true);
      }

      let data = await getReporteTramo(filtro, sesion.token);

      if (tramoInicial && tramoFinal) {
        data = data.filter((e) =>
          (e.poste?.id_ciudadA === tramoInicial && e.poste?.id_ciudadB === tramoFinal) ||
          (e.poste?.id_ciudadA === tramoFinal   && e.poste?.id_ciudadB === tramoInicial)
        );
      }

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
  };

  const handleExport = async (format: "excel" | "csv" | "pdf") => {
    if (!fechaInicio || !fechaFin) return;
    setExporting(true);
    try {
      if (format === "excel") {
        await exportExcelTramo({
          list, listPropietario, listMaterial, listAdss, listObs,
          listCiudad, tramoInicial, tramoFinal, fechaInicio, fechaFin,
        });
      } else if (format === "csv") {
        exportCsvTramo(list, listAdss, listObs);
      } else {
        await exportPdfTramo(list, listAdss, listObs, fechaInicio, fechaFin, tramoInicial, tramoFinal, listCiudad);
      }
    } catch {
      toast.error("Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  // ─── DataTable columns (readable summary — full matrix is in Excel) ─────────

  const columns = useMemo<ColumnDef<EventoInterface>[]>(() => [
    {
      id: "num",
      header: "#",
      enableSorting: false,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.index + 1}</span>,
    },
    {
      id: "poste",
      header: "Poste",
      accessorFn: (r) => r.poste?.name,
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.poste?.name ?? "—"}</span>,
    },
    {
      id: "priority",
      header: "Prioritario",
      accessorFn: (r) => r.priority,
      cell: ({ row }) => <span className="text-xs">{row.original.priority ? "SÍ" : "NO"}</span>,
    },
    {
      id: "propietario",
      header: "Propietario",
      accessorFn: (r) => r.poste?.propietario?.name,
      cell: ({ row }) => <span className="text-sm">{row.original.poste?.propietario?.name ?? "—"}</span>,
    },
    {
      id: "material",
      header: "Material",
      accessorFn: (r) => r.poste?.material?.name,
      cell: ({ row }) => <span className="text-sm">{row.original.poste?.material?.name ?? "—"}</span>,
    },
    {
      id: "coords",
      header: "Coordenadas",
      enableSorting: false,
      cell: ({ row }) => {
        const { lat, lng } = row.original.poste ?? {};
        if (!lat && !lng) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <span className="text-xs font-mono whitespace-nowrap text-muted-foreground">
            {lat?.toFixed(4)}, {lng?.toFixed(4)}
          </span>
        );
      },
    },
    {
      id: "adss",
      header: "Adss",
      enableSorting: false,
      cell: ({ row }) => {
        const matched = listAdss.filter((a) =>
          ((row.original.poste?.adsspostes ?? []) as AdssPosteInterface[]).some((ap) => ap.id_adss === a.id)
        );
        return matched.length > 0
          ? <span className="text-xs">{matched.map((a) => a.name).join(", ")}</span>
          : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "obs",
      header: "Observaciones",
      enableSorting: false,
      cell: ({ row }) => {
        const matched = listObs.filter((o) =>
          (row.original.eventoObs ?? []).some((eo: EventoObsInterface) => eo.id_obs === o.id)
        );
        return matched.length > 0
          ? <span className="text-xs">{matched.map((o) => o.name).join(", ")}</span>
          : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
  ], [listAdss, listObs]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-muted/60">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle>Reporte Por Tramo</CardTitle>
          <CardDescription>
            Eventos con revisión en el período. Columnas dinámicas por propietario, material, ADSS y observaciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
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
          <div className="flex gap-2 mt-5">
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
        <Card className="shadow-sm border-muted/60">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Resultados</CardTitle>
              <span className="text-sm text-muted-foreground">
                {list.length} {list.length === 1 ? "evento" : "eventos"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <DataTable
              data={list}
              loading={false}
              columns={columns}
              hasPaginated={true}
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
      )}
    </div>
  );
};

export default ReportTramoSec;
