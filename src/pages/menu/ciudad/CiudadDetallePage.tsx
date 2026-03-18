import { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { CircleMarker, MapContainer, Popup, useMap } from "react-leaflet";
import ThemedTileLayer from "../../../components/map/ThemedTileLayer";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { PosteInterface } from "../../../interfaces/interfaces";
import { url } from "../../../api/url";
import { useCiudadDetalleData } from "./useCiudadDetalleData";
import { latExample, lngExample } from "../../../data/example";
import {
  CalendarIcon, ChevronRightIcon, MapPinIcon, MoreVerticalIcon, PencilIcon, RefreshCwIcon, RouteIcon, ZapIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import EditCiudadSheet from "../../../components/dialogs/edits/EditCiudadSheet";
import PermissionGuard from "../../../components/PermissionGuard";
import { ImageViewer } from "../../../components/ui/image-viewer";

export default function CiudadDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  const rol = sesion.usuario.id_rol;
  const d = useCiudadDetalleData(Number(id));
  const [openEditCiudad, setOpenEditCiudad] = useState(false);

  const hasCoords = (d.ciudad?.lat ?? 0) !== 0 && (d.ciudad?.lng ?? 0) !== 0;
  const center: [number, number] = hasCoords
    ? [d.ciudad!.lat, d.ciudad!.lng]
    : [latExample, lngExample];

  const boundsCoords: [number, number][] = [
    ...(hasCoords ? [center] : []),
    ...d.postes.filter((p) => p.lat && p.lng).map((p): [number, number] => [p.lat, p.lng]),
  ];

  return (
    <div className="@container/card p-6 md:p-8 w-full space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {d.loading ? (
            <>
              <Skeleton className="h-7 w-40 mb-1" />
              <Skeleton className="h-4 w-56" />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight">{d.ciudad?.name ?? "Ciudad"}</h1>
              <p className="text-sm text-muted-foreground">
                {d.tramos.length} {d.tramos.length === 1 ? "tramo" : "tramos"} · {d.postes.length} postes
              </p>
            </>
          )}
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          {can(rol, "ciudades", "editar") && (
            <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setOpenEditCiudad(true)} disabled={d.loading || !d.ciudad}>
              <PencilIcon className="h-4 w-4" />
              Editar
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={d.load} disabled={d.loading} className="h-8 w-8">
            <RefreshCwIcon className={`h-4 w-4 ${d.loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard loading={d.loading} label="Total Postes" value={d.postes.length} icon={<ZapIcon className="h-3.5 w-3.5 text-muted-foreground" />} />
        <KpiCard loading={d.loading} label="Tramos" value={d.tramos.length} icon={<RouteIcon className="h-3.5 w-3.5 text-primary" />} accent />
        <KpiCard loading={d.loading} label="Ciudades conectadas" value={connectedCities(d.postes, Number(id))} icon={<MapPinIcon className="h-3.5 w-3.5 text-muted-foreground" />} />
        <KpiCard loading={d.loading} label="Registrada" value={d.ciudad?.createdAt ? new Date(d.ciudad.createdAt).toLocaleDateString("es-ES") : "—"} icon={<CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />} small />
      </div>

      {/* Info + Mapa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Info */}
        <Card className="shadow-sm border-muted/60">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base">Información</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            {d.loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              ))
            ) : (
              <>
                <InfoRow icon={<MapPinIcon className="h-4 w-4 text-primary" />} bg="bg-primary/10" label="Nombre" value={d.ciudad?.name ?? "—"} />
                <InfoRow icon={<MapPinIcon className="h-4 w-4 text-muted-foreground" />} bg="bg-muted" label="Coordenadas" value={hasCoords ? `${d.ciudad!.lat.toFixed(6)}, ${d.ciudad!.lng.toFixed(6)}` : "Sin coordenadas"} />
                {d.ciudad?.createdAt && (
                  <InfoRow icon={<CalendarIcon className="h-4 w-4 text-muted-foreground" />} bg="bg-muted" label="Registrada" value={new Date(d.ciudad.createdAt).toLocaleDateString("es-ES")} />
                )}
                {d.ciudad?.image && (
                  <div className="mt-2">
                    <ImageViewer src={`${url}${d.ciudad.image}`} alt={d.ciudad.name} />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Mapa */}
        <Card className="shadow-sm border-muted/60 overflow-hidden flex flex-col h-full">
          <CardHeader className="border-b border-border/40 pb-4 shrink-0">
            <CardTitle className="text-base">Ubicación y postes</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {d.loading ? (
              <Skeleton className="h-full min-h-90 w-full rounded-none" />
            ) : (
              <MapContainer center={center} zoom={hasCoords ? 10 : 5} style={{ height: "100%", minHeight: "360px" }} scrollWheelZoom zoomControl={false}>
                <ThemedTileLayer />
                {boundsCoords.length >= 2 && <FitBounds coords={boundsCoords} />}

                {/* Current city marker */}
                {hasCoords && (
                  <CircleMarker
                    center={center}
                    radius={9}
                    pathOptions={{ color: "#374151", fillColor: "#374151", fillOpacity: 1, weight: 0 }}
                  >
                    <Popup minWidth={180}>
                      <div style={{ padding: "4px 2px 2px" }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{d.ciudad?.name}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--primary)", fontWeight: 500 }}>Esta ciudad</p>
                        <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                          {d.ciudad?.lat?.toFixed(4)}, {d.ciudad?.lng?.toFixed(4)}
                        </p>
                        {can(rol, "ciudades", "editar") && (
                          <>
                            <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
                            <button
                              style={{ width: "100%", padding: "7px 0", borderRadius: 6, background: "var(--primary)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                              onClick={() => setOpenEditCiudad(true)}
                            >
                              Editar
                            </button>
                          </>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                )}

                {/* Poste markers */}
                {d.postes
                  .filter((p) => p.lat && p.lng)
                  .map((p) => (
                    <CircleMarker
                      key={p.id as number}
                      center={[p.lat, p.lng]}
                      radius={6}
                      pathOptions={{ color: "#9ca3af", fillColor: "#9ca3af", fillOpacity: 0.75, weight: 1.5 }}
                    >
                      <Popup minWidth={210}>
                        <div style={{ padding: "4px 2px 2px", minWidth: 195 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "rgba(156,163,175,0.15)", flexShrink: 0 }}>
                              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--muted-foreground)", display: "block" }} />
                            </span>
                            <div>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: "var(--foreground)" }}>Poste {p.name}</p>
                              {p.ciudadA?.name && p.ciudadB?.name && (
                                <p style={{ margin: 0, fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>{p.ciudadA.name} → {p.ciudadB.name}</p>
                              )}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                            {p.propietario?.name && (
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Propietario</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{p.propietario.name}</span>
                              </div>
                            )}
                            {p.material?.name && (
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Material</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{p.material.name}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ height: 1, background: "var(--border)", marginBottom: 8 }} />
                          <button
                            style={{ width: "100%", padding: "7px 0", borderRadius: 6, background: "var(--primary)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                            onMouseOver={(e) => (e.currentTarget.style.background = "var(--primary)")}
                            onMouseOut={(e) => (e.currentTarget.style.background = "var(--primary)")}
                            onClick={() => navigate(`/postes/${p.id}`)}
                          >
                            Ver detalle
                          </button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
              </MapContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tramos y postes */}
      <Card className="shadow-sm border-muted/60">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-base">Postes por tramo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                {/* Tramo header */}
                <div className="flex items-center gap-3 px-6 py-3 bg-muted/30">
                  <RouteIcon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold">
                    {tramo.ciudadA.name} <ChevronRightIcon className="inline h-3 w-3 mx-0.5 shrink-0" /> {tramo.ciudadB.name}
                  </span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {tramo.postes.length} {tramo.postes.length === 1 ? "poste" : "postes"}
                  </Badge>
                </div>
                {/* Postes table */}
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
                              <DropdownMenuItem onClick={() => navigate(`/postes/${p.id}`)}>
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
        </CardContent>
      </Card>

      <PermissionGuard module="ciudades" action="editar" open={openEditCiudad} onOpenChange={(v) => { if (!v) setOpenEditCiudad(false); }}>
        <EditCiudadSheet
          ciudad={d.ciudad}
          open={openEditCiudad}
          setOpen={(v) => { if (!v) setOpenEditCiudad(false); }}
          onSuccess={d.load}
        />
      </PermissionGuard>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function connectedCities(postes: PosteInterface[], ciudadId: number): number {
  const others = new Set<number>();
  postes.forEach((p) => {
    if (p.id_ciudadA === ciudadId) others.add(p.id_ciudadB);
    else others.add(p.id_ciudadA);
  });
  return others.size;
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length < 2) return;
    map.fitBounds(coords, { padding: [40, 40] });
  }, [map, coords]);
  return null;
}

function InfoRow({ icon, bg, label, value }: { icon: React.ReactNode; bg: string; label: string; value: string }) {
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
          {loading ? <Skeleton className="h-4 w-24" /> : <p className="text-xs text-muted-foreground font-medium">{label}</p>}
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
