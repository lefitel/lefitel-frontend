import { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { CircleMarker, MapContainer, Popup, useMap } from "react-leaflet";
import ThemedTileLayer from "../../../components/map/ThemedTileLayer";
import { SonarMarker } from "../../../components/map/SonarMarker";
import { MAP_RADIUS, MAP_WEIGHT } from "../../../components/map/mapConstants";
import { Card, CardContent } from "../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { Badge } from "../../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { CiudadInterface, PosteInterface } from "../../../interfaces/interfaces";
import { url } from "../../../api/url";
import { useCiudadDetalleData } from "./useCiudadDetalleData";
import { latExample, lngExample } from "../../../data/example";
import BitacoraPanel from "../../../components/BitacoraPanel";
import CiudadSheet from "../../../components/dialogs/upsert/CiudadSheet";
import PermissionGuard from "../../../components/PermissionGuard";
import { ImageViewer } from "../../../components/ui/image-viewer";
import {
  ActivityIcon, CalendarIcon, ChevronRightIcon, ImageIcon,
  LocateFixedIcon, MapPinIcon, MoreHorizontalIcon, MoreVerticalIcon,
  PencilIcon, RefreshCwIcon, RouteIcon, ZapIcon,
} from "lucide-react";

const CITY_COLOR = {
  fill:   "#596BAB",
  stroke: "#4557a0",
  rgb:    "89, 107, 171",
};

export default function CiudadDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  const rol = sesion.usuario.id_rol;
  const d = useCiudadDetalleData(Number(id));
  const [openEditCiudad, setOpenEditCiudad] = useState(false);
  const [fitPostes, setFitPostes] = useState(false);

  const hasCoords = (d.ciudad?.lat ?? 0) !== 0 && (d.ciudad?.lng ?? 0) !== 0;
  const center: [number, number] = hasCoords
    ? [d.ciudad!.lat, d.ciudad!.lng]
    : [latExample, lngExample];

  const boundsCoords: [number, number][] = [
    ...(hasCoords ? [center] : []),
    ...d.postes.filter((p) => p.lat && p.lng).map((p): [number, number] => [p.lat, p.lng]),
  ];

  return (
    <div className="@container/card px-6 md:px-8 pb-6 md:pb-8 w-full space-y-6 animate-in fade-in duration-500">

      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-20 -mx-6 md:-mx-8 px-6 md:px-8 py-4 bg-background/85 supports-backdrop-filter:backdrop-blur-md border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {d.loading ? (
              <>
                <Skeleton className="h-7 w-44 mb-1.5" />
                <Skeleton className="h-4 w-64" />
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight truncate">
                  {d.ciudad?.name ?? "Ciudad"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {d.tramos.length} {d.tramos.length === 1 ? "tramo" : "tramos"} · {d.postes.length} postes
                </p>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" disabled={d.loading}>
                  <MoreHorizontalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {can(rol, "ciudades", "editar") && (
                  <DropdownMenuItem onClick={() => setOpenEditCiudad(true)} disabled={!d.ciudad}>
                    <PencilIcon className="h-4 w-4" />
                    Editar ciudad
                  </DropdownMenuItem>
                )}
                {can(rol, "ciudades", "editar") && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={d.load} disabled={d.loading}>
                  <RefreshCwIcon className={`h-4 w-4 ${d.loading ? "animate-spin" : ""}`} />
                  Refrescar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* ── Strip de métricas ── */}
      <CiudadStrip
        loading={d.loading}
        ciudad={d.ciudad}
        postes={d.postes}
        tramos={d.tramos}
        ciudadId={Number(id)}
      />

      {/* ── Info + Mapa ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Info */}
        <Card className="shadow-sm border-muted/60 overflow-hidden flex flex-col h-full py-0 gap-0">
          {/* Hero image */}
          <div className="aspect-16/10 bg-muted relative shrink-0 border-b border-border/40">
            {d.loading ? (
              <Skeleton className="absolute inset-0 rounded-none" />
            ) : d.ciudad?.image ? (
              <ImageViewer src={`${url}${d.ciudad.image}`} alt={d.ciudad.name} hero />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
                <ImageIcon className="h-10 w-10" strokeWidth={1.5} />
                <span className="text-xs">Sin imagen</span>
              </div>
            )}
          </div>

          {/* Datos */}
          <CardContent className="p-5 flex-1">
            {d.loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            ) : (
              <dl className="space-y-3.5">
                <Row label="Nombre" value={d.ciudad?.name} />
                <Row
                  label="Coordenadas"
                  value={hasCoords
                    ? `${d.ciudad!.lat.toFixed(6)}, ${d.ciudad!.lng.toFixed(6)}`
                    : "Sin coordenadas"}
                />
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
          </CardContent>
        </Card>

        {/* Mapa — full-card, sin header, overlays flotantes */}
        <Card className="shadow-sm border-muted/60 overflow-hidden h-full py-0">
          <CardContent className="p-0 h-full">
            {d.loading ? (
              <Skeleton className="h-full min-h-90 w-full rounded-none" />
            ) : (
              <div className="isolate h-full relative">

                {/* Toggle button */}
                {hasCoords && boundsCoords.length >= 2 && (
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

                <MapContainer
                  center={center}
                  zoom={hasCoords ? 13 : 5}
                  style={{ height: "100%", minHeight: "420px" }}
                  scrollWheelZoom
                  zoomControl={false}
                >
                  <ThemedTileLayer />
                  <CityMapView
                    center={center}
                    boundsCoords={boundsCoords}
                    fitPostes={fitPostes}
                    hasCoords={hasCoords}
                  />

                  {/* Postes secundarios */}
                  {d.postes
                    .filter((p) => p.lat && p.lng)
                    .map((p) => (
                      <CircleMarker
                        key={p.id as number}
                        center={[p.lat, p.lng]}
                        radius={MAP_RADIUS.secondary}
                        pathOptions={{ color: "#9ca3af", fillColor: "#9ca3af", fillOpacity: 0.75, weight: MAP_WEIGHT.secondary }}
                      >
                        <Popup minWidth={220}>
                          <PostePopup poste={p} onVer={() => navigate(`/app/postes/${p.id}`)} />
                        </Popup>
                      </CircleMarker>
                    ))}

                  {/* Ciudad principal — SonarMarker */}
                  {hasCoords && (
                    <SonarMarker
                      center={center}
                      fillColor={CITY_COLOR.fill}
                      strokeColor={CITY_COLOR.stroke}
                      rgb={CITY_COLOR.rgb}
                      dotRadius={MAP_RADIUS.main}
                      weight={MAP_WEIGHT.main}
                    >
                      <Popup minWidth={200}>
                        <CiudadPopup
                          ciudad={d.ciudad!}
                          canEdit={can(rol, "ciudades", "editar")}
                          onEditar={() => setOpenEditCiudad(true)}
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

      {/* ── Tramos y Bitácora ── */}
      <Card className="shadow-sm border-muted/60 py-0">
        <CardContent className="p-0">
          <Tabs defaultValue="tramos" className="gap-0">
            <div className="px-4 pt-4 pb-3 border-b border-border/40">
              <TabsList variant="line">
                <TabsTrigger value="tramos" className="gap-1.5">
                  <RouteIcon className="h-3.5 w-3.5" />
                  Postes por tramo
                  {d.postes.length > 0 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({d.postes.length})
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="bitacora" className="gap-1.5">
                  <ActivityIcon className="h-3.5 w-3.5" />
                  Bitácora
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="tramos" className="mt-0">
              {d.loading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : d.tramos.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No hay postes registrados para esta ciudad.
                </p>
              ) : (
                d.tramos.map((tramo) => (
                  <div key={tramo.key} className="border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-3 px-6 py-3 bg-muted/30">
                      <RouteIcon className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-semibold">
                        {tramo.ciudadA.name}
                        <ChevronRightIcon className="inline h-3 w-3 mx-0.5 shrink-0" />
                        {tramo.ciudadB.name}
                      </span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {tramo.postes.length} {tramo.postes.length === 1 ? "poste" : "postes"}
                      </Badge>
                    </div>
                    <Table>
                      <TableHeader className="bg-transparent">
                        <TableRow className="hover:bg-transparent border-0">
                          <TableHead className="text-xs">Nombre</TableHead>
                          <TableHead className="text-xs">Material</TableHead>
                          <TableHead className="text-xs">Propietario</TableHead>
                          <TableHead className="text-xs">Fecha</TableHead>
                          <TableHead className="text-right pr-4 text-xs">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tramo.postes.map((p) => (
                          <TableRow key={p.id as number} className="hover:bg-muted/40">
                            <TableCell className="text-sm font-medium">{p.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.material?.name ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.propietario?.name ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {p.date ? new Date(p.date).toLocaleDateString("es-ES") : "—"}
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors data-[state=open]:bg-muted">
                                  <MoreVerticalIcon className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36">
                                  <DropdownMenuItem onClick={() => navigate(`/app/postes/${p.id}`)}>
                                    Ver detalle
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="bitacora" className="p-5">
              <BitacoraPanel entity="Ciudad" entityId={Number(id)} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <PermissionGuard
        module="ciudades"
        action="editar"
        open={openEditCiudad}
        onOpenChange={(v) => { if (!v) setOpenEditCiudad(false); }}
      >
        <CiudadSheet
          ciudad={d.ciudad}
          open={openEditCiudad}
          setOpen={(v) => { if (!v) setOpenEditCiudad(false); }}
          onSuccess={d.load}
        />
      </PermissionGuard>
    </div>
  );
}

// ── Strip de métricas ─────────────────────────────────────────────────────────

function CiudadStrip({
  loading, ciudad, postes, tramos, ciudadId,
}: {
  loading: boolean;
  ciudad: CiudadInterface | null | undefined;
  postes: PosteInterface[];
  tramos: { key: string }[];
  ciudadId: number;
}) {
  if (loading) {
    return (
      <Card className="shadow-sm border-muted/60 py-0">
        <CardContent className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 lg:divide-x divide-border/40">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 lg:px-3 first:lg:pl-0 last:lg:pr-0">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const connected = connectedCities(postes, ciudadId);

  return (
    <Card className="shadow-sm border-muted/60 py-0">
      <CardContent className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 lg:divide-x divide-border/40">

        <StripCell label="Total postes" icon={<ZapIcon className="h-3.5 w-3.5" />}>
          <span className="text-2xl font-bold leading-none">{postes.length}</span>
        </StripCell>

        <StripCell label="Tramos" icon={<RouteIcon className="h-3.5 w-3.5" />}>
          <span className="text-2xl font-bold leading-none text-primary">{tramos.length}</span>
        </StripCell>

        <StripCell label="Ciudades conectadas" icon={<MapPinIcon className="h-3.5 w-3.5" />}>
          <span className="text-2xl font-bold leading-none">{connected}</span>
        </StripCell>

        <StripCell label="Registrada" icon={<CalendarIcon className="h-3.5 w-3.5" />}>
          <p className="text-sm font-semibold leading-snug">
            {ciudad?.createdAt
              ? new Date(ciudad.createdAt).toLocaleDateString("es-ES", {
                  day: "2-digit", month: "short", year: "numeric",
                })
              : "—"}
          </p>
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

// ── Map helpers ───────────────────────────────────────────────────────────────

function CityMapView({
  center, boundsCoords, fitPostes, hasCoords,
}: {
  center: [number, number];
  boundsCoords: [number, number][];
  fitPostes: boolean;
  hasCoords: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (fitPostes && boundsCoords.length >= 2) {
      map.fitBounds(boundsCoords, { padding: [40, 40] });
    } else if (hasCoords) {
      map.setView(center, 13);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitPostes, center[0], center[1]]);
  return null;
}

// ── Popup components ──────────────────────────────────────────────────────────

function CiudadPopup({
  ciudad, canEdit, onEditar,
}: {
  ciudad: CiudadInterface;
  canEdit: boolean;
  onEditar: () => void;
}) {
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
        <p className="text-[10px] text-muted-foreground font-mono mb-2.5">
          {ciudad.lat.toFixed(4)}, {ciudad.lng.toFixed(4)}
        </p>
      )}
      {canEdit && (
        <>
          <div className="border-t border-border/60 -mx-1 mb-2.5" />
          <Button
            size="sm"
            className="w-full h-7 text-xs bg-primary hover:bg-primary/90 text-white"
            onClick={onEditar}
          >
            Editar ciudad
          </Button>
        </>
      )}
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
          {poste.ciudadA?.name && poste.ciudadB?.name && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {poste.ciudadA.name} → {poste.ciudadB.name}
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
        className="w-full h-7 text-xs bg-primary hover:bg-primary/90 text-white"
        onClick={onVer}
      >
        Ver detalle
      </Button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function connectedCities(postes: PosteInterface[], ciudadId: number): number {
  const others = new Set<number>();
  postes.forEach((p) => {
    if (p.id_ciudadA === ciudadId) others.add(p.id_ciudadB);
    else others.add(p.id_ciudadA);
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
