// The pole's map draws the two cities of its tramo and the line between them,
// all from `poste.tramo`. "Editar ciudad" cannot hand the dialog the city any
// more — the pole carries only `id`, `name`, `lat`, `lng` per end — so it asks
// the server for the whole city first, and these tests pin the three ways that
// can end.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PosteDetalleMap from "./PosteDetalleMap";
import type { PosteInterface } from "../../../../interfaces/interfaces";

const searchCiudad = vi.fn();
const toastError = vi.fn();

vi.mock("../../../../api/Ciudad.api", () => ({ searchCiudad: (...a: unknown[]) => searchCiudad(...a) }));
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));
// The map itself is somebody else's test: what is drawn is what is handed over.
vi.mock("../../../../components/map/BaseMap", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../components/map/MapPoint", () => ({
  default: ({ children, center }: { children: React.ReactNode; center: { lat: number; lng: number } }) => (
    <div data-testid="extremo" data-lat={center.lat}>{children}</div>
  ),
}));
vi.mock("../../../../components/map/MapLine", () => ({ default: () => null }));
vi.mock("../../../../components/map/SonarMarker", () => ({ SonarMarker: () => null }));
vi.mock("../../../../components/map/useFitCoords", () => ({ FitView: () => null }));

const POTOSI = { id: 11, name: "Potosí", lat: -19.58, lng: -65.75 };
const SUCRE = { id: 12, name: "Sucre", lat: -19.03, lng: -65.26 };

const poste = (ciudades: [typeof POTOSI, typeof SUCRE] | [typeof POTOSI, { id: number; name: string; lat: null; lng: null }]) =>
  ({
    id: 40, name: "P-001", lat: -19.3, lng: -65.5, id_tramo: 14,
    tramo: { id: 14, nombre: "Potosí – Sucre", ciudades, id_departamento: null, departamento: null, archivado: false },
  }) as unknown as PosteInterface;

const pintar = (p: PosteInterface, over: Partial<React.ComponentProps<typeof PosteDetalleMap>> = {}) => {
  const props = {
    loading: false, poste: p, eventos: [], tramoPosotes: [], routePath: [], boundsCoords: [],
    onVerCiudad: vi.fn(), onEditarCiudad: vi.fn(), onVerPoste: vi.fn(),
    onEditarOtroPoste: vi.fn(), onEditarEstePoste: vi.fn(),
    canEditPostes: true, canEditCiudades: true, ...over,
  };
  const out = render(<PosteDetalleMap {...props} />);
  return { ...props, ...out };
};

beforeEach(() => vi.clearAllMocks());

describe("the two ends of the tramo on a pole's map", () => {
  it("draws one marker per city of poste.tramo, named, and 'Ver ciudad' goes to that city", async () => {
    const user = userEvent.setup();
    const props = pintar(poste([POTOSI, SUCRE]));

    const marcadores = screen.getAllByTestId("extremo");
    expect(marcadores).toHaveLength(2);
    expect(marcadores[0]).toHaveTextContent("Potosí");
    expect(marcadores[1]).toHaveTextContent("Sucre");

    await user.click(screen.getAllByRole("button", { name: "Ver ciudad" })[1]);
    expect(props.onVerCiudad).toHaveBeenCalledWith(12);
  });

  it("labels both ends 'Extremo del tramo': a tramo has no start and no end", () => {
    pintar(poste([POTOSI, SUCRE]));

    for (const marcador of screen.getAllByTestId("extremo")) {
      expect(marcador).toHaveTextContent("Extremo del tramo");
      expect(marcador.textContent).not.toMatch(/Inicio|Fin del/);
    }
  });

  it("draws no marker for an end with no coordinates, and the other one still appears", () => {
    pintar(poste([POTOSI, { id: 12, name: "Sucre", lat: null, lng: null }]));

    const marcadores = screen.getAllByTestId("extremo");
    expect(marcadores).toHaveLength(1);
    expect(marcadores[0]).toHaveTextContent("Potosí");
  });

  it("draws nothing for a pole that came without a tramo, and does not throw", () => {
    pintar({ id: 40, name: "P-001", lat: -19.3, lng: -65.5 } as unknown as PosteInterface);

    expect(screen.queryAllByTestId("extremo")).toHaveLength(0);
  });
});

describe("'Editar' on a city of the map", () => {
  // The first city's control, found by its marker: its name changes while it loads.
  const editar = () => within(screen.getAllByTestId("extremo")[0]).getByRole("button", { name: /Editar|Cargando/ });

  it("fetches the whole city, shows loading on the button meanwhile, and then hands it over", async () => {
    const user = userEvent.setup();
    let resolver!: (c: unknown) => void;
    searchCiudad.mockReturnValue(new Promise((r) => { resolver = r; }));
    const props = pintar(poste([POTOSI, SUCRE]));

    await user.click(editar());

    expect(searchCiudad).toHaveBeenCalledWith(11);
    await waitFor(() => expect(editar()).toBeDisabled());
    expect(editar()).toHaveTextContent("Cargando");
    expect(props.onEditarCiudad).not.toHaveBeenCalled();

    const completa = { ...POTOSI, image: "x.png" };
    resolver(completa);
    await waitFor(() => expect(props.onEditarCiudad).toHaveBeenCalledWith(completa));
    await waitFor(() => expect(editar()).not.toBeDisabled());
    expect(editar()).toHaveTextContent("Editar");
  });

  it("says the server's sentence and opens nothing when the role may not read cities (403)", async () => {
    const user = userEvent.setup();
    searchCiudad.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: "No tiene permiso para ver ciudades" } },
    });
    const props = pintar(poste([POTOSI, SUCRE]));

    await user.click(editar());

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("No tiene permiso para ver ciudades"));
    expect(props.onEditarCiudad).not.toHaveBeenCalled();
    await waitFor(() => expect(editar()).not.toBeDisabled());
  });

  it("says something and opens nothing when the request fails", async () => {
    const user = userEvent.setup();
    searchCiudad.mockRejectedValue(new Error("Network Error"));
    const props = pintar(poste([POTOSI, SUCRE]));

    await user.click(editar());

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("No se pudo cargar la ciudad."));
    expect(props.onEditarCiudad).not.toHaveBeenCalled();
    await waitFor(() => expect(editar()).not.toBeDisabled());
  });

  it("is not offered to a role that may not edit cities", () => {
    pintar(poste([POTOSI, SUCRE]), { canEditCiudades: false });

    expect(screen.queryAllByRole("button", { name: "Editar" }).filter((b) => b.closest("[data-testid=extremo]"))).toHaveLength(0);
  });
});
