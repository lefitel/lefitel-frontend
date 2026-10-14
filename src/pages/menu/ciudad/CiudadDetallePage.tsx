import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { deleteCiudad, getCiudad, type CiudadConCifras } from "../../../api/Ciudad.api";
import { mensajeDeError } from "../../../api/descarga";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { useTrailLabel } from "../../../components/TrailLabel";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { nombreDelTramo } from "../../../lib/tramo";
import BaseMap from "../../../components/map/BaseMap";
import MapPoint from "../../../components/map/MapPoint";
import { SonarMarker } from "../../../components/map/SonarMarker";
import { FitView } from "../../../components/map/useFitCoords";
import { fromLatLngTuple, type LatLng, hasCoords } from "../../../components/map/mapGeo";
import { MAP_RADIUS, MAP_WEIGHT, MAP_DOT } from "../../../components/map/mapConstants";
import { Card, CardContent } from "../../../components/ui/card";
import PanelRail, { type PanelRailItem } from "../../../components/PanelRail";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { Input } from "../../../components/ui/input";
import CoordInputs from "../../../components/map/CoordInputs";
import { CiudadInterface, PosteInterface } from "../../../interfaces/interfaces";
import { imageUrl } from "../../../lib/imageUrl";
import { useCiudadDetalleData } from "./useCiudadDetalleData";
import { useCiudadEdicion } from "./useCiudadEdicion";
import { FOTO_CABECERA_ALTO } from "../../../components/fotoCabecera";
import type { TramoConCifras } from "../../../api/Tramo.api";
import TramoResumen from "../tramo/TramoResumen";
import { latExample, lngExample } from "../../../data/example";
import BitacoraPanel from "../../../components/BitacoraPanel";
import { ImageViewer } from "../../../components/ui/image-viewer";
import {
  ArchiveIcon, CameraIcon, HistoryIcon, ImageIcon, LayoutListIcon,
  LocateFixedIcon, MapPinIcon, PencilIcon, RouteIcon, SaveIcon, Undo2Icon,
} from "lucide-react";

// A city has no state to colour, so its dot is the neutral blue the forms use —
// theme tokens, where this was one blue picked against the light map.
const CITY_COLOR = {
  fill:   MAP_DOT.subject,
  stroke: "#ffffff",
  rgb:    MAP_DOT.subjectRgb,
};

/** What the city's panel can show; the rail beside it chooses one. */
type VistaCiudad = "resumen" | "bitacora";
const VISTA_PANEL_ID = "ciudad-vista-panel";
const vistaTabId = (vista: VistaCiudad) => `ciudad-vista-tab-${vista}`;

export default function CiudadDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  const rol = sesion.usuario.id_rol;
  // Poles are a second permission. Without it the sheet still opens: it does
  // not ask for them and does not draw the blocks made of them.
  const verPostes = can(rol, "postes", "ver");
  const verBitacora = can(rol, "bitacora", "ver");
  const verTramos = can(rol, "tramos", "ver");
  const d = useCiudadDetalleData(Number(id), { verPostes, verTramos });
  // The trail in the app's header knows this city by its number; this is its name.
  useTrailLabel(d.ciudad?.name);
  // The city is edited here, on its own sheet: its name where it is read, its
  // photo on the photo, its position on the map beside them. A dialog repeated
  // those three and a smaller map.
  const puedeEditar = can(rol, "ciudades", "editar");
  const puedeArchivar = can(rol, "ciudades", "archivar");
  const [confirmArchivar, setConfirmArchivar] = useState(false);
  const [archivando, setArchivando] = useState(false);

  /**
   * Archiving from the sheet, as the list does it. Once it is done there is
   * nothing left here to look at — an archived city is not served at this
   * address — so the way out is the list it was taken from. The server's own
   * sentence is shown when it refuses: a city that still holds a tramo says so.
   */
  const handleArchivar = async () => {
    if (!d.ciudad?.id) return;
    setArchivando(true);
    try {
      await deleteCiudad(d.ciudad.id);
      toast.success("Ciudad archivada");
      setConfirmArchivar(false);
      navigate("/app/ciudades");
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo archivar la ciudad"));
    } finally {
      setArchivando(false);
    }
  };
  const e = useCiudadEdicion(d.ciudad, d.load);
  // Armed by «Mover en el mapa»: the next press on the map places the city.
  // Unarmed, a press on the map is what it always was.
  const [moviendo, setMoviendo] = useState(false);
  const vistaPrevia = useFotoPrevia(e.foto);
  // The name is read as a title and becomes a field when its pencil is pressed.
  // A name the save refused is shown as a field too: its error needs one.
  const [editandoNombre, setEditandoNombre] = useState(false);
  const nombreComoCampo = puedeEditar && !!d.ciudad && (editandoNombre || !!e.errores.name);
  const [fitPostes, setFitPostes] = useState(false);
  const [vista, setVista] = useState<VistaCiudad>("resumen");

  // The page is not remounted from one city to the next — that is what keeps
  // the map — so what belongs to one city is put down here when the address
  // moves on. The draft itself is the edit hook's: it starts again from each
  // city that arrives.
  useEffect(() => {
    setMoviendo(false);
    setEditandoNombre(false);
    setFitPostes(false);
    setConfirmArchivar(false);
  }, [id]);

  // Every other city, drawn on the map so the next one is a press away, as on
  // the Tramos map. Asked once, not per city. A refusal or a failure leaves
  // them undrawn and says nothing: this sheet is about the one city.
  const [otras, setOtras] = useState<CiudadConCifras[]>([]);
  useEffect(() => {
    let vivo = true;
    getCiudad().then((todas) => { if (vivo) setOtras(todas); }).catch(() => undefined);
    return () => { vivo = false; };
  }, []);

  // What the panel can show. The log sits behind its own permission: its
  // endpoint asks for `bitacora.ver`, and without it that view held nothing but
  // "No tiene permiso para ver la bitácora". The poles by tramo were a view
  // here too; the summary now lists the city's tramos, each a link to its card.
  const vistas: PanelRailItem<VistaCiudad>[] = [
    { value: "resumen", label: "Resumen", icon: <LayoutListIcon /> },
    ...(verBitacora
      ? [{ value: "bitacora" as const, label: "Bitácora", icon: <HistoryIcon /> }]
      : []),
  ];

  const located = hasCoords(d.ciudad);
  const center: LatLng = located
    ? { lat: d.ciudad!.lat, lng: d.ciudad!.lng }
    : { lat: latExample, lng: lngExample };

  // Where the dot is drawn: the draft, so a move is seen before it is saved.
  const punto: LatLng | null = e.lat !== 0 || e.lng !== 0 ? { lat: e.lat, lng: e.lng } : null;

  const boundsCoords: [number, number][] = [
    ...(located ? [[center.lat, center.lng] as [number, number]] : []),
    ...d.postes.filter(hasCoords).map((p): [number, number] => [p.lat, p.lng]),
  ];

  return (
    // The same shape as the pole's and the incident's sheets. Two columns and a
    // rail from `lg` up: the page takes exactly the height the shell leaves it,
    // the map fills its column, and the panel beside it scrolls on its own. What
    // the panel holds is chosen on the rail. Below `lg` they stack.
    <div className="w-full p-page grid grid-cols-1 gap-page lg:flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_24rem_auto] lg:grid-rows-[minmax(0,1fr)] animate-in fade-in duration-500">

      <div className="h-64 lg:h-full min-h-0">
        <Card className="shadow-sm border-muted/60 overflow-hidden h-full py-0">
          <CardContent className="p-0 h-full">
            {/* Not while it merely reloads: a placeholder here takes the map down,
                and it would be built again, tiles and all, on every refresh. */}
            {d.loading && !d.ciudad ? (
              <Skeleton className="h-full min-h-64 w-full rounded-none" />
            ) : (
              <div className="isolate h-full relative">

                {/* On a phone it is as wide as the map and was drawn over
                    «Ver postes» in the other corner, so there it takes the
                    row below. */}
                {moviendo && (
                  <div
                    role="status"
                    className="absolute top-3 left-3 max-sm:top-12 max-sm:right-3 z-1000 flex items-center gap-2 rounded-lg border border-border/60 bg-background/90 supports-backdrop-filter:backdrop-blur-sm shadow-sm pl-2.5 pr-1 py-1 text-xs font-medium"
                  >
                    <MapPinIcon className="h-3.5 w-3.5 text-primary" />
                    Pulsa en el mapa para colocar la ciudad
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setMoviendo(false)}>
                      Cancelar
                    </Button>
                  </div>
                )}

                {/* Toggle button */}
                {located && boundsCoords.length >= 2 && (
                  <div className="absolute top-3 right-3 z-1000">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 bg-background/90 supports-backdrop-filter:backdrop-blur-sm shadow-sm border-border/60"
                      onClick={() => setFitPostes((v) => !v)}
                    >
                      {fitPostes ? (
                        <><LocateFixedIcon className="h-3.5 w-3.5" />Centrar</>
                      ) : (
                        <><RouteIcon className="h-3.5 w-3.5" />Ver postes</>
                      )}
                    </Button>
                  </div>
                )}

                <BaseMap
                  center={center}
                  zoom={located ? 13 : 5}
                  style={{ height: "100%", minHeight: "16rem" }}
                  onMapClick={moviendo
                    ? (p) => { e.setPosicion(p.lat, p.lng); setMoviendo(false); }
                    : undefined}
                  // A cross while armed: the map's hand says "drag me", and
                  // the next press is going to place the city instead.
                  cursor={moviendo ? "crosshair" : undefined}
                >
                  <FitView
                    coords={boundsCoords.map(fromLatLngTuple)}
                    fit={fitPostes}
                    center={located ? center : { lat: 0, lng: 0 }}
                    zoom={13}
                    duration={700}
                  />

                  {/* Las demás ciudades: the one shown is drawn below, and the one
                      just chosen is left out while it loads. */}
                  {otras
                    .filter((c) => c.id !== Number(id) && c.id !== d.ciudad?.id && hasCoords(c))
                    .map((c) => (
                      <MapPoint
                        key={`ciudad-${c.id}`}
                        center={{ lat: c.lat, lng: c.lng }}
                        radius={MAP_RADIUS.endpoint}
                        strokeColor={MAP_DOT.endpoint}
                        fillColor={MAP_DOT.endpoint}
                        fillOpacity={1}
                        strokeWidth={MAP_WEIGHT.secondary}
                        popupMinWidth={180}
                      >
                        <OtraCiudadPopup ciudad={c} onVer={() => navigate(`/app/ciudades/${c.id}`)} />
                      </MapPoint>
                    ))}

                  {/* Postes secundarios */}
                  {d.postes
                    .filter(hasCoords)
                    .map((p) => (
                      <MapPoint
                        key={p.id as number}
                        center={{ lat: p.lat, lng: p.lng }}
                        radius={MAP_RADIUS.secondary}
                        strokeColor={MAP_DOT.pole}
                        fillColor={MAP_DOT.poleFill}
                        fillOpacity={1}
                        strokeWidth={MAP_WEIGHT.secondary}
                        popupMinWidth={220}
                      >
                        <PostePopup poste={p} onVer={() => navigate(`/app/postes/${p.id}`)} />
                      </MapPoint>
                    ))}

                  {/* Ciudad principal — SonarMarker */}
                  {punto && d.ciudad && (
                    <SonarMarker
                      center={[punto.lat, punto.lng]}
                      fillColor={CITY_COLOR.fill}
                      strokeColor={CITY_COLOR.stroke}
                      rgb={CITY_COLOR.rgb}
                      dotRadius={MAP_RADIUS.main}
                      weight={MAP_WEIGHT.main}
                      popupMinWidth={200}
                    >
                      <CiudadPopup ciudad={d.ciudad} />
                    </SonarMarker>
                  )}
                </BaseMap>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* One card for the whole panel, and nothing lifted inside it: its parts
          are divided by a short line where a line helps. They were cards of their own, folding ones, in
          a panel that had room to spare. `block` rather than the card's own
          column: a flex column of a fixed height would squeeze them instead of
          letting the panel scroll. */}
      <Card
        id={VISTA_PANEL_ID}
        role="tabpanel"
        aria-labelledby={vistaTabId(vista)}
        className="order-3 lg:order-2 shadow-sm border-muted/60 py-0 gap-0 block min-h-0 lg:overflow-y-auto"
      >
        {vista === "resumen" && (
          <>
            <div>
              {/* The city's photograph, across the top. Pressing it opens the
                  whole picture. */}
              <div className={`relative ${FOTO_CABECERA_ALTO} w-full shrink-0 bg-muted`}>
                {d.loading && !d.ciudad ? (
                  <Skeleton className="absolute inset-0 rounded-none" />
                ) : vistaPrevia ? (
                  // Chosen and not saved yet: shown as it will be.
                  <img src={vistaPrevia} alt="Foto nueva, sin guardar" className="absolute inset-0 h-full w-full object-cover" />
                ) : d.ciudad?.image ? (
                  <ImageViewer src={imageUrl(d.ciudad.image) ?? ""} alt={d.ciudad.name} hero />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground/40">
                    <ImageIcon className="h-5 w-5" strokeWidth={1.5} />
                    <span className="text-xs">Sin imagen</span>
                  </div>
                )}
                {/* The save pair, once something has changed: at the top of the
                    card, over the photo, whichever of the three it was. */}
                {e.cambiado && (
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0 shadow-sm"
                      onClick={() => { e.descartar(); setMoviendo(false); setEditandoNombre(false); }}
                      disabled={e.guardando}
                      aria-label="Descartar cambios"
                      title="Descartar cambios"
                    >
                      <Undo2Icon className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-8 w-8 shrink-0 shadow-sm"
                      onClick={() => void e.guardar()}
                      disabled={e.guardando}
                      aria-label="Guardar cambios"
                      title="Guardar cambios"
                    >
                      <SaveIcon className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {puedeEditar && d.ciudad && (
                  <label className="absolute bottom-2 right-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-background/90 supports-backdrop-filter:backdrop-blur-sm shadow-sm px-2 py-1 text-xs font-medium transition-colors hover:bg-background has-focus-visible:outline-2 has-focus-visible:outline-ring">
                    <CameraIcon className="h-3.5 w-3.5" />
                    Cambiar foto
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={e.guardando}
                      onChange={(ev) => {
                        const f = ev.target.files?.[0];
                        if (f?.type.startsWith("image/")) e.setFoto(f);
                        // So choosing the same file again after a discard is still a change.
                        ev.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="p-3">
                {d.loading && !d.ciudad ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <>
                    {/* Only the name: the save pair is over the photo, and
                        there is no refresh button — the browser has one. */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {nombreComoCampo ? (
                        // Not `truncate`: it clips, and a field's lit edge is
                        // drawn outside its box.
                        <h1 className="min-w-0 flex-1 text-lg font-bold tracking-tight leading-tight">
                          <Input
                            autoFocus
                            aria-label="Nombre de la ciudad"
                            value={e.name}
                            onChange={(ev) => e.setName(ev.target.value)}
                            onBlur={() => setEditandoNombre(false)}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter") {
                                setEditandoNombre(false);
                                if (e.cambiado) void e.guardar();
                              }
                              // Out of the field with the name it had; the rest
                              // of the draft is not this key's to throw away.
                              if (ev.key === "Escape") {
                                e.setName(d.ciudad?.name ?? "");
                                setEditandoNombre(false);
                              }
                            }}
                            disabled={e.guardando}
                            aria-invalid={!!e.errores.name}
                            className="h-9 px-2.5 text-lg md:text-lg font-bold tracking-tight"
                          />
                        </h1>
                      ) : (
                        // The pencil shows when the pointer is on the title's
                        // row, and on focus for the keyboard. The `mouse:`
                        // variant is what hides it, so a touch screen never does.
                        <div className="group/nombre flex h-9 min-w-0 flex-1 items-center gap-1">
                          <h1 className="min-w-0 text-lg font-bold tracking-tight leading-tight truncate">
                            {(puedeEditar ? e.name : d.ciudad?.name) || "Ciudad"}
                          </h1>
                          {puedeEditar && d.ciudad && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground transition-opacity mouse:opacity-0 mouse:group-hover/nombre:opacity-100 mouse:focus-visible:opacity-100"
                              onClick={() => setEditandoNombre(true)}
                              disabled={e.guardando}
                              aria-label="Editar nombre"
                              title="Editar nombre"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                      {/* On the title's row and as an icon, as on a tramo's
                          card: outlined and in red, always in sight. */}
                      {puedeArchivar && d.ciudad && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => setConfirmArchivar(true)}
                          disabled={e.guardando}
                          aria-label="Archivar"
                          title="Archivar"
                        >
                          <ArchiveIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {e.errores.name && <p className="text-xs text-destructive mt-1">{e.errores.name}</p>}
                  </>
                )}
              </div>
            </div>

            {/* No rule above it and no title of its own: what precedes is only
                the city's name, and these are simply the rest of the city. */}
            <section aria-label="Ficha" className="px-3 pb-3">
              {/* Its three figures are counts of poles. */}
              {verPostes && (
                <CiudadStrip
                  loading={d.loading}
                  postes={d.postes}
                  tramos={d.tramos}
                  ciudadId={Number(id)}
                />
              )}
              {d.loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              ) : (
                <dl className="space-y-2.5">
                  {puedeEditar && d.ciudad ? (
                    <div className="space-y-2">
                      {/* On the coordinates' own row, at the foot of it so it
                          lines up with the two fields and not with their labels:
                          it is the third way of saying where the city is. */}
                      <div className="flex items-end gap-2">
                        <div className="min-w-0 flex-1">
                          <CoordInputs
                            id="ciudad"
                            lat={e.lat}
                            lng={e.lng}
                            onChange={e.setPosicion}
                            disabled={e.guardando}
                            invalid={!!e.errores.posicion}
                          />
                        </div>
                        <Button
                          variant={moviendo ? "default" : "outline"}
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          aria-label="Mover en el mapa"
                          title="Mover en el mapa"
                          aria-pressed={moviendo}
                          onClick={() => setMoviendo((v) => !v)}
                          disabled={e.guardando}
                        >
                          <MapPinIcon className="h-4 w-4" />
                        </Button>
                      </div>
                      {e.errores.posicion && <p className="text-xs text-destructive">{e.errores.posicion}</p>}
                    </div>
                  ) : (
                    <Row
                      label="Coordenadas"
                      value={located
                        ? `${d.ciudad!.lat.toFixed(6)}, ${d.ciudad!.lng.toFixed(6)}`
                        : "Sin coordenadas"}
                    />
                  )}
                  <Row
                    label="Registrada"
                    value={d.ciudad?.createdAt
                      ? new Date(d.ciudad.createdAt).toLocaleDateString("es-ES", {
                          day: "2-digit", month: "short", year: "numeric",
                        })
                      : undefined}
                  />
                </dl>
              )}
            </section>

            {verTramos && (
              <>
                {/* Inset, not from edge to edge: a rule across the whole card
                    cut it in two. */}
                <div role="separator" className="mx-3 h-px rounded-full bg-border/60" />
                <section className="p-3">
                  <h2 className="text-sm font-semibold mb-2">
                    Tramos
                    {d.tramosDeCiudad.length > 0 && (
                      <span className="text-muted-foreground font-normal tabular-nums"> · {d.tramosDeCiudad.length}</span>
                    )}
                  </h2>
                  <CiudadTramos loading={d.loading} fallidos={d.tramosFallidos} tramos={d.tramosDeCiudad} />
                </section>
              </>
            )}
          </>
        )}

        {vista === "bitacora" && (
          <div>
            <h2 className="px-3 py-2.5 text-sm font-semibold">Bitácora</h2>
            <div className="px-3 pb-3">
              <BitacoraPanel entity="Ciudad" entityId={Number(id)} />
            </div>
          </div>
        )}
      </Card>

      <div className="order-2 lg:order-3 min-w-0">
        <PanelRail
          label="Vistas de la ciudad"
          items={vistas}
          value={vista}
          onChange={setVista}
          panelId={VISTA_PANEL_ID}
          tabId={vistaTabId}
        />
      </div>

      <AlertDialog open={confirmArchivar} onOpenChange={(v) => { if (!v) setConfirmArchivar(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar ciudad?</AlertDialogTitle>
            <AlertDialogDescription>
              La ciudad <strong>{d.ciudad?.name}</strong> quedará archivada y dejará de aparecer en las listas.
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
    </div>
  );
}

/**
 * An address for a photo that has been chosen and not uploaded yet, so it can
 * be shown; released when the photo changes or the page goes.
 */
function useFotoPrevia(foto: File | null): string | null {
  const url = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

// ── Strip de métricas ─────────────────────────────────────────────────────────

/**
 * The three figures of a city, all of them counts made of its poles.
 *
 * They were three of the four cells of a strip across the top of the sheet;
 * the fourth was the date the city was registered, which the record below
 * already gives.
 */
function CiudadStrip({
  loading, postes, tramos, ciudadId,
}: {
  loading: boolean;
  postes: PosteInterface[];
  tramos: { key: string }[];
  ciudadId: number;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 mb-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  const connected = connectedCities(postes, ciudadId);

  return (
    <div className="grid grid-cols-3 gap-2 mb-3">
      <StripCell label="Postes">
        <span className="text-xl font-semibold leading-tight tabular-nums">{postes.length}</span>
      </StripCell>

      <StripCell label="Tramos">
        <span className="text-xl font-semibold leading-tight tabular-nums text-primary">{tramos.length}</span>
      </StripCell>

      <StripCell label="Ciudades conectadas">
        <span className="text-xl font-semibold leading-tight tabular-nums">{connected}</span>
      </StripCell>
    </div>
  );
}

function StripCell({
  label, children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-muted/60 px-2.5 py-2 min-w-0">
      <div className="text-[11px] text-muted-foreground font-medium leading-tight truncate" title={label}>
        <span>{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ── Tramos de la ciudad ───────────────────────────────────────────────────────

/**
 * The tramos with this city at one end, drawn as the Tramos screen draws its
 * list. Each row leads to that tramo's own card, where it is edited.
 */
function CiudadTramos({
  loading, fallidos, tramos,
}: {
  loading: boolean;
  fallidos: boolean;
  tramos: TramoConCifras[];
}) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
      </div>
    );
  }
  if (fallidos) return <p className="text-sm text-muted-foreground">No se pudieron cargar los tramos.</p>;
  if (tramos.length === 0) return <p className="text-sm text-muted-foreground">Esta ciudad no está en ningún tramo.</p>;

  return (
    <ul aria-label="Tramos de esta ciudad" className="space-y-1.5">
      {tramos.map((t) => (
        <li key={t.id}>
          <Link
            to={`/app/tramos/${t.id}`}
            className="block min-w-0 rounded-lg bg-muted/60 px-2.5 py-2 transition-colors hover:bg-muted -outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <TramoResumen tramo={t} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ── Popup components ──────────────────────────────────────────────────────────

function CiudadPopup({ ciudad }: { ciudad: CiudadInterface }) {
  return (
    <div className="min-w-45 py-1">
      <div className="flex items-start gap-2 mb-2">
        <span
          className="mt-1 h-2 w-2 rounded-full shrink-0"
          style={{ background: CITY_COLOR.fill }}
        />
        <div>
          <p className="text-sm font-bold text-foreground leading-tight">{ciudad.name}</p>
          <p className="text-[10px] font-medium mt-0.5" style={{ color: CITY_COLOR.fill }}>
            Esta ciudad
          </p>
        </div>
      </div>
      {ciudad.lat && ciudad.lng && (
        <p className="text-[10px] text-muted-foreground font-mono">
          {ciudad.lat.toFixed(4)}, {ciudad.lng.toFixed(4)}
        </p>
      )}
    </div>
  );
}

function OtraCiudadPopup({
  ciudad, onVer,
}: {
  ciudad: CiudadConCifras;
  onVer: () => void;
}) {
  return (
    <div className="min-w-40 py-1">
      <p className="text-sm font-bold text-foreground leading-tight">{ciudad.name}</p>
      {/* Only when the server sent it: the figure is behind `postes.ver`. */}
      {ciudad.postes !== undefined && (
        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
          {ciudad.postes} {ciudad.postes === 1 ? "poste" : "postes"}
        </p>
      )}
      <div className="border-t border-border/60 -mx-1 my-2" />
      <Button size="sm" className="w-full h-7 text-xs" onClick={onVer}>
        Ver ciudad
      </Button>
    </div>
  );
}

function PostePopup({
  poste, onVer,
}: {
  poste: PosteInterface;
  onVer: () => void;
}) {
  return (
    <div className="min-w-50 py-1">
      <div className="flex items-start gap-2 mb-2.5">
        <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-muted-foreground/60 inline-block shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground leading-tight">Poste {poste.name}</p>
          {nombreDelTramo(poste) && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {nombreDelTramo(poste)}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-1 mb-2.5">
        {poste.propietario?.name && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Propietario</span>
            <span className="text-[11px] font-semibold text-foreground">{poste.propietario.name}</span>
          </div>
        )}
        {poste.material?.name && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Material</span>
            <span className="text-[11px] font-semibold text-foreground">{poste.material.name}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Coordenadas</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {poste.lat?.toFixed(4)}, {poste.lng?.toFixed(4)}
          </span>
        </div>
      </div>
      <div className="border-t border-border/60 -mx-1 mb-2.5" />
      <Button
        size="sm"
        className="w-full h-7 text-xs"
        onClick={onVer}
      >
        Ver detalle
      </Button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * The other cities reached over the tramos of this city's poles, each counted
 * once. A pole whose tramo does not contain this city says nothing about its
 * connections and is skipped.
 */
function connectedCities(postes: PosteInterface[], ciudadId: number): number {
  const others = new Set<number>();
  postes.forEach((p) => {
    const ciudades = p.tramo?.ciudades;
    if (!ciudades?.some((c) => c.id === ciudadId)) return;
    const otra = ciudades.find((c) => c.id !== ciudadId);
    if (otra) others.add(otra.id);
  });
  return others.size;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <dt className="text-xs text-muted-foreground font-medium shrink-0">{label}</dt>
      <dd className="text-sm font-medium truncate text-right">{value ?? "—"}</dd>
    </div>
  );
}
