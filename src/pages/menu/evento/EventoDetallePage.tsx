import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, useMap } from "react-leaflet";
import ThemedTileLayer from "../../../components/map/ThemedTileLayer";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { getPosteByTramo } from "../../../api/Poste.api";
import { fetchOrsRoute } from "../../../lib/orsRoute";
import { useEventoDetalleData } from "./useEventoDetalleData";
import { PosteInterface } from "../../../interfaces/interfaces";
import { url } from "../../../api/url";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";
import { Separator } from "../../../components/ui/separator";
import AddRevisionSheet from "../../../components/dialogs/add/AddRevisionSheet";
import {
  PencilIcon, PlusIcon, WrenchIcon,
  RefreshCwIcon, CalendarIcon, MapPinIcon, ClockIcon,
  CheckCircle2Icon, ZapIcon,
  AlertCircleIcon,
} from "lucide-react";
import { latExample, lngExample } from "../../../data/example";
import { ImageViewer } from "../../../components/ui/image-viewer";
import { reabrirEvento } from "../../../api/Evento.api";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import EditEventoSheet from "../poste/PosteDetalle/EditEventoSheet";
import ResolverEventoSheet from "../poste/PosteDetalle/ResolverEventoSheet";
import PermissionGuard from "../../../components/PermissionGuard";

export default function EventoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  const d = useEventoDetalleData(Number(id));

  const [openEdit, setOpenEdit] = useState(false);
  const [openRevision, setOpenRevision] = useState(false);
  const [openResolver, setOpenResolver] = useState(false);
  const [confirmReabrir, setConfirmReabrir] = useState(false);
  const [reabriendo, setReabriendo] = useState(false);

  const rol = sesion.usuario.id_rol;
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [tramoPostes, setTramoPostes] = useState<PosteInterface[]>([]);

  const canAct = can(rol, "eventos", "editar");
  const isPending = d.evento ? !d.evento.state : false;

  const poste = d.evento?.poste;
  const hasCoords = (poste?.lat ?? 0) !== 0 && (poste?.lng ?? 0) !== 0;
  const center: [number, number] = hasCoords
    ? [poste!.lat, poste!.lng]
    : [latExample, lngExample];

  // Build route once poste data is available
  useEffect(() => {
    if (!poste) return;
    const a = poste.ciudadA;
    const b = poste.ciudadB;
    if (!a?.lat || !a?.lng || !b?.lat || !b?.lng || !poste.lat || !poste.lng) return;

    getPosteByTramo(poste.id_ciudadA, poste.id_ciudadB, sesion.token)
      .then((postes) => {
        const dx = b.lat - a.lat;
        const dy = b.lng - a.lng;
        const sorted = postes
          .filter((p) => p.lat && p.lng)
          .sort(
            (p1, p2) =>
              (p1.lat - a.lat) * dx + (p1.lng - a.lng) * dy -
              ((p2.lat - a.lat) * dx + (p2.lng - a.lng) * dy)
          );
        setTramoPostes(sorted);
        const fallback: [number, number][] = [
          [a.lat, a.lng],
          ...sorted.map((p): [number, number] => [p.lat, p.lng]),
          [b.lat, b.lng],
        ];
        const waypoints = [
          [a.lng, a.lat],
          ...sorted.map((p) => [p.lng, p.lat]),
          [b.lng, b.lat],
        ];
        const orsKey = import.meta.env.VITE_ORS_API_KEY as string;
        return fetchOrsRoute(waypoints, orsKey)
          .then((route) => setRoutePath(route ?? fallback))
          .catch(() => setRoutePath(fallback));
      })
      .catch(() => toast.warning("No se pudo calcular la ruta del tramo."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poste?.id, sesion.token]);

  const boundsCoords: [number, number][] = [
    ...(poste?.ciudadA?.lat && poste.ciudadA.lng ? [[poste.ciudadA.lat, poste.ciudadA.lng] as [number, number]] : []),
    ...(poste?.ciudadB?.lat && poste.ciudadB.lng ? [[poste.ciudadB.lat, poste.ciudadB.lng] as [number, number]] : []),
    ...(hasCoords ? [center] : []),
    ...tramoPostes.filter((p) => p.lat && p.lng).map((p): [number, number] => [p.lat, p.lng]),
  ];

  return (
    <div className="@container/card p-6 md:p-8 w-full space-y-6 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div>
            {d.loading ? (
              <>
                <Skeleton className="h-7 w-36 mb-1.5" />
                <Skeleton className="h-4 w-56" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight">
                    Evento #{d.evento?.id ?? ""}
                  </h1>
                  {d.evento?.state ? (
                    <Badge className="bg-primary/10 text-primary border-transparent shadow-none">Resuelto</Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-600 border-transparent shadow-none">Pendiente</Badge>
                  )}
                  {d.evento?.priority && (
                    <Badge className="bg-red-500/10 text-red-600 border-transparent shadow-none">Prioritario</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {poste?.name ?? "—"} · {poste?.ciudadA?.name ?? "—"} → {poste?.ciudadB?.name ?? "—"}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2 self-start sm:self-auto pl-11 sm:pl-0">
          {canAct && !d.loading && d.evento && (
            <>
              {isPending && (
                <Button variant="outline" className="gap-1.5" onClick={() => setOpenEdit(true)}>
                  <PencilIcon className="h-3.5 w-3.5" />
                  Editar
                </Button>
              )}
              {isPending && (
                <>
                  <Button variant="outline" className="gap-1.5" onClick={() => setOpenRevision(true)}>
                    <PlusIcon className="h-3.5 w-3.5" />
                    Revisión
                  </Button>
                  <Button className="gap-1.5" onClick={() => setOpenResolver(true)}>
                    <WrenchIcon className="h-3.5 w-3.5" />
                    Resolver
                  </Button>
                </>
              )}
              {!isPending && canAct && (
                <Button variant="outline" className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => setConfirmReabrir(true)}>
                  Des-resolver
                </Button>
              )}
            </>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={d.load} disabled={d.loading}>
            <RefreshCwIcon className={`h-4 w-4 ${d.loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          loading={d.loading}
          label="Revisiones"
          value={d.revicions.length}
          accent
          icon={<ClockIcon className="h-3.5 w-3.5 text-primary" />}
        />
        <KpiCard
          loading={d.loading}
          label="Observaciones"
          value={d.eventoObs.length}
          icon={<ZapIcon className="h-3.5 w-3.5 text-muted-foreground" />}
        />
        <KpiCard
          loading={d.loading}
          label="Estado"
          value={d.evento?.state ? "Resuelto" : "Pendiente"}
          small
          icon={
            d.evento?.state
              ? <CheckCircle2Icon className="h-3.5 w-3.5 text-primary" />
              : <AlertCircleIcon className="h-3.5 w-3.5 text-amber-500" />
          }
        />
        <KpiCard
          loading={d.loading}
          label="Fecha evento"
          value={d.evento?.date ? new Date(d.evento.date).toLocaleDateString("es-ES") : "—"}
          small
          icon={<CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />}
        />
      </div>

      {/* ── Info + Mapa ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Info */}
        <Card className="shadow-sm border-muted/60">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base">Información</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            {d.loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                </div>
              ))
            ) : (
              <>
                <InfoRow
                  icon={<MapPinIcon className="h-4 w-4 text-primary" />}
                  bg="bg-primary/10"
                  label="Poste"
                  value={poste?.name ?? "—"}
                />
                <InfoRow
                  icon={<MapPinIcon className="h-4 w-4 text-muted-foreground" />}
                  bg="bg-muted"
                  label="Tramo"
                  value={`${poste?.ciudadA?.name ?? "—"} → ${poste?.ciudadB?.name ?? "—"}`}
                />
                {poste?.propietario?.name && (
                  <InfoRow
                    icon={<ZapIcon className="h-4 w-4 text-muted-foreground" />}
                    bg="bg-muted"
                    label="Propietario"
                    value={poste.propietario.name}
                  />
                )}
                {d.evento?.usuario && (
                  <InfoRow
                    icon={<CalendarIcon className="h-4 w-4 text-muted-foreground" />}
                    bg="bg-muted"
                    label="Creado por"
                    value={`${d.evento.usuario.name} ${d.evento.usuario.lastname}`}
                  />
                )}
                {d.evento?.description && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                      <p className="text-sm leading-relaxed">{d.evento.description}</p>
                    </div>
                  </>
                )}
                {/* Event image */}
                {d.evento?.image && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Imagen</p>
                    <ImageViewer src={`${url}${d.evento.image}`} alt="evento" />
                  </div>
                )}
                {/* Observaciones */}
                {d.eventoObs.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Observaciones</p>
                    <div className="flex flex-wrap gap-1.5">
                      {d.eventoObs.map((eo) => (
                        <Badge
                          key={eo.id as number}
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {eo.ob?.name ?? `Obs. ${eo.id_obs}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Mapa */}
        <Card className="shadow-sm border-muted/60 overflow-hidden flex flex-col h-full">
          <CardHeader className="border-b border-border/40 pb-4 shrink-0">
            <CardTitle className="text-base">Ubicación del poste</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {d.loading ? (
              <Skeleton className="h-full min-h-90 w-full rounded-none" />
            ) : (
              <MapContainer
                center={center}
                zoom={hasCoords ? 13 : 5}
                style={{ height: "100%", minHeight: "360px" }}
                scrollWheelZoom
                zoomControl={false}
              >
                <ThemedTileLayer />

                {boundsCoords.length >= 2 && <FitBounds coords={boundsCoords} />}

                {/* Route polyline */}
                {routePath.length >= 2 && (
                  <Polyline
                    positions={routePath}
                    pathOptions={{ color: "#596BAB", weight: 3, opacity: 0.7 }}
                  />
                )}

                {/* Ciudad A */}
                {poste?.ciudadA?.lat && poste.ciudadA.lng && (
                  <CircleMarker
                    center={[poste.ciudadA.lat, poste.ciudadA.lng]}
                    radius={7}
                    pathOptions={{ color: "#374151", fillColor: "#374151", fillOpacity: 1, weight: 0 }}
                  >
                    <Popup minWidth={160}>
                      <div style={{ padding: "4px 2px 2px" }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{poste.ciudadA.name}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--primary)", fontWeight: 500 }}>Inicio del tramo</p>
                        <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                          {poste.ciudadA.lat?.toFixed(4)}, {poste.ciudadA.lng?.toFixed(4)}
                        </p>
                        <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
                        <button
                          style={{ width: "100%", padding: "7px 0", borderRadius: 6, background: "var(--primary)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          onClick={() => navigate(`/ciudades/${poste.id_ciudadA}`)}
                        >
                          Ver ciudad
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                )}

                {/* Ciudad B */}
                {poste?.ciudadB?.lat && poste.ciudadB.lng && (
                  <CircleMarker
                    center={[poste.ciudadB.lat, poste.ciudadB.lng]}
                    radius={7}
                    pathOptions={{ color: "#374151", fillColor: "#374151", fillOpacity: 1, weight: 0 }}
                  >
                    <Popup minWidth={160}>
                      <div style={{ padding: "4px 2px 2px" }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{poste.ciudadB.name}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--primary)", fontWeight: 500 }}>Fin del tramo</p>
                        <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                          {poste.ciudadB.lat?.toFixed(4)}, {poste.ciudadB.lng?.toFixed(4)}
                        </p>
                        <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
                        <button
                          style={{ width: "100%", padding: "7px 0", borderRadius: 6, background: "var(--primary)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          onClick={() => navigate(`/ciudades/${poste.id_ciudadB}`)}
                        >
                          Ver ciudad
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                )}

                {/* Otros postes del tramo (gris) */}
                {tramoPostes
                  .filter((p) => p.id !== poste?.id && p.lat && p.lng)
                  .map((p) => (
                    <CircleMarker
                      key={p.id as number}
                      center={[p.lat, p.lng]}
                      radius={6}
                      pathOptions={{ color: "#9ca3af", fillColor: "#9ca3af", fillOpacity: 0.7, weight: 1.5 }}
                    >
                      <Popup minWidth={190}>
                        <div style={{ padding: "4px 2px 2px" }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>Poste {p.name}</p>
                          {p.ciudadA?.name && p.ciudadB?.name && (
                            <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--muted-foreground)" }}>
                              {p.ciudadA.name} → {p.ciudadB.name}
                            </p>
                          )}
                          <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
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

                {/* Poste del evento (destacado) */}
                {hasCoords && (
                  <CircleMarker
                    center={center}
                    radius={10}
                    pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 1, weight: 0 }}
                  >
                    <Popup minWidth={190}>
                      <div style={{ padding: "4px 2px 2px" }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
                          Poste {poste?.name}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 10, color: "#dc2626", fontWeight: 600 }}>
                          Evento #{d.evento?.id}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                          {poste?.lat?.toFixed(4)}, {poste?.lng?.toFixed(4)}
                        </p>
                        <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
                        <button
                          style={{ width: "100%", padding: "7px 0", borderRadius: 6, background: "var(--primary)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          onClick={() => navigate(`/postes/${poste?.id}`)}
                        >
                          Ver poste
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                )}
              </MapContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Revisiones ── */}
      <Card className="shadow-sm border-muted/60">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4 text-muted-foreground" />
              Revisiones ({d.revicions.length})
            </CardTitle>
            {canAct && isPending && !d.loading && (
              <Button variant="outline" className="gap-1.5" onClick={() => setOpenRevision(true)}>
                <PlusIcon className="h-3.5 w-3.5" />
                Agregar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {d.loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : d.revicions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin revisiones registradas</p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3.5 top-3 bottom-3 w-px bg-border" />
              <div className="space-y-4">
                {[...d.revicions]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((rev, i) => (
                    <div key={rev.id ?? i} className="flex gap-4 relative">
                      <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 z-10">
                        <ClockIcon className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="flex-1 rounded-lg border border-border px-3 py-2.5 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarIcon className="h-3 w-3" />
                          {new Date(rev.date).toLocaleDateString("es-ES")}
                        </div>
                        <p className="text-sm">{rev.description}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Solución ── */}
      {(d.solucion || d.evento?.state) && (
        <Card className="shadow-sm border-primary/20">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base flex items-center gap-1.5 text-primary">
              <WrenchIcon className="h-4 w-4" />
              Solución
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            {d.loading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : d.solucion ? (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {new Date(d.solucion.date).toLocaleDateString("es-ES")}
                </div>
                <p className="text-sm leading-relaxed">{d.solucion.description}</p>
                {d.solucion.image && (
                  <ImageViewer src={`${url}${d.solucion.image}`} alt="solución" />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Evento marcado como resuelto.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Sheets ── */}
      <PermissionGuard module="eventos" action="editar" open={openEdit} onOpenChange={(v) => { if (!v) setOpenEdit(false); }}>
        <EditEventoSheet
          eventoId={d.evento?.id ?? null}
          open={openEdit}
          setOpen={(v: boolean) => { if (!v) setOpenEdit(false); }}
          onSuccess={d.load}
        />
      </PermissionGuard>
      <AddRevisionSheet
        eventoId={d.evento?.id ?? null}
        open={openRevision}
        setOpen={(v) => { if (!v) setOpenRevision(false); }}
        onSuccess={d.load}
      />
      <PermissionGuard module="eventos" action="editar" open={openResolver} onOpenChange={(v) => { if (!v) setOpenResolver(false); }}>
        <ResolverEventoSheet
          evento={d.evento}
          open={openResolver}
          setOpen={(v) => { if (!v) setOpenResolver(false); }}
          onSuccess={d.load}
        />
      </PermissionGuard>

      <AlertDialog open={confirmReabrir} onOpenChange={(o) => !o && setConfirmReabrir(false)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Des-resolver evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la solución registrada y el evento volverá a estado pendiente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reabriendo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={reabriendo}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={async () => {
                if (!d.evento?.id) return;
                setReabriendo(true);
                const status = await reabrirEvento(d.evento.id as number, sesion.token);
                setReabriendo(false);
                if (status === 200) {
                  toast.success("Evento reabierto");
                  setConfirmReabrir(false);
                  d.load();
                } else {
                  toast.error("Error al des-resolver el evento");
                }
              }}
            >
              {reabriendo ? "Procesando..." : "Des-resolver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length < 2) return;
    map.fitBounds(coords, { padding: [40, 40] });
  }, [map, coords]);
  return null;
}

function InfoRow({ icon, bg, label, value }: {
  icon: React.ReactNode; bg: string; label: string; value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 ${bg} rounded-full shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function KpiCard({ loading, label, value, icon, accent, small }: {
  loading: boolean; label: string; value: number | string;
  icon: React.ReactNode; accent?: boolean; small?: boolean;
}) {
  return (
    <Card className={`shadow-sm py-0 ${accent ? "border-primary/20" : "border-muted/60"}`}>
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center justify-between">
          {loading
            ? <Skeleton className="h-4 w-24" />
            : <p className="text-xs text-muted-foreground font-medium">{label}</p>
          }
          <div className={`p-2 rounded-full shrink-0 ${accent ? "bg-primary/10" : "bg-muted"}`}>{icon}</div>
        </div>
        {loading
          ? <Skeleton className="h-10 w-14" />
          : <div className={`${small ? "text-2xl" : "text-4xl"} font-bold tracking-tight ${accent ? "text-primary" : ""}`}>{value}</div>
        }
      </CardContent>
    </Card>
  );
}
