import { useMemo, useState } from "react";
import { CiudadInterface, EventoInterface, PosteInterface } from "../../../../interfaces/interfaces";
import { Card, CardContent } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import { Button } from "../../../../components/ui/button";
import BaseMap from "../../../../components/map/BaseMap";
import MapPoint from "../../../../components/map/MapPoint";
import MapLine from "../../../../components/map/MapLine";
import { SonarMarker } from "../../../../components/map/SonarMarker";
import { FitView } from "../../../../components/map/useFitCoords";
import { fromLatLngTuple, type LatLng, hasCoords } from "../../../../components/map/mapGeo";
import { latExample, lngExample } from "../../../../data/example";
import { MAP_RADIUS, MAP_WEIGHT, MAP_DOT } from "../../../../components/map/mapConstants";
import { LocateFixedIcon, RouteIcon } from "lucide-react";

interface Props {
  loading: boolean;
  poste: PosteInterface | null;
  eventos: EventoInterface[];
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

type PosteHealth = "operativo" | "atencion" | "critico";

const HEALTH_COLOR: Record<PosteHealth, { fill: string; stroke: string; label: string; rgb: string }> = {
  operativo: { fill: "#10b981", stroke: "#059669", label: "Operativo", rgb: "16, 185, 129" },
  atencion:  { fill: "#f59e0b", stroke: "#d97706", label: "Atención",  rgb: "245, 158, 11" },
  critico:   { fill: "#ef4444", stroke: "#dc2626", label: "Crítico",   rgb: "220, 38, 38"  },
};

function computeHealth(eventos: EventoInterface[]): PosteHealth {
  const abiertos = eventos.filter((e) => !e.state);
  if (abiertos.some((e) => e.priority)) return "critico";
  if (abiertos.length > 0) return "atencion";
  return "operativo";
}

export default function PosteDetalleMap({
  loading, poste, eventos, tramoPosotes, routePath, boundsCoords,
  onVerCiudad, onEditarCiudad, onVerPoste, onEditarOtroPoste, onEditarEstePoste,
  canEditPostes, canEditCiudades,
}: Props) {
  const located = hasCoords(poste);
  const center: LatLng = located
    ? { lat: poste!.lat, lng: poste!.lng }
    : { lat: latExample, lng: lngExample };
  const [fitTramo, setFitTramo] = useState(false);

  const health = useMemo(() => computeHealth(eventos), [eventos]);
  const healthCfg = HEALTH_COLOR[health];
  const abiertosCount = useMemo(() => eventos.filter((e) => !e.state).length, [eventos]);
  const criticosCount = useMemo(
    () => eventos.filter((e) => !e.state && e.priority).length,
    [eventos]
  );

  return (
    <Card className="shadow-sm border-muted/60 overflow-hidden h-full py-0">
      <CardContent className="p-0 h-full">
        {loading && !poste ? (
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
            <div className="absolute bottom-3 left-3 z-1000 flex items-center gap-2 text-[10px] bg-background/90 supports-backdrop-filter:backdrop-blur-sm rounded-md px-2.5 py-1.5 shadow-sm border border-border/60 text-muted-foreground">
              <LegendItem color="#10b981" label="OK" />
              <LegendItem color="#f59e0b" label="Atención" />
              <LegendItem color="#ef4444" label="Crítico" />
            </div>
            <BaseMap
              center={center}
              zoom={located ? 13 : 5}
              style={{ height: "100%", minHeight: "16rem" }}
            >
              <FitView
                coords={boundsCoords.map(fromLatLngTuple)}
                fit={fitTramo}
                center={located ? center : { lat: 0, lng: 0 }}
                zoom={15}
                duration={700}
              />

              {/* Ciudad A */}
              {poste?.ciudadA?.lat && poste.ciudadA.lng && (
                <MapPoint
                  center={{ lat: poste.ciudadA.lat, lng: poste.ciudadA.lng }}
                  radius={MAP_RADIUS.endpoint}
                  strokeColor={MAP_DOT.endpoint}
                  fillColor={MAP_DOT.endpoint}
                  fillOpacity={1}
                  strokeWidth={MAP_WEIGHT.secondary}
                  popupMinWidth={220}
                >
                  <CiudadPopup
                    ciudad={poste.ciudadA}
                    role="Inicio del tramo"
                    canEdit={canEditCiudades}
                    onVer={() => onVerCiudad(poste.id_ciudadA)}
                    onEditar={() => onEditarCiudad(poste.ciudadA!)}
                  />
                </MapPoint>
              )}

              {/* Ciudad B */}
              {poste?.ciudadB?.lat && poste.ciudadB.lng && (
                <MapPoint
                  center={{ lat: poste.ciudadB.lat, lng: poste.ciudadB.lng }}
                  radius={MAP_RADIUS.endpoint}
                  strokeColor={MAP_DOT.endpoint}
                  fillColor={MAP_DOT.endpoint}
                  fillOpacity={1}
                  strokeWidth={MAP_WEIGHT.secondary}
                  popupMinWidth={220}
                >
                  <CiudadPopup
                    ciudad={poste.ciudadB}
                    role="Fin del tramo"
                    canEdit={canEditCiudades}
                    onVer={() => onVerCiudad(poste.id_ciudadB)}
                    onEditar={() => onEditarCiudad(poste.ciudadB!)}
                  />
                </MapPoint>
              )}

              {/* Otros postes del tramo */}
              {tramoPosotes
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
                    popupMinWidth={240}
                  >
                    <PostePopup
                      poste={p}
                      canEdit={canEditPostes}
                      onVer={() => onVerPoste(p.id as number)}
                      onEditar={() => onEditarOtroPoste(p.id as number)}
                    />
                  </MapPoint>
                ))}

              {routePath.length >= 2 && (
                <MapLine
                  id="poste-detalle-route"
                  positions={routePath.map(fromLatLngTuple)}
                />
              )}

              {/* Poste actual con health-based color */}
              {located && (
                <SonarMarker
                  center={[center.lat, center.lng]}
                  fillColor={healthCfg.fill}
                  strokeColor={healthCfg.stroke}
                  rgb={healthCfg.rgb}
                  dotRadius={MAP_RADIUS.main}
                  weight={MAP_WEIGHT.main}
                >
                  <PostePopup
                    poste={poste!}
                    isActual
                    health={health}
                    healthLabel={healthCfg.label}
                    abiertos={abiertosCount}
                    criticos={criticosCount}
                    canEdit={canEditPostes}
                    onEditar={onEditarEstePoste}
                  />
                </SonarMarker>
              )}
            </BaseMap>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 rounded-full inline-block" style={{ background: color }} />
      <span>{label}</span>
    </span>
  );
}

// ─── Popups (componentes con clases Tailwind, ya no inline styles) ────────────

function CiudadPopup({
  ciudad, role, canEdit, onVer, onEditar,
}: {
  ciudad: CiudadInterface;
  role: string;
  canEdit: boolean;
  onVer: () => void;
  onEditar: () => void;
}) {
  return (
    <div className="min-w-50 py-1">
      <div className="flex items-start gap-2 mb-2">
        <span className="mt-0.5 h-2 w-2 rounded-full bg-foreground inline-block shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">{ciudad.name}</p>
          <p className="text-[10px] text-primary font-medium mt-0.5">{role}</p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground font-mono mb-2.5">
        {ciudad.lat?.toFixed(4)}, {ciudad.lng?.toFixed(4)}
      </p>
      <div className="border-t border-border/60 -mx-1 mb-2.5" />
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={onVer}>
          Ver ciudad
        </Button>
        {canEdit && (
          <Button size="sm" className="flex-1 h-7 text-xs" onClick={onEditar}>
            Editar
          </Button>
        )}
      </div>
    </div>
  );
}

function PostePopup({
  poste, isActual, health, healthLabel, abiertos, criticos, canEdit, onVer, onEditar,
}: {
  poste: PosteInterface;
  isActual?: boolean;
  health?: PosteHealth;
  healthLabel?: string;
  abiertos?: number;
  criticos?: number;
  canEdit: boolean;
  onVer?: () => void;
  onEditar: () => void;
}) {
  const dotColor = isActual && health
    ? HEALTH_COLOR[health].fill
    : "var(--muted-foreground)";

  return (
    <div className="min-w-55 py-1">
      <div className="flex items-start gap-2 mb-2.5">
        <span
          className="mt-0.5 h-2.5 w-2.5 rounded-full inline-block shrink-0"
          style={{ background: dotColor }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-foreground leading-tight truncate">
              Poste {poste.name}
            </p>
            {isActual && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-primary shrink-0">
                Este
              </span>
            )}
          </div>
          {poste.ciudadA?.name && poste.ciudadB?.name && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {poste.ciudadA.name} → {poste.ciudadB.name}
            </p>
          )}
        </div>
      </div>

      {/* Estado (solo poste actual) */}
      {isActual && health && healthLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-muted-foreground">Estado</span>
          <span className="text-[11px] font-semibold" style={{ color: HEALTH_COLOR[health].fill }}>
            {healthLabel}
            {abiertos !== undefined && abiertos > 0 && (
              <> · {abiertos} abierto{abiertos === 1 ? "" : "s"}{criticos ? `, ${criticos} crítico${criticos === 1 ? "" : "s"}` : ""}</>
            )}
          </span>
        </div>
      )}

      {/* Material y Propietario */}
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
      <div className="flex gap-1.5">
        {!isActual && onVer && (
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={onVer}>
            Ver detalle
          </Button>
        )}
        {canEdit && (
          <Button size="sm" className={`${isActual ? "w-full" : "flex-1"} h-7 text-xs`} onClick={onEditar}>
            Editar
          </Button>
        )}
      </div>
    </div>
  );
}
