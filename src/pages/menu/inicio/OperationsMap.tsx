import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { CircleMarker, MapContainer, Popup } from "react-leaflet";
import ThemedTileLayer from "../../../components/map/ThemedTileLayer";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { PosteInterface, EventoInterface } from "../../../interfaces/interfaces";
import { latExample, lngExample } from "../../../data/example";
import { MapMarker, MapTab } from "./types";
import { searchPoste } from "../../../api/Poste.api";
import ResolverEventoSheet from "../poste/PosteDetalle/ResolverEventoSheet";
import AddRevicionSheet from "../poste/PosteDetalle/AddRevicionSheet";
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
  const [resolverEvento, setResolverEvento] = useState<EventoInterface | null>(null);
  const [addRevicionEventoId, setAddRevicionEventoId] = useState<number | null>(null);

  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-3">
        <CardTitle>Mapa de Operaciones</CardTitle>
        <div className="flex items-center rounded-lg border border-border bg-muted/30 p-1 gap-1 w-fit mt-2">
          {(["postes", "pendientes", "solucionados"] as MapTab[]).map((tab) => (
            <Button key={tab} variant={mapTab === tab ? "default" : "ghost"} size="sm" className="h-7 text-xs capitalize" onClick={() => setMapTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden rounded-b-xl">
        <div className="isolate">
        <MapContainer center={[latExample, lngExample]} zoom={5} style={{ height: "420px" }} scrollWheelZoom={true} zoomControl={false}>
          <ThemedTileLayer />
          {mapMarkers.map((m, i) => (
            <CircleMarker
              key={i}
              center={[m.lat, m.lng]}
              radius={7}
              pathOptions={{
                color: m.isPoste ? "#596BAB" : mapTab === "pendientes" ? "#FF5500" : "#249243",
                fillColor: m.isPoste ? "#596BAB" : mapTab === "pendientes" ? "#FF5500" : "#249243",
                fillOpacity: 0.85,
                weight: 1.5,
              }}
            >
              <Popup minWidth={220}>
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
                        onClick={() => navigate(`/postes/${m.item.id}`)}
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
                        onClick={() => navigate(`/eventos/${m.item.id}`)}
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
                        onClick={() => { if (m.item.id) setAddRevicionEventoId(m.item.id as number); }}
                      >
                        Agregar revisión
                      </button>
                    )}
                  </div>
                )}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        </div>
      </CardContent>
      <PermissionGuard module="eventos" action="editar" open={!!resolverEvento} onOpenChange={(v) => { if (!v) setResolverEvento(null); }}>
        <ResolverEventoSheet
          evento={resolverEvento}
          open={!!resolverEvento}
          setOpen={(v) => { if (!v) setResolverEvento(null); }}
          onSuccess={load}
        />
      </PermissionGuard>
      <PermissionGuard module="eventos" action="editar" open={!!addRevicionEventoId} onOpenChange={(v) => { if (!v) setAddRevicionEventoId(null); }}>
        <AddRevicionSheet
          eventoId={addRevicionEventoId}
          open={!!addRevicionEventoId}
          setOpen={(v) => { if (!v) setAddRevicionEventoId(null); }}
          onSuccess={load}
        />
      </PermissionGuard>
    </Card>
  );
}
