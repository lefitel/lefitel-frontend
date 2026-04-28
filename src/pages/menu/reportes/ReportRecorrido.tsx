import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MapContainer, CircleMarker, Polyline, Popup, useMap } from "react-leaflet";
import ThemedTileLayer from "../../../components/map/ThemedTileLayer";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { getReporteRecorrido } from "../../../api/reporte.api";
import { getCiudad } from "../../../api/Ciudad.api";
import { getPosteByTramo } from "../../../api/Poste.api";
import { fetchOrsRoute } from "../../../lib/orsRoute";
import {
    CiudadInterface,
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
import { DownloadIcon, Loader2Icon, MapPinIcon, RouteIcon } from "lucide-react";
import ResolverEventoSheet from "../poste/PosteDetalle/ResolverEventoSheet";
import AddRevicionSheet from "../poste/PosteDetalle/AddRevicionSheet";
import PermissionGuard from "../../../components/PermissionGuard";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getEventColor = (e: EventoInterface) => {
    if (e.state) return "#249243";
    if (e.priority) return "#DD0031";
    return "#FF5500";
};

const getEventColorBg = (e: EventoInterface) => {
    if (e.state) return "rgba(36,146,67,0.1)";
    if (e.priority) return "rgba(221,0,49,0.1)";
    return "rgba(255,85,0,0.1)";
};

const exportCsv = (list: EventoInterface[], ciudadA: string, ciudadB: string) => {
    const headers = ["Poste", "Descripción", "Fecha", "Revisiones", "Estado", "Prioridad"];
    const rows = list.map((e) => [
        e.poste?.name ?? "",
        e.description,
        format(new Date(e.date), "dd/MM/yyyy", { locale: es }),
        String(e.revicions?.length ?? 0),
        e.state ? "Solucionado" : "Pendiente",
        e.priority ? "Alta" : "Normal",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recorrido_${ciudadA}-${ciudadB}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// ─── FitBounds ────────────────────────────────────────────────────────────────

const FitBounds = ({ coords }: { coords: [number, number][] }) => {
    const map = useMap();
    useEffect(() => {
        if (coords.length === 0) return;
        if (coords.length === 1) { map.setView(coords[0], 13); return; }
        map.fitBounds(coords, { padding: [40, 40] });
    }, [map, coords]);
    return null;
};

// ─── Component ────────────────────────────────────────────────────────────────

const ReportRecorridoSec = () => {
    const { sesion } = useContext(SesionContext);
    const navigate = useNavigate();

    const [fechaInicio, setFechaInicio] = useState<Date | undefined>(undefined);
    const [fechaFin, setFechaFin] = useState<Date | undefined>(undefined);
    const [tramoInicial, setTramoInicial] = useState<number | null>(null);
    const [tramoFinal, setTramoFinal] = useState<number | null>(null);
    const [listCiudad, setListCiudad] = useState<CiudadInterface[]>([]);
    const [excludeOld, setExcludeOld] = useState(false);
    const [list, setList] = useState<EventoInterface[]>([]);
    const [appliedRange, setAppliedRange] = useState<{ start: Date; end: Date } | null>(null);
    const [loading, setLoading] = useState(false);
    const [mapTab, setMapTab] = useState<"eventos" | "postes">("eventos");
    const [estadoFilter, setEstadoFilter] = useState<"all" | "pending" | "solved">("all");
    const [routePath, setRoutePath] = useState<[number, number][]>([]);

    const [resolverEvento, setResolverEvento] = useState<EventoInterface | null>(null);
    const [addRevicionEventoId, setAddRevicionEventoId] = useState<number | null>(null);

    useEffect(() => {
        getCiudad(sesion.token).then(setListCiudad).catch(() => toast.error("Error al cargar las ciudades"));
    }, [sesion.token]);

    const handleGenerar = async () => {
        if (!fechaInicio || !fechaFin) return toast.warning("Selecciona un rango de fechas");
        if (fechaInicio > fechaFin) return toast.warning("La fecha de inicio debe ser anterior a la fecha de fin");
        if (!tramoInicial || !tramoFinal) return toast.warning("Selecciona el tramo inicial y final");
        if (tramoInicial === tramoFinal) return toast.warning("El tramo inicial y final deben ser diferentes");

        const inicio = new Date(fechaInicio); inicio.setHours(0, 0, 0, 0);
        const fin = new Date(fechaFin); fin.setHours(23, 59, 59, 0);
        const filtro: ReporteInterface = { fechaInicial: inicio, fechaFinal: fin, TramoInicial: tramoInicial, TramoFinal: tramoFinal, excludeOld };

        setLoading(true);
        try {
            const [data, postesTramo] = await Promise.all([
                getReporteRecorrido(filtro, sesion.token),
                getPosteByTramo(tramoInicial, tramoFinal, sesion.token),
            ]);

            const a = listCiudad.find((c) => c.id === tramoInicial)!;
            const b = listCiudad.find((c) => c.id === tramoFinal)!;
            if (a?.lat && a?.lng && b?.lat && b?.lng) {
                const dx = b.lat - a.lat;
                const dy = b.lng - a.lng;
                const sorted = postesTramo
                    .filter((p) => p.lat && p.lng)
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
                    const MAX_INTERMEDIATES = 48;
                    const intermediates = sorted.length > MAX_INTERMEDIATES
                        ? sorted.filter((_, i) => i % Math.ceil(sorted.length / MAX_INTERMEDIATES) === 0)
                        : sorted;
                    const waypoints = [[a.lng, a.lat], ...intermediates.map((p) => [p.lng, p.lat]), [b.lng, b.lat]];
                    const orsKey = import.meta.env.VITE_ORS_API_KEY as string;
                    const route = await fetchOrsRoute(waypoints, orsKey);
                    setRoutePath(route ?? fallback);
                } catch {
                    setRoutePath(fallback);
                }
            }

            if (data.length === 0) {
                toast.warning("No hay eventos para el tramo y período seleccionado");
                setList([]);
                setAppliedRange(null);
            } else {
                setList(data);
                setAppliedRange({ start: inicio, end: fin });
                toast.success(`${data.length} ${data.length === 1 ? "evento encontrado" : "eventos encontrados"}`);
            }
        } catch {
            toast.error("Error al generar el reporte de recorrido");
        } finally {
            setLoading(false);
        }
    };

    // ─── Derived ──────────────────────────────────────────────────────────────

    const ciudadA = listCiudad.find((c) => c.id === tramoInicial);
    const ciudadB = listCiudad.find((c) => c.id === tramoFinal);

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
        if (estadoFilter === "pending") return !e.state;
        if (estadoFilter === "solved") return e.state;
        return true;
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
                            <Label>Tramo desde</Label>
                            <Combobox
                                options={listCiudad.filter((c) => c.id !== tramoFinal).map((c) => ({ value: String(c.id), label: c.name }))}
                                value={tramoInicial ? String(tramoInicial) : ""}
                                onValueChange={(v) => setTramoInicial(v ? Number(v) : null)}
                                placeholder="Seleccionar ciudad"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Tramo hasta</Label>
                            <Combobox
                                options={listCiudad.filter((c) => c.id !== tramoInicial).map((c) => ({ value: String(c.id), label: c.name }))}
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
                    <Button onClick={handleGenerar} disabled={loading} className="mt-5 h-10 px-6">
                        {loading ? <Loader2Icon className="h-4 w-4 animate-spin mr-2" /> : <RouteIcon className="h-4 w-4 mr-2" />}
                        Generar
                    </Button>
                </CardContent>
            </Card>

            {list.length > 0 && ciudadA && ciudadB && (
                <>
                    {(() => {
                        const nuevas = appliedRange
                            ? list.filter((e) => {
                                if (!e.date) return false;
                                const d = new Date(e.date).getTime();
                                return d >= appliedRange.start.getTime() && d <= appliedRange.end.getTime();
                            }).length
                            : 0;
                        const arrastradas = list.length - nuevas;
                        return (
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium">
                            Tramo: <span className="text-primary font-semibold">{ciudadA.name} — {ciudadB.name}</span>
                        </span>
                        <Badge variant="outline" className="gap-1"><MapPinIcon className="h-3 w-3" />{list.length} {list.length === 1 ? "evento" : "eventos"}</Badge>
                        {!excludeOld && arrastradas > 0 && (
                            <Badge variant="outline" className="gap-1 text-blue-600" title="Eventos creados en el rango / Eventos creados antes pero revisados en el rango">
                                {nuevas} nuevas · {arrastradas} arrastradas
                            </Badge>
                        )}
                        {excludeOld && (
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
                                <div className="flex items-center rounded-lg border border-border bg-muted/30 p-1 gap-1">
                                    {(["eventos", "postes"] as const).map((tab) => (
                                        <Button key={tab} variant={mapTab === tab ? "default" : "ghost"} size="sm" className="h-7 text-xs capitalize" onClick={() => setMapTab(tab)}>
                                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 overflow-hidden rounded-b-xl">
                            <MapContainer center={mapCenter} zoom={8} style={{ height: "460px" }} scrollWheelZoom zoomControl={false}>
                                <ThemedTileLayer />
                                <FitBounds coords={boundsCoords} />

                                {routePath.length >= 2 && (
                                    <Polyline positions={routePath} pathOptions={{ color: "var(--primary)", weight: 3, opacity: 0.75 }} />
                                )}

                                {/* Ciudad A */}
                                {ciudadA.lat && ciudadA.lng && (
                                    <CircleMarker center={[ciudadA.lat, ciudadA.lng]} radius={7} pathOptions={{ color: "#1e293b", fillColor: "#1e293b", fillOpacity: 1, weight: 0 }}>
                                        <Popup minWidth={160}>
                                            <div style={{ padding: "4px 2px 2px" }}>
                                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{ciudadA.name}</p>
                                                <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--primary)", fontWeight: 500 }}>Inicio del tramo</p>
                                                <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{ciudadA.lat.toFixed(4)}, {ciudadA.lng.toFixed(4)}</p>
                                            </div>
                                        </Popup>
                                    </CircleMarker>
                                )}
                                {/* Ciudad B */}
                                {ciudadB.lat && ciudadB.lng && (
                                    <CircleMarker center={[ciudadB.lat, ciudadB.lng]} radius={7} pathOptions={{ color: "#1e293b", fillColor: "#1e293b", fillOpacity: 1, weight: 0 }}>
                                        <Popup minWidth={160}>
                                            <div style={{ padding: "4px 2px 2px" }}>
                                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{ciudadB.name}</p>
                                                <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--primary)", fontWeight: 500 }}>Fin del tramo</p>
                                                <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{ciudadB.lat.toFixed(4)}, {ciudadB.lng.toFixed(4)}</p>
                                            </div>
                                        </Popup>
                                    </CircleMarker>
                                )}

                                {/* Event markers */}
                                {mapTab === "eventos" && eventMapMarkers.map((e, i) => (
                                    <CircleMarker key={i} center={[e.poste!.lat, e.poste!.lng]} radius={8}
                                        pathOptions={{ color: getEventColor(e), fillColor: getEventColor(e), fillOpacity: 0.85, weight: 1.5 }}
                                    >
                                        <Popup minWidth={230}>
                                            <div style={{ padding: "4px 2px 2px", minWidth: 215 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: getEventColorBg(e), flexShrink: 0 }}>
                                                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: getEventColor(e), display: "block" }} />
                                                    </span>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: "var(--foreground)" }}>{e.poste?.name}</p>
                                                        <p style={{ margin: 0, fontSize: 10, marginTop: 1, color: e.state ? "#249243" : e.priority ? "#DD0031" : "#d97706" }}>
                                                            {e.state ? "Solucionado" : e.priority ? "Alta prioridad" : "Pendiente"}
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
                                                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Fecha</span>
                                                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{format(new Date(e.date), "dd MMM yyyy", { locale: es })}</span>
                                                    </div>
                                                    {(e.revicions?.length ?? 0) > 0 && (
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Revisiones</span>
                                                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{e.revicions!.length}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ height: 1, background: "var(--border)", marginBottom: 8 }} />
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button
                                                        style={{ flex: 1, padding: "7px 0", borderRadius: 6, background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                                        onClick={() => navigate(`/eventos/${e.id}`)}
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
                                                        onClick={() => { if (e.id) setAddRevicionEventoId(e.id as number); }}
                                                    >
                                                        Agregar revisión
                                                    </button>
                                                )}
                                            </div>
                                        </Popup>
                                    </CircleMarker>
                                ))}

                                {/* Poste markers */}
                                {mapTab === "postes" && posteMapMarkers.map((p, i) => (
                                    <CircleMarker key={i} center={[p.lat, p.lng]} radius={8}
                                        pathOptions={{ color: "var(--primary)", fillColor: "var(--primary)", fillOpacity: 0.85, weight: 1.5 }}
                                    >
                                        <Popup minWidth={220}>
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
                                                    onClick={() => navigate(`/postes/${p.id}`)}
                                                >
                                                    Ver poste
                                                </button>
                                            </div>
                                        </Popup>
                                    </CircleMarker>
                                ))}
                            </MapContainer>

                            {mapTab === "eventos" && (
                                <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-border/40 text-xs text-muted-foreground">
                                    {[{ color: "#DD0031", label: "Pendiente prioritario" }, { color: "#FF5500", label: "Pendiente" }, { color: "#249243", label: "Solucionado" }].map(({ color, label }) => (
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
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center rounded-lg border border-border bg-muted/30 p-1 gap-1">
                                        {([{ value: "all", label: "Todos" }, { value: "pending", label: "Pendientes" }, { value: "solved", label: "Solucionados" }] as const).map((opt) => (
                                            <Button key={opt.value} variant={estadoFilter === opt.value ? "default" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setEstadoFilter(opt.value)}>
                                                {opt.label}
                                            </Button>
                                        ))}
                                    </div>
                                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => exportCsv(list, ciudadA.name, ciudadB.name)}>
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
                                                    {(e.revicions?.length ?? 0) > 0 && <span className="ml-2">· {e.revicions!.length} {e.revicions!.length === 1 ? "revisión" : "revisiones"}</span>}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Badge className={`text-xs border-transparent shadow-none ${e.state ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600"}`}>
                                                    {e.state ? "Solucionado" : "Pendiente"}
                                                </Badge>
                                                {e.priority && <Badge variant="destructive" className="text-xs">Alta prioridad</Badge>}
                                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(`/eventos/${e.id}`)}>
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
                    onSuccess={handleGenerar}
                />
            </PermissionGuard>
            <PermissionGuard module="eventos" action="editar" open={!!addRevicionEventoId} onOpenChange={(v) => { if (!v) setAddRevicionEventoId(null); }}>
                <AddRevicionSheet
                    eventoId={addRevicionEventoId}
                    open={!!addRevicionEventoId}
                    setOpen={(v) => { if (!v) setAddRevicionEventoId(null); }}
                    onSuccess={handleGenerar}
                />
            </PermissionGuard>
        </div>
    );
};

export default ReportRecorridoSec;
