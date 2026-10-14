// The city's sheet draws the other cities on its map, and choosing one moves
// the sheet there without building the map again.
//
// The route used to be keyed by the city, so going from one city to the next
// tore the whole page down — the map with its tiles included — and built it
// again from nothing.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CiudadDetallePage from "./CiudadDetallePage";
import { SesionContext } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";

const POTOSI = { id: 11, name: "Potosí", lat: -19.58, lng: -65.75, image: "", postes: 3 };
const SUCRE = { id: 12, name: "Sucre", lat: -19.03, lng: -65.26, image: "", postes: 1 };
const ORURO_SIN_SITIO = { id: 13, name: "Oruro", lat: 0, lng: 0, image: "" };
let montajesDelMapa = 0;

vi.mock("../../../api/Ciudad.api", () => ({
  searchCiudad: (id: number) => Promise.resolve(id === 12 ? SUCRE : POTOSI),
  getCiudad: () => Promise.resolve([POTOSI, SUCRE, ORURO_SIN_SITIO]),
}));
vi.mock("../../../api/Poste.api", () => ({ getPosteByCiudad: () => Promise.resolve([]) }));
vi.mock("../../../api/Tramo.api", () => ({ getTramos: () => Promise.resolve([]) }));
vi.mock("../../../components/map/BaseMap", () => ({
  default: function MapaFalso({ children }: { children: React.ReactNode }) {
    useEffect(() => { montajesDelMapa++; }, []);
    return <div>{children}</div>;
  },
}));
vi.mock("../../../components/map/MapPoint", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="punto">{children}</div>,
}));
vi.mock("../../../components/map/SonarMarker", () => ({ SonarMarker: () => null }));
vi.mock("../../../components/map/useFitCoords", () => ({ FitView: () => null }));
vi.mock("../../../components/BitacoraPanel", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const pintar = () =>
  render(
    <MemoryRouter initialEntries={["/app/ciudades/11"]}>
      <SesionContext.Provider
        value={{ sesion: { usuario: usuarioExample, autenticado: true }, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <Routes>
          <Route path="/app/ciudades/:id" element={<CiudadDetallePage />} />
        </Routes>
      </SesionContext.Provider>
    </MemoryRouter>,
  );

beforeEach(() => { montajesDelMapa = 0; });

describe("the other cities on a city's map", () => {
  it("are drawn, all but the one on the sheet and one with no position", async () => {
    pintar();

    expect(await screen.findByRole("heading", { name: "Potosí" })).toBeInTheDocument();
    const ver = await screen.findAllByRole("button", { name: "Ver ciudad" });
    expect(ver).toHaveLength(1);
    expect(screen.getByText("Sucre")).toBeInTheDocument();
    expect(screen.getByText("1 poste")).toBeInTheDocument();
    expect(screen.queryByText("Oruro")).toBeNull();
  });

  it("lead to their own sheet, which takes the place of this one on the same map", async () => {
    const user = userEvent.setup();
    pintar();

    await user.click(await screen.findByRole("button", { name: "Ver ciudad" }));

    expect(await screen.findByRole("heading", { name: "Sucre" })).toBeInTheDocument();
    // Potosí is one of the others now, a press away.
    expect(screen.getByText("Potosí")).toBeInTheDocument();
    // And the map was built once, for both.
    expect(montajesDelMapa).toBe(1);
  });
});
