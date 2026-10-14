// The city's page groups its poles by tramo and counts the cities it is joined
// to. Both used to read the two city ids a pole carried; the server stopped
// sending them, so the count showed a confident "0" and the groups had no
// title. Now both come from `poste.tramo`.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CiudadDetallePage from "./CiudadDetallePage";
import { SesionContext } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";
import type { PosteInterface } from "../../../interfaces/interfaces";

const searchCiudad = vi.fn();
const getPosteByCiudad = vi.fn();

vi.mock("../../../api/Ciudad.api", () => ({
  searchCiudad: (...a: unknown[]) => searchCiudad(...a),
  // The other cities the sheet's map draws; none here.
  getCiudad: () => Promise.resolve([]),
}));
vi.mock("../../../api/Poste.api", () => ({ getPosteByCiudad: (...a: unknown[]) => getPosteByCiudad(...a) }));
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
  can: () => true,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const POTOSI = { id: 11, name: "Potosí", lat: -19.58, lng: -65.75 };
const SUCRE = { id: 12, name: "Sucre", lat: -19.03, lng: -65.26 };
const ORURO = { id: 13, name: "Oruro", lat: -17.97, lng: -67.11 };

const tramo = (id: number, nombre: string, ciudades: [typeof POTOSI, typeof POTOSI]) =>
  ({ id, nombre, ciudades, id_departamento: null, departamento: null, archivado: false });
const T14 = tramo(14, "Potosí – Sucre", [POTOSI, SUCRE]);
const T15 = tramo(15, "Oruro – Potosí", [ORURO, POTOSI]);
const poste = (id: number, t: typeof T14) =>
  ({ id, name: `P-${id}`, lat: -19.3, lng: -65.5, id_tramo: t.id, tramo: t }) as unknown as PosteInterface;

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

beforeEach(() => {
  vi.clearAllMocks();
  searchCiudad.mockResolvedValue({ ...POTOSI, image: "" });
});

describe("the strip of a city's page", () => {
  it("counts the distinct other cities its poles' tramos reach, not a confident zero", async () => {
    getPosteByCiudad.mockResolvedValue([poste(1, T14), poste(2, T14), poste(3, T15)]);
    pintar();

    const celda = (await screen.findByText("Ciudades conectadas")).closest("div")!.parentElement!;
    // Sucre and Oruro: two poles on the same tramo reach one city, not two.
    await waitFor(() => expect(within(celda).getByText("2")).toBeInTheDocument());
  });

  it("counts one city once even when two tramos reach it, and ignores a pole with no tramo", async () => {
    const otraConSucre = tramo(16, "Sucre – Potosí (otro)", [SUCRE, POTOSI]);
    getPosteByCiudad.mockResolvedValue([
      poste(1, T14), poste(2, otraConSucre),
      { id: 3, name: "P-3", lat: -19.3, lng: -65.5 } as unknown as PosteInterface,
    ]);
    pintar();

    const celda = (await screen.findByText("Ciudades conectadas")).closest("div")!.parentElement!;
    await waitFor(() => expect(within(celda).getByText("1")).toBeInTheDocument());
  });
});

describe("a pole whose tramo does not contain this city", () => {
  it("is not counted as a connection to the tramo's first city", async () => {
    // Stray data: this page is Potosí's, and the tramo is Oruro – Sucre. Reading
    // "the city that is not this one" would count Oruro; the pole says nothing
    // about a connection of Potosí's, so it counts for nothing.
    const ajeno = tramo(17, "Oruro – Sucre", [ORURO, SUCRE]);
    getPosteByCiudad.mockResolvedValue([poste(1, T14), poste(2, ajeno)]);
    pintar();

    const celda = (await screen.findByText("Ciudades conectadas")).closest("div")!.parentElement!;
    // Only Sucre, through the tramo that does contain Potosí.
    await waitFor(() => expect(within(celda).getByText("1")).toBeInTheDocument());
  });
});
