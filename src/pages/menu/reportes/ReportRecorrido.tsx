import { MAP_DOT } from "../../../components/map/mapConstants";
import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import BaseMap from "../../../components/map/BaseMap";
import MapPoint from "../../../components/map/MapPoint";
import MapLine from "../../../components/map/MapLine";
import { FitView } from "../../../components/map/useFitCoords";
import { fromLatLngTuple, hasCoords } from "../../../components/map/mapGeo";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { getReporteRecorrido } from "../../../api/reporte.api";
import { mensajeDeError } from "../../../api/descarga";
import {
    estadoTrasFallo, getOpcionesReporte, EstadoOpciones, OpcionCiudad, TramoPair,
} from "../../../api/opciones.api";
import { getPosteByTramo } from "../../../api/Poste.api";
import { useTramoNeighbors } from "../../../hooks/useTramoNeighbors";
import { fetchOrsRoute } from "../../../lib/orsRoute";
import {
    EventoInterface,
    PosteInterface,
    ReporteInterface,
} from "../../../interfaces/interfaces";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { DatePicker } from "../../../components/ui/date-picker";
import { Badge } from "../../../components/ui/badge";
import { Combobox } from "../../../components/ui/combobox";
import { Switch } from "../../../components/ui/switch";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { DownloadIcon, Loader2Icon, MapPinIcon, RouteIcon } from "lucide-react";
import ResolverEventoSheet from "../../../components/dialogs/ResolverEventoSheet";
import AddRevisionSheet from "../../../components/dialogs/AddRevisionSheet";
import PermissionGuard from "../../../components/PermissionGuard";
import { CriticalityBadge } from "../../../components/CriticalityBadge";
import {
    getEventCriticality, getCriticalityMeta, matchesCriticalityBand,
    CRITICALITY_BAND_OPTIONS, type CriticalityBand,
} from "../../../lib/criticality";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Color hex por nivel de criticidad. Si state=true gana verde. Sin criticidad usa fallback prio/default.
const getEventColor = (e: EventoInterface) => {
    if (e.state) return "#249243"; // resuelto siempre verde
    const c = getEventCriticality(e);
    if (c != null) {
        if (c <= 3) return "#DC2626"; // crítica — rojo
        if (c <= 5) return "#EA580C"; // alta — naranja
        if (c <= 7) return "#CA8A04"; // media — amarillo oscuro
        return "#2563EB";              // baja — azul
    }
    // Sin clasificar
    if (e.priority) return "#DD0031";
    return "#FF5500";
};

const getEventColorBg = (e: EventoInterface) => {
    const color = getEventColor(e);
    // Convert hex to rgba with 0.1 alpha
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},0.1)`;
};

const getEventStatusLabel = (e: EventoInterface): string => {
    if (e.state) return "Solucionado";
    const c = getEventCriticality(e);
    if (c != null && c <= 3) return "Crítico";
    if (e.priority) return "Alta prioridad";
    return "Pendiente";
};

/**
 * Exports exactly the rows on screen. The button lives in the same header row
 * as the severity and status filters, so it was handed the unfiltered list:
 * narrowing the list to three critical events and pressing CSV downloaded all
 * four hundred, with nothing on screen saying so.
 */
const exportCsv = (rowsOnScreen: EventoInterface[], ciudadA: string, ciudadB: string) => {
    const headers = ["Poste", "Descripción", "Fecha", "Criticidad", "Revisiones", "Estado", "Prioridad"];
    const rows = rowsOnScreen.map((e) => {
        const c = getEventCriticality(e);
        return [
            e.poste?.name ?? "",
            e.description,
            format(new Date(e.date), "dd/MM/yyyy", { locale: es }),
            c != null ? `${c} - ${getCriticalityMeta(c).label}` : "—",
            String(e.revisions?.length ?? 0),
            e.state ? "Solucionado" : "Pendiente",
            e.priority ? "Alta" : "Normal",
        ];
    });
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const n = new Date();
    const ts = `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, "0")}${String(n.getDate()).padStart(2, "0")}_${String(n.getHours()).padStart(2, "0")}${String(n.getMinutes()).padStart(2, "0")}${String(n.getSeconds()).padStart(2, "0")}`;
    a.download = `recorrido_${ciudadA}-${ciudadB}_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// ─── Component ────────────────────────────────────────────────────────────────

const ReportRecorridoSec = () => {
    const { sesion } = useContext(SesionContext);
    const navigate = useNavigate();

    const [fechaInicio, setFechaInicio] = useState<Date | undefined>(undefined);
    const [fechaFin, setFechaFin] = useState<Date | undefined>(undefined);
    const [tramoInicial, setTramoInicial] = useState<number | null>(null);
    const [tramoFinal, setTramoFinal] = useState<number | null>(null);
    const [listCiudad, setListCiudad] = useState<OpcionCiudad[]>([]);
    const [tramos, setTramos] = useState<TramoPair[]>([]);
    /**
     * Why the two comboboxes are empty, when they are — and this screen is the
     * one that most needs to say it. Without cities there is no stretch, and
     * without a stretch `handleGenerar` refuses: the screen is simply dead, and
     * a four-second toast is all it used to offer as an explanation.
     */
    const [estadoOpciones, setEstadoOpciones] = useState<EstadoOpciones>("cargando");
    const neighbors = useTramoNeighbors(tramos);
    const [excludeOld, setExcludeOld] = useState(false);
    const [list, setList] = useState<EventoInterface[]>([]);
    /**
     * The filter the rows on screen were generated with: dates, stretch and the
     * "solo nuevas" switch. Set with `list` and cleared with it, so everything
     * that describes the rows — the "Tramo:" label, the CSV's filename, the
     * two city markers, the badge — reads this and never the live comboboxes,
     * which can be moved without pressing Generar.
     */
    const [applied, setApplied] = useState<{
        start: Date; end: Date; tramoInicial: number; tramoFinal: number; excludeOld: boolean;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    /** The run whose answer is still wanted; see `handleGenerar`. */
    const runSeq = useRef(0);
    const [mapTab, setMapTab] = useState<"eventos" | "postes">("eventos");
    const [estadoFilter, setEstadoFilter] = useState<"all" | "pending" | "solved">("all");
    const [critFilter, setCritFilter] = useState<CriticalityBand | "all">("all");
    const [routePath, setRoutePath] = useState<[number, number][]>([]);

    const [resolverEvento, setResolverEvento] = useState<EventoInterface | null>(null);
    const [addRevisionEventoId, setAddRevisionEventoId] = useState<number | null>(null);

    // Both blocks of the same response. `lat`/`lng` are the load-bearing part
    // here: the whole route calculation sits behind `if (a?.lat && a?.lng …)`,
    // so a city list without them draws this screen with no line and no error.
    useEffect(() => {
        getOpcionesReporte()
            .then((opciones) => {
                setListCiudad(opciones.ciudad);
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

    useEffect(() => {
        if (tramoInicial && tramoFinal && neighbors.size > 0) {
            const valid = neighbors.get(tramoInicial)?.has(tramoFinal);
            if (!valid) setTramoFinal(null);
        }
    }, [tramoInicial, tramoFinal, neighbors]);

    /**
     * Runs the report for what the controls say now.
     *
     * `keepOnError` is for the two re-runs this screen fires on its own — after
     * an incident is resolved or revised from a map popup — and means what it
     * means in the generator: a failure the person did not ask for keeps the
     * rows they were reading. Since B3 that failure is usually a 429 "espere un
     * momento", and this screen is the one most likely to hear it, because
     * those re-runs spend the same thirty a minute as a press of Generar.
     * Clearing there would take the map away after an operation that
     * succeeded, and leave them unable to get it back for the rest of the
     * minute. A failed Generar does clear: rows from another stretch or range
     * under this one's header is a lie on screen.
     *
     * `runSeq` guards the overlap those re-runs allow. The button is disabled
     * while loading; the popups are not, so a run that started first can
     * finish last — and, before this guard, wipe the fresh rows of the one that
     * had already succeeded.
     */
    const handleGenerar = async (keepOnError = false) => {
        if (!fechaInicio || !fechaFin) return toast.warning("Selecciona un rango de fechas");
        if (fechaInicio > fechaFin) return toast.warning("La fecha de inicio debe ser anterior a la fecha de fin");
        if (!tramoInicial || !tramoFinal) return toast.warning("Selecciona el tramo inicial y final");
        if (tramoInicial === tramoFinal) return toast.warning("El tramo inicial y final deben ser diferentes");

        const inicio = new Date(fechaInicio); inicio.setHours(0, 0, 0, 0);
        const fin = new Date(fechaFin); fin.setHours(23, 59, 59, 0);
        const filtro: ReporteInterface = { fechaInicial: inicio, fechaFinal: fin, TramoInicial: tramoInicial, TramoFinal: tramoFinal, excludeOld };

        const seq = ++runSeq.current;
        setLoading(true);
        try {
            // The poles are decoration: they shape the line drawn on the map,
            // and without them the fallback below still draws city to city. So
            // they must not be able to void a report that arrived. Since C5
            // they can be refused on their own — `GET /api/poste/` asks for
            // `postes.ver` and this screen opens on `reportes.ver` — and a
            // rejected leg of a `Promise.all` used to take the whole report
            // down with it, with a message blaming the report.
            const [data, postesTramo] = await Promise.all([
                getReporteRecorrido(filtro),
                getPosteByTramo(tramoInicial, tramoFinal).catch(() => []),
            ]);
            if (seq !== runSeq.current) return;

            const a = listCiudad.find((c) => c.id === tramoInicial)!;
            const b = listCiudad.find((c) => c.id === tramoFinal)!;
            if (a?.lat && a?.lng && b?.lat && b?.lng) {
                const dx = b.lat - a.lat;
                const dy = b.lng - a.lng;
                const sorted = postesTramo
                    .filter(hasCoords)
                    .sort((p1, p2) =>
                        ((p1.lat - a.lat) * dx + (p1.lng - a.lng) * dy) -
                        ((p2.lat - a.lat) * dx + (p2.lng - a.lng) * dy)
                    );
                const fallback: [number, number][] = [
                    [a.lat, a.lng],
                    ...sorted.map((p): [number, number] => [p.lat, p.lng]),
                    [b.lat, b.lng],
                ];
                try {
                    // El recorte a 48 intermedios vivía aquí y solo aquí, que es
                    // por qué las otras tres pantallas nunca dibujaban carretera
                    // en un tramo largo. Ahora lo hace `fetchOrsRoute` con esta
                    // misma fórmula y sobre esta misma lista, así que la línea de
                    // este informe no cambia.
                    const waypoints = [[a.lng, a.lat], ...sorted.map((p) => [p.lng, p.lat]), [b.lng, b.lat]];
                    const route = await fetchOrsRoute(waypoints);
                    if (seq !== runSeq.current) return;
                    setRoutePath(route ?? fallback);
                } catch {
                    if (seq !== runSeq.current) return;
                    setRoutePath(fallback);
                }
            }

            if (data.length === 0) {
                toast.warning("No hay eventos para el tramo y período seleccionado");
                setList([]);
                setApplied(null);
            } else {
                setList(data);
                setApplied({ start: inicio, end: fin, tramoInicial, tramoFinal, excludeOld });
                toast.success(`${data.length} ${data.length === 1 ? "evento encontrado" : "eventos encontrados"}`);
            }
        } catch (error) {
            if (seq !== runSeq.current) return;
            // The server's sentence when there is one — since B3 the six
            // reports answer 429 "espere un momento" after thirty a minute,
            // shared with the generator. The rows go only when the person
            // pressed Generar; the doc comment above says why.
            toast.error(mensajeDeError(error, "Error al generar el reporte de recorrido"));
            if (!keepOnError) {
                setList([]);
                setApplied(null);
            }
        } finally {
            if (seq === runSeq.current) setLoading(false);
        }
    };

    // ─── Derived ──────────────────────────────────────────────────────────────

    // The stretch the rows were generated for, not the one the comboboxes show
    // now: the label, the markers and the CSV's filename all describe the rows.
    const ciudadA = listCiudad.find((c) => c.id === applied?.tramoInicial);
    const ciudadB = listCiudad.find((c) => c.id === applied?.tramoFinal);

    const uniquePostes: PosteInterface[] = list.reduce((acc: PosteInterface[], e) => {
        if (e.poste && !acc.find((p) => p.id === e.poste!.id)) acc.push(e.poste as PosteInterface);
        return acc;
    }, []);

    const mapCenter: [number, number] = ciudadA?.lat && ciudadA?.lng ? [ciudadA.lat, ciudadA.lng] : [-17.8, -63.2];
    const eventMapMarkers = list.filter((e) => (e.poste?.lat ?? 0) !== 0 && (e.poste?.lng ?? 0) !== 0);
    const posteMapMarkers = uniquePostes.filter((p) => (p.lat ?? 0) !== 0 && (p.lng ?? 0) !== 0);

    const boundsCoords: [number, number][] = [
        ...(ciudadA?.lat && ciudadA?.lng ? [[ciudadA.lat, ciudadA.lng] as [number, number]] : []),
        ...(ciudadB?.lat && ciudadB?.lng ? [[ciudadB.lat, ciudadB.lng] as [number, number]] : []),
        ...eventMapMarkers.map((e) => [e.poste!.lat, e.poste!.lng] as [number, number]),
    ];

    const filteredList = list.filter((e) => {
        if (estadoFilter === "pending" && e.state) return false;
        if (estadoFilter === "solved" && !e.state) return false;
        return matchesCriticalityBand(getEventCriticality(e), critFilter);
    });

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            <Card className="shadow-sm border-muted/60">
                <CardHeader className="border-b border-border/40 pb-4">
                    <CardTitle>Reporte de Recorrido</CardTitle>
                    <CardDescription>
                        Visualización geográfica de eventos y postes en un tramo específico para el período seleccionado.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-2 gap-y-3 items-end">
                        <div className="space-y-1.5">
                            <Label>Fecha de inicio</Label>
                            <DatePicker ariaLabel="Fecha de inicio" value={fechaInicio} onSelect={setFechaInicio} placeholder="Inicio" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Fecha de fin</Label>
                            <DatePicker ariaLabel="Fecha de fin" value={fechaFin} onSelect={setFechaFin} placeholder="Fin" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Tramo desde</Label>
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
                                placeholder="Seleccionar ciudad"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Tramo hasta</Label>
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
                                placeholder="Seleccionar ciudad"
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
                    {(estadoOpciones === "denegado" || estadoOpciones === "fallo") && (
                        // The screen that most needs this: without cities there
                        // is no stretch, and `handleGenerar` refuses without a
                        // stretch. All it used to offer was a toast that is
                        // gone four seconds later, leaving a page with two
                        // empty comboboxes and no explanation at all.
                        <p className="text-sm text-destructive mt-3">
                            {estadoOpciones === "denegado"
                                ? "No tiene permiso para consultar los catálogos de informes, y sin ellos esta pantalla no puede ofrecerle ningún tramo."
                                : "No se pudieron cargar los catálogos, y sin ellos esta pantalla no puede ofrecerle ningún tramo. Recargue la pantalla."}
                        </p>
                    )}
                    <div className="flex gap-2 mt-3 justify-end">
                        <Button onClick={() => void handleGenerar()} disabled={loading}>
                            {loading ? <Loader2Icon className="h-4 w-4 animate-spin mr-2" /> : <RouteIcon className="h-4 w-4 mr-2" />}
                            Generar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {list.length > 0 && ciudadA && ciudadB && (
                <>
                    {(() => {
                        const nuevas = applied
                            ? list.filter((e) => {
                                if (!e.date) return false;
                                const d = new Date(e.date).getTime();
                                return d >= applied.start.getTime() && d <= applied.end.getTime();
                            }).length
                            : 0;
                        const arrastradas = list.length - nuevas;
                        return (
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium">
                            Tramo: <span className="text-primary font-semibold">{ciudadA.name} — {ciudadB.name}</span>
                        </span>
                        <Badge variant="outline" className="gap-1"><MapPinIcon className="h-3 w-3" />{list.length} {list.length === 1 ? "evento" : "eventos"}</Badge>
                        {!applied?.excludeOld && arrastradas > 0 && (
                            <Badge variant="outline" className="gap-1 text-blue-600" title="Eventos creados en el rango / Eventos creados antes pero revisados en el rango">
                                {nuevas} nuevas · {arrastradas} arrastradas
                            </Badge>
                        )}
                        {applied?.excludeOld && (
                            <Badge variant="outline" className="gap-1 text-blue-600">solo nuevas del período</Badge>
                        )}
                        <Badge variant="outline" className="gap-1">{uniquePostes.length} {uniquePostes.length === 1 ? "poste" : "postes"}</Badge>
                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">{list.filter((e) => !e.state).length} pendientes</Badge>
                        <Badge variant="outline" className="gap-1 text-[#249243] border-[#249243]/40">{list.filter((e) => e.state).length} solucionados</Badge>
                        {list.filter((e) => e.priority && !e.state).length > 0 && (
                            <Badge variant="destructive" className="gap-1">{list.filter((e) => e.priority && !e.state).length} prioritarios</Badge>
                        )}
                    </div>
                        );
                    })()}

                    {/* Map */}
                    <Card className="shadow-sm border-muted/60">
                        <CardHeader className="border-b border-border/40 pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle>Mapa del Recorrido</CardTitle>
                                <SegmentedControl
                                    options={[
                                        { value: "eventos", label: "Eventos" },
                                        { value: "postes", label: "Postes" },
                                    ]}
                                    value={mapTab}
                                    onValueChange={setMapTab}
                                    ariaLabel="Tipo de marcadores en el mapa"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 overflow-hidden rounded-b-xl">
                            <BaseMap center={fromLatLngTuple(mapCenter)} zoom={8} style={{ height: "460px" }}>
                                {boundsCoords.length > 0 && (
                                    <FitView
                                        coords={boundsCoords.map(fromLatLngTuple)}
                                        fit
                                        center={boundsCoords.length === 1 ? fromLatLngTuple(boundsCoords[0]) : fromLatLngTuple(mapCenter)}
                                        zoom={13}
                                    />
                                )}

                                {routePath.length >= 2 && (
                                    <MapLine id="recorrido-route" positions={routePath.map(fromLatLngTuple)} />
                                )}

                                {/* Ciudad A */}
                                {ciudadA.lat && ciudadA.lng && (
                                    <MapPoint center={{ lat: ciudadA.lat, lng: ciudadA.lng }} radius={7} strokeColor={MAP_DOT.endpoint} fillColor={MAP_DOT.endpoint} fillOpacity={1} strokeWidth={0} popupMinWidth={160}>
                                        <div style={{ padding: "4px 2px 2px" }}>
                                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{ciudadA.name}</p>
                                            <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--primary)", fontWeight: 500 }}>Inicio del tramo</p>
                                            <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{ciudadA.lat.toFixed(4)}, {ciudadA.lng.toFixed(4)}</p>
                                        </div>
                                    </MapPoint>
                                )}
                                {/* Ciudad B */}
                                {ciudadB.lat && ciudadB.lng && (
                                    <MapPoint center={{ lat: ciudadB.lat, lng: ciudadB.lng }} radius={7} strokeColor={MAP_DOT.endpoint} fillColor={MAP_DOT.endpoint} fillOpacity={1} strokeWidth={0} popupMinWidth={160}>
                                        <div style={{ padding: "4px 2px 2px" }}>
                                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{ciudadB.name}</p>
                                            <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--primary)", fontWeight: 500 }}>Fin del tramo</p>
                                            <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{ciudadB.lat.toFixed(4)}, {ciudadB.lng.toFixed(4)}</p>
                                        </div>
                                    </MapPoint>
                                )}

                                {/* Event markers */}
                                {mapTab === "eventos" && eventMapMarkers.map((e, i) => (
                                    <MapPoint
                                        key={i}
                                        center={{ lat: e.poste!.lat, lng: e.poste!.lng }}
                                        radius={8}
                                        strokeColor="#fff"
                                        fillColor={getEventColor(e)}
                                        fillOpacity={0.95}
                                        strokeWidth={2.5}
                                        popupMinWidth={230}
                                    >
                                            <div style={{ padding: "4px 2px 2px", minWidth: 215 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: getEventColorBg(e), flexShrink: 0 }}>
                                                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: getEventColor(e), display: "block" }} />
                                                    </span>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: "var(--foreground)" }}>{e.poste?.name}</p>
                                                        <p style={{ margin: 0, fontSize: 10, marginTop: 1, color: getEventColor(e) }}>
                                                            {getEventStatusLabel(e)}
                                                        </p>
                                                    </div>
                                                </div>
                                                {e.description && (
                                                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                                                        {e.description}
                                                    </p>
                                                )}
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Criticidad</span>
                                                        <CriticalityBadge level={getEventCriticality(e)} compact />
                                                    </div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Fecha</span>
                                                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{format(new Date(e.date), "dd MMM yyyy", { locale: es })}</span>
                                                    </div>
                                                    {(e.revisions?.length ?? 0) > 0 && (
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Revisiones</span>
                                                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{e.revisions!.length}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ height: 1, background: "var(--border)", marginBottom: 8 }} />
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button
                                                        style={{ flex: 1, padding: "7px 0", borderRadius: 6, background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                                        onClick={() => navigate(`/app/eventos/${e.id}`)}
                                                    >
                                                        Ver detalle
                                                    </button>
                                                    {!e.state && can(sesion.usuario.id_rol, "eventos", "editar") && (
                                                        <button
                                                            style={{ flex: 1, padding: "7px 0", borderRadius: 6, background: e.priority ? "#DD0031" : "#FF5500", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                                            onClick={() => { if (e.id) setResolverEvento(e); }}
                                                        >
                                                            Resolver
                                                        </button>
                                                    )}
                                                </div>
                                                {!e.state && can(sesion.usuario.id_rol, "eventos", "editar") && (
                                                    <button
                                                        style={{ width: "100%", marginTop: 5, padding: "5px 0", borderRadius: 6, background: "transparent", color: "var(--primary)", border: "1px solid var(--primary)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                                                        onClick={() => { if (e.id) setAddRevisionEventoId(e.id as number); }}
                                                    >
                                                        Agregar revisión
                                                    </button>
                                                )}
                                            </div>
                                    </MapPoint>
                                ))}

                                {/* Poste markers */}
                                {mapTab === "postes" && posteMapMarkers.map((p, i) => (
                                    <MapPoint key={i} center={{ lat: p.lat, lng: p.lng }} radius={8}
                                        strokeColor="#fff" fillColor={MAP_DOT.subject} fillOpacity={0.95} strokeWidth={2.5} popupMinWidth={220}
                                    >
                                            <div style={{ padding: "4px 2px 2px", minWidth: 205 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "rgba(89,107,171,0.12)", flexShrink: 0 }}>
                                                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--primary)", display: "block" }} />
                                                    </span>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: "var(--foreground)" }}>{p.name}</p>
                                                        {p.propietario?.name && <p style={{ margin: 0, fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>{p.propietario.name}</p>}
                                                    </div>
                                                </div>
                                                {(() => {
                                                    const evs = list.filter((ev) => ev.poste?.id === p.id);
                                                    const pending = evs.filter((ev) => !ev.state).length;
                                                    return (
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Eventos en período</span>
                                                                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{evs.length}</span>
                                                            </div>
                                                            {pending > 0 && (
                                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Pendientes</span>
                                                                    <span style={{ fontSize: 11, fontWeight: 600, color: "#d97706" }}>{pending}</span>
                                                                </div>
                                                            )}
                                                            {p.material?.name && (
                                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Material</span>
                                                                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{p.material.name}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                                <div style={{ height: 1, background: "var(--border)", marginBottom: 8 }} />
                                                <button
                                                    style={{ width: "100%", padding: "7px 0", borderRadius: 6, background: "var(--primary)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                                    onClick={() => navigate(`/app/postes/${p.id}`)}
                                                >
                                                    Ver poste
                                                </button>
                                            </div>
                                    </MapPoint>
                                ))}
                            </BaseMap>

                            {mapTab === "eventos" && (
                                <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-border/40 text-xs text-muted-foreground">
                                    {[
                                        { color: "#DC2626", label: "Crítica (1-3)" },
                                        { color: "#EA580C", label: "Alta (4-5)" },
                                        { color: "#CA8A04", label: "Media (6-7)" },
                                        { color: "#2563EB", label: "Baja (8-9)" },
                                        { color: "#FF5500", label: "Sin clasificar" },
                                        { color: "#249243", label: "Solucionado" },
                                    ].map(({ color, label }) => (
                                        <span key={label} className="flex items-center gap-1.5">
                                            <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {mapTab === "postes" && (
                                <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/40 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1.5">
                                        <span className="inline-block h-3 w-3 rounded-full" style={{ background: "var(--primary)" }} />
                                        Poste con incidencias
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Event list */}
                    <Card className="shadow-sm border-muted/60">
                        <CardHeader className="border-b border-border/40 pb-3">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <CardTitle>Eventos del Tramo</CardTitle>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <SegmentedControl
                                        options={CRITICALITY_BAND_OPTIONS}
                                        value={critFilter}
                                        onValueChange={setCritFilter}
                                        size="sm"
                                        ariaLabel="Filtro por criticidad"
                                    />
                                    <SegmentedControl
                                        options={[
                                            { value: "all", label: "Todos" },
                                            { value: "pending", label: "Pendientes" },
                                            { value: "solved", label: "Solucionados" },
                                        ]}
                                        value={estadoFilter}
                                        onValueChange={setEstadoFilter}
                                        ariaLabel="Filtro de estado de eventos"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5 text-xs"
                                        disabled={filteredList.length === 0}
                                        title={`Descargar ${filteredList.length} ${filteredList.length === 1 ? "fila" : "filas"}`}
                                        onClick={() => exportCsv(filteredList, ciudadA.name, ciudadB.name)}
                                    >
                                        <DownloadIcon className="h-3.5 w-3.5" />
                                        CSV
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {filteredList.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados</p>
                            ) : (
                                <div className="divide-y divide-border">
                                    {filteredList.map((e) => (
                                        <div key={e.id} className="flex items-center justify-between gap-4 py-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{e.poste?.name ?? "—"}</p>
                                                <p className="text-xs text-muted-foreground truncate">{e.description}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {format(new Date(e.date), "dd/MM/yyyy", { locale: es })}
                                                    {(e.revisions?.length ?? 0) > 0 && <span className="ml-2">· {e.revisions!.length} {e.revisions!.length === 1 ? "revisión" : "revisiones"}</span>}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <CriticalityBadge level={getEventCriticality(e)} compact />
                                                <Badge className={`text-xs border-transparent shadow-none ${e.state ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600"}`}>
                                                    {e.state ? "Solucionado" : "Pendiente"}
                                                </Badge>
                                                {e.priority && <Badge variant="destructive" className="text-xs">Alta prioridad</Badge>}
                                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(`/app/eventos/${e.id}`)}>
                                                    Ver
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            <PermissionGuard module="eventos" action="editar" open={!!resolverEvento} onOpenChange={(v) => { if (!v) setResolverEvento(null); }}>
                <ResolverEventoSheet
                    evento={resolverEvento}
                    open={!!resolverEvento}
                    setOpen={(v) => { if (!v) setResolverEvento(null); }}
                    onSuccess={() => void handleGenerar(true)}
                />
            </PermissionGuard>
            <PermissionGuard module="eventos" action="editar" open={!!addRevisionEventoId} onOpenChange={(v) => { if (!v) setAddRevisionEventoId(null); }}>
                <AddRevisionSheet
                    eventoId={addRevisionEventoId}
                    open={!!addRevisionEventoId}
                    setOpen={(v) => { if (!v) setAddRevisionEventoId(null); }}
                    onSuccess={() => void handleGenerar(true)}
                />
            </PermissionGuard>
        </div>
    );
};

export default ReportRecorridoSec;
