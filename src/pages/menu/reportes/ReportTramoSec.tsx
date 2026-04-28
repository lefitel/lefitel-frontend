import { useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ColumnDef, Row } from "@tanstack/react-table";

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
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import { Loader2Icon, FileSpreadsheetIcon, FileTextIcon, FileIcon, ChevronDownIcon, CheckIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import DataTable from "../../../components/table/DataTable";
import { exportExcelTramo, exportCsvTramo, exportPdfTramo } from "../../../lib/exports/reportTramo";

// ─── Component ────────────────────────────────────────────────────────────────

const ReportTramoSec = () => {
  const { sesion } = useContext(SesionContext);
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>(undefined);
  const [fechaFin, setFechaFin]       = useState<Date | undefined>(undefined);
  const [tramoInicial, setTramoInicial] = useState<number | null>(null);
  const [tramoFinal,   setTramoFinal]   = useState<number | null>(null);
  const [listCiudad,   setListCiudad]   = useState<CiudadInterface[]>([]);
  const [excludeOld, setExcludeOld]   = useState(false);
  const [list, setList]               = useState<EventoInterface[]>([]);
  const [appliedRange, setAppliedRange] = useState<{ start: Date; end: Date } | null>(null);
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
    const filtro: ReporteInterface = { fechaInicial: inicio, fechaFinal: fin, TramoInicial: null, TramoFinal: null, excludeOld };

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
        setAppliedRange(null);
      } else {
        setList(data);
        setAppliedRange({ start: inicio, end: fin });
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
    setAppliedRange(null);
    setFechaInicio(undefined);
    setFechaFin(undefined);
    setTramoInicial(null);
    setTramoFinal(null);
    setExcludeOld(false);
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
        await exportPdfTramo(list, listAdss, listObs, listPropietario, listMaterial, fechaInicio, fechaFin, tramoInicial, tramoFinal, listCiudad);
      }
    } catch {
      toast.error("Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  // ─── DataTable columns (matrix — mirrors Excel layout) ───────────────────────

  const check = (bg: string, color: string) => (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded ${bg}`}>
      <CheckIcon className={`h-3.5 w-3.5 ${color}`} />
    </span>
  );

  const vHeader = (label: string) => (
    <span
      className="text-[10px] font-medium leading-tight block"
      style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
    >
      {label}
    </span>
  );

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
      header: () => vHeader("Prioritario"),
      enableSorting: false,
      cell: ({ row }) => row.original.priority ? check("bg-[#FDE8D0]", "text-orange-600") : null,
    },
    // ── Propietario columns ──────────────────────────────────────────────────
    ...listPropietario.map((prop) => ({
      id: `prop_${prop.id}`,
      header: () => vHeader(prop.name),
      enableSorting: false,
      cell: ({ row }: { row: Row<EventoInterface> }) =>
        row.original.poste?.propietario?.id === prop.id
          ? check("bg-[#BDD7EE]", "text-blue-700")
          : null,
    })),
    // ── Material columns ─────────────────────────────────────────────────────
    ...listMaterial.map((mat) => ({
      id: `mat_${mat.id}`,
      header: () => vHeader(mat.name),
      enableSorting: false,
      cell: ({ row }: { row: Row<EventoInterface> }) =>
        row.original.poste?.material?.id === mat.id
          ? check("bg-[#E8B4B8]", "text-rose-700")
          : null,
    })),
    // ── Adss columns ─────────────────────────────────────────────────────────
    ...listAdss.map((adss) => ({
      id: `adss_${adss.id}`,
      header: () => vHeader(adss.name),
      enableSorting: false,
      cell: ({ row }: { row: Row<EventoInterface> }) =>
        ((row.original.poste?.adsspostes ?? []) as AdssPosteInterface[]).some((ap) => ap.id_adss === adss.id)
          ? check("bg-[#FFE599]", "text-yellow-700")
          : null,
    })),
    {
      id: "lat",
      header: "Latitud",
      accessorFn: (r) => r.poste?.lat,
      cell: ({ row }) => {
        const lat = row.original.poste?.lat;
        return lat != null
          ? <span className="text-xs font-mono text-muted-foreground">{lat.toFixed(4)}</span>
          : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "lng",
      header: "Longitud",
      accessorFn: (r) => r.poste?.lng,
      cell: ({ row }) => {
        const lng = row.original.poste?.lng;
        return lng != null
          ? <span className="text-xs font-mono text-muted-foreground">{lng.toFixed(4)}</span>
          : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    // ── Observaciones columns ────────────────────────────────────────────────
    ...listObs.map((obs) => ({
      id: `obs_${obs.id}`,
      header: () => vHeader(obs.name),
      enableSorting: false,
      cell: ({ row }: { row: Row<EventoInterface> }) =>
        (row.original.eventoObs ?? []).some((eo: EventoObsInterface) => eo.id_obs === obs.id)
          ? check("bg-[#D4EDDA]", "text-green-700")
          : null,
    })),
  ], [listAdss, listObs, listPropietario, listMaterial]);

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
          <div className="mt-5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Switch checked={excludeOld} onCheckedChange={setExcludeOld} />
              <span className="text-sm">
                Excluir incidencias antiguas
                <span className="block text-xs text-muted-foreground">
                  Solo eventos creados en el rango (ignora arrastrados de meses anteriores)
                </span>
              </span>
            </label>
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

      {list.length > 0 && (() => {
        const nuevas = appliedRange
          ? list.filter((e) => {
              if (!e.date) return false;
              const d = new Date(e.date).getTime();
              return d >= appliedRange.start.getTime() && d <= appliedRange.end.getTime();
            }).length
          : 0;
        const arrastradas = list.length - nuevas;
        return (
        <Card className="shadow-sm border-muted/60">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>Resultados</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{list.length} {list.length === 1 ? "evento" : "eventos"}</Badge>
                {!excludeOld && arrastradas > 0 && (
                  <Badge variant="outline" className="text-blue-600" title="Eventos creados en el rango / Eventos creados antes pero revisados en el rango">
                    {nuevas} nuevas · {arrastradas} arrastradas
                  </Badge>
                )}
                {excludeOld && (
                  <Badge variant="outline" className="text-blue-600">solo nuevas del período</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="[&_td]:border [&_td]:border-border/20 [&_th]:border [&_th]:border-border/20">
            <DataTable
              data={list}
              loading={false}
              columns={columns}
              hasPaginated={true}
              actions={
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground shadow-xs hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    disabled={exporting}
                  >
                    {exporting
                      ? <Loader2Icon className="h-4 w-4 animate-spin" />
                      : <FileIcon className="h-4 w-4 text-muted-foreground" />}
                    {exporting ? "Exportando…" : "Exportar"}
                    <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
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
            </div>
          </CardContent>
        </Card>
        );
      })()}
    </div>
  );
};

export default ReportTramoSec;
