import { useContext } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RedMap from "./RedMap";
import { ESTADO_INICIAL, type EstadoRed } from "./redEstado";
import { ROUTE_PAINT } from "../../../../components/map/mapConstants";
import type { CiudadDeRed, TramoConCifras } from "../../../../api/Tramo.api";
import type { PosteInterface } from "../../../../interfaces/interfaces";

const fitProps = vi.fn();
const postesLayer = vi.fn();
const sourceIds: string[] = [];
const layerIds: string[] = [];
// The last data and paint each source and layer was given, by id.
const sourceData: Record<string, GeoJSON.Feature<GeoJSON.LineString>> = {};
const layerPaint: Record<string, Record<string, unknown>> = {};
const layerBefore: Record<string, string | undefined> = {};

// A map that records what is registered on it, so the zoom can be driven.
type Registro = { tipo: string; fn: (e?: unknown) => void };
let registrados: Registro[] = [];
let zoomActual = 5;
const mapaFalso = {
  on: (tipo: string, fn: Registro["fn"]) => { registrados.push({ tipo, fn }); },
  off: () => {},
  getZoom: () => zoomActual,
};
const hacerZoom = (z: number) => act(() => {
  zoomActual = z;
  registrados.filter((r) => r.tipo === "zoom").forEach((r) => r.fn());
});

// Like the real library, the map reaches only the descendants of the map component:
// the stub `BaseMap` hands the fake map down through a context and the stub `useMap`
// reads it, so a hook called anywhere else (the parent of `BaseMap`) gets nothing.
const MapaCtx = await vi.hoisted(async () => {
  const { createContext } = await import("react");
  return createContext<unknown>(undefined);
});

// The map is somebody else's test: what is drawn is what is handed over.
vi.mock("../../../../components/theme-provider", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("../../../../components/map/BaseMap", () => ({
  default: ({ children, onMapClick }: { children: React.ReactNode; onMapClick?: (p: { lat: number; lng: number }) => void }) => (
    <MapaCtx.Provider value={mapaFalso}>
      <div data-testid="mapa" onClick={() => onMapClick?.({ lat: 1, lng: 2 })}>{children}</div>
    </MapaCtx.Provider>
  ),
}));
vi.mock("../../../../components/map/MapSearch", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="busqueda">{children}</div>,
}));
vi.mock("../../../../components/map/useFitCoords", () => ({
  FitView: (p: unknown) => { fitProps(p); return null; },
}));
vi.mock("../../../../components/map/MapPointsLayer", () => ({
  default: (p: { points: unknown[]; renderPopup: unknown }) => { postesLayer(p); return null; },
}));
vi.mock("@vis.gl/react-maplibre", () => ({
  useMap: () => ({ current: useContext(MapaCtx) }),
  Source: ({ id, data, children }: { id: string; data: GeoJSON.Feature<GeoJSON.LineString>; children?: React.ReactNode }) => {
    sourceIds.push(id);
    sourceData[id] = data;
    return <>{children}</>;
  },
  Layer: ({ id, paint, beforeId }: { id: string; paint: Record<string, unknown>; beforeId?: string }) => {
    layerIds.push(id);
    layerPaint[id] = paint;
    layerBefore[id] = beforeId;
    return null;
  },
  // A real Marker's click comes from its element, with the DOM event attached.
  Marker: ({ children, longitude, latitude, style, onClick, ...resto }: {
    children: React.ReactNode; longitude: number; latitude: number; style?: React.CSSProperties;
    onClick?: (e: { originalEvent: unknown }) => void;
  }) => (
    <div
      // The library's `applyReactStyle`, as it is: a falsy style is skipped, and a key
      // it once set is never removed, only overwritten by a later value for the same key.
      ref={(el) => { if (el && style) Object.assign(el.style, style); }}
      data-testid="marcador"
      // No city can be dragged any more: a test can hold the map to that.
      data-draggable={String("draggable" in resto && Boolean((resto as { draggable?: boolean }).draggable))}
      data-lng={longitude}
      data-lat={latitude}
      onClick={(e) => onClick?.({ originalEvent: e })}
    >
      {children}
    </div>
  ),
  // The real one hangs from a point of the map and has its own cross.
  Popup: ({ children, longitude, latitude, onClose }: {
    children: React.ReactNode; longitude: number; latitude: number; onClose?: () => void;
  }) => (
    <div data-testid="flotante" data-lng={longitude} data-lat={latitude}>
      <button type="button" onClick={onClose}>Cerrar ficha</button>
      {children}
    </div>
  ),
}));

const CIUDADES: CiudadDeRed[] = [
  { id: 1, name: "Uno", lat: -17, lng: -65, image: null },
  { id: 2, name: "Dos", lat: -18, lng: -64, image: null },
  { id: 3, name: "Tres", lat: -19, lng: -63, image: null },
  { id: 4, name: "Sin sitio", lat: null, lng: null, image: null },
];
const tramo = (id: number, a: number, b: number): TramoConCifras => ({
  id, nombre: `${a}-${b}`, id_departamento: null, departamento: null, archivado: false,
  ciudades: [{ id: a, name: null, lat: null, lng: null }, { id: b, name: null, lat: null, lng: null }],
});
const poste = (id: number, lat: number, lng: number) => ({ id, name: `P-${id}`, lat, lng }) as unknown as PosteInterface;

const props = (): React.ComponentProps<typeof RedMap> => ({
  tramos: [tramo(10, 1, 2)], ciudades: CIUDADES, tramoSel: null, ciudadSel: null, postes: [],
  estado: ESTADO_INICIAL,
  ruta: { estado: "pendiente" },
  onCiudad: vi.fn(), onMapa: vi.fn(), onVerPoste: vi.fn(),
});
const pintar = (over: Partial<React.ComponentProps<typeof RedMap>> = {}) => {
  const p = { ...props(), ...over };
  return { ...p, ...render(<RedMap {...p} />) };
};
const conEstado = (e: Partial<EstadoRed>): EstadoRed => ({ ...ESTADO_INICIAL, ...e });

const TIENE_ONDA = ".sonar-root";
/** The names of the cities whose marker carries the ripple. */
const ciudadesQuePulsan = () =>
  screen.getAllByRole("button")
    .filter((b) => b.closest("[data-testid=marcador]")!.querySelector(TIENE_ONDA) !== null)
    .map((b) => b.getAttribute("aria-label"));
/** The marker that holds no city button: the draft of a new city. */
const marcadorSinBoton = () => {
  const sueltos = screen.getAllByTestId("marcador").filter((m) => m.querySelector("button") === null);
  expect(sueltos).toHaveLength(1);
  return sueltos[0];
};

beforeEach(() => {
  vi.clearAllMocks();
  sourceIds.length = 0;
  layerIds.length = 0;
  registrados = [];
  for (const k of Object.keys(sourceData)) delete sourceData[k];
  for (const k of Object.keys(layerPaint)) delete layerPaint[k];
  for (const k of Object.keys(layerBefore)) delete layerBefore[k];
  zoomActual = 5;
});

describe("cities on the network map", () => {
  it("draws one button per city with coordinates, named, and none for the one without", () => {
    pintar();

    expect(screen.getAllByRole("button")).toHaveLength(3);
    for (const n of ["Uno", "Dos", "Tres"]) expect(screen.getByRole("button", { name: n })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sin sitio" })).toBeNull();
  });

  it("calls onCiudad with the id of the city pressed, and the click does not reach the map", async () => {
    const user = userEvent.setup();
    const p = pintar();

    await user.click(screen.getByRole("button", { name: "Dos" }));

    expect(p.onCiudad).toHaveBeenCalledTimes(1);
    expect(p.onCiudad).toHaveBeenCalledWith(2);
    expect(p.onMapa).not.toHaveBeenCalled();
  });

  it("reports a click on the map itself through onMapa", async () => {
    const user = userEvent.setup();
    const p = pintar();

    await user.click(screen.getByTestId("mapa"));

    expect(p.onMapa).toHaveBeenCalledWith({ lat: 1, lng: 2 });
  });

});

describe("the provisional line", () => {
  it("exists with two chosen cities", () => {
    pintar({ estado: conEstado({ modo: "tramoNuevo", elegidas: [1, 2] }) });

    expect(sourceIds).toContain("red-provisional");
  });

  it("does not exist with one chosen city, nor with none", () => {
    pintar({ estado: conEstado({ modo: "tramoNuevo", elegidas: [1] }) });
    expect(sourceIds).not.toContain("red-provisional");

    sourceIds.length = 0;
    pintar();
    expect(sourceIds).not.toContain("red-provisional");
  });
});

describe("the draft city and the poles", () => {
  it("draws the draft where the state says", () => {
    pintar({ estado: conEstado({ modo: "ciudadNueva", borrador: { lat: -12, lng: -60 } }) });

    const borrador = marcadorSinBoton();
    expect(borrador).toHaveAttribute("data-lat", "-12");
    expect(borrador).toHaveAttribute("data-lng", "-60");
  });

  it("sends the poles with coordinates to the layer and leaves out the ones without", () => {
    pintar({ postes: [poste(1, -17.5, -64.5), poste(2, 0, 0), poste(3, Number.NaN, -64)] });

    const { points } = postesLayer.mock.calls.at(-1)![0] as { points: { id: number }[] };
    expect(points.map((x) => x.id)).toEqual([1]);
  });
});

describe("the place search", () => {
  it("is given nothing to lay out beside its box: the screen's one tool is in the card", () => {
    pintar();

    expect(screen.getByTestId("busqueda")).toBeEmptyDOMElement();
  });
});

describe("what pulses", () => {
  it("nothing with nothing selected", () => {
    pintar();

    expect(document.querySelectorAll(TIENE_ONDA)).toHaveLength(0);
  });

  it("only the selected city", () => {
    pintar({ ciudadSel: 3 });

    expect(ciudadesQuePulsan()).toEqual(["Tres"]);
    expect(document.querySelectorAll(TIENE_ONDA)).toHaveLength(1);
  });

  it("only the two ends of the selected tramo", () => {
    pintar({ tramoSel: 10 });

    expect(ciudadesQuePulsan().sort()).toEqual(["Dos", "Uno"]);
    expect(document.querySelectorAll(TIENE_ONDA)).toHaveLength(2);
  });

  it("the cities picked for a new tramo, and no other", () => {
    pintar({ estado: conEstado({ modo: "tramoNuevo", elegidas: [3, 1] }) });

    expect(ciudadesQuePulsan().sort()).toEqual(["Tres", "Uno"]);
    expect(document.querySelectorAll(TIENE_ONDA)).toHaveLength(2);
  });

  it("the draft point of a new city, with its four rings, and no city", () => {
    pintar({ estado: conEstado({ modo: "ciudadNueva", borrador: { lat: -12, lng: -60 } }) });

    expect(ciudadesQuePulsan()).toEqual([]);
    expect(marcadorSinBoton().querySelectorAll(".sonar-ring")).toHaveLength(4);
    expect(document.querySelectorAll(TIENE_ONDA)).toHaveLength(1);
  });

  it("a pulsing city has the four rings, and a quiet one has none", () => {
    pintar({ ciudadSel: 1 });

    const rondas = (nombre: string) =>
      screen.getByRole("button", { name: nombre }).closest("[data-testid=marcador]")!.querySelectorAll(".sonar-ring").length;
    expect(rondas("Uno")).toBe(4);
    expect(rondas("Dos")).toBe(0);
  });

  it("lets the pointer through the ripple and back in at the button, so the neighbours stay clickable", () => {
    pintar({ ciudadSel: 1 });

    const boton = screen.getByRole("button", { name: "Uno" });
    expect(boton.closest(TIENE_ONDA)).toHaveStyle({ pointerEvents: "none" });
    expect(boton).toHaveStyle({ pointerEvents: "auto" });
  });

  it("leaves a city clickable once it stops pulsing: the library never removes a style key it set", async () => {
    const user = userEvent.setup();
    const p = pintar({ ciudadSel: 1 });
    const marcador = screen.getByRole("button", { name: "Uno" }).closest("[data-testid=marcador]") as HTMLElement;
    expect(marcador.style.pointerEvents).toBe("none");

    // Selection moves to another city; "Uno" goes back to a plain dot (same marker element).
    p.rerender(<RedMap {...p} ciudadSel={2} />);

    expect(ciudadesQuePulsan()).toEqual(["Dos"]);
    const uno = screen.getByRole("button", { name: "Uno" });
    expect(uno.closest("[data-testid=marcador]")).toBe(marcador);
    expect(getComputedStyle(marcador).pointerEvents).not.toBe("none");
    expect(getComputedStyle(uno).pointerEvents).not.toBe("none");
    expect(marcador.style.zIndex).not.toBe("1");
    await user.click(uno);
    expect(p.onCiudad).toHaveBeenCalledWith(1);
  });

});

describe("the pole card", () => {
  it("names the pole and 'Ver poste' calls onVerPoste with its id", async () => {
    const user = userEvent.setup();
    const p = pintar({ postes: [poste(9, -17.5, -64.5)] });
    const { points, renderPopup } = postesLayer.mock.calls.at(-1)![0] as {
      points: { item: PosteInterface }[]; renderPopup: (i: PosteInterface) => React.ReactNode;
    };

    render(<>{renderPopup(points[0].item)}</>);

    expect(screen.getByText("Poste P-9")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver poste" }));
    expect(p.onVerPoste).toHaveBeenCalledWith(9);
  });
});

describe("what the view frames", () => {
  const marco = () => fitProps.mock.calls.at(-1)![0] as { coords: unknown; nonce?: number };

  // Picking cities for a tramo, or placing the city it lacks, happens with the
  // person looking at one corner of the network: the view must stay there.
  it.each<[string, Partial<EstadoRed>]>([
    ["cities are picked for a new tramo", { modo: "tramoNuevo", elegidas: [1, 2] }],
    ["a new city's draft is placed", { modo: "ciudadNueva", borrador: { lat: -17.5, lng: -64.5 } }],
  ])("does not hand FitView different coordinates when %s", (_, cambio) => {
    const base = props();
    const vista = render(<RedMap {...base} />);
    const antes = marco();

    vista.rerender(<RedMap {...base} estado={conEstado(cambio)} />);

    // The same array, not an equal one: `FitView` refits on a new one.
    expect(marco().coords).toBe(antes.coords);
    expect(marco().nonce).toBe(antes.nonce);
  });
});

// A city that is pressed is read on the map, in a card that floats over it.
// The page writes the card; the map only knows where that city stands.
describe("the pressed city's floating card", () => {
  const ficha = <p>ficha de la ciudad</p>;

  it("hangs from the selected city, at its position", () => {
    pintar({ ciudadSel: 2, ciudadFlotante: ficha });

    const flotante = screen.getByTestId("flotante");
    expect(within(flotante).getByText("ficha de la ciudad")).toBeInTheDocument();
    expect(flotante).toHaveAttribute("data-lat", "-18");
    expect(flotante).toHaveAttribute("data-lng", "-64");
  });

  it("is not drawn with no city selected, whatever the page hands over", () => {
    pintar({ ciudadSel: null, ciudadFlotante: ficha });

    expect(screen.queryByTestId("flotante")).toBeNull();
  });

  it("is not drawn for a city that was never placed: it has nowhere to hang from", () => {
    pintar({ ciudadSel: 4, ciudadFlotante: ficha });

    expect(screen.queryByTestId("flotante")).toBeNull();
  });

  it("is not drawn when the page hands nothing over", () => {
    pintar({ ciudadSel: 2 });

    expect(screen.queryByTestId("flotante")).toBeNull();
  });

  it("tells the page when it is closed", async () => {
    const user = userEvent.setup();
    const onCerrarCiudad = vi.fn();
    pintar({ ciudadSel: 2, ciudadFlotante: ficha, onCerrarCiudad });

    await user.click(screen.getByRole("button", { name: "Cerrar ficha" }));

    expect(onCerrarCiudad).toHaveBeenCalledTimes(1);
  });
});

describe("the cities", () => {
  it("cannot be dragged, any of them, in any state: a city is moved on its own sheet", () => {
    const { rerender, ...base } = pintar({ ciudadSel: 2 });
    const arrastrables = () => screen.getAllByTestId("marcador").map((m) => m.getAttribute("data-draggable"));
    expect(arrastrables()).toEqual(["false", "false", "false"]);

    rerender(<RedMap {...(base as unknown as React.ComponentProps<typeof RedMap>)} estado={conEstado({ modo: "tramoNuevo", elegidas: [1] })} />);
    expect(arrastrables()).toEqual(["false", "false", "false"]);
  });
});

describe("leaving a selection", () => {
  const ultimas = () => (fitProps.mock.calls.at(-1)![0] as { coords: { lat: number; lng: number }[] }).coords;

  it("frames every city on the first placement when nothing is selected", () => {
    pintar();

    expect(ultimas().map((c) => c.lat).sort((x, y) => x - y)).toEqual([-19, -18, -17]);
  });

  it("keeps the frame it had when the selection goes back to nothing, instead of flying out to the whole network", () => {
    const p = props();
    const { rerender } = render(<RedMap {...p} tramoSel={10} />);
    const antes = ultimas();
    expect(antes).toHaveLength(2);

    rerender(<RedMap {...p} tramoSel={null} ciudadSel={null} />);

    expect(ultimas()).toBe(antes);
  });

  it("keeps the frame when the selection becomes a city that has no position", () => {
    const p = props();
    const { rerender } = render(<RedMap {...p} tramoSel={10} />);
    const antes = ultimas();

    // «Sin sitio» is loaded but was never placed: there is nothing to frame.
    rerender(<RedMap {...p} tramoSel={null} ciudadSel={4} />);

    expect(ultimas()).toBe(antes);
  });

  it("frames the next selection again after having kept the frame", () => {
    const p = props();
    const { rerender } = render(<RedMap {...p} tramoSel={10} />);
    rerender(<RedMap {...p} tramoSel={null} />);

    rerender(<RedMap {...p} tramoSel={null} ciudadSel={3} />);

    expect(ultimas().map((c) => c.lat)).toEqual([-19]);
  });
});

describe("framing the same selection again", () => {
  const nonce = () => (fitProps.mock.calls.at(-1)![0] as { nonce?: number }).nonce;

  it("asks FitView to frame again when the same tramo is selected after a deselect", () => {
    const p = props();
    const { rerender } = render(<RedMap {...p} tramoSel={10} />);
    const primera = nonce();

    rerender(<RedMap {...p} tramoSel={null} />);
    expect(nonce()).toBe(primera);

    rerender(<RedMap {...p} tramoSel={10} />);
    expect(nonce()).not.toBe(primera);
  });

  it("does the same for a city", () => {
    const p = props();
    const { rerender } = render(<RedMap {...p} ciudadSel={3} />);
    const primera = nonce();
    rerender(<RedMap {...p} ciudadSel={null} />);

    rerender(<RedMap {...p} ciudadSel={3} />);

    expect(nonce()).not.toBe(primera);
  });

  it("changes it when another tramo is selected", () => {
    const p = props();
    const { rerender } = render(<RedMap {...p} tramos={[tramo(10, 1, 2), tramo(11, 2, 3)]} tramoSel={10} />);
    const primera = nonce();

    rerender(<RedMap {...p} tramos={[tramo(10, 1, 2), tramo(11, 2, 3)]} tramoSel={11} />);

    expect(nonce()).not.toBe(primera);
  });

  it("does not change it for a selection the data does not hold, or a city with no position, until there is something to frame", () => {
    const p = props();
    const { rerender } = render(<RedMap {...p} tramoSel={10} />);
    const primera = nonce();

    rerender(<RedMap {...p} tramoSel={null} ciudadSel={4} />);
    expect(nonce()).toBe(primera);
    rerender(<RedMap {...p} tramoSel={77} />);
    expect(nonce()).toBe(primera);

    rerender(<RedMap {...p} tramos={[tramo(10, 1, 2), tramo(77, 2, 3)]} tramoSel={77} />);
    expect(nonce()).not.toBe(primera);
  });
});

describe("a selection the data does not hold yet", () => {
  const ultimas = () => (fitProps.mock.calls.at(-1)![0] as { coords: { lat: number; lng: number }[] }).coords;

  it("keeps the view on what it framed until a tramo id is found, then frames its two cities", () => {
    const p = props();
    const { rerender } = render(<RedMap {...p} />);
    const antes = ultimas();
    expect(antes).toHaveLength(3);

    // Unknown to the loaded data: `encuadre` alone would answer every city.
    rerender(<RedMap {...p} tramoSel={77} />);
    expect(ultimas()).toBe(antes);

    rerender(<RedMap {...p} tramos={[tramo(10, 1, 2), tramo(77, 2, 3)]} tramoSel={77} />);
    expect(ultimas().map((c) => c.lat)).toEqual([-18, -19]);
  });

  it("keeps the view until a city id is found, then frames it", () => {
    const p = props();
    const { rerender } = render(<RedMap {...p} tramoSel={10} />);
    const antes = ultimas();
    expect(antes).toHaveLength(2);

    // `encuadre` alone would answer nothing for this id.
    rerender(<RedMap {...p} tramoSel={null} ciudadSel={88} />);
    expect(ultimas()).toBe(antes);

    rerender(<RedMap {...p} ciudades={[...CIUDADES, { id: 88, name: "Nueva", lat: -10, lng: -60, image: null }]} ciudadSel={88} />);
    expect(ultimas().map((c) => c.lat)).toEqual([-10]);
  });
});

const RUTA_PUNTOS = [{ lat: -17, lng: -65 }, { lat: -17.6, lng: -64.2 }, { lat: -18, lng: -64 }];

describe("the selected tramo's line", () => {
  const sourcesDeTramo = () => sourceIds.filter((id) => id !== "red-provisional");

  it("draws no line for any tramo when none is selected: only the cities", () => {
    pintar({ tramos: [tramo(10, 1, 2), tramo(11, 2, 3)] });

    expect(sourcesDeTramo()).toEqual([]);
    expect(layerIds.filter((id) => id !== "red-provisional-linea")).toEqual([]);
  });

  it("draws the route solid, at full strength, through the points it was given", () => {
    pintar({ tramoSel: 10, ruta: { estado: "lista", puntos: RUTA_PUNTOS } });

    expect(sourcesDeTramo()).toEqual(["red-ruta"]);
    expect(sourceData["red-ruta"].geometry.coordinates).toEqual([[-65, -17], [-64.2, -17.6], [-64, -18]]);
    expect(layerPaint["red-ruta-line"]).toMatchObject({ "line-opacity": 1, "line-color": ROUTE_PAINT.light.color });
    expect(layerPaint["red-ruta-line"]).not.toHaveProperty("line-dasharray");
  });

  it("draws nothing for the tramo while its route is pending", () => {
    pintar({ tramoSel: 10, ruta: { estado: "pendiente" } });

    expect(sourcesDeTramo()).toEqual([]);
  });

  it("draws a dashed straight line between the two ends when there is no route", () => {
    pintar({ tramoSel: 10, ruta: { estado: "sinRuta" } });

    expect(sourcesDeTramo()).toEqual(["red-sin-ruta"]);
    expect(sourceData["red-sin-ruta"].geometry.coordinates).toEqual([[-65, -17], [-64, -18]]);
    expect(layerPaint["red-sin-ruta-linea"]).toMatchObject({ "line-dasharray": [2, 2], "line-color": ROUTE_PAINT.light.color });
  });

  it("draws no line at all when an end has no position, whatever the route says", () => {
    const sinSitio = [tramo(12, 1, 4)];
    pintar({ tramos: sinSitio, tramoSel: 12, ruta: { estado: "sinRuta" } });
    pintar({ tramos: sinSitio, tramoSel: 12, ruta: { estado: "lista", puntos: RUTA_PUNTOS } });

    expect(sourcesDeTramo()).toEqual([]);
  });

  it("puts the route and the fallback under the pole dots, and the provisional line too", () => {
    pintar({ tramoSel: 10, ruta: { estado: "lista", puntos: RUTA_PUNTOS } });
    pintar({ tramoSel: 10, ruta: { estado: "sinRuta" } });
    pintar({ estado: conEstado({ modo: "tramoNuevo", elegidas: [1, 2] }) });

    for (const capa of ["red-ruta-line", "red-sin-ruta-linea", "red-provisional-linea"]) {
      expect(layerBefore[capa], capa).toBe("red-postes-circles");
    }
  });

  it("shares the dashed look with the provisional line", () => {
    pintar({ estado: conEstado({ modo: "tramoNuevo", elegidas: [1, 2] }) });

    expect(layerPaint["red-provisional-linea"]).toMatchObject({ "line-dasharray": [2, 2], "line-opacity": 1 });
    expect(sourceData["red-provisional"].geometry.coordinates).toEqual([[-65, -17], [-64, -18]]);
  });
});

describe("framing the route", () => {
  const ultimas = () => (fitProps.mock.calls.at(-1)![0] as { coords: { lat: number; lng: number }[] }).coords;
  const nonce = () => (fitProps.mock.calls.at(-1)![0] as { nonce?: number }).nonce;

  it("grows the frame to contain the route when it arrives, without asking to frame again", () => {
    const p = props();
    const { rerender } = render(<RedMap {...p} tramoSel={10} />);
    const sinRuta = ultimas();
    const marca = nonce();
    expect(sinRuta).toHaveLength(2);

    rerender(<RedMap {...p} tramoSel={10} ruta={{ estado: "lista", puntos: RUTA_PUNTOS }} />);

    expect(ultimas()).toEqual([...sinRuta, ...RUTA_PUNTOS]);
    expect(nonce()).toBe(marca);
  });

  it("keeps the frame, route included, while the route of the same selection is asked again", () => {
    const p = props();
    const { rerender } = render(<RedMap {...p} tramoSel={10} ruta={{ estado: "lista", puntos: RUTA_PUNTOS }} />);
    const conRuta = ultimas();
    expect(conRuta).toHaveLength(2 + RUTA_PUNTOS.length);

    // Its poles changed in between: the cached route is gone and a new one is on its way.
    rerender(<RedMap {...p} tramoSel={10} ruta={{ estado: "pendiente" }} />);
    expect(ultimas()).toBe(conRuta);

    const nueva = [{ lat: -17, lng: -65 }, { lat: -17.9, lng: -64.1 }, { lat: -18, lng: -64 }];
    rerender(<RedMap {...p} tramoSel={10} ruta={{ estado: "lista", puntos: nueva }} />);
    expect(ultimas().slice(2)).toEqual(nueva);
  });

  it("frames the ends of a tramo selected for the first time while its route is pending", () => {
    const p = props();
    const { rerender } = render(<RedMap {...p} tramos={[tramo(10, 1, 2), tramo(11, 2, 3)]} tramoSel={10} ruta={{ estado: "lista", puntos: RUTA_PUNTOS }} />);

    rerender(<RedMap {...p} tramos={[tramo(10, 1, 2), tramo(11, 2, 3)]} tramoSel={11} ruta={{ estado: "pendiente" }} />);

    expect(ultimas().map((c) => c.lat)).toEqual([-18, -19]);
  });

  it("does not change the frame again for the same route", () => {
    const p = props();
    const ruta = { estado: "lista", puntos: RUTA_PUNTOS } as const;
    const { rerender } = render(<RedMap {...p} tramoSel={10} ruta={ruta} />);
    const antes = ultimas();

    rerender(<RedMap {...p} tramoSel={10} ruta={ruta} estado={conEstado({ modo: "tramoNuevo", elegidas: [1, 2] })} />);

    expect(ultimas()).toBe(antes);
  });
});

describe("city labels", () => {
  const etiqueta = (nombre: string) => within(screen.getByRole("button", { name: nombre })).queryByText(nombre);

  it("hides a plain city's label below zoom 7 and shows it from zoom 7", () => {
    pintar();
    expect(etiqueta("Uno")).toBeNull();

    hacerZoom(6.9);
    expect(etiqueta("Uno")).toBeNull();

    hacerZoom(7);
    expect(etiqueta("Uno")).not.toBeNull();
  });

  it("reads the zoom the map already has when it mounts", () => {
    zoomActual = 9;
    pintar();

    expect(etiqueta("Uno")).not.toBeNull();
  });

  it("always shows the label of the selected city, a selected tramo's ends and a chosen city", () => {
    pintar({ ciudadSel: 3, tramoSel: 10, estado: conEstado({ modo: "tramoNuevo", elegidas: [3] }) });

    // City 3 selected and chosen; cities 1 and 2 are the ends of tramo 10.
    for (const n of ["Uno", "Dos", "Tres"]) expect(etiqueta(n)).not.toBeNull();
  });

  it("leaves a city that is none of those unlabelled at low zoom", () => {
    pintar({ tramoSel: 10 });

    expect(etiqueta("Uno")).not.toBeNull();
    expect(etiqueta("Tres")).toBeNull();
  });
});
