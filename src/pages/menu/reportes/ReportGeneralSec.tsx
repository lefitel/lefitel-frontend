import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";

import { SesionContext } from "../../../context/SesionContext";
import { getReporteGeneral } from "../../../api/reporte.api";
import { getCiudad } from "../../../api/Ciudad.api";
import { CiudadInterface, EventoInterface, ReporteInterface } from "../../../interfaces/interfaces";
import { url } from "../../../api/url";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { DatePicker } from "../../../components/ui/date-picker";
import { Combobox } from "../../../components/ui/combobox";
import { Badge } from "../../../components/ui/badge";
import { Switch } from "../../../components/ui/switch";
import { Loader2Icon, FileSpreadsheetIcon, FileTextIcon, FileIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
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
import { CriticalityBadge } from "../../../components/CriticalityBadge";
import { getEventCriticality } from "../../../lib/criticality";
import { exportExcelGeneral, exportCsvGeneral, exportPdfGeneral, latestRevision } from "../../../lib/exports/reportGeneral";
import { useTramoNeighbors } from "../../../hooks/useTramoNeighbors";

// ─── Row color helpers ────────────────────────────────────────────────────────

const getRowBg = (row: EventoInterface): string => {
  if (row.solucions?.[0]?.image)        return "!bg-[#D4EDDA] hover:!bg-[#C3E6CB]";
  if ((row.revisions?.length ?? 0) >= 5) return "!bg-[#FAD7D7] hover:!bg-[#F5C0C0]";
  if ((row.revisions?.length ?? 0) >  1) return "!bg-[#FDE8D0] hover:!bg-[#FAD8B8]";
  return "!bg-[#FEF9E0] hover:!bg-[#FBF3C8]";
};

// ─── Component ────────────────────────────────────────────────────────────────

const ReportGeneralSec = () => {
  const { sesion } = useContext(SesionContext);
  const navigate = useNavigate();
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>(undefined);
  const [fechaFin, setFechaFin] = useState<Date | undefined>(undefined);
  const [tramoInicial, setTramoInicial] = useState<number | null>(null);
  const [tramoFinal, setTramoFinal] = useState<number | null>(null);
  const [listCiudad, setListCiudad] = useState<CiudadInterface[]>([]);
  const neighbors = useTramoNeighbors(sesion.token);
  const [estado, setEstado] = useState<"todos" | "pendiente" | "solucionado">("todos");
  const [prioridad, setPrioridad] = useState<"todos" | "si" | "no">("todos");
  const [criticidad, setCriticidad] = useState<"todos" | "criticas" | "altas" | "medias" | "bajas" | "sin">("todos");
  const [excludeOld, setExcludeOld] = useState(false);
  const [list, setList] = useState<EventoInterface[]>([]);
  const [appliedRange, setAppliedRange] = useState<{ start: Date; end: Date } | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getCiudad(sesion.token).then(setListCiudad).catch(() => toast.error("Error al cargar las ciudades"));
  }, [sesion.token]);

  useEffect(() => {
    if (tramoInicial && tramoFinal && neighbors.size > 0) {
      const valid = neighbors.get(tramoInicial)?.has(tramoFinal);
      if (!valid) setTramoFinal(null);
    }
  }, [tramoInicial, tramoFinal, neighbors]);

  const handleGenerar = async () => {
    if (!fechaInicio || !fechaFin) return toast.warning("Selecciona un rango de fechas");
    if (fechaInicio > fechaFin) return toast.warning("La fecha de inicio debe ser anterior a la fecha de fin");

    const inicio = new Date(fechaInicio); inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fechaFin); fin.setHours(23, 59, 59, 0);
    const filtro: ReporteInterface = { fechaInicial: inicio, fechaFinal: fin, TramoInicial: null, TramoFinal: null, excludeOld };

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
      if (criticidad !== "todos") {
        data = data.filter((e) => {
          const c = getEventCriticality(e);
          if (criticidad === "sin") return c == null;
          if (criticidad === "criticas") return c != null && c <= 3;
          if (criticidad === "altas") return c != null && c >= 4 && c <= 5;
          if (criticidad === "medias") return c != null && c >= 6 && c <= 7;
          if (criticidad === "bajas") return c != null && c >= 8;
          return true;
        });
      }
      // Sort by criticality ASC (1 = most critical first), then by id DESC
      data = [...data].sort((a, b) => {
        const ca = getEventCriticality(a) ?? 99;
        const cb = getEventCriticality(b) ?? 99;
        if (ca !== cb) return ca - cb;
        return (b.id ?? 0) - (a.id ?? 0);
      });

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
    setEstado("todos");
    setPrioridad("todos");
    setCriticidad("todos");
    setExcludeOld(false);
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
      cell: ({ row, table }) => {
        const visibleIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id);
        const { pageIndex, pageSize } = table.getState().pagination;
        return <span className="text-xs text-muted-foreground">{pageIndex * pageSize + visibleIndex + 1}</span>;
      },
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
      id: "lat",
      header: "Latitud",
      accessorFn: (row) => row.poste?.lat,
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
      accessorFn: (row) => row.poste?.lng,
      cell: ({ row }) => {
        const lng = row.original.poste?.lng;
        return lng != null
          ? <span className="text-xs font-mono text-muted-foreground">{lng.toFixed(4)}</span>
          : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "tramo",
      header: "Tramo",
      accessorFn: (row) => `${row.poste?.ciudadA?.name} - ${row.poste?.ciudadB?.name}`,
      cell: ({ row }) => {
        const a = row.original.poste?.ciudadA;
        const b = row.original.poste?.ciudadB;
        return (
          <span className="flex items-center gap-0.5 text-xs whitespace-nowrap">
            {a?.id ? <button className="hover:underline hover:text-foreground" onClick={(e) => { e.stopPropagation(); navigate(`/app/ciudades/${a.id}`); }}>{a.name}</button> : (a?.name ?? "—")}
            <ChevronRightIcon className="h-3 w-3 mx-0.5 shrink-0" />
            {b?.id ? <button className="hover:underline hover:text-foreground" onClick={(e) => { e.stopPropagation(); navigate(`/app/ciudades/${b.id}`); }}>{b.name}</button> : (b?.name ?? "—")}
          </span>
        );
      },
    },
    {
      id: "fechaRev",
      header: "Fecha rev.",
      cell: ({ row }) => {
        const max = latestRevision(row.original.revisions);
        return max.getTime() === 0
          ? <span className="text-xs text-muted-foreground">—</span>
          : <span className="text-xs whitespace-nowrap">{max.toLocaleDateString("es-ES")}</span>;
      },
    },
    {
      id: "horaRev",
      header: "Hora rev.",
      enableSorting: false,
      cell: ({ row }) => {
        const max = latestRevision(row.original.revisions);
        return max.getTime() === 0
          ? <span className="text-xs text-muted-foreground">—</span>
          : <span className="text-xs whitespace-nowrap font-mono">{max.toLocaleTimeString("es-ES")}</span>;
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
      id: "revisions",
      header: "Revisiones",
      accessorFn: (row) => row.revisions?.length ?? 0,
      cell: ({ row }) => (
        <span className="text-sm font-semibold">{row.original.revisions?.length ?? 0}</span>
      ),
    },
    {
      id: "criticality",
      header: "Criticidad",
      accessorFn: (row) => getEventCriticality(row) ?? 99,
      cell: ({ row }) => <CriticalityBadge level={getEventCriticality(row.original)} compact />,
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
      id: "image",
      header: "Foto evento",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.image ? (
          <img src={`${url}${row.original.image}`} className="h-14 w-14 object-cover rounded" loading="lazy" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "fechaSol",
      header: "Fecha sol.",
      cell: ({ row }) => {
        const sol = row.original.solucions?.[0];
        return sol
          ? <span className="text-xs whitespace-nowrap">{new Date(sol.date).toLocaleDateString("es-ES")}</span>
          : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "horaSol",
      header: "Hora sol.",
      enableSorting: false,
      cell: ({ row }) => {
        const sol = row.original.solucions?.[0];
        return sol
          ? <span className="text-xs whitespace-nowrap font-mono">{new Date(sol.date).toLocaleTimeString("es-ES")}</span>
          : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "descSol",
      header: "Descripción sol.",
      cell: ({ row }) => {
        const sol = row.original.solucions?.[0];
        return sol
          ? <span className="text-xs line-clamp-2 max-w-45">{sol.description}</span>
          : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "imageSol",
      header: "Foto sol.",
      enableSorting: false,
      cell: ({ row }) => {
        const sol = row.original.solucions?.[0];
        return sol?.image ? (
          <img src={`${url}${sol.image}`} className="h-14 w-14 object-cover rounded" loading="lazy" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
  ], [navigate]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  const pendientes   = list.filter((e) => !e.state).length;
  const solucionados = list.filter((e) => e.state).length;
  const criticos     = list.filter((e) => (e.revisions?.length ?? 0) >= 5).length;
  const prioritarios = list.filter((e) => e.priority).length;
  const nuevas       = appliedRange
    ? list.filter((e) => {
        if (!e.date) return false;
        const d = new Date(e.date).getTime();
        return d >= appliedRange.start.getTime() && d <= appliedRange.end.getTime();
      }).length
    : 0;
  const arrastradas  = list.length - nuevas;
  // Criticality breakdown
  const critCount = useMemo(() => {
    const counts = { criticas: 0, altas: 0, medias: 0, bajas: 0, sin: 0 };
    list.forEach((e) => {
      const c = getEventCriticality(e);
      if (c == null) counts.sin++;
      else if (c <= 3) counts.criticas++;
      else if (c <= 5) counts.altas++;
      else if (c <= 7) counts.medias++;
      else counts.bajas++;
    });
    return counts;
  }, [list]);

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-muted/60">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle>Reporte General</CardTitle>
          <CardDescription>
            Eventos con revisión en el rango de fechas seleccionado. Incluye datos de poste, evento y solución.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-2 gap-y-3 items-end">
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
                options={listCiudad
                  .filter((c) => {
                    if (c.id == null || c.id === tramoFinal) return false;
                    if (!tramoFinal) return (neighbors.get(c.id)?.size ?? 0) > 0;
                    return neighbors.get(tramoFinal)?.has(c.id) ?? false;
                  })
                  .map((c) => ({ value: String(c.id), label: c.name }))}
                value={tramoInicial ? String(tramoInicial) : ""}
                onValueChange={(v) => setTramoInicial(v ? Number(v) : null)}
                placeholder="Todas las ciudades"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tramo hasta <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Combobox
                options={listCiudad
                  .filter((c) => {
                    if (c.id == null || c.id === tramoInicial) return false;
                    if (!tramoInicial) return (neighbors.get(c.id)?.size ?? 0) > 0;
                    return neighbors.get(tramoInicial)?.has(c.id) ?? false;
                  })
                  .map((c) => ({ value: String(c.id), label: c.name }))}
                value={tramoFinal ? String(tramoFinal) : ""}
                onValueChange={(v) => setTramoFinal(v ? Number(v) : null)}
                placeholder="Todas las ciudades"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-2 gap-y-3 items-end">
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as typeof estado)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="si">Solo prioritarios</SelectItem>
                  <SelectItem value="no">No prioritarios</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Criticidad</Label>
              <Select value={criticidad} onValueChange={(v) => setCriticidad(v as typeof criticidad)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="criticas">Críticas (1-3)</SelectItem>
                  <SelectItem value="altas">Altas (4-5)</SelectItem>
                  <SelectItem value="medias">Medias (6-7)</SelectItem>
                  <SelectItem value="bajas">Bajas (8-9)</SelectItem>
                  <SelectItem value="sin">Sin clasificar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
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
          <div className="flex gap-2 mt-3 justify-end">
            <Button onClick={handleGenerar} disabled={loading}>
              {loading ? <Loader2Icon className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheetIcon className="h-4 w-4 mr-2" />}
              Generar
            </Button>
            {list.length > 0 && (
              <Button variant="outline" onClick={handleLimpiar}>
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
            {!excludeOld && arrastradas > 0 && (
              <Badge variant="outline" className="text-blue-600" title="Eventos creados en el rango / Eventos creados antes pero revisados en el rango">
                {nuevas} nuevas · {arrastradas} arrastradas
              </Badge>
            )}
            {excludeOld && (
              <Badge variant="outline" className="text-blue-600">
                solo nuevas del período
              </Badge>
            )}
            <Badge variant="outline" className="text-amber-600">{pendientes} pendientes</Badge>
            <Badge variant="outline" className="text-green-600">{solucionados} solucionados</Badge>
            <Badge variant="outline" className="text-red-600">{criticos} críticos</Badge>
            {prioritarios > 0 && <Badge variant="destructive">{prioritarios} prioritarios</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center mr-1">Por criticidad:</span>
            {critCount.criticas > 0 && (
              <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-700">
                {critCount.criticas} críticas (1-3)
              </Badge>
            )}
            {critCount.altas > 0 && (
              <Badge variant="outline" className="border-yellow-500/40 bg-yellow-500/10 text-yellow-700">
                {critCount.altas} altas (4-5)
              </Badge>
            )}
            {critCount.medias > 0 && (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700">
                {critCount.medias} medias (6-7)
              </Badge>
            )}
            {critCount.bajas > 0 && (
              <Badge variant="outline" className="border-blue-500/40 bg-blue-500/10 text-blue-700">
                {critCount.bajas} bajas (8-9)
              </Badge>
            )}
            {critCount.sin > 0 && (
              <Badge variant="outline" className="border-dashed text-muted-foreground">
                {critCount.sin} sin clasificar
              </Badge>
            )}
          </div>
          <Card className="shadow-sm border-muted/60 py-0">
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ReportGeneralSec;
