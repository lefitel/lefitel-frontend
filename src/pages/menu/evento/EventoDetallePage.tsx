import { useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTrailLabel } from "../../../components/TrailLabel";
import Dato from "../../../components/Dato";
import { FOTO_CABECERA_ALTO } from "../../../components/fotoCabecera";
import DatoTramo from "../tramo/DatoTramo";
import BaseMap from "../../../components/map/BaseMap";
import MapPoint from "../../../components/map/MapPoint";
import MapLine from "../../../components/map/MapLine";
import { SonarMarker } from "../../../components/map/SonarMarker";
import { FitView } from "../../../components/map/useFitCoords";
import { fromLatLngTuple, type LatLng, hasCoords } from "../../../components/map/mapGeo";
import { MAP_RADIUS, MAP_WEIGHT, MAP_DOT } from "../../../components/map/mapConstants";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { getPostesDelTramo } from "../../../api/Poste.api";
import { fetchOrsRoute } from "../../../lib/orsRoute";
import { ordenarTramo } from "../../../lib/tramoOrden";
import { ETIQUETA_EXTREMO, extremosDibujables, nombreDelTramo } from "../../../lib/tramo";
import { useEventoDetalleData } from "./useEventoDetalleData";
import {
  EventoInterface, PosteInterface, RevisionInterface, SolucionInterface,
} from "../../../interfaces/interfaces";
import { imageUrl } from "../../../lib/imageUrl";
import { Card, CardContent } from "../../../components/ui/card";
import PanelRail, { type PanelRailItem } from "../../../components/PanelRail";
import BitacoraPanel from "../../../components/BitacoraPanel";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";
import AddRevisionSheet from "../../../components/dialogs/AddRevisionSheet";
import {
  PencilIcon, PlusIcon, WrenchIcon, ArchiveIcon,
  ClockIcon, RotateCcwIcon, LocateFixedIcon, RouteIcon,
  ImageIcon, LayoutListIcon, HistoryIcon,
  Building2Icon, CalendarIcon, UserIcon, UtilityPoleIcon,
} from "lucide-react";
import { latExample, lngExample } from "../../../data/example";
import { ImageViewer } from "../../../components/ui/image-viewer";
import { deleteEvento, reabrirEvento } from "../../../api/Evento.api";
import { mensajeDeError } from "../../../api/descarga";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import EventoSheet from "../../../components/dialogs/upsert/EventoSheet";
import ResolverEventoSheet from "../../../components/dialogs/ResolverEventoSheet";
import PermissionGuard from "../../../components/PermissionGuard";
import { daysOpen } from "../inicio/helpers";
import { getCriticalityMeta, getEventCriticality } from "../../../lib/criticality";
import { CriticalityBadge } from "../../../components/CriticalityBadge";

/** What the incident's panel can show; the rail beside it chooses one. */
type VistaEvento = "resumen" | "actividad" | "bitacora";
const SOLUCION_TITULO_ID = "evento-solucion-titulo";
const VISTA_PANEL_ID = "evento-vista-panel";
const vistaTabId = (vista: VistaEvento) => `evento-vista-tab-${vista}`;

export default function EventoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  const d = useEventoDetalleData(Number(id));
  // An incident has no name of its own: the trail says what the sheet's title says.
  useTrailLabel(d.evento?.id ? `Evento #${d.evento.id}` : null);

  const [openEdit, setOpenEdit] = useState(false);
  const [openRevision, setOpenRevision] = useState(false);
  const [openResolver, setOpenResolver] = useState(false);
  const [confirmReabrir, setConfirmReabrir] = useState(false);
  const [reabriendo, setReabriendo] = useState(false);
  const [confirmArchivar, setConfirmArchivar] = useState(false);
  const [archivando, setArchivando] = useState(false);
  const [fitTramo, setFitTramo] = useState(false);
  const [vista, setVista] = useState<VistaEvento>("resumen");

  const rol = sesion.usuario.id_rol;
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [tramoPostes, setTramoPostes] = useState<PosteInterface[]>([]);
  const [extremos, setExtremos] = useState<LatLng[]>([]);

  const canAct = can(rol, "eventos", "editar");
  const canArchivar = can(rol, "eventos", "archivar");

  /**
   * Archiving from the sheet, as the list does it. Once it is done there is
   * nothing left here to look at — an archived incident is not served at this
   * address — so the way out is the list it was taken from.
   */
  const handleArchivar = async () => {
    if (!d.evento?.id) return;
    setArchivando(true);
    try {
      await deleteEvento(d.evento.id);
      toast.success("Evento archivado.");
      setConfirmArchivar(false);
      navigate("/app/eventos");
    } catch (error) {
      toast.error(mensajeDeError(error, "Error al archivar el evento."));
    } finally {
      setArchivando(false);
    }
  };
  const isPending = d.evento ? !d.evento.state : false;
  const eventoStatus = computeStatus(d.evento ?? null);
  const eventoCfg = STATUS_CFG[eventoStatus];

  // The event's severity is the worst level among its observations — the same
  // rule the list, the map and the reports use. This screen showed none of it,
  // so arriving here from a "crítica" alert told you nothing about how bad the
  // thing you were looking at was.
  const criticality = getEventCriticality({ eventoObs: d.eventoObs });

  // What the panel can show. The log is only offered to a role that may read
  // it: its endpoint asks for `bitacora.ver`, and without it the view held
  // nothing but "No tiene permiso para ver la bitácora".
  const vistas: PanelRailItem<VistaEvento>[] = [
    { value: "resumen", label: "Resumen", icon: <LayoutListIcon /> },
    { value: "actividad", label: "Actividad", icon: <ClockIcon />, count: d.revisions.length + (d.solucion ? 1 : 0) },
    ...(can(rol, "bitacora", "ver")
      ? [{ value: "bitacora" as const, label: "Bitácora", icon: <HistoryIcon /> }]
      : []),
  ];

  const poste = d.evento?.poste;
  const located = hasCoords(poste);
  const center: LatLng = located
    ? { lat: poste!.lat, lng: poste!.lng }
    : { lat: latExample, lng: lngExample };

  // The two ends of the tramo as points; an end with no position stays
  // missing in its own slot and draws no marker.
  const extremosTramo = extremosDibujables(poste?.tramo);

  useEffect(() => {
    // What the previous incident drew belongs to it: this page is not remounted
    // when the route parameter changes, so a pole with nothing to draw has to
    // take the old line down itself.
    if (!poste?.id_tramo || !located) {
      setTramoPostes([]);
      setExtremos([]);
      setRoutePath([]);
      return;
    }
    const [uno, dos] = extremosDibujables(poste.tramo);

    // A stretch that answers after the person has moved to another incident
    // must not draw itself over the one now on screen.
    let vigente = true;
    getPostesDelTramo(poste.id_tramo)
      .then((postes) => {
        if (!vigente) return;
        const tramo = ordenarTramo(postes, uno, dos);
        setTramoPostes(tramo.postes);
        setExtremos([tramo.inicio, tramo.fin].filter((c) => c !== null));
        return fetchOrsRoute(tramo.waypoints)
          .then((route) => { if (vigente) setRoutePath(route ?? tramo.linea); })
          .catch(() => { if (vigente) setRoutePath(tramo.linea); });
      })
      .catch(() => { if (vigente) toast.warning("No se pudo calcular la ruta del tramo."); });
    return () => { vigente = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poste?.id]);

  // The cities the line reaches, not the tramo's two cities as stored: one kept
  // at a placeholder position would stretch the view across half the globe.
  const boundsCoords: [number, number][] = [
    ...extremos.map((c): [number, number] => [c.lat, c.lng]),
    ...(located ? [[center.lat, center.lng] as [number, number]] : []),
    ...tramoPostes.filter(hasCoords).map((p): [number, number] => [p.lat, p.lng]),
  ];

  return (
    // The same shape as the pole's sheet. Two columns and a rail from `lg` up:
    // the page takes exactly the height the shell leaves it, the map fills its
    // column, and the panel beside it scrolls on its own. What the panel holds
    // is chosen on the rail. Below `lg` they stack and the shell scrolls.
    <div className="w-full p-page grid grid-cols-1 gap-page lg:flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_24rem_auto] lg:grid-rows-[minmax(0,1fr)] animate-in fade-in duration-500">

      <div className="h-64 lg:h-full min-h-0">
        <Card className="shadow-sm border-muted/60 overflow-hidden h-full py-0">
          <CardContent className="p-0 h-full">
            {/* Not while it merely reloads: a placeholder here takes the map down,
                and it would be built again, tiles and all, on every refresh. */}
            {d.loading && !d.evento ? (
              <Skeleton className="h-full min-h-64 w-full rounded-none" />
            ) : (
              <div className="isolate h-full relative">
                {located && boundsCoords.length >= 2 && (
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
                <BaseMap
                  center={center}
                  zoom={located ? 15 : 5}
                  style={{ height: "100%", minHeight: "16rem" }}
                >
                  <FitView
                    coords={boundsCoords.map(fromLatLngTuple)}
                    fit={fitTramo}
                    center={located ? center : { lat: 0, lng: 0 }}
                    zoom={15}
                    duration={700}
                  />

                  {([0, 1] as const).map((i) => {
                    const ciudad = poste?.tramo?.ciudades?.[i];
                    const punto = extremosTramo[i];
                    if (!ciudad || !punto) return null;
                    return (
                      <MapPoint
                        key={ciudad.id}
                        center={punto}
                        radius={MAP_RADIUS.endpoint}
                        strokeColor={MAP_DOT.endpoint}
                        fillColor={MAP_DOT.endpoint}
                        fillOpacity={1}
                        strokeWidth={MAP_WEIGHT.secondary}
                        popupMinWidth={200}
                      >
                        <CityPopup
                          name={ciudad.name ?? "—"}
                          role={ETIQUETA_EXTREMO}
                          lat={punto.lat}
                          lng={punto.lng}
                          onVer={() => navigate(`/app/ciudades/${ciudad.id}`)}
                        />
                      </MapPoint>
                    );
                  })}

                  {tramoPostes
                    .filter((p) => p.id !== poste?.id && hasCoords(p))
                    .map((p) => (
                      <MapPoint
                        key={p.id as number}
                        center={{ lat: p.lat, lng: p.lng }}
                        radius={MAP_RADIUS.secondary}
                        strokeColor={MAP_DOT.pole}
                        fillColor={MAP_DOT.poleFill}
                        fillOpacity={1}
                        strokeWidth={MAP_WEIGHT.secondary}
                        popupMinWidth={200}
                      >
                        <TramoPostePopup
                          name={p.name}
                          tramo={nombreDelTramo(p)}
                          onVer={() => navigate(`/app/postes/${p.id}`)}
                        />
                      </MapPoint>
                    ))}

                  {routePath.length >= 2 && (
                    <MapLine
                      id="evento-route"
                      positions={routePath.map(fromLatLngTuple)}
                    />
                  )}

                  {located && (
                    <SonarMarker
                      center={[center.lat, center.lng]}
                      fillColor={eventoCfg.fill}
                      strokeColor={eventoCfg.stroke}
                      rgb={eventoCfg.rgb}
                      dotRadius={MAP_RADIUS.main}
                      weight={MAP_WEIGHT.main}
                      popupMinWidth={200}
                    >
                      <EventoPostePopup
                        name={poste?.name ?? ""}
                        tramo={nombreDelTramo(poste)}
                        eventoId={d.evento?.id as number}
                        lat={poste?.lat}
                        lng={poste?.lng}
                        onVer={() => navigate(`/app/postes/${poste?.id}`)}
                      />
                    </SonarMarker>
                  )}
                </BaseMap>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* One card for the whole panel, and nothing lifted inside it — its parts
          were cards of their own, one of them folding, in a panel with room to
          spare. `block` rather than the card's own column: a flex column of a
          fixed height would squeeze them instead of letting the panel scroll. */}
      <Card
        id={VISTA_PANEL_ID}
        role="tabpanel"
        aria-labelledby={vistaTabId(vista)}
        className="order-3 lg:order-2 shadow-sm border-muted/60 py-0 gap-0 block min-h-0 lg:overflow-y-auto"
      >
        {vista === "resumen" && (
          <>
            <div>
              {/* The incident's photograph, across the top. Pressing it opens
                  the whole picture. */}
              <div className={`relative ${FOTO_CABECERA_ALTO} w-full shrink-0 bg-muted`}>
                {d.loading && !d.evento ? (
                  <Skeleton className="absolute inset-0 rounded-none" />
                ) : d.evento?.image ? (
                  <ImageViewer src={imageUrl(d.evento.image) ?? ""} alt="evento" hero />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground/40">
                    <ImageIcon className="h-5 w-5" strokeWidth={1.5} />
                    <span className="text-xs">Sin imagen</span>
                  </div>
                )}
              </div>

              <div className="p-3 space-y-2.5">
                <div className="min-w-0">
                  {d.loading ? (
                    <>
                      <Skeleton className="h-6 w-36 mb-1.5" />
                      <Skeleton className="h-4 w-48" />
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-lg font-bold tracking-tight leading-tight">
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
                        {criticality != null && (
                          <span className="inline-flex items-center gap-1.5">
                            {/* The word is worth the pixels: the map's marker
                                paints a manually flagged event as "Crítico",
                                and this is a different fact about a different
                                thing. Which of the two the word should mean is
                                an open decision. */}
                            <span className="text-xs text-muted-foreground">Gravedad</span>
                            <CriticalityBadge level={criticality} />
                          </span>
                        )}
                      </div>
                      {d.evento?.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                          {d.evento.description}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/*
                  Buttons, not a «⋯». The menu that stood here never held more
                  than one thing — Editar while the event is open, Reabrir once
                  it is resolved — so it was a click spent on opening a list of
                  one.

                  Two rows of two, each button half the card: what moves the
                  incident forward above, what changes or removes its record
                  below. Four on one row did not fit the card's width.
                */}
                {!d.loading && d.evento && (canAct || canArchivar) && (
                  <div className="space-y-2">
                    {canAct && isPending && (
                      <div className="flex gap-2">
                        <Button size="sm" className="gap-1.5 flex-1" onClick={() => setOpenResolver(true)}>
                          <WrenchIcon className="h-3.5 w-3.5" />
                          Resolver
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => setOpenRevision(true)}>
                          <PlusIcon className="h-3.5 w-3.5" />
                          Revisión
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {canAct && isPending && (
                        <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => setOpenEdit(true)}>
                          <PencilIcon className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                      )}
                      {canAct && !isPending && (
                        // Amber as it was in the menu, and still asked before it
                        // happens: the press opens the same confirmation.
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 flex-1 text-amber-600 hover:text-amber-600"
                          onClick={() => setConfirmReabrir(true)}
                        >
                          <RotateCcwIcon className="h-3.5 w-3.5" />
                          Reabrir
                        </Button>
                      )}
                      {canArchivar && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 flex-1 text-destructive hover:text-destructive"
                          onClick={() => setConfirmArchivar(true)}
                        >
                          <ArchiveIcon className="h-3.5 w-3.5" />
                          Archivar
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Straight under the header and with no title of its own: it is
                the only other thing the summary holds. */}
            <section aria-label="Datos" className="px-3 pb-3">
              {d.loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex justify-between gap-4">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3.5 w-32" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <EventoCifras evento={d.evento} reviciones={d.revisions} solucion={d.solucion} />
                {/* The same cells as the pole's sheet: an icon, a small
                    label and the value under it, two to a row. They were lines
                    of a label at one edge and its value at the other, with the
                    width of the panel empty between them. */}
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                  <Dato icon={<UtilityPoleIcon />} label="Poste">
                    {poste?.id != null && (
                      <Link to={`/app/postes/${poste.id}`} className="text-primary hover:underline underline-offset-2">
                        {poste.name}
                      </Link>
                    )}
                  </Dato>
                  <Dato icon={<Building2Icon />} label="Propietario">{poste?.propietario?.name}</Dato>
                  <DatoTramo tramo={poste?.tramo} canVerTramos={can(rol, "tramos", "ver")} />
                  <Dato icon={<CalendarIcon />} label="Fecha apertura">
                    {d.evento?.date
                      ? new Date(d.evento.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
                      : undefined}
                  </Dato>
                  <Dato icon={<UserIcon />} label="Creado por">
                    {d.evento?.usuario ? `${d.evento.usuario.name} ${d.evento.usuario.lastname}` : undefined}
                  </Dato>
                </dl>

                {d.eventoObs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <p className="text-xs text-muted-foreground mb-2">Observaciones</p>
                    <div className="flex flex-wrap gap-1.5">
                      {/* Tinted by their own level, so a catastrophic observation
                          does not sit here looking like the routine one beside
                          it. Unclassified keeps the plain outline. */}
                      {d.eventoObs.map((eo) => {
                        const level = eo.ob?.criticality ?? null;
                        const meta = getCriticalityMeta(level);
                        return (
                          <Badge
                            key={eo.id as number}
                            variant="outline"
                            className={`text-xs font-normal ${level != null ? `${meta.bgClass} ${meta.textClass} ${meta.borderClass}` : ""}`}
                            title={level != null ? `Gravedad ${level} · ${meta.label}` : "Sin clasificar"}
                          >
                            {eo.ob?.name ?? `Obs. ${eo.id_obs}`}
                            {level != null && (
                              <span className="ml-1 font-semibold tabular-nums">{level}</span>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
                </>
              )}
            </section>

            {/* How it was solved, on the summary of an incident that is: its
                words and its photo were only an entry of the activity, a tab
                away from the first thing somebody asks of a closed incident. */}
            {!d.loading && d.solucion && (
              <>
                {/* Inset, not from edge to edge: a rule across the whole card
                    cut it in two. */}
                <div role="separator" className="mx-3 h-px rounded-full bg-border/60" />
                <section aria-labelledby={SOLUCION_TITULO_ID} className="p-3 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 id={SOLUCION_TITULO_ID} className="text-sm font-semibold">Solución</h2>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(d.solucion.date).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{d.solucion.description}</p>
                  {d.solucion.image && (
                    <div className="relative h-40 w-full overflow-hidden rounded-lg border border-border/60 bg-muted">
                      <ImageViewer src={imageUrl(d.solucion.image) ?? ""} alt="Foto de la solución" hero />
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}

        {vista === "actividad" && (
          <EventoTimeline
            loading={d.loading}
            reviciones={d.revisions}
            solucion={d.solucion}
            canAct={canAct}
            isPending={isPending}
            onAddRevision={() => setOpenRevision(true)}
          />
        )}

        {vista === "bitacora" && (
          <div>
            <h2 className="px-3 py-2.5 text-sm font-semibold">Bitácora</h2>
            <div className="px-3 pb-3">
              <BitacoraPanel entity="Evento" entityId={d.evento?.id as number ?? null} />
            </div>
          </div>
        )}
      </Card>

      <div className="order-2 lg:order-3 min-w-0">
        <PanelRail
          label="Vistas del evento"
          items={vistas}
          value={vista}
          onChange={setVista}
          panelId={VISTA_PANEL_ID}
          tabId={vistaTabId}
        />
      </div>

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

      <AlertDialog open={confirmArchivar} onOpenChange={(o) => !o && setConfirmArchivar(false)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar evento?</AlertDialogTitle>
            <AlertDialogDescription>
              El evento quedará archivado y dejará de aparecer en las listas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archivando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive-fill text-destructive-foreground hover:bg-destructive-fill/90"
              disabled={archivando}
              onClick={handleArchivar}
            >
              {archivando ? "Archivando..." : "Archivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReabrir} onOpenChange={(o) => !o && setConfirmReabrir(false)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reabrir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la solución registrada y su fotografía, que no se podrá
              recuperar. El evento volverá a estado pendiente.
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
                try {
                  await reabrirEvento(d.evento.id as number);
                  toast.success("Evento reabierto");
                  setConfirmReabrir(false);
                  d.load();
                } catch (error) {
                  // La frase del servidor. El rechazo habitual es de permiso, y
                  // «Error al reabrir el evento» no lo distinguía de una avería.
                  toast.error(mensajeDeError(error, "Error al reabrir el evento"));
                } finally {
                  setReabriendo(false);
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

/**
 * The two figures of an incident: how long it has been open — or took to
 * close — and how many times somebody has been to look at it.
 *
 * These were two of the four cells of a strip across the top of the sheet. The
 * other two said what the header already says (the state) and what the record
 * below already says (who registered it).
 */
function EventoCifras({
  evento, reviciones, solucion,
}: {
  evento: EventoInterface | null;
  reviciones: RevisionInterface[];
  solucion: SolucionInterface | null;
}) {
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

  const duracionSub = evento?.date
    ? solucion?.date
      ? `${fmtShort(evento.date)} → ${fmtShort(solucion.date)}`
      : `Desde el ${fmtDate(evento.date)}`
    : null;

  const revSub = lastRevision
    ? `Última ${diasTranscurridos(lastRevision.date)}`
    : "Sin actividad";

  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <Cifra label={solucion ? "Duración" : "Días abierto"} sub={duracionSub}>
        <span className="text-xl font-semibold leading-tight tabular-nums">{diasAbierto ?? "—"}</span>
        {diasAbierto !== null && (
          <span className="text-xs text-muted-foreground">{diasAbierto === 1 ? "día" : "días"}</span>
        )}
      </Cifra>
      <Cifra label="Revisiones" sub={revSub}>
        <span className={`text-xl font-semibold leading-tight tabular-nums ${reviciones.length === 0 ? "text-muted-foreground" : ""}`}>
          {reviciones.length}
        </span>
        {solucion && (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
            + 1 solución
          </span>
        )}
      </Cifra>
    </div>
  );
}

function Cifra({
  label, sub, children,
}: {
  label: string;
  sub: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2 min-w-0">
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      <p className="flex items-baseline gap-1 min-w-0">{children}</p>
      {sub && <p className="text-[11px] text-muted-foreground truncate" title={sub}>{sub}</p>}
    </div>
  );
}

// ─── Timeline de actividad ────────────────────────────────────────────────────

type TimelineItem =
  | { type: "revision"; date: Date; description: string }
  | { type: "solucion"; date: Date; description: string; image: string };

/**
 * What has been done about the incident, the latest first: each visit, and the
 * repair that closed it. It has the whole panel to itself — chosen on the rail —
 * because it is the one part of the sheet that keeps growing.
 */
function EventoTimeline({
  loading, reviciones, solucion, canAct, isPending, onAddRevision,
}: {
  loading: boolean;
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
    <div>
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Actividad
          {items.length > 0 && (
            <span className="text-muted-foreground font-normal tabular-nums"> · {items.length}</span>
          )}
        </h2>
        {canAct && isPending && !loading && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onAddRevision}>
            <PlusIcon className="h-3.5 w-3.5" />
            Agregar revisión
          </Button>
        )}
      </div>

      <div className="px-3 pb-3">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                <Skeleton className="h-16 flex-1 rounded-lg" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          // No button here: "Agregar revisión" is on this view's own header,
          // and a second way into the same form was noise.
          <div className="text-center py-8">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-2">
              <ClockIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Sin actividad registrada</p>
            <p className="text-xs text-muted-foreground mt-1">
              Las revisiones y la solución aparecerán aquí.
            </p>
          </div>
        ) : (
              <div className="relative">
                <div className="absolute left-3.5 top-3.5 bottom-3.5 w-px bg-border/60" />
                <div className="space-y-5">
                  {items.map((item, i) => {
                    const isSolucion = item.type === "solucion";
                    return (
                      <div key={i} className="flex gap-3 relative">
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
                        <div className="flex-1 rounded-lg border border-border/60 px-3 py-2.5 space-y-1.5 min-w-0">
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
                                src={imageUrl((item as TimelineItem & { type: "solucion" }).image) ?? ""}
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
      </div>
    </div>
  );
}

// ─── Helpers de celda ─────────────────────────────────────────────────────────

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
  name, tramo, onVer,
}: {
  name: string; tramo?: string; onVer: () => void;
}) {
  return (
    <div className="min-w-50 py-1">
      <div className="flex items-start gap-2 mb-2">
        <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-muted-foreground inline-block shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">Poste {name}</p>
          {tramo && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{tramo}</p>
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
  name, tramo, eventoId, lat, lng, onVer,
}: {
  name: string; tramo?: string;
  eventoId: number; lat?: number; lng?: number; onVer: () => void;
}) {
  return (
    <div className="min-w-50 py-1">
      <div className="flex items-start gap-2 mb-2">
        <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-red-500 inline-block shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">Poste {name}</p>
          {tramo && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{tramo}</p>
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

