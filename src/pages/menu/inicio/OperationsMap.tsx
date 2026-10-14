import { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { mensajeDeError } from "../../../api/descarga";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { nombreDelTramo } from "../../../lib/tramo";
import BaseMap from "../../../components/map/BaseMap";
import MapPointsLayer from "../../../components/map/MapPointsLayer";
import { hasCoords } from "../../../components/map/mapGeo";
import { FitView } from "../../../components/map/useFitCoords";
import { Card, CardContent } from "../../../components/ui/card";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import InfoPopover from "../../../components/InfoPopover";
import { Departamento, PosteInterface, EventoInterface } from "../../../interfaces/interfaces";
import { DashboardEvento } from "../../../api/dashboard.api";
import { latExample, lngExample } from "../../../data/example";
import { MapDepartamento, MapMarker, MapTab } from "./types";
import { searchPoste } from "../../../api/Poste.api";
import { MAP_RADIUS, MAP_WEIGHT, SUBJECT_PAINT } from "../../../components/map/mapConstants";
import { useTheme } from "../../../components/theme-provider";
import ResolverEventoSheet from "../../../components/dialogs/ResolverEventoSheet";
import AddRevisionSheet from "../../../components/dialogs/AddRevisionSheet";
import PermissionGuard from "../../../components/PermissionGuard";

interface OperationsMapProps {
  mapMarkers: MapMarker[];
  mapTab: MapTab;
  setMapTab: (t: MapTab) => void;
  load: () => void;
  setOpenEditPoste: (v: boolean) => void;
  setDataPoste: (p: PosteInterface) => void;
  /** The department the markers are already narrowed to; see `useInicioData`. */
  departamento: MapDepartamento;
  setDepartamento: (d: MapDepartamento) => void;
  /** The departments there is something to show for. */
  departamentos: Departamento[];
  /** Whether any pole has no department, and so needs an option of its own. */
  sinDepartamento: boolean;
}

/** The whole country, which is what the map shows while nothing narrows it. */
const PAIS = { center: { lat: latExample, lng: lngExample }, zoom: 5 };
/** Close enough to read the streets around a single pole. */
const ZOOM_UN_PUNTO = 12;

export function OperationsMap({
  mapMarkers, mapTab, setMapTab, load,
  setOpenEditPoste, setDataPoste,
  departamento, setDepartamento, departamentos, sinDepartamento,
}: OperationsMapProps) {
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  // The poles are painted on the canvas, which cannot read a theme token.
  const { resolvedTheme } = useTheme();
  const posteColor = SUBJECT_PAINT[resolvedTheme === "dark" ? "dark" : "light"];
  const rol = sesion.usuario.id_rol;
  const [resolverEvento, setResolverEvento] = useState<DashboardEvento | null>(null);
  const [addRevisionEventoId, setAddRevisionEventoId] = useState<number | null>(null);

  function PostePopup(m: Extract<MapMarker, { isPoste: true }>) {
    return (
      <div style={{ padding: "4px 2px 2px", minWidth: 205 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "rgba(89,107,171,0.12)", flexShrink: 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--primary)", display: "block" }} />
          </span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: "var(--foreground)" }}>{m.label}</p>
            {nombreDelTramo(m.item) && (
              <p style={{ margin: 0, fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>
                {nombreDelTramo(m.item)}
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
              // The pole is fetched before the sheet can show
              // anything, and the fetch can now be refused:
              // C5 puts `postes.ver` on `GET /api/poste/:id`,
              // while this button only asks for `postes.editar`.
              // Unguarded, a refusal threw here and the button
              // did nothing at all — no sheet, no message.
              onClick={async () => {
                if (!m.item.id) return;
                try {
                  const poste = await searchPoste(m.item.id);
                  setDataPoste(poste);
                  setOpenEditPoste(true);
                } catch (error) {
                  toast.error(mensajeDeError(error, "No se pudo abrir este poste para editarlo."));
                }
              }}
            >
              Editar
            </button>
          )}
        </div>
      </div>
    );
  }

  function EventoPopup(m: Extract<MapMarker, { isPoste: false }>) {
    return (
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
    );
  }

  // Rebuilt only when the underlying markers or the colour rule (mapTab)
  // change — not on every render of a screen that re-renders on any dashboard
  // state change. Otherwise MapPointsLayer's own memo never hits and the
  // whole FeatureCollection is rebuilt for nothing, on the one screen whose
  // point count has no ceiling.
  const mapPoints = useMemo(
    () => mapMarkers.map((m) => ({
      // Poles and events are two independent auto-increment sequences that
      // both start at 1: without the entity prefix, "postes" tab's poste #3
      // and "pendientes" tab's evento #3 would carry the same id. The click
      // lookup in MapPointsLayer, and the reconciliation that keeps an open
      // card in sync with `points`, both match purely by id — a collision
      // across tabs would silently swap the open card for the wrong marker's
      // instead of closing it.
      id: `${m.isPoste ? "poste" : "evento"}-${m.item.id}`,
      lat: m.lat,
      lng: m.lng,
      color: m.isPoste
        ? posteColor
        : mapTab === "pendientes"
          ? (m.item.priority ? "#DD0031" : "#FF5500")
          : "#249243",
      item: m,
    })),
    [mapMarkers, mapTab, posteColor],
  );

  // mapMarkers.length counts rows before the 0,0 ("no coordinates yet") ones
  // are dropped, so the badge could read "12 marcadores" while only 11 are
  // actually drawn. Count what is actually drawn instead.
  const visibleMarkers = useMemo(() => mapPoints.filter(hasCoords).length, [mapPoints]);

  // Choosing a department is asking to see it, so the map goes there: it fits
  // what is left, or centres on it when a single point is left and there is
  // no box to fit. With every department shown, or none of the chosen one's
  // points in this tab, it shows the country.
  const drawnCoords = useMemo(
    () => mapPoints.filter(hasCoords).map(({ lat, lng }) => ({ lat, lng })),
    [mapPoints],
  );
  const filtrado = departamento !== "all";
  const unico = filtrado && drawnCoords.length === 1 ? drawnCoords[0] : null;

  return (
    // Named here because nothing drawn on the card names it any more.
    <Card role="region" aria-label="Mapa de Operaciones" className="shadow-sm border-muted/60 py-0 h-80 sm:h-105">
      <CardContent className="p-0 h-full overflow-hidden rounded-xl">
        <div className="isolate h-full relative">

          {/* Alone in its corner: the title that floated here said what the map
              is to somebody already looking at it. On the left and not beside
              the tabs, which on a phone already take the row. Hidden when
              there is nothing to choose between — only when there are no
              poles at all.

              On a phone the tabs are the whole width of the card and were
              drawn over it, so there it drops to a row of its own below them. */}
          <div className="absolute top-3 left-3 z-1000 max-sm:top-14">
          {(departamentos.length > 0 || sinDepartamento) && (
            <Select
              // The control deals in strings; a department is its id.
              value={String(departamento)}
              onValueChange={(v) => setDepartamento(v === "all" || v === "none" ? v : Number(v))}
            >
              <SelectTrigger aria-label="Departamento" className="h-8 w-auto max-w-52 gap-2 text-xs shadow-sm border border-border/60 bg-background/90 supports-backdrop-filter:backdrop-blur-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los departamentos</SelectItem>
                {departamentos.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
                {sinDepartamento && <SelectItem value="none">Sin departamento</SelectItem>}
              </SelectContent>
            </Select>
          )}
          </div>

          <SegmentedControl
            options={[
              { value: "postes", label: "Revisados" },
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
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: posteColor }} />
                Poste revisado
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

          <div className="absolute bottom-3 right-3 z-1000 bg-background/90 supports-backdrop-filter:backdrop-blur-sm rounded-md px-2.5 py-1.5 shadow-sm border border-border/60 text-xs text-muted-foreground flex items-center gap-1.5">
            {visibleMarkers} {visibleMarkers === 1 ? "marcador" : "marcadores"}
            {/* What the three tabs count, beside the count of what is drawn. */}
            <InfoPopover label="Información sobre el mapa" side="top" align="end" className="w-80 max-w-[calc(100vw-2rem)]">
              <span className="block text-left leading-relaxed normal-case space-y-1.5">
                <span className="block"><strong className="font-semibold">Revisados:</strong> postes con al menos una revisión registrada en el período seleccionado.</span>
                <span className="block"><strong className="font-semibold">Pendientes:</strong> eventos sin resolver que tienen revisión en el período. Rojo = alta prioridad.</span>
                <span className="block"><strong className="font-semibold">Solucionados:</strong> eventos cuya fecha de resolución cae dentro del período seleccionado.</span>
              </span>
            </InfoPopover>
          </div>

          <BaseMap center={PAIS.center} zoom={PAIS.zoom} className="h-full">
            <FitView
              coords={drawnCoords}
              fit={filtrado}
              center={unico ?? PAIS.center}
              zoom={unico ? ZOOM_UN_PUNTO : PAIS.zoom}
              duration={600}
            />
            <MapPointsLayer
              id="operations"
              points={mapPoints}
              radius={MAP_RADIUS.main}
              strokeWidth={MAP_WEIGHT.main}
              renderPopup={(m) => (m.isPoste ? PostePopup(m) : EventoPopup(m))}
            />
          </BaseMap>
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
