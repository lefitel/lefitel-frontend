// The pole's page loads the other poles of its tramo to draw the stretch. It
// does so once per tramo and keys that on `poste.id_tramo`: the two city ids it
// used to key on do not exist any more, and a key built from them read
// "undefined-undefined" for every pole, so the load never followed the pole.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PosteDetallePage from "./index";
import { SesionContext } from "../../../../context/SesionContext";
import { usuarioExample } from "../../../../data/example";
import type { PosteInterface } from "../../../../interfaces/interfaces";

const getPostesDelTramo = vi.fn();
const fetchOrsRoute = vi.fn();
const mapa = vi.fn();
let poste: PosteInterface | null = null;

vi.mock("../../../../api/Poste.api", () => ({
  getPostesDelTramo: (...a: unknown[]) => getPostesDelTramo(...a),
  searchPoste: vi.fn(),
}));
vi.mock("../../../../lib/orsRoute", () => ({ fetchOrsRoute: (...a: unknown[]) => fetchOrsRoute(...a) }));
vi.mock("./usePosteDetalleData", () => ({
  usePosteDetalleData: () => ({
    poste, dataPoste: poste ?? { id: null }, setDataPoste: vi.fn(), eventos: [], loading: false, load: vi.fn(),
    openEditPoste: false, setOpenEditPoste: vi.fn(), addEventoOpen: false, setAddEventoOpen: vi.fn(),
    addRevisionEventoId: null, setAddRevisionEventoId: vi.fn(), resolverEvento: null, setResolverEvento: vi.fn(),
    editEventoId: null, setEditEventoId: vi.fn(), reabrirEvento: vi.fn(),
  }),
}));
vi.mock("./PosteDetalleMap", () => ({ default: (p: unknown) => { mapa(p); return null; } }));
vi.mock("./PosteDetalleHeader", () => ({ default: () => null }));
vi.mock("./PosteDetalleHistorial", () => ({ default: () => null }));
vi.mock("./PosteDetalleRail", () => ({ default: () => null }));
vi.mock("./PosteDetalleEventosAbiertos", () => ({ default: () => <div>lista-abiertos</div> }));
vi.mock("./PosteDetalleInfo", () => ({ default: () => <div>datos-del-poste</div>, PosteDetalleFoto: () => null }));
vi.mock("../../../../components/dialogs/upsert/PosteSheet", () => ({ default: () => null }));
vi.mock("../../../../components/dialogs/upsert/CiudadSheet", () => ({ default: () => null }));
vi.mock("../../../../components/dialogs/upsert/EventoSheet", () => ({ default: () => null }));
vi.mock("../../../../components/dialogs/AddRevisionSheet", () => ({ default: () => null }));
vi.mock("../../../../components/dialogs/ResolverEventoSheet", () => ({ default: () => null }));
vi.mock("../../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/permissions")>()),
  can: () => true,
}));
vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

const tramo = (id: number) => ({
  id, nombre: id === 14 ? "Potosí – Sucre" : "Oruro – Potosí", id_departamento: null, departamento: null, archivado: false,
  ciudades: id === 14
    ? [{ id: 11, name: "Potosí", lat: -19.58, lng: -65.75 }, { id: 12, name: "Sucre", lat: -19.03, lng: -65.26 }]
    : [{ id: 13, name: "Oruro", lat: -17.97, lng: -67.11 }, { id: 11, name: "Potosí", lat: -19.58, lng: -65.75 }],
});
const unPoste = (id: number, idTramo: number) =>
  ({ id, name: `P-${id}`, lat: -19.3, lng: -65.5, id_tramo: idTramo, tramo: tramo(idTramo) }) as unknown as PosteInterface;

const sesion = { usuario: usuarioExample, autenticado: true };
const arbol = () => (
  <MemoryRouter>
    <SesionContext.Provider value={{ sesion, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}>
      <PosteDetallePage />
    </SesionContext.Provider>
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  getPostesDelTramo.mockResolvedValue([]);
  fetchOrsRoute.mockResolvedValue(null);
});

describe("loading the poles of the tramo", () => {
  it("asks for them by the pole's id_tramo, and again when the next pole is on another tramo", async () => {
    poste = unPoste(40, 14);
    const { rerender } = render(arbol());
    await waitFor(() => expect(getPostesDelTramo).toHaveBeenCalledWith(14));

    poste = unPoste(41, 14);
    rerender(arbol());
    // Same tramo, another pole: the stretch is not asked for again.
    expect(getPostesDelTramo).toHaveBeenCalledTimes(1);

    poste = unPoste(50, 15);
    rerender(arbol());
    await waitFor(() => expect(getPostesDelTramo).toHaveBeenLastCalledWith(15));
    expect(getPostesDelTramo).toHaveBeenCalledTimes(2);
  });

  it("does not ask for anything for a pole that came without a tramo", async () => {
    poste = { id: 40, name: "P-1", lat: -19.3, lng: -65.5 } as unknown as PosteInterface;
    render(arbol());

    await new Promise((r) => setTimeout(r, 20));
    expect(getPostesDelTramo).not.toHaveBeenCalled();
  });

  it("frames the map with the ends of poste.tramo that have coordinates", async () => {
    poste = unPoste(40, 14);
    render(arbol());

    await waitFor(() => {
      const ultimo = mapa.mock.calls.at(-1)?.[0] as { boundsCoords: [number, number][] };
      expect(ultimo.boundsCoords).toEqual(expect.arrayContaining([[-19.58, -65.75], [-19.03, -65.26]]));
    });
  });
});

describe("the pole's panel", () => {
  it("is one card with nothing lifted or folding inside it: the pole's data first, its open incidents last", () => {
    poste = unPoste(40, 14);
    render(arbol());

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("data-slot", "card");
    expect(panel.querySelector('[data-slot="card"]')).toBeNull();
    // Nothing folds: the titles are titles, and the data has none of its own.
    expect(screen.getByRole("heading", { name: "Eventos abiertos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eventos abiertos|Ficha/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Ficha" })).toBeNull();
    // The fixed part above the list that grows.
    const texto = panel.textContent ?? "";
    expect(texto.indexOf("datos-del-poste")).toBeGreaterThanOrEqual(0);
    expect(texto.indexOf("datos-del-poste")).toBeLessThan(texto.indexOf("Eventos abiertos"));
    expect(texto.indexOf("Eventos abiertos")).toBeLessThan(texto.indexOf("lista-abiertos"));
  });
});
