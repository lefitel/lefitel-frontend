// A city can be archived from its own sheet, and not only from the list. It
// has a permission of its own, apart from editing, and the server may refuse —
// a city that still holds a tramo — in which case the sheet stays and says why.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CiudadDetallePage from "./CiudadDetallePage";
import { SesionContext } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";

const searchCiudad = vi.fn();
const deleteCiudad = vi.fn();
/** The actions this session holds on `ciudades`. */
let acciones: string[] = [];

vi.mock("../../../api/Ciudad.api", () => ({
  searchCiudad: (...a: unknown[]) => searchCiudad(...a),
  deleteCiudad: (...a: unknown[]) => deleteCiudad(...a),
  // The other cities the sheet's map draws; none here.
  getCiudad: () => Promise.resolve([]),
}));
vi.mock("../../../api/Poste.api", () => ({ getPosteByCiudad: () => Promise.resolve([]) }));
vi.mock("../../../api/Tramo.api", () => ({ getTramos: () => Promise.resolve([]) }));
vi.mock("../../../components/map/BaseMap", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../components/map/MapPoint", () => ({ default: () => null }));
vi.mock("../../../components/map/SonarMarker", () => ({ SonarMarker: () => null }));
vi.mock("../../../components/map/useFitCoords", () => ({ FitView: () => null }));
vi.mock("../../../components/BitacoraPanel", () => ({ default: () => null }));
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: (_rol: unknown, modulo: string, accion: string) => modulo !== "ciudades" || acciones.includes(accion),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const pintar = () =>
  render(
    <MemoryRouter initialEntries={["/app/ciudades/11"]}>
      <SesionContext.Provider
        value={{ sesion: { usuario: usuarioExample, autenticado: true }, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <Routes>
          <Route path="/app/ciudades/:id" element={<CiudadDetallePage />} />
          <Route path="/app/ciudades" element={<p>la lista de ciudades</p>} />
        </Routes>
      </SesionContext.Provider>
    </MemoryRouter>,
  );

const boton = () => screen.findByRole("button", { name: "Archivar" });

beforeEach(() => {
  vi.clearAllMocks();
  acciones = ["ver", "editar", "archivar"];
  searchCiudad.mockResolvedValue({ id: 11, name: "Potosí", lat: -19.58, lng: -65.75, image: "" });
  deleteCiudad.mockResolvedValue(undefined);
});

describe("archiving a city from its sheet", () => {
  it("is not offered without ciudades.archivar", async () => {
    acciones = ["ver", "editar"];
    pintar();

    await screen.findByRole("heading", { name: "Potosí" });
    expect(screen.queryByRole("button", { name: "Archivar" })).not.toBeInTheDocument();
  });

  it("is offered to a session that may archive and not edit", async () => {
    acciones = ["ver", "archivar"];
    pintar();

    expect(await boton()).toBeInTheDocument();
  });

  it("asks first, naming the city, and sends nothing until it is confirmed", async () => {
    const user = userEvent.setup();
    pintar();

    await user.click(await boton());
    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo).toHaveTextContent("Potosí");
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(deleteCiudad).not.toHaveBeenCalled();
  });

  it("archives the city being looked at and leaves for the list", async () => {
    const user = userEvent.setup();
    pintar();

    await user.click(await boton());
    const dialogo = await screen.findByRole("alertdialog");
    await user.click(within(dialogo).getByRole("button", { name: "Archivar" }));

    await waitFor(() => expect(deleteCiudad).toHaveBeenCalledWith(11));
    expect(await screen.findByText("la lista de ciudades")).toBeInTheDocument();
  });

  it("stays on the sheet and shows the server's reason when it refuses", async () => {
    const user = userEvent.setup();
    deleteCiudad.mockRejectedValue({ response: { status: 409, data: { message: "La ciudad tiene tramos" } } });
    pintar();

    await user.click(await boton());
    const dialogo = await screen.findByRole("alertdialog");
    await user.click(within(dialogo).getByRole("button", { name: "Archivar" }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByText("la lista de ciudades")).not.toBeInTheDocument();
  });
});
