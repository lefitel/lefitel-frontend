import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { MapContainer, Popup, CircleMarker } from "react-leaflet";
import ThemedTileLayer from "../../../components/map/ThemedTileLayer";
import { Card, CardContent } from "../../../components/ui/card";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { PosteInterface, EventoInterface } from "../../../interfaces/interfaces";
import { DashboardEvento } from "../../../api/dashboard.api";
import { latExample, lngExample } from "../../../data/example";
import { MapMarker, MapTab } from "./types";
import { searchPoste } from "../../../api/Poste.api";
import { MAP_RADIUS, MAP_WEIGHT } from "../../../components/map/mapConstants";
import ResolverEventoSheet from "../../../components/dialogs/ResolverEventoSheet";
import AddRevisionSheet from "../../../components/dialogs/AddRevisionSheet";
import PermissionGuard from "../../../components/PermissionGuard";

interface OperationsMapProps {
  mapMarkers: MapMarker[];
  mapTab: MapTab;
  setMapTab: (t: MapTab) => void;
  token: string;
  load: () => void;
  setOpenEditPoste: (v: boolean) => void;
  setDataPoste: (p: PosteInterface) => void;
}

export function OperationsMap({
  mapMarkers, mapTab, setMapTab, token, load,
  setOpenEditPoste, setDataPoste,
}: OperationsMapProps) {
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  const rol = sesion.usuario.id_rol;
  const [resolverEvento, setResolverEvento] = useState<DashboardEvento | null>(null);
  const [addRevisionEventoId, setAddRevisionEventoId] = useState<number | null>(null);

  return (
    <Card className="shadow-sm border-muted/60 py-0 h-80 sm:h-105">
      <CardContent className="p-0 h-full overflow-hidden rounded-xl">
        <div className="isolate h-full relative">

          <div className="absolute top-3 left-3 z-1000 bg-background/90 supports-backdrop-filter:backdrop-blur-sm rounded-md px-2.5 py-1.5 shadow-sm border border-border/60">
            <p className="text-sm font-semibold leading-none tracking-tight">Mapa de Operaciones</p>
          </div>

          <SegmentedControl
            options={[
              { value: "postes", label: "Postes" },
              { value: "pendientes", label: "Pendientes" },
              { value: "solucionados", label: "Solucionados" },
            ]}
            value={mapTab}
            onValueChange={setMapTab}
            ariaLabel="Filtro del mapa"
            className="absolute top-3 right-3 z-1000 shadow-sm"
          />

          <div className="absolute bottom-3 left-3 z-1000 bg-background/90 supports-backdrop-filter:backdrop-blur-sm rounded-md px-2.5 py-1.5 shadow-sm border border-border/60 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {mapTab === "postes" && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#596BAB" }} />
                Poste
              </span>
            )}
            {mapTab === "pendientes" && (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#FF5500" }} />
                  Pendiente
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#DD0031" }} />
                  Alta prioridad
                </span>
              </>
            )}
            {mapTab === "solucionados" && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#249243" }} />
                Solucionado
              </span>
            )}
          </div>

          <div className="absolute bottom-3 right-3 z-1000 bg-background/90 supports-backdrop-filter:backdrop-blur-sm rounded-md px-2.5 py-1.5 shadow-sm border border-border/60 text-xs text-muted-foreground">
            {mapMarkers.length} {mapMarkers.length === 1 ? "marcador" : "marcadores"}
          </div>

          <MapContainer center={[latExample, lngExample]} zoom={5} className="h-full" scrollWheelZoom={true} zoomControl={false}>
            <ThemedTileLayer />
            {mapMarkers.map((m, i) => {
              const fill = m.isPoste
                ? "#596BAB"
                : mapTab === "pendientes"
                  ? (m.item.priority ? "#DD0031" : "#FF5500")
                  : "#249243";
              return (
                <CircleMarker
                  key={i}
                  center={[m.lat, m.lng]}
                  radius={MAP_RADIUS.main}
                  pathOptions={{
                    color: "#fff",
                    fillColor: fill,
                    fillOpacity: 0.95,
                    weight: MAP_WEIGHT.main,
                  }}
                >
                  <Popup minWidth={200} maxWidth={260}>
                    {m.isPoste ? (
                      <div style={{ padding: "4px 2px 2px", minWidth: 205 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "rgba(89,107,171,0.12)", flexShrink: 0 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--primary)", display: "block" }} />
                          </span>
                          <div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: "var(--foreground)" }}>{m.label}</p>
                            {m.item.ciudadA?.name && m.item.ciudadB?.name && (
                              <p style={{ margin: 0, fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>
                                {m.item.ciudadA.name} → {m.item.ciudadB.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                          {m.item.propietario?.name && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Propietario</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{m.item.propietario.name}</span>
                            </div>
                          )}
                          {m.item.material?.name && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Material</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{m.item.material.name}</span>
                            </div>
                          )}
                        </div>
                        <div style={{ height: 1, background: "var(--border)", marginBottom: 8 }} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            style={{ flex: 1, padding: "7px 0", borderRadius: 6, background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                            onClick={() => navigate(`/app/postes/${m.item.id}`)}
                          >
                            Ver detalle
                          </button>
                          {can(rol, "postes", "editar") && (
                            <button
                              style={{ flex: 1, padding: "7px 0", borderRadius: 6, background: "var(--primary)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                              onClick={async () => {
                                if (m.item.id) { setOpenEditPoste(true); setDataPoste(await searchPoste(m.item.id, token)); }
                              }}
                            >
                              Editar
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: "4px 2px 2px", minWidth: 205 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: m.item.priority ? "rgba(221,0,49,0.1)" : "rgba(255,85,0,0.1)", flexShrink: 0 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: m.item.priority ? "#DD0031" : "#FF5500", display: "block" }} />
                          </span>
                          <div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: "var(--foreground)" }}>
                              {m.item.poste?.name ?? m.label}
                            </p>
                            <p style={{ margin: 0, fontSize: 10, marginTop: 1, color: m.item.priority ? "#DD0031" : "#d97706" }}>
                              {m.item.priority ? "Alta prioridad" : "Pendiente"}
                            </p>
                          </div>
                        </div>
                        {m.item.description && (
                          <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                            {m.item.description}
                          </p>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Fecha</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>
                              {new Date(m.item.date).toLocaleDateString("es-ES")}
                            </span>
                          </div>
                          {m.item.poste?.propietario?.name && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Propietario</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{m.item.poste.propietario.name}</span>
                            </div>
                          )}
                        </div>
                        <div style={{ height: 1, background: "var(--border)", marginBottom: 8 }} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            style={{ flex: 1, padding: "7px 0", borderRadius: 6, background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                            onClick={() => navigate(`/app/eventos/${m.item.id}`)}
                          >
                            Ver detalle
                          </button>
                          {can(rol, "eventos", "editar") && (
                            <button
                              style={{ flex: 1, padding: "7px 0", borderRadius: 6, background: m.item.priority ? "#DD0031" : "#FF5500", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                              onClick={() => { if (m.item.id) setResolverEvento(m.item); }}
                            >
                              Resolver
                            </button>
                          )}
                        </div>
                        {can(rol, "eventos", "editar") && (
                          <button
                            style={{ width: "100%", marginTop: 5, padding: "5px 0", borderRadius: 6, background: "transparent", color: "var(--primary)", border: "1px solid var(--primary)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                            onClick={() => { if (m.item.id) setAddRevisionEventoId(m.item.id as number); }}
                          >
                            Agregar revisión
                          </button>
                        )}
                      </div>
                    )}
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </CardContent>
      <PermissionGuard module="eventos" action="editar" open={!!resolverEvento} onOpenChange={(v) => { if (!v) setResolverEvento(null); }}>
        <ResolverEventoSheet
          evento={resolverEvento as unknown as EventoInterface}
          open={!!resolverEvento}
          setOpen={(v) => { if (!v) setResolverEvento(null); }}
          onSuccess={load}
        />
      </PermissionGuard>
      <PermissionGuard module="eventos" action="editar" open={!!addRevisionEventoId} onOpenChange={(v) => { if (!v) setAddRevisionEventoId(null); }}>
        <AddRevisionSheet
          eventoId={addRevisionEventoId}
          open={!!addRevisionEventoId}
          setOpen={(v) => { if (!v) setAddRevisionEventoId(null); }}
          onSuccess={load}
        />
      </PermissionGuard>
    </Card>
  );
}
