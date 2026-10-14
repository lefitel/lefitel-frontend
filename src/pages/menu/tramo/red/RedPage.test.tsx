// The Tramos screen as a map. The map is somebody else's test: here it is a stub that
// keeps the props it was given, so a test can press what the real one would report.
// What these tests pin down is what each click means in each mode, that the address
// is the source of the selection, and that a selection which only exists after a
// reload is not thrown away while that reload is out.

import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import type RedMap from "./RedMap";
import RedPage from "./RedPage";
import { SesionContext, type contextProps } from "../../../../context/SesionContext";
import { TooltipProvider } from "../../../../components/ui/tooltip";
import { TrailLabelProvider } from "../../../../components/TrailLabel";
import { olvidarPermisos, setPermisos, sinPermisos, type Modulo } from "../../../../lib/permissions";
import type { CiudadDeRed, TramoConCifras } from "../../../../api/Tramo.api";
import type { PosteInterface } from "../../../../interfaces/interfaces";

type MapaProps = React.ComponentProps<typeof RedMap>;
let mapa: MapaProps;
vi.mock("./RedMap", () => ({
  // Like the real map, it is what hangs the pressed city's card: the page writes it.
  default: (p: MapaProps) => { mapa = p; return <div data-testid="mapa">{p.ciudadFlotante}</div>; },
}));

const getTramos = vi.fn();
const getOpcionesTramo = vi.fn();
const createTramo = vi.fn();
const deleteTramo = vi.fn();
vi.mock("../../../../api/Tramo.api", async (original) => ({
  ...(await original<typeof import("../../../../api/Tramo.api")>()),
  getTramos: (...a: unknown[]) => getTramos(...a),
  getOpcionesTramo: (...a: unknown[]) => getOpcionesTramo(...a),
  createTramo: (...a: unknown[]) => createTramo(...a),
  deleteTramo: (...a: unknown[]) => deleteTramo(...a),
}));

const createCiudad = vi.fn();
vi.mock("../../../../api/Ciudad.api", () => ({
  createCiudad: (...a: unknown[]) => createCiudad(...a),
}));

const getPostesDelTramo = vi.fn();
vi.mock("../../../../api/Poste.api", () => ({
  getPostesDelTramo: (...a: unknown[]) => getPostesDelTramo(...a),
}));

const getEventosPendientesDelTramo = vi.fn();
vi.mock("../../../../api/Evento.api", () => ({
  getEventosPendientesDelTramo: (...a: unknown[]) => getEventosPendientesDelTramo(...a),
}));

vi.mock("../../../../components/BitacoraPanel", () => ({
  default: (p: { entity: string; entityId: number }) => <div data-testid="bitacora">{p.entity} {p.entityId}</div>,
}));

const fetchOrsRoute = vi.fn();
vi.mock("../../../../lib/orsRoute", () => ({ fetchOrsRoute: (...a: unknown[]) => fetchOrsRoute(...a) }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const ROL = 3;

const OLIVOS: CiudadDeRed = { id: 1, name: "Olivos", lat: -19.5, lng: -65.7, image: null };
const SUCRE: CiudadDeRed = { id: 2, name: "Sucre", lat: -19.0, lng: -65.2, image: null };
const NORTE: CiudadDeRed = { id: 3, name: "Norte", lat: -18.0, lng: -65.0, image: null };
const CAMARGO: CiudadDeRed = { id: 4, name: "Camargo", lat: -20.6, lng: -65.2, image: null };
const CIUDADES = [OLIVOS, SUCRE, NORTE, CAMARGO];

const tramo = (id: number, nombre: string, a: CiudadDeRed, b: CiudadDeRed): TramoConCifras => ({
  id, nombre, ciudades: [a, b], id_departamento: null, departamento: null, archivado: false, postes: 0,
});
const TRAMOS = [
  tramo(5, "Camargo – Sucre", CAMARGO, SUCRE),
  tramo(6, "Olivos – Sucre", OLIVOS, SUCRE),
];
// The one created in the tests that save: Olivos and Camargo are not joined yet.
const NUEVO = tramo(7, "Camargo – Olivos", CAMARGO, OLIVOS);

type Permisos = Partial<Record<Modulo, ("ver" | "crear" | "editar" | "archivar")[]>>;
const TODO: Permisos = {
  tramos: ["ver", "crear", "editar", "archivar"],
  ciudades: ["ver", "crear", "editar"],
  postes: ["ver"],
};

// Lets a test change the address the way the browser's own controls do.
const navegador: { actual?: NavigateFunction } = {};
// A number is a step through the history: -1 is the browser's Back.
const ir = (a: string | number) => (typeof a === "number" ? navegador.actual!(a) : navegador.actual!(a));
const Ruta = () => {
  const { pathname, search } = useLocation();
  const navegar = useNavigate();
  useEffect(() => { navegador.actual = navegar; }, [navegar]);
  return <output data-testid="ruta">{pathname}{search}</output>;
};
const direccion = () => screen.getByTestId("ruta").textContent;

function diferido<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

const pintar = async (url = "/app/tramos", permisos: Permisos = TODO) => {
  olvidarPermisos();
  const matriz = sinPermisos();
  for (const [m, acciones] of Object.entries(permisos) as [Modulo, string[]][]) {
    for (const a of acciones) (matriz[m] as Record<string, boolean>)[a] = true;
  }
  setPermisos(ROL, matriz);
  const ctx = { sesion: { usuario: { id: 7, id_rol: ROL } } } as unknown as contextProps;
  render(
    <MemoryRouter initialEntries={[url]}>
      <TooltipProvider><SesionContext.Provider value={ctx}>
        <TrailLabelProvider value={nombreParaLaMiga}>
          <Routes>
            <Route path="/app/tramos/:id?" element={<RedPage />} />
            <Route path="*" element={null} />
          </Routes>
        </TrailLabelProvider>
        <Ruta />
      </SesionContext.Provider></TooltipProvider>
    </MemoryRouter>,
  );
  await screen.findByTestId("mapa");
  return userEvent.setup();
};

/** What the screen tells the app's header its record is called. */
const nombreParaLaMiga = vi.fn();
const tarjeta = () => screen.getByRole("region", { name: "Detalle de la red" });
/**
 * The way out of a tramo's card. The page hangs it in the app's header, left of
 * the trail; mounted on its own, as here, it is drawn where it is written.
 */
const volver = () => screen.getByRole("button", { name: "Volver a la lista" });
/** The pressed city's card, which the map hangs over that city. */
const flotante = () => screen.getByTestId("mapa");
type Usuario = ReturnType<typeof userEvent.setup>;
/** The screen's one tool: on the list's title row, in the card. */
const botonTramo = () => within(tarjeta()).getByRole("button", { name: "Añadir tramo" });
const anadirTramo = (user: Usuario) => user.click(botonTramo());
/** The city a new tramo lacks: only reached from the tramo being drawn. */
const ciudadNueva = async (user: Usuario) => {
  await anadirTramo(user);
  await user.click(within(tarjeta()).getByRole("button", { name: "Crear ciudad" }));
};

beforeEach(() => {
  vi.clearAllMocks();
  getTramos.mockResolvedValue(TRAMOS);
  getOpcionesTramo.mockResolvedValue({ ciudad: CIUDADES, departamento: [] });
  getPostesDelTramo.mockResolvedValue([]);
  getEventosPendientesDelTramo.mockResolvedValue([]);
  fetchOrsRoute.mockResolvedValue(null);
});

describe("the address is the selection", () => {
  it("hands the map the tramo in the address and marks it in the list, without opening its card", async () => {
    await pintar("/app/tramos?tramo=5");

    expect(mapa.tramoSel).toBe(5);
    expect(mapa.ciudadSel).toBeNull();
    expect(within(tarjeta()).getByRole("button", { name: /^Camargo – Sucre/, pressed: true })).toBeInTheDocument();
    expect(within(tarjeta()).getByRole("heading", { name: "2 tramos" })).toBeInTheDocument();
    expect(within(tarjeta()).queryByRole("heading", { name: "Camargo – Sucre" })).toBeNull();
  });

  it("opens a tramo's card at that tramo's own address, drawn on the map like a selected one", async () => {
    await pintar("/app/tramos/5");

    expect(mapa.tramoSel).toBe(5);
    expect(within(tarjeta()).getByRole("heading", { name: "Camargo – Sucre" })).toBeInTheDocument();
    // Nothing rewrote it: the path is the whole of it.
    expect(direccion()).toBe("/app/tramos/5");
  });

  it("does not load the network again when a card is opened or closed: it is one screen", async () => {
    const user = await pintar("/app/tramos?tramo=5");
    expect(getTramos).toHaveBeenCalledTimes(1);

    await user.click(within(tarjeta()).getByRole("button", { name: "Editar Camargo – Sucre" }));
    expect(direccion()).toBe("/app/tramos/5");
    await user.click(volver());
    expect(direccion()).toBe("/app/tramos?tramo=5");

    expect(getTramos).toHaveBeenCalledTimes(1);
    expect(getOpcionesTramo).toHaveBeenCalledTimes(1);
  });

  it("opens the card from the selected row's button, and Back closes it with the row still selected", async () => {
    const user = await pintar();

    await user.click(within(tarjeta()).getByRole("button", { name: /^Camargo – Sucre/ }));
    expect(direccion()).toBe("/app/tramos?tramo=5");

    await user.click(within(tarjeta()).getByRole("button", { name: "Editar Camargo – Sucre" }));
    expect(direccion()).toBe("/app/tramos/5");
    expect(within(tarjeta()).getByRole("heading", { name: "Camargo – Sucre" })).toBeInTheDocument();

    // A new entry, so the browser's Back is the card's back arrow.
    act(() => { ir(-1); });
    expect(direccion()).toBe("/app/tramos?tramo=5");
    expect(within(tarjeta()).getByRole("button", { name: /^Camargo – Sucre/, pressed: true })).toBeInTheDocument();
  });

  it("opens a tramo's card straight from its row's button, selecting it on the way", async () => {
    // Not the selected row, and with a city in the address: one press does both.
    const user = await pintar("/app/tramos?ciudad=2");

    await user.click(within(tarjeta()).getByRole("button", { name: "Editar Olivos – Sucre" }));

    expect(direccion()).toBe("/app/tramos/6");
    expect(mapa.tramoSel).toBe(6);
    expect(within(tarjeta()).getByRole("heading", { name: "Olivos – Sucre" })).toBeInTheDocument();
  });

  it("offers the way back only while a tramo's card is open, and outside the card: it belongs to the header", async () => {
    const user = await pintar("/app/tramos?tramo=5");
    // Selected is not opened: there is nothing to go back from.
    expect(screen.queryByRole("button", { name: "Volver a la lista" })).toBeNull();

    await user.click(within(tarjeta()).getByRole("button", { name: "Editar Camargo – Sucre" }));

    expect(volver()).toBeInTheDocument();
    expect(tarjeta()).not.toContainElement(volver());
  });

  it("closes the card with its back arrow and keeps the tramo selected and drawn", async () => {
    const user = await pintar("/app/tramos/5");

    await user.click(volver());

    expect(direccion()).toBe("/app/tramos?tramo=5");
    expect(mapa.tramoSel).toBe(5);
  });

  it("lets go of the tramo when its row is pressed again", async () => {
    const user = await pintar("/app/tramos?tramo=5");

    await user.click(within(tarjeta()).getByRole("button", { name: /^Camargo – Sucre/, pressed: true }));

    expect(direccion()).toBe("/app/tramos");
    expect(mapa.tramoSel).toBeNull();
  });

  it("does not carry an open card over to another selection", async () => {
    const user = await pintar("/app/tramos/5");

    // A city pressed on the map with a card open: the card closes for it.
    act(() => mapa.onCiudad(2));
    expect(direccion()).toBe("/app/tramos?ciudad=2");
    // And from that city's floating card, to another tramo: selected, not opened.
    await user.click(within(flotante()).getByRole("button", { name: "Olivos – Sucre" }));

    expect(direccion()).toBe("/app/tramos?tramo=6");
    expect(within(tarjeta()).getByRole("button", { name: /^Olivos – Sucre/, pressed: true })).toBeInTheDocument();
  });

  it.each(["999", "abc"])("goes back to the list from the card of a tramo that is not there (/app/tramos/%s)", async (valor) => {
    await pintar(`/app/tramos/${valor}`);

    await waitFor(() => expect(direccion()).toBe("/app/tramos"));
    expect(mapa.tramoSel).toBeNull();
    expect(within(tarjeta()).getByRole("heading", { name: "2 tramos" })).toBeInTheDocument();
  });

  it("lets the card's tramo win over a city the address also carries", async () => {
    await pintar("/app/tramos/5?ciudad=2");

    expect(mapa.tramoSel).toBe(5);
    expect(mapa.ciudadSel).toBeNull();
    expect(within(tarjeta()).getByRole("heading", { name: "Camargo – Sucre" })).toBeInTheDocument();
  });

  it("leaves the card's address when its tramo is archived", async () => {
    deleteTramo.mockResolvedValue(undefined);
    const user = await pintar("/app/tramos/5");

    await user.click(within(tarjeta()).getByRole("button", { name: "Archivar" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archivar" }));

    await waitFor(() => expect(direccion()).toBe("/app/tramos"));
  });

  it.each(["999", "abc"])("drops ?tramo=%s from the address and selects nothing", async (valor) => {
    await pintar(`/app/tramos?tramo=${valor}`);

    await waitFor(() => expect(direccion()).toBe("/app/tramos"));
    expect(mapa.tramoSel).toBeNull();
    expect(mapa.ciudadSel).toBeNull();
  });

  it("drops a city that does not exist from the address too", async () => {
    await pintar("/app/tramos?ciudad=999");

    await waitFor(() => expect(direccion()).toBe("/app/tramos"));
    expect(mapa.ciudadSel).toBeNull();
  });

  it("lets the tramo win when the address carries both", async () => {
    await pintar("/app/tramos?tramo=5&ciudad=2");

    expect(mapa.tramoSel).toBe(5);
    expect(mapa.ciudadSel).toBeNull();
    // The list with the tramo marked, not the city's card.
    expect(within(tarjeta()).getByRole("button", { name: /^Camargo – Sucre/, pressed: true })).toBeInTheDocument();
    expect(within(tarjeta()).queryByRole("heading", { name: "Sucre" })).toBeNull();
  });

  it("selects a city from the address and floats its card over the map, with the list still beside it", async () => {
    await pintar("/app/tramos?ciudad=2");

    expect(mapa.ciudadSel).toBe(2);
    expect(mapa.tramoSel).toBeNull();
    expect(within(flotante()).getByText("Sucre")).toBeInTheDocument();
    // The panel is not taken over: it is still the list of tramos.
    expect(within(tarjeta()).getByRole("heading", { name: "2 tramos" })).toBeInTheDocument();
  });

  it("writes the selection to the address as a new entry, replacing the other kind", async () => {
    const user = await pintar("/app/tramos?tramo=5");

    act(() => mapa.onCiudad(2));
    expect(direccion()).toBe("/app/tramos?ciudad=2");
    expect(mapa.ciudadSel).toBe(2);

    // A tramo is never pressed on the map itself: here, from the city's floating card.
    await user.click(within(flotante()).getByRole("button", { name: "Olivos – Sucre" }));
    expect(direccion()).toBe("/app/tramos?tramo=6");
    expect(mapa.tramoSel).toBe(6);
  });
});

// A city is read on this screen and changed on its own. Pressed on the map, it
// opens a card that floats over it; the panel beside the map stays the list.
describe("the pressed city's floating card", () => {
  it("names the city and lists the tramos that leave it", async () => {
    await pintar();
    expect(mapa.ciudadFlotante).toBeFalsy();

    act(() => mapa.onCiudad(2));

    expect(within(flotante()).getByText("Sucre")).toBeInTheDocument();
    expect(within(flotante()).getByText("2 tramos")).toBeInTheDocument();
    const lista = within(flotante()).getByRole("list", { name: "Tramos de Sucre" });
    expect(within(lista).getAllByRole("button").map((b) => b.textContent)).toEqual(["Camargo – Sucre", "Olivos – Sucre"]);
  });

  it("says so for a city no tramo leaves, in the singular for one", async () => {
    await pintar();

    act(() => mapa.onCiudad(3));
    expect(within(flotante()).getByText("Sin tramos todavía")).toBeInTheDocument();
    expect(within(flotante()).queryByRole("list")).toBeNull();

    act(() => mapa.onCiudad(4));
    expect(within(flotante()).getByText("1 tramo")).toBeInTheDocument();
  });

  it("selects the tramo that is pressed in it, and closes", async () => {
    const user = await pintar("/app/tramos?ciudad=2");

    await user.click(within(flotante()).getByRole("button", { name: "Camargo – Sucre" }));

    expect(direccion()).toBe("/app/tramos?tramo=5");
    expect(mapa.ciudadFlotante).toBeFalsy();
    expect(within(tarjeta()).getByRole("button", { name: /^Camargo – Sucre/, pressed: true })).toBeInTheDocument();
  });

  it("links to the city's own sheet, which is where a city is changed", async () => {
    await pintar("/app/tramos?ciudad=2");

    expect(within(flotante()).getByRole("link", { name: "Abrir ficha de la ciudad" })).toHaveAttribute("href", "/app/ciudades/2");
    // Nothing of a city can be changed from here.
    expect(screen.queryByRole("textbox", { name: "Nombre" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mover" })).toBeNull();
  });

  it("has no link to the sheet for a role that may not read cities", async () => {
    await pintar("/app/tramos?ciudad=2", { tramos: ["ver", "crear"] });

    expect(within(flotante()).queryByRole("link")).toBeNull();
  });

  it("starts a tramo from that city, with the card gone and the city already picked", async () => {
    const user = await pintar("/app/tramos?ciudad=2");

    await user.click(within(flotante()).getByRole("button", { name: "Tramo desde aquí" }));

    expect(mapa.estado.modo).toBe("tramoNuevo");
    expect(mapa.estado.elegidas).toEqual([2]);
    expect(direccion()).toBe("/app/tramos");
    expect(mapa.ciudadFlotante).toBeFalsy();
  });

  it("does not offer a tramo from there without tramos.crear", async () => {
    await pintar("/app/tramos?ciudad=2", { tramos: ["ver"], ciudades: ["ver"] });

    expect(within(flotante()).queryByRole("button", { name: "Tramo desde aquí" })).toBeNull();
  });

  it("closes when the map says so, and takes the city out of the address", async () => {
    await pintar("/app/tramos?ciudad=2");

    act(() => mapa.onCerrarCiudad!());

    expect(direccion()).toBe("/app/tramos");
    expect(mapa.ciudadSel).toBeNull();
    expect(mapa.ciudadFlotante).toBeFalsy();
  });

  it("does not float while a tramo is being drawn: a city pressed then is picked, not looked at", async () => {
    const user = await pintar();
    await anadirTramo(user);

    act(() => mapa.onCiudad(2));

    expect(mapa.estado.elegidas).toEqual([2]);
    expect(mapa.ciudadFlotante).toBeFalsy();
    expect(direccion()).toBe("/app/tramos");
  });
});

describe("the selected tramo's route", () => {
  it("hands the map nothing to draw when no tramo is selected, and asks for no route", async () => {
    await pintar("/app/tramos?ciudad=2");

    expect(mapa.ruta).toEqual({ estado: "pendiente" });
    expect(fetchOrsRoute).not.toHaveBeenCalled();
  });

  it("asks once for the route of the tramo in the address, after its poles, and hands it to the map", async () => {
    getPostesDelTramo.mockResolvedValue([{ id: 1, name: "P-1", lat: -19.8, lng: -65.2 }]);
    fetchOrsRoute.mockResolvedValue([[-20.6, -65.2], [-19, -65.2]]);
    await pintar("/app/tramos?tramo=5");

    await waitFor(() => expect(mapa.ruta).toEqual({
      estado: "lista", puntos: [{ lat: -20.6, lng: -65.2 }, { lat: -19, lng: -65.2 }],
    }));
    expect(fetchOrsRoute).toHaveBeenCalledTimes(1);
    expect(fetchOrsRoute).toHaveBeenCalledWith([[-65.2, -20.6], [-65.2, -19.8], [-65.2, -19]]);
  });

  it("asks with the two ends alone for a role that cannot see poles", async () => {
    await pintar("/app/tramos?tramo=5", { tramos: ["ver"] });

    await waitFor(() => expect(mapa.ruta).toEqual({ estado: "sinRuta" }));
    expect(getPostesDelTramo).not.toHaveBeenCalled();
    expect(fetchOrsRoute).toHaveBeenCalledTimes(1);
    expect(fetchOrsRoute).toHaveBeenCalledWith([[-65.2, -20.6], [-65.2, -19]]);
  });
});

describe("what a click means", () => {
  it("in seleccionar, a click on the empty map changes nothing", async () => {
    await pintar("/app/tramos?tramo=5");

    act(() => mapa.onMapa({ lat: 1, lng: 2 }));

    expect(direccion()).toBe("/app/tramos?tramo=5");
    expect(mapa.estado.borrador).toBeNull();
    expect(mapa.estado.modo).toBe("seleccionar");
  });

  it("in ciudadNueva, any click on the map leaves the draft there", async () => {
    const user = await pintar();
    await ciudadNueva(user);

    act(() => mapa.onMapa({ lat: -19, lng: -65 }));

    expect(mapa.estado.borrador).toEqual({ lat: -19, lng: -65 });
    act(() => mapa.onMapa({ lat: -18, lng: -64 }));
    expect(mapa.estado.borrador).toEqual({ lat: -18, lng: -64 });
  });

  it("in ciudadNueva, pressing an existing city does nothing", async () => {
    const user = await pintar();
    await ciudadNueva(user);
    act(() => mapa.onMapa({ lat: -19, lng: -65 }));

    act(() => mapa.onCiudad(2));

    expect(direccion()).toBe("/app/tramos");
    expect(mapa.estado.modo).toBe("ciudadNueva");
    expect(mapa.estado.borrador).toEqual({ lat: -19, lng: -65 });
    expect(mapa.estado.elegidas).toEqual([]);
  });

  it("in tramoNuevo, a city is picked and not selected", async () => {
    const user = await pintar();
    await anadirTramo(user);

    act(() => mapa.onCiudad(2));
    expect(mapa.estado.elegidas).toEqual([2]);
    expect(direccion()).toBe("/app/tramos");
    expect(mapa.ciudadSel).toBeNull();

    act(() => mapa.onMapa({ lat: 1, lng: 2 }));
    expect(mapa.estado.borrador).toBeNull();
  });

  it("keeps the callbacks it gave the map when only the state changes underneath", async () => {
    const user = await pintar();
    await ciudadNueva(user);
    const antes = mapa;

    act(() => mapa.onMapa({ lat: -19, lng: -65 }));

    expect(mapa.estado.borrador).not.toBe(antes.estado.borrador);
    expect(mapa.onCiudad).toBe(antes.onCiudad);
    expect(mapa).not.toHaveProperty("onTramo");
    expect(mapa).not.toHaveProperty("onArrastre");
    expect(mapa.onMapa).toBe(antes.onMapa);
    expect(mapa.onVerPoste).toBe(antes.onVerPoste);
    expect(mapa.onCerrarCiudad).toBe(antes.onCerrarCiudad);
  });

  it("'Ver poste' goes to that pole", async () => {
    await pintar("/app/tramos?tramo=5");

    act(() => mapa.onVerPoste(9));

    expect(direccion()).toBe("/app/postes/9");
  });
});

describe("the one tool", () => {
  it("is «Añadir tramo», in the card beside the list's title, and nothing floats over the map", async () => {
    await pintar();

    expect(botonTramo()).toBeInTheDocument();
    expect(screen.getByTestId("mapa")).toBeEmptyDOMElement();
    expect(screen.queryByRole("toolbar")).toBeNull();
    for (const nombre of ["Seleccionar", "+ Tramo", "+ Ciudad"]) {
      expect(screen.queryByRole("button", { name: nombre })).toBeNull();
    }
  });

  it("starts a new tramo", async () => {
    const user = await pintar();

    await anadirTramo(user);

    expect(mapa.estado.modo).toBe("tramoNuevo");
    expect(within(tarjeta()).getByRole("heading", { name: "Elige dos ciudades" })).toBeInTheDocument();
  });

  it("is backed out of with the card's «Cancelar», which clears what had been picked", async () => {
    const user = await pintar();
    await anadirTramo(user);
    act(() => mapa.onCiudad(2));

    await user.click(within(tarjeta()).getByRole("button", { name: "Cancelar" }));

    expect(mapa.estado.modo).toBe("seleccionar");
    expect(mapa.estado.elegidas).toEqual([]);
    expect(botonTramo()).toBeInTheDocument();
  });

  it("is not offered without tramos.crear", async () => {
    await pintar("/app/tramos", { tramos: ["ver"], ciudades: ["ver", "crear"] });

    expect(within(tarjeta()).queryByRole("button", { name: "Añadir tramo" })).toBeNull();
  });
});

// A city is made from the tramo that lacks it, and nowhere else on this screen.
describe("the city a new tramo lacks", () => {
  it("is reached from the tramo being drawn, which keeps what it had picked", async () => {
    const user = await pintar();
    await anadirTramo(user);
    act(() => mapa.onCiudad(2));

    await user.click(within(tarjeta()).getByRole("button", { name: "Crear ciudad" }));

    expect(mapa.estado.modo).toBe("ciudadNueva");
    expect(mapa.estado.elegidas).toEqual([2]);
  });

  it("is not offered without ciudades.crear", async () => {
    const user = await pintar("/app/tramos", { tramos: ["ver", "crear"], ciudades: ["ver"] });
    await anadirTramo(user);

    expect(within(tarjeta()).queryByRole("button", { name: "Crear ciudad" })).toBeNull();
  });

  it("goes back to the tramo, untouched, on «Volver al tramo»", async () => {
    const user = await pintar();
    await anadirTramo(user);
    act(() => mapa.onCiudad(2));
    await user.click(within(tarjeta()).getByRole("button", { name: "Crear ciudad" }));
    act(() => mapa.onMapa({ lat: -19, lng: -65 }));

    await user.click(within(tarjeta()).getByRole("button", { name: "Volver al tramo" }));

    expect(mapa.estado.modo).toBe("tramoNuevo");
    expect(mapa.estado.elegidas).toEqual([2]);
    expect(mapa.estado.borrador).toBeNull();
  });

  it("goes back to the tramo with the new city picked, once the reload has brought it in", async () => {
    const user = await pintar();
    createCiudad.mockResolvedValue({ id: 8 });
    await anadirTramo(user);
    act(() => mapa.onCiudad(2));
    await user.click(within(tarjeta()).getByRole("button", { name: "Crear ciudad" }));
    act(() => mapa.onMapa({ lat: -19, lng: -65 }));
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");
    getOpcionesTramo.mockResolvedValue({ ciudad: [...CIUDADES, { id: 8, name: "Tarija", lat: -19, lng: -65 }], departamento: [] });

    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));

    // The tramo it was made for, named with it: Sucre was picked, Tarija is new.
    expect(await within(tarjeta()).findByRole("heading", { name: "Sucre – Tarija" })).toBeInTheDocument();
    expect(mapa.estado.modo).toBe("tramoNuevo");
    expect(mapa.estado.elegidas).toEqual([2, 8]);
    // No city card was opened on the way.
    expect(direccion()).toBe("/app/tramos");
  });
});

describe("Esc", () => {
  it("backs out one step at a time: from the new city to its tramo, then out of the tramo", async () => {
    const user = await pintar();
    await anadirTramo(user);
    act(() => mapa.onCiudad(2));
    await user.click(within(tarjeta()).getByRole("button", { name: "Crear ciudad" }));
    act(() => mapa.onMapa({ lat: -19, lng: -65 }));

    await user.keyboard("{Escape}");

    // Not thrown away with the city: the tramo is still being drawn.
    expect(mapa.estado.modo).toBe("tramoNuevo");
    expect(mapa.estado.elegidas).toEqual([2]);
    expect(mapa.estado.borrador).toBeNull();

    await user.keyboard("{Escape}");

    expect(mapa.estado.modo).toBe("seleccionar");
    expect(mapa.estado.elegidas).toEqual([]);
  });

  it("is left to an open dialog: the mode stays", async () => {
    const user = await pintar();
    await ciudadNueva(user);
    const dialogo = document.createElement("div");
    dialogo.setAttribute("role", "dialog");
    document.body.appendChild(dialogo);
    try {
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(mapa.estado.modo).toBe("ciudadNueva");
    } finally {
      dialogo.remove();
    }

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(mapa.estado.modo).toBe("tramoNuevo");
  });

  it("is left to an open alert dialog too", async () => {
    const user = await pintar();
    await anadirTramo(user);
    const dialogo = document.createElement("div");
    dialogo.setAttribute("role", "alertdialog");
    document.body.appendChild(dialogo);
    try {
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(mapa.estado.modo).toBe("tramoNuevo");
    } finally {
      dialogo.remove();
    }
  });

  it("does nothing, and no key listener is on the document, in seleccionar", async () => {
    const alta = vi.spyOn(document, "addEventListener");
    try {
      const user = await pintar();
      const teclas = () => alta.mock.calls.filter(([tipo]) => tipo === "keydown");
      expect(teclas()).toHaveLength(0);

      await user.keyboard("{Escape}");

      expect(direccion()).toBe("/app/tramos");
      expect(mapa.estado.modo).toBe("seleccionar");

      // The spy sees a listener when there is one: starting a tramo adds it.
      await anadirTramo(user);
      expect(teclas()).toHaveLength(1);
    } finally {
      alta.mockRestore();
    }
  });

  it("is left to whatever popup consumed it: an Escape that is already prevented changes nothing", async () => {
    const user = await pintar();
    await ciudadNueva(user);
    act(() => mapa.onMapa({ lat: -19, lng: -65 }));
    // What Radix does with the Escape that closes its select: it takes it and prevents it.
    const consumir = (e: Event) => e.preventDefault();
    document.addEventListener("keydown", consumir, true);
    try {
      fireEvent.keyDown(document.body, { key: "Escape" });
    } finally {
      document.removeEventListener("keydown", consumir, true);
    }

    expect(mapa.estado.modo).toBe("ciudadNueva");
    expect(mapa.estado.borrador).toEqual({ lat: -19, lng: -65 });

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(mapa.estado.modo).toBe("tramoNuevo");
  });

  // The dialog roles are caught by the whole-document check (an open dialog is
  // Esc's wherever focus is), and the two tests above pin that down. These two
  // are only found by looking at where the key came from.
  it.each(["listbox", "menu"])("is left to a %s that holds focus", async (rol) => {
    const user = await pintar();
    await anadirTramo(user);
    act(() => mapa.onCiudad(2));
    const popup = document.createElement("div");
    popup.setAttribute("role", rol);
    const opcion = document.createElement("button");
    popup.appendChild(opcion);
    const aparte = document.createElement("section");
    aparte.appendChild(popup);
    document.body.appendChild(aparte);
    try {
      opcion.focus();
      fireEvent.keyDown(opcion, { key: "Escape" });
      expect(mapa.estado.modo).toBe("tramoNuevo");
      expect(mapa.estado.elegidas).toEqual([2]);
    } finally {
      aparte.remove();
    }
  });

  it("is left to a popper's content wrapper, which Radix puts around its floating panels", async () => {
    const user = await pintar();
    await anadirTramo(user);
    act(() => mapa.onCiudad(2));
    const envoltorio = document.createElement("div");
    envoltorio.setAttribute("data-radix-popper-content-wrapper", "");
    const dentro = document.createElement("div");
    envoltorio.appendChild(dentro);
    document.body.appendChild(envoltorio);
    try {
      fireEvent.keyDown(dentro, { key: "Escape" });
      expect(mapa.estado.modo).toBe("tramoNuevo");
    } finally {
      envoltorio.remove();
    }
  });
});

describe("the help under the map", () => {
  const ayuda = () => document.querySelector('[aria-live="polite"]')!.textContent;

  it("says nothing while just selecting", async () => {
    await pintar();
    expect(ayuda()).toBe("");
  });

  it("walks through the three steps of a new tramo", async () => {
    const user = await pintar();
    await anadirTramo(user);
    expect(ayuda()).toBe("Pincha dos ciudades para trazar el tramo.");

    act(() => mapa.onCiudad(1));
    expect(ayuda()).toBe("Pincha la otra ciudad.");

    act(() => mapa.onCiudad(4));
    expect(ayuda()).toBe("Revisa el tramo en la tarjeta y guarda.");
  });

  it("tells where the new city goes", async () => {
    const user = await pintar();
    await ciudadNueva(user);
    expect(ayuda()).toBe("Pincha en el mapa donde va la ciudad nueva.");
  });

});

describe("poles", () => {
  it("asks for the poles of the selected tramo and hands them to the map", async () => {
    const postes = [{ id: 9, name: "P-9", lat: -19, lng: -65 }] as unknown as PosteInterface[];
    getPostesDelTramo.mockResolvedValue(postes);
    await pintar("/app/tramos?tramo=5");

    await waitFor(() => expect(mapa.postes).toEqual(postes));
    expect(getPostesDelTramo).toHaveBeenCalledWith(5);
  });

  it("asks for none without postes.ver", async () => {
    await pintar("/app/tramos?tramo=5", { tramos: ["ver"], ciudades: ["ver"] });

    expect(getPostesDelTramo).not.toHaveBeenCalled();
    expect(mapa.postes).toEqual([]);
  });
});

describe("loading and failing", () => {
  it("shows a way to retry when the first load fails, and loads again on pressing it", async () => {
    getTramos.mockRejectedValueOnce(new Error("boom"));
    olvidarPermisos();
    const user = userEvent.setup();
    const matriz = sinPermisos();
    matriz.tramos.ver = true;
    setPermisos(ROL, matriz);
    const ctx = { sesion: { usuario: { id: 7, id_rol: ROL } } } as unknown as contextProps;
    render(
      <MemoryRouter initialEntries={["/app/tramos"]}>
        <TooltipProvider><SesionContext.Provider value={ctx}><RedPage /></SesionContext.Provider></TooltipProvider>
      </MemoryRouter>,
    );

    const reintentar = await screen.findByRole("button", { name: "Reintentar" });
    expect(screen.queryByTestId("mapa")).toBeNull();
    expect(getTramos).toHaveBeenCalledTimes(1);

    await user.click(reintentar);

    expect(await screen.findByTestId("mapa")).toBeInTheDocument();
    expect(getTramos).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });

  it("shows neither the map nor a retry while the first load is out", async () => {
    getTramos.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <TooltipProvider><SesionContext.Provider value={{ sesion: { usuario: { id: 7, id_rol: ROL } } } as unknown as contextProps}>
          <RedPage />
        </SesionContext.Provider></TooltipProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Tramos" })).toBeInTheDocument();
    expect(screen.queryByTestId("mapa")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });
});

describe("a tramo created and selected before the reload brings it in", () => {
  /** Picks Camargo and Olivos in the map and presses «Guardar tramo»; the reload is left out. */
  const guardarHastaLaRecarga = async () => {
    const user = await pintar();
    const recarga = diferido<TramoConCifras[]>();
    createTramo.mockResolvedValue({ id: 7 });
    getTramos.mockReturnValueOnce(recarga.promesa);

    await anadirTramo(user);
    act(() => mapa.onCiudad(4));
    act(() => mapa.onCiudad(1));
    await user.click(screen.getByRole("button", { name: "Guardar tramo" }));
    await waitFor(() => expect(direccion()).toBe("/app/tramos?tramo=7"));
    return recarga;
  };

  it("keeps the unknown id in the address while the reload is out", async () => {
    await guardarHastaLaRecarga();

    // Give the page every chance to wrongly clear it.
    await act(async () => { await Promise.resolve(); });
    expect(direccion()).toBe("/app/tramos?tramo=7");
    expect(mapa.tramoSel).toBe(7);
    expect(mapa.estado.modo).toBe("seleccionar");
  });

  it("keeps the id and marks its row when the reload brings the tramo in", async () => {
    const recarga = await guardarHastaLaRecarga();

    await act(async () => { recarga.resolver([...TRAMOS, NUEVO]); });

    expect(direccion()).toBe("/app/tramos?tramo=7");
    expect(mapa.tramoSel).toBe(7);
    // Selected in the list, like any other: its card is one press away.
    expect(await within(tarjeta()).findByRole("button", { name: /^Camargo – Olivos/, pressed: true })).toBeInTheDocument();
  });

  it("removes the id once the reload has settled without it", async () => {
    const recarga = await guardarHastaLaRecarga();

    await act(async () => { recarga.resolver(TRAMOS); });

    await waitFor(() => expect(direccion()).toBe("/app/tramos"));
    expect(mapa.tramoSel).toBeNull();
  });
});

describe("poles of a tramo the data does not hold", () => {
  it("asks for none while the address carries an id that is not in the loaded tramos", async () => {
    await pintar("/app/tramos?tramo=999");

    await waitFor(() => expect(direccion()).toBe("/app/tramos"));
    expect(getPostesDelTramo).not.toHaveBeenCalled();
  });
});

describe("a tramo that already existed, found by a 409 for a tramo this screen has not loaded", () => {
  it("reloads, and marks that tramo's row at ?tramo=<id> instead of dropping the selection", async () => {
    const user = await pintar();
    createTramo.mockRejectedValue(Object.assign(new Error("409"), {
      isAxiosError: true,
      response: { status: 409, data: { message: "Ya existe", tramo: { id: 7, nombre: "Camargo – Olivos", archivado: false } } },
    }));
    getTramos.mockResolvedValueOnce([...TRAMOS, NUEVO]);

    await anadirTramo(user);
    act(() => mapa.onCiudad(4));
    act(() => mapa.onCiudad(1));
    await user.click(screen.getByRole("button", { name: "Guardar tramo" }));

    expect(await within(tarjeta()).findByRole("button", { name: /^Camargo – Olivos/, pressed: true })).toBeInTheDocument();
    expect(direccion()).toBe("/app/tramos?tramo=7");
    expect(mapa.tramoSel).toBe(7);
    expect(toast.info).toHaveBeenCalledWith("Ese tramo ya existía: Camargo – Olivos");
    expect(getTramos).toHaveBeenCalledTimes(2);
  });
});

describe("a save in flight", () => {
  /** Placing the city a new tramo lacks: a draft, a name typed and «Guardar ciudad» pressed; the answer is held back. */
  const guardarCiudadSinRespuesta = async () => {
    const user = await pintar();
    const crear = diferido<{ id: number }>();
    createCiudad.mockReturnValue(crear.promesa);
    await ciudadNueva(user);
    act(() => mapa.onMapa({ lat: -19, lng: -65 }));
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");
    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));
    expect(createCiudad).toHaveBeenCalledTimes(1);
    return { user, crear };
  };

  it("ignores Esc, the way back and the map's clicks while the card reports a save in flight", async () => {
    const { user, crear } = await guardarCiudadSinRespuesta();

    await user.keyboard("{Escape}");
    act(() => mapa.onMapa({ lat: 1, lng: 2 }));
    act(() => mapa.onCiudad(2));

    expect(mapa.estado.modo).toBe("ciudadNueva");
    expect(mapa.estado.borrador).toEqual({ lat: -19, lng: -65 });
    expect(within(tarjeta()).getByRole("button", { name: "Volver al tramo" })).toBeDisabled();
    expect(direccion()).toBe("/app/tramos");

    // The reload that follows the create brings the new city in, and the
    // tramo it was made for is gone back to with it picked.
    getOpcionesTramo.mockResolvedValue({ ciudad: [...CIUDADES, { id: 8, name: "Tarija", lat: -19, lng: -65 }], departamento: [] });
    await act(async () => { crear.resolver({ id: 8 }); });
    await waitFor(() => expect(mapa.estado.modo).toBe("tramoNuevo"));
    expect(mapa.estado.elegidas).toEqual([8]);
    expect(direccion()).toBe("/app/tramos");
  });

  it("listens again to Esc and the way back once the save is refused", async () => {
    const { user, crear } = await guardarCiudadSinRespuesta();

    await act(async () => { crear.rechazar(new Error("no")); });
    expect(within(tarjeta()).getByRole("button", { name: "Volver al tramo" })).toBeEnabled();
    await user.keyboard("{Escape}");

    expect(mapa.estado.modo).toBe("tramoNuevo");
  });

  it("does not take the person back to the map when a create answers after they left the page", async () => {
    const { crear } = await guardarCiudadSinRespuesta();

    act(() => { ir("/app/postes"); });
    expect(direccion()).toBe("/app/postes");
    await act(async () => { crear.resolver({ id: 8 }); });

    expect(direccion()).toBe("/app/postes");
  });
});

// The department filter is set in the card's list, and the map follows it:
// an unselected tramo has no line, so what leaves the map is the cities.
describe("the department filter, on the map", () => {
  const CHUQUISACA = { id: 6, name: "Chuquisaca" };
  const enChuquisaca = { ...TRAMOS[0], id_departamento: CHUQUISACA.id, departamento: CHUQUISACA };
  const ciudadesDelMapa = () => mapa.ciudades.map((c) => c.name);

  const filtrar = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(within(tarjeta()).getByRole("button", { name: "Filtros" }));
    await user.click(screen.getByRole("combobox", { name: "Filtrar por departamento" }));
    await user.click(await screen.findByRole("option", { name: "Chuquisaca" }));
    await user.keyboard("{Escape}");
  };

  beforeEach(() => {
    // Camargo – Sucre is in Chuquisaca; Olivos – Sucre has no department; Norte is in no tramo.
    getTramos.mockResolvedValue([enChuquisaca, TRAMOS[1]]);
  });

  it("draws every city until a department is chosen, then only the ends of its tramos", async () => {
    const user = await pintar();
    expect(ciudadesDelMapa()).toEqual(["Olivos", "Sucre", "Norte", "Camargo"]);

    await filtrar(user);

    expect(ciudadesDelMapa()).toEqual(["Sucre", "Camargo"]);
    // The map is told about every tramo still: it needs them to know the selection.
    expect(mapa.tramos).toHaveLength(2);
  });

  it("brings the whole network back while a tramo is being added", async () => {
    const user = await pintar();
    await filtrar(user);

    await anadirTramo(user);

    // A new tramo may join two departments: a hidden city could not be picked.
    expect(ciudadesDelMapa()).toEqual(["Olivos", "Sucre", "Norte", "Camargo"]);
  });

  it("keeps a tramo opened from outside the filter on the map, ends and all", async () => {
    const user = await pintar();
    await filtrar(user);

    await act(async () => { ir("/app/tramos?tramo=6"); });

    expect(ciudadesDelMapa()).toEqual(["Olivos", "Sucre", "Camargo"]);
  });
});

// The rail the pole's sheet and the incident's have, beside a tramo's card.
describe("the rail beside a tramo's card", () => {
  // `TODO` reads poles already; this is a base that reads none of the three.
  const SOLO_RED: Permisos = { tramos: TODO.tramos, ciudades: TODO.ciudades };
  const TODO_Y_MAS: Permisos = { ...SOLO_RED, postes: ["ver"], eventos: ["ver"], bitacora: ["ver"] };
  const rail = () => screen.getByRole("tablist", { name: "Vistas del tramo" });
  const pestana = (nombre: RegExp) => within(rail()).getByRole("tab", { name: nombre });

  it("is there only while a tramo's card is open", async () => {
    const user = await pintar("/app/tramos?tramo=5", TODO_Y_MAS);
    // Selected is not opened: the list has no views to choose between.
    expect(screen.queryByRole("tablist", { name: "Vistas del tramo" })).toBeNull();

    await user.click(within(tarjeta()).getByRole("button", { name: "Editar Camargo – Sucre" }));
    expect(rail()).toBeInTheDocument();

    await user.click(volver());
    expect(screen.queryByRole("tablist", { name: "Vistas del tramo" })).toBeNull();
  });

  it("offers the summary, the poles, the pending incidents and the audit log, and opens on the summary", async () => {
    await pintar("/app/tramos/5", TODO_Y_MAS);

    expect(within(rail()).getAllByRole("tab").map((t) => t.getAttribute("aria-label"))).toEqual([
      "Resumen", "Postes", "Eventos pendientes", "Bitácora",
    ]);
    expect(pestana(/^Resumen/)).toHaveAttribute("aria-selected", "true");
    expect(within(tarjeta()).getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("carries the figures the tramo's row has, beside each name", async () => {
    getTramos.mockResolvedValue([{ ...TRAMOS[0], postes: 12, pendientes: 3 }, TRAMOS[1]]);
    await pintar("/app/tramos/5", TODO_Y_MAS);

    expect(pestana(/^Postes/)).toHaveAttribute("aria-label", "Postes (12)");
    expect(pestana(/^Eventos pendientes/)).toHaveAttribute("aria-label", "Eventos pendientes (3)");
  });

  it.each<[string, Permisos, string[]]>([
    ["poles", { tramos: ["ver", "editar"], eventos: ["ver"], bitacora: ["ver"] }, ["Resumen", "Eventos pendientes", "Bitácora"]],
    ["incidents", { tramos: ["ver", "editar"], postes: ["ver"], bitacora: ["ver"] }, ["Resumen", "Postes", "Bitácora"]],
    ["the audit log", { tramos: ["ver", "editar"], postes: ["ver"], eventos: ["ver"] }, ["Resumen", "Postes", "Eventos pendientes"]],
  ])("does not offer what a role may not read: %s", async (_, permisos, esperadas) => {
    await pintar("/app/tramos/5", permisos);

    expect(within(rail()).getAllByRole("tab").map((t) => t.getAttribute("aria-label"))).toEqual(esperadas);
  });

  it("is not drawn at all for a role that may read none of the three: the summary alone is no choice", async () => {
    await pintar("/app/tramos/5", { tramos: ["ver", "editar"] });

    expect(within(tarjeta()).getByRole("heading", { name: "Camargo – Sucre" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "Vistas del tramo" })).toBeNull();
    expect(tarjeta().parentElement!.className).not.toContain("_auto]");
  });

  it("fills the card with the tramo's poles, the ones the map already draws, without asking again", async () => {
    getPostesDelTramo.mockResolvedValue([{ id: 9, name: "P-9", lat: -19, lng: -65 }]);
    const user = await pintar("/app/tramos/5", TODO_Y_MAS);
    await waitFor(() => expect(mapa.postes).toHaveLength(1));

    await user.click(pestana(/^Postes/));

    expect(within(tarjeta()).getByRole("link", { name: /Poste P-9/ })).toHaveAttribute("href", "/app/postes/9");
    expect(getPostesDelTramo).toHaveBeenCalledTimes(1);
    // The tabs point at the card they fill.
    expect(pestana(/^Postes/)).toHaveAttribute("aria-controls", tarjeta().id);
  });

  it("asks for the pending incidents only when their view is opened", async () => {
    const user = await pintar("/app/tramos/5", TODO_Y_MAS);
    expect(getEventosPendientesDelTramo).not.toHaveBeenCalled();

    await user.click(pestana(/^Eventos pendientes/));

    await waitFor(() => expect(getEventosPendientesDelTramo).toHaveBeenCalledWith(5));
    expect(await within(tarjeta()).findByText("Este tramo no tiene eventos pendientes.")).toBeInTheDocument();
  });

  it("shows the tramo's audit log", async () => {
    const user = await pintar("/app/tramos/5", TODO_Y_MAS);

    await user.click(pestana(/^Bitácora/));

    expect(within(tarjeta()).getByTestId("bitacora")).toHaveTextContent("Tramo 5");
  });

  it("opens another tramo's card on its summary, not on the view the last one was left on", async () => {
    const user = await pintar("/app/tramos/5", TODO_Y_MAS);
    await user.click(pestana(/^Bitácora/));

    act(() => { ir("/app/tramos/6"); });

    expect(pestana(/^Resumen/)).toHaveAttribute("aria-selected", "true");
    expect(within(tarjeta()).getByRole("heading", { name: "Olivos – Sucre" })).toBeInTheDocument();
    expect(within(tarjeta()).queryByTestId("bitacora")).toBeNull();
  });

  it("gives the map's column back when the card is closed", async () => {
    const user = await pintar("/app/tramos/5", TODO_Y_MAS);
    const rejilla = () => tarjeta().parentElement!.className;
    expect(rejilla()).toContain("lg:grid-cols-[minmax(0,1fr)_24rem_auto]");

    await user.click(volver());

    expect(rejilla()).toContain("lg:grid-cols-[minmax(0,1fr)_24rem]");
    expect(rejilla()).not.toContain("_auto]");
  });
});

// The way back sits in the app's header beside the button that folds the
// sidebar, and the two are the same kind of thing: a bare icon. It was a size
// up — 32px against that button's 28 — which next to each other reads as two
// controls from two different sets. The sidebar's button is a ghost icon button
// narrowed to `size-7`; so is this one, in the same words.
describe("the way back, beside the sidebar's button", () => {
  it("is the same size and the same bare skin as that button", async () => {
    await pintar("/app/tramos/5");

    const clases = volver().className.split(/\s+/);
    expect(clases).toContain("size-7");
    expect(clases.filter((c) => /^(h|w|size)-(8|9)$/.test(c))).toEqual([]);
    // Ghost: nothing behind it until it is hovered.
    expect(clases).toContain("hover:bg-accent");
    expect(clases.filter((c) => /^bg-/.test(c))).toEqual([]);
  });
});


// The trail in the app's header is built from the address, which knows a tramo
// by its number. The screen has its name.
describe("what the trail is told the open tramo is called", () => {
  it("is its name, for the address of its card, once the card is open", async () => {
    await pintar("/app/tramos/5");

    expect(nombreParaLaMiga).toHaveBeenLastCalledWith({ path: "/app/tramos/5", text: "Camargo – Sucre" });
  });

  it("is nothing while a tramo is only selected: the trail there says «Tramos», which is right", async () => {
    await pintar("/app/tramos?tramo=5");

    expect(nombreParaLaMiga).not.toHaveBeenCalledWith(expect.objectContaining({ text: expect.any(String) }));
  });

  it("is taken back when the card is closed", async () => {
    const user = await pintar("/app/tramos/5");
    expect(nombreParaLaMiga).toHaveBeenLastCalledWith({ path: "/app/tramos/5", text: "Camargo – Sucre" });

    await user.click(volver());

    expect(nombreParaLaMiga).toHaveBeenLastCalledWith(null);
  });
});
