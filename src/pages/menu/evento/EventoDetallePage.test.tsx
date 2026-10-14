// The incident's page names its pole's tramo and draws it: the two cities and
// the stretch between them. All of it comes from `evento.poste.tramo`; the two
// city fields it used to read are gone from the server's answer, so on real
// data it showed two dashes and drew no city at all.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventoDetallePage from "./EventoDetallePage";
import { SesionContext } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";
import type { EventoInterface } from "../../../interfaces/interfaces";

const getPostesDelTramo = vi.fn();
let evento: EventoInterface | null = null;

vi.mock("../../../api/Poste.api", () => ({ getPostesDelTramo: (...a: unknown[]) => getPostesDelTramo(...a) }));
vi.mock("../../../api/Evento.api", () => ({ reabrirEvento: vi.fn() }));
vi.mock("../../../lib/orsRoute", () => ({ fetchOrsRoute: vi.fn().mockResolvedValue(null) }));
vi.mock("./useEventoDetalleData", () => ({
  useEventoDetalleData: () => ({
    evento, revisions: [], solucion: null, eventoObs: [], loading: false, load: vi.fn(),
  }),
}));
vi.mock("../../../components/map/BaseMap", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../components/map/MapPoint", () => ({
  default: ({ children, center }: { children: React.ReactNode; center: { lat: number } }) => (
    <div data-testid="marcador" data-lat={center.lat}>{children}</div>
  ),
}));
vi.mock("../../../components/map/MapLine", () => ({
  default: ({ positions }: { positions: unknown[] }) => <div data-testid="linea" data-puntos={positions.length} />,
}));
vi.mock("../../../components/map/SonarMarker", () => ({ SonarMarker: () => null }));
vi.mock("../../../components/map/useFitCoords", () => ({ FitView: () => null }));
vi.mock("../../../components/BitacoraPanel", () => ({ default: () => null }));
vi.mock("../../../components/dialogs/AddRevisionSheet", () => ({ default: () => null }));
vi.mock("../../../components/dialogs/upsert/EventoSheet", () => ({ default: () => null }));
vi.mock("../../../components/dialogs/ResolverEventoSheet", () => ({ default: () => null }));
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: () => true,
}));
vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }));

const POTOSI = { id: 11, name: "Potosí", lat: -19.58, lng: -65.75 };
const SUCRE = { id: 12, name: "Sucre", lat: -19.03, lng: -65.26 };

const conTramo = (sucre: { id: number; name: string; lat: number | null; lng: number | null } = SUCRE) =>
  ({
    id: 5, description: "Cable caído", image: "", state: false, priority: false, date: new Date("2026-01-05"),
    id_poste: 40,
    poste: {
      id: 40, name: "P-001", lat: -19.3, lng: -65.5, id_tramo: 14,
      tramo: { id: 14, nombre: "Potosí – Sucre", ciudades: [POTOSI, sucre], id_departamento: null, departamento: null, archivado: false },
    },
  }) as unknown as EventoInterface;

const pintar = () =>
  render(
    <MemoryRouter>
      <SesionContext.Provider
        value={{ sesion: { usuario: usuarioExample, autenticado: true }, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <EventoDetallePage />
      </SesionContext.Provider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  getPostesDelTramo.mockResolvedValue([]);
});

describe("the tramo on an incident's page", () => {
  it("is the name the server built, and no two city names are joined here", async () => {
    evento = conTramo();
    const { container } = pintar();

    expect(await screen.findAllByText("Potosí – Sucre")).not.toHaveLength(0);
    const texto = container.textContent ?? "";
    for (const unir of [" > ", " → ", " — "]) expect(texto).not.toContain(unir);
  });

  it("loads the poles of the tramo by its id", async () => {
    evento = conTramo();
    pintar();

    await waitFor(() => expect(getPostesDelTramo).toHaveBeenCalledWith(14));
  });

  it("draws a marker for each city of the tramo that has coordinates", () => {
    evento = conTramo();
    pintar();

    const marcadores = screen.getAllByTestId("marcador");
    expect(marcadores).toHaveLength(2);
    expect(marcadores[0]).toHaveTextContent("Potosí");
    expect(marcadores[1]).toHaveTextContent("Sucre");
  });

  it("labels both ends 'Extremo del tramo': a tramo has no start and no end", () => {
    evento = conTramo();
    pintar();

    for (const marcador of screen.getAllByTestId("marcador")) {
      expect(marcador).toHaveTextContent("Extremo del tramo");
      expect(marcador.textContent).not.toMatch(/Inicio|Fin del/);
    }
  });

  it("draws no marker for an end with no coordinates, and breaks nothing", () => {
    evento = conTramo({ id: 12, name: "Sucre", lat: null, lng: null });
    pintar();

    const marcadores = screen.getAllByTestId("marcador");
    expect(marcadores).toHaveLength(1);
    expect(marcadores[0]).toHaveTextContent("Potosí");
  });
});

/**
 * Moving from one incident to another, on the same mounted page.
 *
 * The page keeps the poles, ends and route of the incident it drew in its own
 * state. Nothing remounts it when the route parameter changes, so what the
 * first incident drew has to be taken down by hand, and an answer still in
 * flight for it must not land on the second.
 */
const POSTE_DEL_TRAMO = (id: number, name: string, lat: number) => ({
  id, name, lat, lng: -65.6, id_tramo: 14,
  tramo: { id: 14, nombre: "Potosí – Sucre", ciudades: [POTOSI, SUCRE], id_departamento: null, departamento: null, archivado: false },
});

const eventoDe = (poste: Record<string, unknown>) =>
  ({
    id: 6, description: "Otro", image: "", state: false, priority: false, date: new Date("2026-01-06"),
    id_poste: poste.id, poste,
  }) as unknown as EventoInterface;

describe("moving to another incident", () => {
  it.each([
    ["has no tramo", { id: 41, name: "P-002", lat: -19.3, lng: -65.5 }],
    ["has no coordinates", {
      id: 41, name: "P-002", lat: null, lng: null, id_tramo: 14,
      tramo: { id: 14, nombre: "Potosí – Sucre", ciudades: [POTOSI, SUCRE], id_departamento: null, departamento: null, archivado: false },
    }],
  ])("takes the previous incident's line and poles down when the new pole %s", async (_motivo, posteNuevo) => {
    getPostesDelTramo.mockResolvedValue([POSTE_DEL_TRAMO(42, "P-VECINO", -19.2)]);
    evento = conTramo();
    const { rerender } = pintar();
    expect(await screen.findByTestId("linea")).toBeTruthy();
    expect(screen.getByText("Poste P-VECINO")).toBeTruthy();

    evento = eventoDe(posteNuevo);
    rerender(
      <MemoryRouter>
        <SesionContext.Provider
          value={{ sesion: { usuario: usuarioExample, autenticado: true }, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
        >
          <EventoDetallePage />
        </SesionContext.Provider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryByTestId("linea")).toBeNull());
    expect(screen.queryByText("Poste P-VECINO")).toBeNull();
  });

  it("does not let a slow answer for the previous incident land on the new one", async () => {
    const respuestas: Record<number, (postes: unknown[]) => void> = {};
    getPostesDelTramo.mockImplementation(
      (idTramo: number) => new Promise((resolver) => { respuestas[idTramo] = resolver; }),
    );
    const tramo = (id: number, nombre: string) =>
      ({ id, nombre, ciudades: [POTOSI, SUCRE], id_departamento: null, departamento: null, archivado: false });

    evento = eventoDe({ id: 40, name: "P-A", lat: -19.3, lng: -65.5, id_tramo: 14, tramo: tramo(14, "Potosí – Sucre") });
    // A new element each time: React would skip re-rendering the same one.
    const arbol = () => (
      <MemoryRouter>
        <SesionContext.Provider
          value={{ sesion: { usuario: usuarioExample, autenticado: true }, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
        >
          <EventoDetallePage />
        </SesionContext.Provider>
      </MemoryRouter>
    );
    const { rerender } = render(arbol());
    await waitFor(() => expect(getPostesDelTramo).toHaveBeenCalledWith(14));

    evento = eventoDe({ id: 50, name: "P-B", lat: -19.4, lng: -65.4, id_tramo: 15, tramo: tramo(15, "Potosí – Oruro") });
    rerender(arbol());
    await waitFor(() => expect(getPostesDelTramo).toHaveBeenCalledWith(15));

    respuestas[15]([{ id: 51, name: "VECINO-B", lat: -19.35, lng: -65.45 }]);
    expect(await screen.findByText("Poste VECINO-B")).toBeTruthy();
    // The first one answers last.
    respuestas[14]([{ id: 41, name: "VECINO-A", lat: -19.25, lng: -65.55 }]);
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.queryByText("Poste VECINO-A")).toBeNull();
    expect(screen.getByText("Poste VECINO-B")).toBeTruthy();
  });
});

describe("the data of an incident, on its summary", () => {
  it("leads to the pole's sheet and to the tramo's card, and says the tramo's department", () => {
    evento = conTramo();
    (evento.poste as { tramo: { departamento: unknown } }).tramo.departamento = { id: 3, name: "Chuquisaca" };
    pintar();

    const datos = screen.getByRole("region", { name: "Datos" });
    expect(within(datos).getByRole("link", { name: "P-001" })).toHaveAttribute("href", "/app/postes/40");
    expect(within(datos).getByRole("link", { name: "Potosí – Sucre" })).toHaveAttribute("href", "/app/tramos/14");
    expect(within(datos).getByText("Chuquisaca")).toBeInTheDocument();
  });

  it("names an archived tramo without linking to it: it has no card to open", () => {
    evento = conTramo();
    (evento.poste as { tramo: { archivado: boolean } }).tramo.archivado = true;
    pintar();

    const datos = screen.getByRole("region", { name: "Datos" });
    expect(within(datos).getByText("Potosí – Sucre")).toBeInTheDocument();
    expect(within(datos).queryByRole("link", { name: "Potosí – Sucre" })).toBeNull();
  });

  it("writes the opening date with its month in letters, as the pole's sheet does", () => {
    evento = { ...conTramo(), date: new Date("2026-01-05T12:00:00") } as EventoInterface;
    pintar();

    expect(within(screen.getByRole("region", { name: "Datos" })).getByText("05 ene 2026")).toBeInTheDocument();
  });
});
