import { useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, useMap } from "react-leaflet";
import ThemedTileLayer from "../../../components/map/ThemedTileLayer";
import { SonarMarker } from "../../../components/map/SonarMarker";
import { MAP_RADIUS, MAP_WEIGHT } from "../../../components/map/mapConstants";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { getPosteByTramo } from "../../../api/Poste.api";
import { fetchOrsRoute } from "../../../lib/orsRoute";
import { useEventoDetalleData } from "./useEventoDetalleData";
import {
  EventoInterface, PosteInterface, RevisionInterface, SolucionInterface,
} from "../../../interfaces/interfaces";
import { url } from "../../../api/url";
import { Card, CardContent } from "../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import BitacoraPanel from "../../../components/BitacoraPanel";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import AddRevisionSheet from "../../../components/dialogs/AddRevisionSheet";
import {
  PencilIcon, PlusIcon, WrenchIcon, RefreshCwIcon, CalendarIcon,
  ClockIcon, MoreHorizontalIcon, LocateFixedIcon, RouteIcon,
  ActivityIcon, UserIcon, ChevronRightIcon, ImageIcon,
} from "lucide-react";
import { latExample, lngExample } from "../../../data/example";
import { ImageViewer } from "../../../components/ui/image-viewer";
import { reabrirEvento } from "../../../api/Evento.api";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import EventoSheet from "../../../components/dialogs/upsert/EventoSheet";
import ResolverEventoSheet from "../../../components/dialogs/ResolverEventoSheet";
import PermissionGuard from "../../../components/PermissionGuard";
import { daysOpen } from "../inicio/helpers";

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
  const [fitTramo, setFitTramo] = useState(false);

  const rol = sesion.usuario.id_rol;
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [tramoPostes, setTramoPostes] = useState<PosteInterface[]>([]);

  const canAct = can(rol, "eventos", "editar");
  const isPending = d.evento ? !d.evento.state : false;
  const eventoStatus = computeStatus(d.evento ?? null);
  const eventoCfg = STATUS_CFG[eventoStatus];

  const poste = d.evento?.poste;
  const hasCoords = (poste?.lat ?? 0) !== 0 && (poste?.lng ?? 0) !== 0;
  const center: [number, number] = hasCoords ? [poste!.lat, poste!.lng] : [latExample, lngExample];

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
    <div className="@container/card px-6 md:px-8 pb-6 md:pb-8 w-full space-y-6 animate-in fade-in duration-500">

      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-20 -mx-6 md:-mx-8 px-6 md:px-8 py-4 bg-background/85 supports-backdrop-filter:backdrop-blur-md border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            {d.loading ? (
              <>
                <Skeleton className="h-7 w-40 mb-1.5" />
                <Skeleton className="h-4 w-64" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight">
                    Evento #{d.evento?.id ?? ""}
                  </h1>
                  {d.evento?.state ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent shadow-none">
                      Resuelto
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent shadow-none">
                      Pendiente
                    </Badge>
                  )}
                  {d.evento?.priority && (
                    <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-transparent shadow-none">
                      Prioritario
                    </Badge>
                  )}
                </div>
                {d.evento?.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1 max-w-xl">
                    {d.evento.description}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {!d.loading && d.evento && canAct && isPending && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpenRevision(true)}>
                  <PlusIcon className="h-3.5 w-3.5" />
                  Revisión
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setOpenResolver(true)}>
                  <WrenchIcon className="h-3.5 w-3.5" />
                  Resolver
                </Button>
              </>
            )}
            {!d.loading && d.evento && canAct && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <MoreHorizontalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isPending && (
                    <DropdownMenuItem onClick={() => setOpenEdit(true)}>
                      <PencilIcon className="h-3.5 w-3.5 mr-2" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {!isPending && (
                    <DropdownMenuItem
                      onClick={() => setConfirmReabrir(true)}
                      className="text-amber-600 focus:text-amber-600"
                    >
                      <RefreshCwIcon className="h-3.5 w-3.5 mr-2" />
                      Reabrir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={d.load} disabled={d.loading}>
              <RefreshCwIcon className={`h-4 w-4 ${d.loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Strip de estado ── */}
      <EventoStrip
        loading={d.loading}
        evento={d.evento}
        reviciones={d.revisions}
        solucion={d.solucion}
      />

      {/* ── Info + Mapa ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Info */}
        <Card className="shadow-sm border-muted/60 overflow-hidden flex flex-col h-full py-0 gap-0">
          {/* Hero image */}
          <div className="aspect-16/10 bg-muted relative shrink-0 border-b border-border/40">
            {d.loading ? (
              <Skeleton className="absolute inset-0 rounded-none" />
            ) : d.evento?.image ? (
              <ImageViewer src={`${url}${d.evento.image}`} alt="evento" hero />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
                <ImageIcon className="h-10 w-10" strokeWidth={1.5} />
                <span className="text-xs">Sin imagen</span>
              </div>
            )}
          </div>

          {/* Datos */}
          <CardContent className="p-0 flex-1">
            {d.loading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex justify-between gap-4">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-32" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <dl className="space-y-3.5 px-5 py-4">
                  <InfoCell label="Poste">
                    <button
                      className="text-sm font-medium text-primary hover:underline underline-offset-2"
                      onClick={() => navigate(`/app/postes/${poste?.id}`)}
                    >
                      {poste?.name ?? "—"}
                    </button>
                  </InfoCell>
                  <InfoCell label="Tramo">
                    <span className="text-sm font-medium">
                      {poste?.ciudadA?.name ?? "—"}
                      <ChevronRightIcon className="inline h-3 w-3 mx-1 text-muted-foreground shrink-0" />
                      {poste?.ciudadB?.name ?? "—"}
                    </span>
                  </InfoCell>
                  {poste?.propietario?.name && (
                    <InfoCell label="Propietario">
                      <span className="text-sm font-medium">{poste.propietario.name}</span>
                    </InfoCell>
                  )}
                  <InfoCell label="Fecha apertura">
                    <span className="text-sm font-medium">
                      {d.evento?.date
                        ? new Date(d.evento.date).toLocaleDateString("es-ES")
                        : "—"}
                    </span>
                  </InfoCell>
                  {d.evento?.usuario && (
                    <InfoCell label="Creado por">
                      <span className="text-sm font-medium">
                        {d.evento.usuario.name} {d.evento.usuario.lastname}
                      </span>
                    </InfoCell>
                  )}
                </dl>

                {d.eventoObs.length > 0 && (
                  <div className="px-5 py-4 border-t border-border/40">
                    <p className="text-xs text-muted-foreground mb-2">Observaciones</p>
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
        <Card className="shadow-sm border-muted/60 overflow-hidden h-full py-0">
          <CardContent className="p-0 h-full">
            {d.loading ? (
              <Skeleton className="h-full min-h-90 w-full rounded-none" />
            ) : (
              <div className="isolate h-full relative">
                {hasCoords && boundsCoords.length >= 2 && (
                  <div className="absolute top-3 right-3 z-1000">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 bg-background/90 supports-backdrop-filter:backdrop-blur-sm shadow-sm border-border/60"
                      onClick={() => setFitTramo((v) => !v)}
                    >
                      {fitTramo ? (
                        <><LocateFixedIcon className="h-3.5 w-3.5" />Centrar</>
                      ) : (
                        <><RouteIcon className="h-3.5 w-3.5" />Ver tramo</>
                      )}
                    </Button>
                  </div>
                )}
                <MapContainer
                  center={center}
                  zoom={hasCoords ? 15 : 5}
                  style={{ height: "100%", minHeight: "420px" }}
                  scrollWheelZoom
                  zoomControl={false}
                >
                  <ThemedTileLayer />
                  <MapView
                    center={center}
                    boundsCoords={boundsCoords}
                    fitTramo={fitTramo}
                    hasCoords={hasCoords}
                  />

                  {poste?.ciudadA?.lat && poste.ciudadA.lng && (
                    <CircleMarker
                      center={[poste.ciudadA.lat, poste.ciudadA.lng]}
                      radius={7}
                      pathOptions={{ color: "#374151", fillColor: "#374151", fillOpacity: 1, weight: MAP_WEIGHT.secondary }}
                    >
                      <Popup minWidth={200}>
                        <CityPopup
                          name={poste.ciudadA.name}
                          role="Inicio del tramo"
                          lat={poste.ciudadA.lat}
                          lng={poste.ciudadA.lng}
                          onVer={() => navigate(`/app/ciudades/${poste.id_ciudadA}`)}
                        />
                      </Popup>
                    </CircleMarker>
                  )}

                  {poste?.ciudadB?.lat && poste.ciudadB.lng && (
                    <CircleMarker
                      center={[poste.ciudadB.lat, poste.ciudadB.lng]}
                      radius={7}
                      pathOptions={{ color: "#374151", fillColor: "#374151", fillOpacity: 1, weight: MAP_WEIGHT.secondary }}
                    >
                      <Popup minWidth={200}>
                        <CityPopup
                          name={poste.ciudadB.name}
                          role="Fin del tramo"
                          lat={poste.ciudadB.lat}
                          lng={poste.ciudadB.lng}
                          onVer={() => navigate(`/app/ciudades/${poste.id_ciudadB}`)}
                        />
                      </Popup>
                    </CircleMarker>
                  )}

                  {tramoPostes
                    .filter((p) => p.id !== poste?.id && p.lat && p.lng)
                    .map((p) => (
                      <CircleMarker
                        key={p.id as number}
                        center={[p.lat, p.lng]}
                        radius={MAP_RADIUS.secondary}
                        pathOptions={{ color: "#9ca3af", fillColor: "#9ca3af", fillOpacity: 0.65, weight: MAP_WEIGHT.secondary }}
                      >
                        <Popup minWidth={200}>
                          <TramoPostePopup
                            name={p.name}
                            ciudadA={p.ciudadA?.name}
                            ciudadB={p.ciudadB?.name}
                            onVer={() => navigate(`/app/postes/${p.id}`)}
                          />
                        </Popup>
                      </CircleMarker>
                    ))}

                  {routePath.length >= 2 && (
                    <Polyline
                      positions={routePath}
                      pathOptions={{ color: "#596BAB", weight: 3, opacity: 0.7 }}
                    />
                  )}

                  {hasCoords && (
                    <SonarMarker
                      center={center}
                      fillColor={eventoCfg.fill}
                      strokeColor={eventoCfg.stroke}
                      rgb={eventoCfg.rgb}
                      dotRadius={MAP_RADIUS.main}
                      weight={MAP_WEIGHT.main}
                    >
                      <Popup minWidth={200}>
                        <EventoPostePopup
                          name={poste?.name ?? ""}
                          ciudadA={poste?.ciudadA?.name}
                          ciudadB={poste?.ciudadB?.name}
                          eventoId={d.evento?.id as number}
                          lat={poste?.lat}
                          lng={poste?.lng}
                          onVer={() => navigate(`/app/postes/${poste?.id}`)}
                        />
                      </Popup>
                    </SonarMarker>
                  )}
                </MapContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Timeline de actividad ── */}
      <EventoTimeline
        loading={d.loading}
        eventoId={d.evento?.id as number ?? null}
        reviciones={d.revisions}
        solucion={d.solucion}
        canAct={canAct}
        isPending={isPending}
        onAddRevision={() => setOpenRevision(true)}
      />

      {/* ── Sheets ── */}
      <PermissionGuard module="eventos" action="editar" open={openEdit} onOpenChange={(v) => { if (!v) setOpenEdit(false); }}>
        <EventoSheet
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
            <AlertDialogTitle>¿Reabrir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              El evento volverá a estado pendiente.
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
                  toast.error("Error al reabrir el evento");
                }
              }}
            >
              {reabriendo ? "Procesando..." : "Reabrir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Strip de estado ──────────────────────────────────────────────────────────

type EventoStatus = "resuelto" | "pendiente" | "critico";

const STATUS_CFG: Record<EventoStatus, { label: string; dot: string; text: string; bg: string; fill: string; stroke: string; rgb: string }> = {
  resuelto: {
    label: "Resuelto",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    fill: "#10b981", stroke: "#059669", rgb: "16, 185, 129",
  },
  pendiente: {
    label: "Pendiente",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    fill: "#f59e0b", stroke: "#d97706", rgb: "245, 158, 11",
  },
  critico: {
    label: "Crítico",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    fill: "#ef4444", stroke: "#dc2626", rgb: "220, 38, 38",
  },
};

function computeStatus(evento: EventoInterface | null): EventoStatus {
  if (!evento || evento.state) return evento?.state ? "resuelto" : "pendiente";
  if (evento.priority) return "critico";
  return "pendiente";
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtShort(d: Date | string) {
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function diasTranscurridos(d: Date | string) {
  const n = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));
  if (n === 0) return "hoy";
  if (n === 1) return "hace 1 día";
  return `hace ${n} días`;
}

function EventoStrip({
  loading, evento, reviciones, solucion,
}: {
  loading: boolean;
  evento: EventoInterface | null;
  reviciones: RevisionInterface[];
  solucion: SolucionInterface | null;
}) {
  const status = computeStatus(evento);
  const cfg = STATUS_CFG[status];

  const diasAbierto = useMemo(() => {
    if (!evento?.date) return null;
    const end = solucion?.date ? new Date(solucion.date) : new Date();
    return Math.max(0, Math.floor((end.getTime() - new Date(evento.date).getTime()) / 86_400_000));
  }, [evento?.date, solucion?.date]);

  const lastRevision = useMemo(
    () =>
      reviciones.length > 0
        ? [...reviciones].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
        : null,
    [reviciones]
  );

  if (loading) {
    return (
      <Card className="shadow-sm border-muted/60 py-0">
        <CardContent className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 lg:divide-x divide-border/40">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2.5 lg:px-3 first:lg:pl-0 last:lg:pr-0">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const estadoSub = status === "resuelto"
    ? (solucion?.date ? `Cerrado el ${fmtDate(solucion.date)}` : "Cerrado")
    : status === "critico"
    ? "Requiere atención inmediata"
    : evento?.date ? `Abierto el ${fmtDate(evento.date)}` : null;

  const duracionSub = evento?.date
    ? solucion?.date
      ? `${fmtShort(evento.date)} → ${fmtShort(solucion.date)}`
      : `Desde el ${fmtDate(evento.date)}`
    : null;

  const revSub = lastRevision
    ? `Última revisión ${diasTranscurridos(lastRevision.date)}`
    : "Sin actividad registrada";

  const registradoSub = evento?.date
    ? `${fmtDate(evento.date)} · ${diasTranscurridos(evento.date)}`
    : null;

  return (
    <Card className="shadow-sm border-muted/60 py-0">
      <CardContent className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 lg:divide-x divide-border/40">

        {/* Estado */}
        <StripCell label="Estado" icon={<ActivityIcon className="h-3.5 w-3.5" />}>
          <div className="flex items-center gap-2">
            <span className={`h-6 w-6 rounded-full ${cfg.bg} flex items-center justify-center shrink-0`}>
              <span className={`h-3 w-3 rounded-full ${cfg.dot}`} />
            </span>
            <span className={`text-lg font-semibold ${cfg.text}`}>{cfg.label}</span>
          </div>
          {estadoSub && (
            <p className={`text-xs mt-1.5 leading-relaxed ${status === "critico" ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
              {estadoSub}
            </p>
          )}
        </StripCell>

        {/* Duración */}
        <StripCell
          label={solucion ? "Duración" : "Días abierto"}
          icon={<CalendarIcon className="h-3.5 w-3.5" />}
        >
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold leading-none">{diasAbierto ?? "—"}</span>
            {diasAbierto !== null && (
              <span className="text-xs text-muted-foreground">días</span>
            )}
          </div>
          {duracionSub && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{duracionSub}</p>
          )}
        </StripCell>

        {/* Revisiones */}
        <StripCell label="Revisiones" icon={<ClockIcon className="h-3.5 w-3.5" />}>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold leading-none ${reviciones.length === 0 ? "text-muted-foreground" : ""}`}>
              {reviciones.length}
            </span>
            {solucion && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                + 1 solución
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{revSub}</p>
        </StripCell>

        {/* Registrado por */}
        <StripCell label="Registrado por" icon={<UserIcon className="h-3.5 w-3.5" />}>
          <p className="text-sm font-semibold leading-snug truncate">
            {evento?.usuario
              ? `${evento.usuario.name} ${evento.usuario.lastname}`
              : "—"}
          </p>
          {registradoSub && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{registradoSub}</p>
          )}
        </StripCell>

      </CardContent>
    </Card>
  );
}

function StripCell({
  label, icon, children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="lg:px-3 first:lg:pl-0 last:lg:pr-0 min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ─── Timeline de actividad ────────────────────────────────────────────────────

type TimelineItem =
  | { type: "revision"; date: Date; description: string }
  | { type: "solucion"; date: Date; description: string; image: string };

function EventoTimeline({
  loading, eventoId, reviciones, solucion, canAct, isPending, onAddRevision,
}: {
  loading: boolean;
  eventoId: number | null;
  reviciones: RevisionInterface[];
  solucion: SolucionInterface | null;
  canAct: boolean;
  isPending: boolean;
  onAddRevision: () => void;
}) {
  const items = useMemo<TimelineItem[]>(() => {
    const result: TimelineItem[] = reviciones.map((r) => ({
      type: "revision",
      date: r.date,
      description: r.description,
    }));
    if (solucion) {
      result.push({
        type: "solucion",
        date: solucion.date,
        description: solucion.description,
        image: solucion.image,
      });
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [reviciones, solucion]);

  return (
    <Card className="shadow-sm border-muted/60 py-0">
      <CardContent className="p-0">
        <Tabs defaultValue="actividad" className="gap-0">
          <div className="px-4 pt-4 pb-3 border-b border-border/40 flex items-center justify-between gap-3 flex-wrap">
            <TabsList variant="line">
              <TabsTrigger value="actividad" className="gap-1.5">
                <ClockIcon className="h-3.5 w-3.5" />
                Actividad
                {items.length > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">({items.length})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="bitacora" className="gap-1.5">
                <ActivityIcon className="h-3.5 w-3.5" />
                Bitácora
              </TabsTrigger>
            </TabsList>
            {canAct && isPending && !loading && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onAddRevision}>
                <PlusIcon className="h-3.5 w-3.5" />
                Agregar revisión
              </Button>
            )}
          </div>

          <TabsContent value="actividad" className="p-5">
            {loading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                    <Skeleton className="h-16 flex-1 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-10">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <ClockIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Sin actividad registrada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Las revisiones y la solución aparecerán aquí.
                </p>
                {canAct && isPending && (
                  <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onAddRevision}>
                    <PlusIcon className="h-3.5 w-3.5" />
                    Primera revisión
                  </Button>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-3.5 top-3.5 bottom-3.5 w-px bg-border/60" />
                <div className="space-y-5">
                  {items.map((item, i) => {
                    const isSolucion = item.type === "solucion";
                    return (
                      <div key={i} className="flex gap-4 relative">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 border ${
                          isSolucion
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : "bg-sky-500/10 border-sky-500/30"
                        }`}>
                          {isSolucion
                            ? <WrenchIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            : <ClockIcon className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                          }
                        </div>
                        <div className="flex-1 rounded-lg border border-border/60 px-4 py-3 space-y-1.5 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-semibold ${
                              isSolucion
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-sky-600 dark:text-sky-400"
                            }`}>
                              {isSolucion ? "Solución" : "Revisión"}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {daysOpen(item.date)}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed">{item.description}</p>
                          {isSolucion && (item as TimelineItem & { type: "solucion" }).image && (
                            <div className="pt-1">
                              <ImageViewer
                                src={`${url}${(item as TimelineItem & { type: "solucion" }).image}`}
                                alt="solución"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="bitacora" className="p-5">
            <BitacoraPanel entity="Evento" entityId={eventoId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── Helpers de celda ─────────────────────────────────────────────────────────

function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="text-right min-w-0">{children}</div>
    </div>
  );
}

// ─── Popups del mapa ─────────────────────────────────────────────────────────

function CityPopup({
  name, role, lat, lng, onVer,
}: {
  name: string; role: string; lat: number; lng: number; onVer: () => void;
}) {
  return (
    <div className="min-w-47.5 py-1">
      <div className="flex items-start gap-2 mb-2">
        <span className="mt-0.5 h-2 w-2 rounded-full bg-foreground inline-block shrink-0" />
        <div>
          <p className="text-sm font-bold text-foreground leading-tight">{name}</p>
          <p className="text-[10px] text-primary font-medium mt-0.5">{role}</p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground font-mono mb-2.5">
        {lat.toFixed(4)}, {lng.toFixed(4)}
      </p>
      <div className="border-t border-border/60 -mx-1 mb-2.5" />
      <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={onVer}>
        Ver ciudad
      </Button>
    </div>
  );
}

function TramoPostePopup({
  name, ciudadA, ciudadB, onVer,
}: {
  name: string; ciudadA?: string; ciudadB?: string; onVer: () => void;
}) {
  return (
    <div className="min-w-50 py-1">
      <div className="flex items-start gap-2 mb-2">
        <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-muted-foreground inline-block shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">Poste {name}</p>
          {ciudadA && ciudadB && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{ciudadA} → {ciudadB}</p>
          )}
        </div>
      </div>
      <div className="border-t border-border/60 -mx-1 mb-2.5" />
      <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={onVer}>
        Ver poste
      </Button>
    </div>
  );
}

function EventoPostePopup({
  name, ciudadA, ciudadB, eventoId, lat, lng, onVer,
}: {
  name: string; ciudadA?: string; ciudadB?: string;
  eventoId: number; lat?: number; lng?: number; onVer: () => void;
}) {
  return (
    <div className="min-w-50 py-1">
      <div className="flex items-start gap-2 mb-2">
        <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-red-500 inline-block shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">Poste {name}</p>
          {ciudadA && ciudadB && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{ciudadA} → {ciudadB}</p>
          )}
          <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold mt-0.5">
            Evento #{eventoId}
          </p>
        </div>
      </div>
      {lat !== undefined && lng !== undefined && (
        <p className="text-[10px] text-muted-foreground font-mono mb-2.5">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </p>
      )}
      <div className="border-t border-border/60 -mx-1 mb-2.5" />
      <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={onVer}>
        Ver poste
      </Button>
    </div>
  );
}

// ─── MapView ──────────────────────────────────────────────────────────────────

function MapView({
  center, boundsCoords, fitTramo, hasCoords,
}: {
  center: [number, number];
  boundsCoords: [number, number][];
  fitTramo: boolean;
  hasCoords: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (fitTramo && boundsCoords.length >= 2) {
      map.fitBounds(boundsCoords, { padding: [40, 40] });
    } else if (hasCoords) {
      map.setView(center, 15);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitTramo, center[0], center[1]]);
  return null;
}
