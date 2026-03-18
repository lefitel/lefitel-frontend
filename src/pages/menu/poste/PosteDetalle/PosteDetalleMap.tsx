import { useEffect } from "react";
import { CiudadInterface, PosteInterface } from "../../../../interfaces/interfaces";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import { CircleMarker, MapContainer, Polyline, Popup, useMap } from "react-leaflet";
import ThemedTileLayer from "../../../../components/map/ThemedTileLayer";
import { latExample, lngExample } from "../../../../data/example";

interface Props {
  loading: boolean;
  poste: PosteInterface | null;
  tramoPosotes: PosteInterface[];
  routePath: [number, number][];
  boundsCoords: [number, number][];
  onVerCiudad: (id: number) => void;
  onEditarCiudad: (ciudad: CiudadInterface) => void;
  onVerPoste: (id: number) => void;
  onEditarOtroPoste: (posteId: number) => void;
  onEditarEstePoste: () => void;
  canEditPostes: boolean;
  canEditCiudades: boolean;
}

export default function PosteDetalleMap({
  loading, poste, tramoPosotes, routePath, boundsCoords,
  onVerCiudad, onEditarCiudad, onVerPoste, onEditarOtroPoste, onEditarEstePoste,
  canEditPostes, canEditCiudades,
}: Props) {
  const hasCoords = (poste?.lat ?? 0) !== 0 && (poste?.lng ?? 0) !== 0;
  const center: [number, number] = hasCoords ? [poste!.lat, poste!.lng] : [latExample, lngExample];

  return (
    <Card className="shadow-sm border-muted/60 overflow-hidden flex flex-col h-full">
      <CardHeader className="border-b border-border/40 pb-4 shrink-0">
        <CardTitle className="text-base">Ubicación</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        {loading ? (
          <Skeleton className="h-full min-h-90 w-full rounded-none" />
        ) : (
          <div className="isolate h-full">
          <MapContainer center={center} zoom={hasCoords ? 13 : 5} style={{ height: "100%", minHeight: "360px" }} scrollWheelZoom={true} zoomControl={false}>
            <ThemedTileLayer />

            {boundsCoords.length >= 2 && <FitBounds coords={boundsCoords} />}

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
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        style={{ flex: 1, padding: "7px 0", borderRadius: 6, background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        onClick={() => onVerCiudad(poste.id_ciudadA)}
                      >
                        Ver ciudad
                      </button>
                      {canEditCiudades && (
                        <button
                          style={{ flex: 1, padding: "7px 0", borderRadius: 6, background: "var(--primary)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          onClick={() => onEditarCiudad(poste.ciudadA!)}
                        >
                          Editar
                        </button>
                      )}
                    </div>
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
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        style={{ flex: 1, padding: "7px 0", borderRadius: 6, background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        onClick={() => onVerCiudad(poste.id_ciudadB)}
                      >
                        Ver ciudad
                      </button>
                      {canEditCiudades && (
                        <button
                          style={{ flex: 1, padding: "7px 0", borderRadius: 6, background: "var(--primary)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          onClick={() => onEditarCiudad(poste.ciudadB!)}
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            )}

            {/* Other postes in the tramo (gray) */}
            {tramoPosotes
              .filter((p) => p.id !== poste?.id && p.lat && p.lng)
              .map((p) => (
                <CircleMarker
                  key={p.id as number}
                  center={[p.lat, p.lng]}
                  radius={7}
                  pathOptions={{ color: "#9ca3af", fillColor: "#9ca3af", fillOpacity: 0.7, weight: 1.5 }}
                >
                  <Popup minWidth={210}>
                    <div style={{ padding: "4px 2px 2px", minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "rgba(156,163,175,0.15)", flexShrink: 0 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--muted-foreground)", display: "block" }} />
                        </span>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: "var(--foreground)" }}>
                            Poste {p.name}
                          </p>
                          {p.ciudadA?.name && p.ciudadB?.name && (
                            <p style={{ margin: 0, fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>
                              {p.ciudadA.name} → {p.ciudadB.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                        {p.propietario?.name && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Propietario</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{p.propietario.name}</span>
                          </div>
                        )}
                        {p.material?.name && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Material</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{p.material.name}</span>
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Coordenadas</span>
                          <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                            {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 1, background: "var(--border)", marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          style={{ flex: 1, padding: "7px 0", borderRadius: 6, background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          onClick={() => onVerPoste(p.id as number)}
                        >
                          Ver detalle
                        </button>
                        {canEditPostes && (
                          <button
                            style={{ flex: 1, padding: "7px 0", borderRadius: 6, background: "var(--primary)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                            onClick={() => onEditarOtroPoste(p.id as number)}
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

            {/* Current poste (blue) */}
            {hasCoords && (
              <CircleMarker
                center={center}
                radius={9}
                pathOptions={{ color: "#596BAB", fillColor: "#596BAB", fillOpacity: 0.95, weight: 2 }}
              >
                <Popup minWidth={210}>
                  <div style={{ padding: "4px 2px 2px", minWidth: 195 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "rgba(89,107,171,0.12)", flexShrink: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--primary)", display: "block" }} />
                      </span>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: "var(--foreground)" }}>
                          Poste {poste?.name}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--primary)", fontWeight: 500 }}>Este poste</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {poste?.propietario?.name && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Propietario</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{poste.propietario.name}</span>
                        </div>
                      )}
                      {poste?.material?.name && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Material</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{poste.material.name}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Coordenadas</span>
                        <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                          {poste?.lat?.toFixed(4)}, {poste?.lng?.toFixed(4)}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
                    {canEditPostes && (
                      <button
                        style={{ width: "100%", padding: "7px 0", borderRadius: 6, background: "var(--primary)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        onClick={onEditarEstePoste}
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            )}
          </MapContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length < 2) return;
    map.fitBounds(coords, { padding: [40, 40] });
  }, [map, coords]);
  return null;
}
