import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Col, Rw } from "../../../components/table/tableFeatures";
import { getReporteTramo } from "../../../api/reporte.api";
import { mensajeDeError } from "../../../api/descarga";
import {
  AdssPosteInterface,
  EventoInterface,
  EventoObsInterface,
  ReporteInterface,
  Tramo,
} from "../../../interfaces/interfaces";
import {
  estadoTrasFallo, getOpcionesReporte, EstadoOpciones, OpcionSimple,
} from "../../../api/opciones.api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { DatePicker } from "../../../components/ui/date-picker";
import TramoCombobox from "../../../components/TramoCombobox";
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
import { rowNumberColumn } from "../../../components/table/rowNumberColumn";

// ─── Component ────────────────────────────────────────────────────────────────

const ReportTramoSec = () => {
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>(undefined);
  const [fechaFin, setFechaFin]       = useState<Date | undefined>(undefined);
  /** The tramo the selector shows now; `null` is "Todos los tramos". */
  const [tramoId,      setTramoId]      = useState<number | null>(null);
  const [tramos,       setTramos]       = useState<Tramo[]>([]);
  const [excludeOld, setExcludeOld]   = useState(false);
  const [list, setList]               = useState<EventoInterface[]>([]);
  /**
   * The filter the rows on screen were generated with: dates, tramo and the
   * "solo nuevas" switch. Set with `list` and cleared with it, so everything
   * that describes the rows — the file's period and stretch headers, the
   * "nuevas · arrastradas" badge — reads this and never the live controls,
   * which can be moved without pressing Generar.
   */
  const [applied, setApplied] = useState<{
    start: Date; end: Date; tramo: Tramo | null; excludeOld: boolean;
  } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [exporting, setExporting]     = useState(false);

  const [listAdss,        setListAdss]        = useState<OpcionSimple[]>([]);
  const [listMaterial,    setListMaterial]    = useState<OpcionSimple[]>([]);
  const [listPropietario, setListPropietario] = useState<OpcionSimple[]>([]);
  const [listObs,         setListObs]         = useState<OpcionSimple[]>([]);
  /**
   * Why the five lists are missing, when they are — and why this screen refuses
   * to generate without them.
   *
   * Four of these lists used to be fetched **inside** `handleGenerar`, in the
   * same `try` as the report itself, so a failure there aborted the generation
   * and the Resultados card — which is where the Export button lives — never
   * appeared. Moving the fetch to mount quietly removes that protection: the
   * report would generate fine while `listPropietario`, `listMaterial`,
   * `listAdss` and `listObs` sat empty, and every column of this report is
   * built from those four. The result is an Excel or a PDF with its header,
   * its date range and its pole numbers, and **not one column of content** —
   * with nothing in the file to say so, on its way to a client. So the block
   * that used to be implicit is now written down.
   *
   * **Four states and not "an error or nothing", which the first version of
   * this fix got wrong and its own audit caught.** With a nullable error,
   * `null` means both *not back yet* and *fine*, so the whole loading window
   * was unguarded: pick two dates, press Generar before the lists land —
   * the report is a different request and can answer first — and the Resultados
   * card appears with the Export button inside it while the four lists are
   * still empty. The very file it was written to prevent, produced by the fix
   * that claimed to prevent it. Nothing here may act on the catalogues until
   * they are actually here.
   */
  const [estadoOpciones, setEstadoOpciones] = useState<EstadoOpciones>("cargando");

  useEffect(() => {
    getOpcionesReporte()
      .then((opciones) => {
        setTramos(opciones.tramos);
        setListAdss(opciones.adss);
        setListMaterial(opciones.material);
        setListPropietario(opciones.propietario);
        setListObs(opciones.obs);
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
    if (estadoOpciones !== "listas") return toast.error(estadoOpciones === "denegado"
      ? "No tiene permiso para consultar los catálogos, y sin ellos el informe saldría sin columnas."
      : estadoOpciones === "fallo"
        ? "Los catálogos no se cargaron. Recargue la pantalla antes de generar el informe."
        : "Los catálogos aún se están cargando.");
    if (!fechaInicio || !fechaFin) return toast.warning("Selecciona un rango de fechas");
    if (fechaInicio > fechaFin)    return toast.warning("La fecha de inicio debe ser anterior a la fecha de fin");

    const inicio = new Date(fechaInicio); inicio.setHours(0, 0, 0, 0);
    const fin    = new Date(fechaFin);    fin.setHours(23, 59, 59, 0);
    // The chosen tramo is resolved once, before the request, and both the
    // request and the applied filter come from that one object: an id that is
    // not in the list must not filter the rows while the file says "Total".
    const elegido = tramoId === null ? null : tramos.find((t) => t.id === tramoId) ?? null;
    if (tramoId !== null && !elegido) return toast.warning("Selecciona un tramo de la lista");
    // The server narrows by the tramo; the key is left out, not sent empty,
    // when none is chosen (`tramo=` is a 400).
    const filtro: ReporteInterface = {
      fechaInicial: inicio, fechaFinal: fin, excludeOld, ...(elegido ? { tramo: elegido.id } : {}),
    };

    setLoading(true);
    try {
      const data = await getReporteTramo(filtro);

      if (data.length === 0) {
        toast.warning("No hay datos para el rango seleccionado");
        setList([]);
        setApplied(null);
      } else {
        setList(data);
        setApplied({ start: inicio, end: fin, tramo: elegido, excludeOld });
        toast.success(`${data.length} ${data.length === 1 ? "evento encontrado" : "eventos encontrados"}`);
      }
    } catch (error) {
      // The server's sentence when there is one — since B3 the six reports
      // answer 429 "espere un momento" after thirty a minute, shared with the
      // generator — and the previous rows go with the failure: they belong to
      // another range, and Exportar would print them under this one. See
      // `ReportGeneralSec` for the long version.
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
    setExcludeOld(false);
  };

  const handleExport = async (format: "excel" | "csv" | "pdf") => {
    // The rows' own filter, never the pickers: dates and comboboxes can be
    // moved without pressing Generar, and the file prints both as its header
    // — "Fecha:" and "Tramo:" — over rows that were generated for others.
    if (!applied) return;
    // The second door, and the one that actually matters. Guarding Generar is
    // not enough: `list` survives a Limpiar-less reload of nothing, and the
    // report request can answer before the catalogues do, so the Resultados
    // card — which is where this button lives — can be on screen with the four
    // content lists still empty. Every column of the file comes from them.
    if (estadoOpciones !== "listas") {
      return toast.error("Los catálogos no están disponibles: el fichero saldría sin columnas.");
    }
    setExporting(true);
    try {
      if (format === "excel") {
        await exportExcelTramo({
          list, listPropietario, listMaterial, listAdss, listObs,
          tramo: applied.tramo,
          fechaInicio: applied.start, fechaFin: applied.end,
        });
      } else if (format === "csv") {
        exportCsvTramo(list, listAdss, listObs);
      } else {
        await exportPdfTramo(
          list, listAdss, listObs, listPropietario, listMaterial,
          applied.start, applied.end, applied.tramo,
        );
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

  const columns = useMemo<Col<EventoInterface>[]>(() => [
    rowNumberColumn(),
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
      cell: ({ row }: { row: Rw<EventoInterface> }) =>
        row.original.poste?.propietario?.id === prop.id
          ? check("bg-[#BDD7EE]", "text-blue-700")
          : null,
    })),
    // ── Material columns ─────────────────────────────────────────────────────
    ...listMaterial.map((mat) => ({
      id: `mat_${mat.id}`,
      header: () => vHeader(mat.name),
      enableSorting: false,
      cell: ({ row }: { row: Rw<EventoInterface> }) =>
        row.original.poste?.material?.id === mat.id
          ? check("bg-[#E8B4B8]", "text-rose-700")
          : null,
    })),
    // ── Adss columns ─────────────────────────────────────────────────────────
    ...listAdss.map((adss) => ({
      id: `adss_${adss.id}`,
      header: () => vHeader(adss.name),
      enableSorting: false,
      cell: ({ row }: { row: Rw<EventoInterface> }) =>
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
      cell: ({ row }: { row: Rw<EventoInterface> }) =>
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
        <CardContent>
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
          {(estadoOpciones === "denegado" || estadoOpciones === "fallo") && (
            // A disabled button with nothing beside it is its own small defect:
            // the toast that fired on mount lasts four seconds and this screen
            // is one somebody leaves open.
            <p className="text-sm text-destructive mt-3">
              {estadoOpciones === "denegado"
                ? "No tiene permiso para consultar los catálogos de informes, y sin ellos este informe saldría sin columnas."
                : "No se pudieron cargar los catálogos, y sin ellos este informe saldría sin columnas. Recargue la pantalla."}
            </p>
          )}
          <div className="flex gap-2 mt-3 justify-end">
            <Button onClick={handleGenerar} disabled={loading || estadoOpciones !== "listas"}>
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

      {list.length > 0 && (() => {
        const nuevas = applied
          ? list.filter((e) => {
              if (!e.date) return false;
              const d = new Date(e.date).getTime();
              return d >= applied.start.getTime() && d <= applied.end.getTime();
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
                {!applied?.excludeOld && arrastradas > 0 && (
                  <Badge variant="outline" className="text-blue-600" title="Eventos creados en el rango / Eventos creados antes pero revisados en el rango">
                    {nuevas} nuevas · {arrastradas} arrastradas
                  </Badge>
                )}
                {applied?.excludeOld && (
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
