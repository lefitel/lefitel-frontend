import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Col } from "../../../components/table/tableFeatures";
import { getReporteGeneral } from "../../../api/reporte.api";
import { mensajeDeError } from "../../../api/descarga";
import {
  estadoTrasFallo, getOpcionesReporte, EstadoOpciones,
} from "../../../api/opciones.api";
import { EventoInterface, ReporteInterface, Tramo } from "../../../interfaces/interfaces";
import { imageUrl } from "../../../lib/imageUrl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button, buttonVariants } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { DatePicker } from "../../../components/ui/date-picker";
import TramoCombobox from "../../../components/TramoCombobox";
import { Badge } from "../../../components/ui/badge";
import { Switch } from "../../../components/ui/switch";
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
import { CriticalityBadge } from "../../../components/CriticalityBadge";
import { getEventCriticality } from "../../../lib/criticality";
import { exportExcelGeneral, exportCsvGeneral, exportPdfGeneral, latestRevision } from "../../../lib/exports/reportGeneral";
import { nombreDelTramo } from "../../../lib/tramo";
import TramoEnlazado from "../../../components/TramoEnlazado";
import { rowNumberColumn } from "../../../components/table/rowNumberColumn";
import { cn } from "../../../lib/utils";

// ─── Row color helpers ────────────────────────────────────────────────────────

const getRowBg = (row: EventoInterface): string => {
  if (row.solucions?.[0]?.image)        return "!bg-[#D4EDDA] hover:!bg-[#C3E6CB]";
  if ((row.revisions?.length ?? 0) >= 5) return "!bg-[#FAD7D7] hover:!bg-[#F5C0C0]";
  if ((row.revisions?.length ?? 0) >  1) return "!bg-[#FDE8D0] hover:!bg-[#FAD8B8]";
  return "!bg-[#FEF9E0] hover:!bg-[#FBF3C8]";
};

// ─── Component ────────────────────────────────────────────────────────────────

const ReportGeneralSec = () => {
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>(undefined);
  const [fechaFin, setFechaFin] = useState<Date | undefined>(undefined);
  /** The tramo the selector shows now; `null` is "Todos los tramos". */
  const [tramoId, setTramoId] = useState<number | null>(null);
  const [tramos, setTramos] = useState<Tramo[]>([]);
  /** Why the tramo list is empty. See `ReportTramoSec` for the long version. */
  const [estadoOpciones, setEstadoOpciones] = useState<EstadoOpciones>("cargando");
  const [estado, setEstado] = useState<"todos" | "pendiente" | "solucionado">("todos");
  const [prioridad, setPrioridad] = useState<"todos" | "si" | "no">("todos");
  const [criticidad, setCriticidad] = useState<"todos" | "criticas" | "altas" | "medias" | "bajas" | "sin">("todos");
  const [excludeOld, setExcludeOld] = useState(false);
  const [list, setList] = useState<EventoInterface[]>([]);
  /**
   * The filter the rows on screen were generated with. Set with `list` and
   * cleared with it, so everything that describes the rows — the file's period
   * header, the "nuevas · arrastradas" badge — reads this and never the live
   * controls, which can be moved without pressing Generar. The tramo is not
   * kept: each row names its own.
   */
  const [applied, setApplied] = useState<{
    start: Date; end: Date; excludeOld: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // One request for the report's lists, tramos included: the selector must
  // not ask this endpoint a second time for them.
  useEffect(() => {
    getOpcionesReporte()
      .then((opciones) => {
        setTramos(opciones.tramos);
        setEstadoOpciones("listas");
      })
      .catch((error) => {
        const estado = estadoTrasFallo(error);
        setEstadoOpciones(estado);
        toast.error(estado === "denegado"
          ? "No tiene permiso para consultar los catálogos de informes."
          : "No se pudieron cargar los catálogos del informe.");
      });
  }, []);

  const handleGenerar = async () => {
    if (!fechaInicio || !fechaFin) return toast.warning("Selecciona un rango de fechas");
    if (fechaInicio > fechaFin) return toast.warning("La fecha de inicio debe ser anterior a la fecha de fin");

    const inicio = new Date(fechaInicio); inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fechaFin); fin.setHours(23, 59, 59, 0);
    // The server narrows by the tramo; the key is left out, not sent empty,
    // when none is chosen (`tramo=` is a 400).
    const filtro: ReporteInterface = {
      fechaInicial: inicio, fechaFinal: fin, excludeOld, ...(tramoId !== null ? { tramo: tramoId } : {}),
    };

    setLoading(true);
    try {
      let data = await getReporteGeneral(filtro);

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
        setApplied(null);
      } else {
        setList(data);
        setApplied({ start: inicio, end: fin, excludeOld });
        toast.success(`${data.length} ${data.length === 1 ? "evento encontrado" : "eventos encontrados"}`);
      }
    } catch (error) {
      // The server's sentence when there is one. Since B3 the six reports
      // answer 429 "espere un momento" after thirty heavy queries a minute —
      // a budget shared with the report generator — and "Error al generar"
      // would send the person straight back to the button.
      //
      // And the previous rows go, as the generator does on a failed Generar:
      // they belong to another range, and a card of January's incidents under
      // pickers that say February is a lie on screen — and, through Exportar,
      // a lie in a file.
      toast.error(mensajeDeError(error, "Error al generar el reporte"));
      setList([]);
      setApplied(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLimpiar = () => {
    setList([]);
    setApplied(null);
    setFechaInicio(undefined);
    setFechaFin(undefined);
    setTramoId(null);
    setEstado("todos");
    setPrioridad("todos");
    setCriticidad("todos");
    setExcludeOld(false);
  };

  const handleExport = async (format: "excel" | "csv" | "pdf") => {
    // The range the rows were generated with, never the pickers. The pickers
    // can be moved without pressing Generar, and the file's period header comes
    // from these two dates: read off the pickers it was "01/02 — 28/02" over
    // January's rows, with nothing inside the file to show it. `applied`
    // is set with `list` and cleared with it, so it is the rows' own range.
    if (!applied) return;
    setExporting(true);
    try {
      if (format === "excel") await exportExcelGeneral(list, applied.start, applied.end);
      else if (format === "csv") exportCsvGeneral(list);
      else await exportPdfGeneral(list, applied.start, applied.end);
    } catch {
      toast.error("Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo<Col<EventoInterface>[]>(() => [
    rowNumberColumn(),
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
      accessorFn: (row) => nombreDelTramo(row.poste),
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap"><TramoEnlazado tramo={row.original.poste?.tramo} vacio="—" /></span>
      ),
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
          <img src={imageUrl(row.original.image) ?? undefined} className="h-14 w-14 object-cover rounded" loading="lazy" />
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
          <img src={imageUrl(sol.image) ?? undefined} className="h-14 w-14 object-cover rounded" loading="lazy" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
  ], []);

  // ─── Render ───────────────────────────────────────────────────────────────────

  const pendientes   = list.filter((e) => !e.state).length;
  const solucionados = list.filter((e) => e.state).length;
  const criticos     = list.filter((e) => (e.revisions?.length ?? 0) >= 5).length;
  const prioritarios = list.filter((e) => e.priority).length;
  const nuevas       = applied
    ? list.filter((e) => {
        if (!e.date) return false;
        const d = new Date(e.date).getTime();
        return d >= applied.start.getTime() && d <= applied.end.getTime();
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-2 gap-y-3 items-end">
            <div className="space-y-1.5">
              <Label>Fecha de inicio</Label>
              <DatePicker ariaLabel="Fecha de inicio" value={fechaInicio} onSelect={setFechaInicio} placeholder="Inicio" />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de fin</Label>
              <DatePicker ariaLabel="Fecha de fin" value={fechaFin} onSelect={setFechaFin} placeholder="Fin" />
            </div>
            <div className="space-y-1.5">
              <Label>Tramo <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <TramoCombobox tramos={tramos} value={tramoId} onChange={setTramoId} permitirTodos />
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
          {(estadoOpciones === "denegado" || estadoOpciones === "fallo") && (
            // Said on screen and not only in a toast: this one lasts four
            // seconds and the screen is one people leave open. Unlike Por
            // Tramo, the report itself is still worth generating without the
            // catalogues — only the tramo selector depends on them — so
            // Generar stays enabled and the notice says what is missing.
            <p className="text-sm text-destructive mt-3">
              {estadoOpciones === "denegado"
                ? "No tiene permiso para consultar los catálogos, así que no se puede filtrar por tramo. El resto del informe funciona."
                : "No se pudieron cargar los catálogos, así que no se puede filtrar por tramo. Recargue la pantalla."}
            </p>
          )}
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
            {!applied?.excludeOld && arrastradas > 0 && (
              <Badge variant="outline" className="text-blue-600" title="Eventos creados en el rango / Eventos creados antes pero revisados en el rango">
                {nuevas} nuevas · {arrastradas} arrastradas
              </Badge>
            )}
            {applied?.excludeOld && (
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
                    {/*
                      A button and not a chooser: it holds no value, it offers
                      three things to do. So it wears what the other menu on
                      this same table bar wears — `buttonVariants` — rather
                      than the skin of a select, which would say it remembers
                      what you last exported.
                    */}
                    <DropdownMenuTrigger
                      className={cn(buttonVariants({ variant: "outline" }), "h-8 gap-1.5 px-3 text-sm font-medium")}
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
