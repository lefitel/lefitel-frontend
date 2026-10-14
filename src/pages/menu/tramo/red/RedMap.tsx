import { useEffect, useMemo, useState } from "react";
import { Layer, Marker, Popup, Source, useMap } from "@vis.gl/react-maplibre";
import type { Feature, LineString } from "geojson";
import type { CiudadDeRed, TramoConCifras } from "../../../../api/Tramo.api";
import type { PosteInterface } from "../../../../interfaces/interfaces";
import { Button } from "../../../../components/ui/button";
import { useTheme } from "../../../../components/theme-provider";
import BaseMap from "../../../../components/map/BaseMap";
import MapLine from "../../../../components/map/MapLine";
import MapPointsLayer from "../../../../components/map/MapPointsLayer";
import MapSearch from "../../../../components/map/MapSearch";
import { SonarMarker } from "../../../../components/map/SonarMarker";
import { SonarRipple } from "../../../../components/map/SonarRipple";
import { FitView } from "../../../../components/map/useFitCoords";
import { hasCoords, toLngLat, type LatLng, type MapPointData } from "../../../../components/map/mapGeo";
import { MAP_DOT, MAP_RADIUS, MAP_WEIGHT, ROUTE_PAINT, SUBJECT_PAINT, dotDiameter } from "../../../../components/map/mapConstants";
import { latExample, lngExample } from "../../../../data/example";
import { nombreDeCiudad } from "../../../../lib/nombreDeCiudad";
import { encuadre, extremosDelTramo } from "./redGeo";
import type { RutaDelTramo } from "./useRutaDelTramo";
import { idsDe, type EstadoRed } from "./redEstado";

interface RedMapProps {
  tramos: TramoConCifras[];
  ciudades: CiudadDeRed[];
  tramoSel: number | null;
  ciudadSel: number | null;
  postes: PosteInterface[];
  /** The selected tramo's road route, as the page asked for it. */
  ruta: RutaDelTramo;
  estado: EstadoRed;
  onCiudad: (id: number) => void;
  /** Any click on the map itself, wherever it lands. The page decides what it means. */
  onMapa: (p: LatLng) => void;
  onVerPoste: (id: number) => void;
  /**
   * What floats over the selected city, if anything: the page writes it, the
   * map only knows where that city is. Closed from its own cross, or by a
   * click on the map away from it.
   */
  ciudadFlotante?: React.ReactNode;
  onCerrarCiudad?: () => void;
}

/** Below this zoom only the highlighted cities carry their name: all of them would be a smear. */
const ZOOM_ETIQUETAS = 7;
/** Lines sit under this layer, so a route runs below the pole dots instead of through them. */
const CAPA_POSTES = "red-postes-circles";
const CENTRO: LatLng = { lat: latExample, lng: lngExample };

/**
 * The whole network on one map: every city, the selected tramo along its road
 * and, once a page asks for them, the poles. Tramos that are not selected have
 * no line: a straight one between two cities says nothing true about the road.
 * It draws and reports what was clicked; what a click means, and every save,
 * belongs to the page that composes it.
 */
export default function RedMap({
  tramos, ciudades, tramoSel, ciudadSel, postes, ruta, estado,
  onCiudad, onMapa, onVerPoste, ciudadFlotante, onCerrarCiudad,
}: RedMapProps) {
  const { resolvedTheme } = useTheme();
  const paint = ROUTE_PAINT[resolvedTheme === "dark" ? "dark" : "light"];
  const subject = SUBJECT_PAINT[resolvedTheme === "dark" ? "dark" : "light"];
  const { elegidas, borrador } = estado;

  // Stored positions and the selection only: picking cities or placing a draft
  // must not move the view.
  const extremosEncuadre = useMemo(
    () => encuadre({ tramos, ciudades, tramoSel, ciudadSel }),
    [tramos, ciudades, tramoSel, ciudadSel],
  );
  // The route joins the frame when it arrives: the frame grows once, and the
  // answer is the same object on every render after that, so it does not move again.
  const encuadrado = useMemo(
    () => (ruta.estado === "lista" ? [...extremosEncuadre, ...ruta.puntos] : extremosEncuadre),
    [extremosEncuadre, ruta],
  );
  // What the view frames. Every city only on the first placement; after that the
  // frame follows a selection that can be drawn and otherwise stays where it was:
  // a selection the loaded data does not hold yet (just created, the reload still
  // out), a selection that has no position to frame (a city never placed), and no
  // selection at all (leaving a card to enter a tool, where the neighbourhood is
  // what is wanted). Not flying out to the whole network on every deselect.
  const ausente = tramoSel !== null
    ? !tramos.some((t) => t.id === tramoSel)
    : ciudadSel !== null && !ciudades.some((c) => c.id === ciudadSel);
  const haySeleccion = tramoSel !== null || ciudadSel !== null;
  const seleccion = tramoSel !== null ? `t${tramoSel}` : ciudadSel !== null ? `c${ciudadSel}` : null;
  // The same selection chosen again after a deselect frames the same box, which
  // `FitView` would not refit on its own: the nonce says "show it again". It moves
  // when the selection becomes one that is drawn, not on a deselect and not when
  // only the tool state changes.
  const [marca, setMarca] = useState<{ sel: string | null; nonce: number }>({ sel: null, nonce: 0 });
  const [ultimo, setUltimo] = useState(encuadrado);
  // A tramo already framed whose route is on its way again (its poles were asked
  // for again, or they changed) keeps the frame it had, route included, until the
  // answer lands: otherwise the view would shrink to the two ends and grow again.
  const rutaEnCamino = tramoSel !== null && ruta.estado === "pendiente" && marca.sel === seleccion;
  const conservar = ausente || rutaEnCamino || (ultimo.length > 0 && (!haySeleccion || encuadrado.length === 0));
  if (!conservar && ultimo !== encuadrado) setUltimo(encuadrado);
  const coords = conservar ? ultimo : encuadrado;

  const enmarcada = haySeleccion && (!conservar || rutaEnCamino) ? seleccion : null;
  if (enmarcada !== null && enmarcada !== marca.sel) setMarca({ sel: enmarcada, nonce: marca.nonce + 1 });
  else if (enmarcada === null && marca.sel !== null) setMarca({ sel: null, nonce: marca.nonce });
  const unica = coords.length === 1 ? coords[0] : null;

  // Where each city is drawn. One that was never placed is not.
  const posiciones = useMemo(() => {
    const out = new Map<number, LatLng>();
    for (const c of ciudades) {
      if (hasCoords(c)) out.set(c.id, { lat: c.lat as number, lng: c.lng as number });
    }
    return out;
  }, [ciudades]);

  // The two cities picked while creating a tramo.
  const extremosElegidos = useMemo<[LatLng, LatLng] | null>(() => {
    if (elegidas.length !== 2) return null;
    const a = posiciones.get(elegidas[0]);
    const b = posiciones.get(elegidas[1]);
    return a && b ? [a, b] : null;
  }, [elegidas, posiciones]);

  // The ends of the selected tramo count as highlighted cities.
  const extremosSel = useMemo(() => {
    const t = tramoSel === null ? undefined : tramos.find((x) => x.id === tramoSel);
    return new Set<number>((t && idsDe(t)) ?? []);
  }, [tramos, tramoSel]);

  // Where the selected tramo's line runs from and to.
  const extremosLinea = useMemo(() => {
    const t = tramoSel === null ? undefined : tramos.find((x) => x.id === tramoSel);
    return t ? extremosDelTramo(t, ciudades) : null;
  }, [tramos, ciudades, tramoSel]);

  const puntosPostes = useMemo<MapPointData<PosteInterface>[]>(
    () => postes.flatMap((p) => (hasCoords(p) && p.id != null
      ? [{ id: p.id, lat: p.lat, lng: p.lng, color: subject, item: p }]
      : [])),
    [postes, subject],
  );

  const [cerca, setCerca] = useState(false);

  // A city with no position has nowhere for its card to hang from.
  const posicionFlotante = ciudadSel === null ? undefined : posiciones.get(ciudadSel);

  return (
    <BaseMap center={unica ?? CENTRO} zoom={unica ? 11 : 5} onMapClick={onMapa} style={{ height: "100%", minHeight: "20rem", width: "100%" }}>
      <MapSearch />
      {/* `useMap` only reaches the descendants of the map: this one lives inside it. */}
      <SeguirZoom alCambiar={setCerca} />
      <FitView
        coords={coords}
        fit
        center={unica ?? CENTRO}
        zoom={unica ? 11 : 5}
        duration={600}
        nonce={marca.nonce}
      />

      {/* First, so that its layer exists when the lines below are placed under it. */}
      <MapPointsLayer
        id="red-postes"
        points={puntosPostes}
        radius={MAP_RADIUS.secondary}
        renderPopup={(p) => <PostePopup poste={p} onVer={() => onVerPoste(p.id as number)} />}
      />

      {/* Nothing while the route is on its way: the two ends are already highlighted. */}
      {extremosLinea && ruta.estado === "lista" && (
        <MapLine id="red-ruta" positions={ruta.puntos} width={5} opacity={1} beforeId={CAPA_POSTES} />
      )}
      {extremosLinea && ruta.estado === "sinRuta" && (
        <LineaDiscontinua id="red-sin-ruta" extremos={extremosLinea} color={paint.color} beforeId={CAPA_POSTES} />
      )}
      {extremosElegidos && <LineaDiscontinua id="red-provisional" extremos={extremosElegidos} color={paint.color} beforeId={CAPA_POSTES} />}

      {ciudades.map((c) => {
        const pos = posiciones.get(c.id);
        if (!pos) return null;
        const elegida = elegidas.includes(c.id);
        const destacada = elegida || ciudadSel === c.id || extremosSel.has(c.id);
        return (
          <Marker
            key={c.id}
            longitude={pos.lng}
            latitude={pos.lat}
            anchor="center"
            // A pulsing city is raised above the rest and its ripple, which is bigger
            // than the dot, lets the pointer through: only the button takes it. Both keys
            // are always given, with a value for each state: the library applies a style by
            // assigning keys and never removes one, so a state that left a key out would
            // keep the previous state's value on the element.
            style={{ zIndex: destacada ? 1 : "auto", pointerEvents: destacada ? "none" : "auto" }}
            onClick={(e) => {
              // The marker sits inside the map's own click surface: without this the
              // click also reaches the map underneath and the page sees a click on empty ground.
              e.originalEvent?.stopPropagation();
              onCiudad(c.id);
            }}
          >
            <CiudadBoton ciudad={c} destacada={destacada} elegida={elegida} conEtiqueta={destacada || cerca} />
          </Marker>
        );
      })}

      {/* The pressed city's card, on the city. A sibling of the markers, as
          vis.gl wants a popup, and above the highlighted city's ripple. */}
      {ciudadFlotante && posicionFlotante && (
        <Popup
          longitude={posicionFlotante.lng}
          latitude={posicionFlotante.lat}
          offset={14}
          maxWidth="280px"
          onClose={onCerrarCiudad}
        >
          {ciudadFlotante}
        </Popup>
      )}

      {borrador && hasCoords(borrador) && (
        <SonarMarker
          center={[borrador.lat, borrador.lng]}
          fillColor={MAP_DOT.subject}
          strokeColor="var(--background)"
          rgb={MAP_DOT.subjectRgb}
          dotRadius={MAP_RADIUS.main}
          weight={MAP_WEIGHT.main * 2}
        />
      )}
    </BaseMap>
  );
}

/**
 * Tells whether the map is close enough to name every city, following the map's
 * own `zoom` event. A component, not a hook of `RedMap`: it has to sit inside the
 * map to reach it.
 */
function SeguirZoom({ alCambiar }: { alCambiar: (cerca: boolean) => void }): null {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map) return;
    const leer = () => alCambiar(map.getZoom() >= ZOOM_ETIQUETAS);
    leer();
    map.on("zoom", leer);
    return () => { map.off("zoom", leer); };
  }, [map, alCambiar]);

  return null;
}

/** A dashed straight line between two points: a tramo with no road route, and the one being drawn. */
function LineaDiscontinua({ id, extremos, color, beforeId }: {
  id: string; extremos: [LatLng, LatLng]; color: string;
  /** The layer to sit under, as `MapLine`'s: it must exist when this one is added. */
  beforeId?: string;
}) {
  const data = useMemo<Feature<LineString>>(() => ({
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: [toLngLat(extremos[0]), toLngLat(extremos[1])] },
  }), [extremos]);

  return (
    <Source id={id} type="geojson" data={data}>
      <Layer
        id={`${id}-linea`}
        beforeId={beforeId}
        type="line"
        layout={{ "line-cap": "butt" }}
        paint={{ "line-color": color, "line-width": 3, "line-opacity": 1, "line-dasharray": [2, 2] }}
      />
    </Source>
  );
}

/**
 * A city: dot and name in one button. The name sits beside the dot without
 * pushing it, so the marker's anchor stays on the dot. It is drawn on a
 * theme-coloured pill because the base map under it can be light or dark.
 * A highlighted city (selected, an end of the selected tramo, or picked for a
 * new tramo) pulses with the ripple the pole's detail map uses.
 */
function CiudadBoton({ ciudad, destacada, elegida, conEtiqueta }: {
  ciudad: CiudadDeRed; destacada: boolean; elegida: boolean; conEtiqueta: boolean;
}) {
  const radio = destacada ? MAP_RADIUS.main : MAP_RADIUS.endpoint;
  const borde = elegida ? MAP_WEIGHT.main * 2 : destacada ? MAP_WEIGHT.main : MAP_WEIGHT.secondary;
  const boton = (
    <button
      type="button"
      aria-label={nombreDeCiudad(ciudad)}
      className="relative block cursor-pointer rounded-full p-0"
      // Inside the ripple, which lets everything through, the button takes the pointer back.
      // Always, not only while pulsing, so it never inherits a `none` from its marker.
      style={{ pointerEvents: "auto" }}
    >
      <span
        style={{
          display: "block",
          width: radio * 2,
          height: radio * 2,
          borderRadius: "50%",
          boxSizing: "content-box",
          background: destacada ? MAP_DOT.subject : MAP_DOT.endpoint,
          border: `${borde}px solid ${destacada ? "var(--background)" : MAP_DOT.endpoint}`,
        }}
      />
      {conEtiqueta && (
        <span className="pointer-events-none absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded bg-background/80 px-1 text-xs text-foreground">
          {nombreDeCiudad(ciudad)}
        </span>
      )}
    </button>
  );
  return destacada
    ? <SonarRipple dotPx={dotDiameter(radio, borde)} rgb={MAP_DOT.subjectRgb}>{boton}</SonarRipple>
    : boton;
}

function PostePopup({ poste, onVer }: { poste: PosteInterface; onVer: () => void }) {
  return (
    <div className="min-w-50 py-1">
      <div className="flex items-start gap-2 mb-2.5">
        <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-muted-foreground/60 inline-block shrink-0" />
        <p className="text-sm font-bold text-foreground leading-tight">Poste {poste.name}</p>
      </div>
      <Button size="sm" className="w-full h-7 text-xs" onClick={onVer}>Ver poste</Button>
    </div>
  );
}
