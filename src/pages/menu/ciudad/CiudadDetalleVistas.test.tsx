// The city's sheet shows one thing at a time beside its map, chosen on a rail:
// the summary or the audit log. The summary is where the city is edited — its
// name, its photo, its position — and where its tramos are listed.
//
// The log sits behind its own permission: its endpoint asks for `bitacora.ver`, which the seeded Coordinador and
// Cliente roles do not hold — a Bitácora tab was drawn for them anyway, holding
// nothing but "No tiene permiso para ver la bitácora".

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CiudadDetallePage from "./CiudadDetallePage";
import { SesionContext } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";
import type { PosteInterface } from "../../../interfaces/interfaces";

const getPosteByCiudad = vi.fn();
const getTramos = vi.fn();
const editCiudad = vi.fn();
/** Where the next press on the mocked map lands. */
let clic = { lat: -19.6, lng: -65.7 };
let negados: string[] = [];

const POTOSI = { id: 11, name: "Potosí", lat: -19.58, lng: -65.75 };
const SUCRE = { id: 12, name: "Sucre", lat: -19.03, lng: -65.26 };
const T14 = { id: 14, nombre: "Potosí – Sucre", ciudades: [POTOSI, SUCRE], id_departamento: null, departamento: null, archivado: false };
const poste = (id: number) =>
  ({ id, name: `P-${id}`, lat: -19.3, lng: -65.5, id_tramo: T14.id, tramo: T14 }) as unknown as PosteInterface;

vi.mock("../../../api/Ciudad.api", () => ({
  searchCiudad: () => Promise.resolve({ id: 11, name: "Potosí", lat: -19.58, lng: -65.75, image: "" }),
  editCiudad: (...a: unknown[]) => editCiudad(...a),
  // The other cities the sheet's map draws; none here.
  getCiudad: () => Promise.resolve([]),
}));
vi.mock("../../../api/Poste.api", () => ({ getPosteByCiudad: (...a: unknown[]) => getPosteByCiudad(...a) }));
vi.mock("../../../api/Tramo.api", () => ({ getTramos: (...a: unknown[]) => getTramos(...a) }));
// The map as a button: a press on it is a press on the map, when the page listens.
vi.mock("../../../components/map/BaseMap", () => ({
  default: ({ onMapClick, cursor }: { onMapClick?: (p: { lat: number; lng: number }) => void; cursor?: string }) => (
    <button type="button" data-cursor={cursor ?? "mano"} onClick={() => onMapClick?.(clic)}>mapa</button>
  ),
}));
vi.mock("../../../components/BitacoraPanel", () => ({ default: () => <div>panel-bitacora</div> }));
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: (_rol: unknown, modulo: string) => !negados.includes(modulo),
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
        </Routes>
      </SesionContext.Provider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  negados = [];
  getPosteByCiudad.mockResolvedValue([poste(1), poste(2)]);
  getTramos.mockResolvedValue([]);
  editCiudad.mockResolvedValue({});
  clic = { lat: -19.6, lng: -65.7 };
});

describe("the views of a city's sheet", () => {
  it("opens on the summary, with the city's name and what can be done to it", async () => {
    pintar();

    expect(await screen.findByRole("heading", { name: "Potosí" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
    // Nothing to refresh with: the browser already has that.
    expect(screen.queryByRole("button", { name: "Refrescar" })).toBeNull();
  });

  it("has no view of the poles by tramo: the summary lists the tramos instead", async () => {
    pintar();

    await screen.findByRole("heading", { name: "Potosí" });
    expect(screen.queryByRole("tab", { name: /Postes por tramo/ })).toBeNull();
    expect(screen.getAllByRole("tab").map((t) => t.getAttribute("aria-label"))).toEqual(["Resumen", "Bitácora"]);
  });

  it("is one card: no card inside the panel in any view, and the record is always open", async () => {
    const user = userEvent.setup();
    pintar();

    await screen.findByRole("heading", { name: "Potosí" });
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("data-slot", "card");
    // The record is simply there under the name: nothing to fold, and no
    // title saying "Ficha" over the only thing the summary holds.
    expect(screen.queryByRole("heading", { name: "Ficha" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Ficha/ })).toBeNull();
    expect(screen.getByLabelText("Latitud")).toBeInTheDocument();

    for (const vista of [null, "Bitácora"]) {
      if (vista) await user.click(screen.getByRole("tab", { name: vista }));
      expect(panel.querySelector('[data-slot="card"]')).toBeNull();
    }
  });

  it("offers the log to a role that may read it, and asks for it only when opened", async () => {
    const user = userEvent.setup();
    pintar();

    await screen.findByRole("heading", { name: "Potosí" });
    expect(screen.queryByText("panel-bitacora")).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Bitácora" }));
    expect(screen.getByText("panel-bitacora")).toBeInTheDocument();
  });

  it("does not offer the log to a role that cannot read it", async () => {
    negados = ["bitacora"];
    pintar();

    await screen.findByRole("heading", { name: "Potosí" });
    expect(screen.queryByRole("tab", { name: "Bitácora" })).toBeNull();
    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("does not ask for the poles, nor show their figures, without `postes.ver`", async () => {
    negados = ["postes"];
    pintar();

    await screen.findByRole("heading", { name: "Potosí" });
    expect(getPosteByCiudad).not.toHaveBeenCalled();
    expect(screen.queryByText("Ciudades conectadas")).toBeNull();
    // The sheet itself still opens, with its record.
    expect(screen.getByLabelText("Latitud")).toBeInTheDocument();
  });
});

describe("the tramos of a city, under its record", () => {
  const ORURO = { id: 13, name: "Oruro", lat: -17.97, lng: -67.11 };
  const red = [
    { ...T14, id_departamento: 3, departamento: { id: 3, name: "Chuquisaca" }, postes: 193, pendientes: 2 },
    // No poles yet: the groups made of poles would never show this one.
    { id: 15, nombre: "Oruro – Potosí", ciudades: [ORURO, POTOSI], id_departamento: null, departamento: null, archivado: false, postes: 0, pendientes: 0 },
    // Not this city's.
    { id: 16, nombre: "Oruro – Sucre", ciudades: [ORURO, SUCRE], id_departamento: null, departamento: null, archivado: false, postes: 4, pendientes: 0 },
  ];

  it("lists the tramos that have this city at one end, each a link to its own card, where it is edited", async () => {
    getTramos.mockResolvedValue(red);
    pintar();

    const lista = await screen.findByRole("list", { name: "Tramos de esta ciudad" });
    const enlaces = within(lista).getAllByRole("link");
    expect(enlaces.map((a) => a.getAttribute("href"))).toEqual(["/app/tramos/14", "/app/tramos/15"]);
    expect(enlaces[0]).toHaveTextContent("Potosí – Sucre");
    expect(enlaces[0]).toHaveTextContent("Chuquisaca");
    // The row of the Tramos screen: the name, and one line under it.
    expect(enlaces[0]).toHaveTextContent("Chuquisaca · 193 postes · 2 pendientes");
    expect(enlaces[1]).toHaveTextContent("Sin departamento · 0 postes · sin pendientes");
    expect(screen.queryByText("Oruro – Sucre")).toBeNull();
  });

  it("says so when the city is at the end of none", async () => {
    getTramos.mockResolvedValue([red[2]]);
    pintar();

    expect(await screen.findByText("Esta ciudad no está en ningún tramo.")).toBeInTheDocument();
  });

  it("says the list could not be read, and still shows the city, when the tramos fail", async () => {
    getTramos.mockRejectedValue(new Error("500"));
    pintar();

    expect(await screen.findByText("No se pudieron cargar los tramos.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Potosí" })).toBeInTheDocument();
    expect(screen.getByLabelText("Latitud")).toBeInTheDocument();
  });

  it("neither asks for them nor titles them without `tramos.ver`", async () => {
    negados = ["tramos"];
    getTramos.mockResolvedValue(red);
    pintar();

    await screen.findByRole("heading", { name: "Potosí" });
    expect(getTramos).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: /Tramos/ })).toBeNull();
  });
});

describe("editing a city on its own sheet", () => {
  /** The name's field, opened with its pencil. */
  const nombre = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("button", { name: "Editar nombre" }));
    return screen.getByRole("textbox", { name: "Nombre de la ciudad" });
  };

  it("has no «Editar» and no dialog: the name is a title until its pencil is pressed, and the save pair waits for a change", async () => {
    const user = userEvent.setup();
    pintar();

    expect(await screen.findByRole("heading", { name: "Potosí" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Nombre de la ciudad" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();

    const campo = await nombre(user);
    expect(campo).toHaveValue("Potosí");
    expect(campo).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();

    await user.type(campo, " Nueva");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descartar cambios" })).toBeInTheDocument();
  });

  it("goes back to a title on leaving the field, keeping what was typed", async () => {
    const user = userEvent.setup();
    pintar();

    await user.type(await nombre(user), " Nueva");
    await user.tab();

    expect(screen.queryByRole("textbox", { name: "Nombre de la ciudad" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Potosí Nueva" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
  });

  it("puts the name back on Escape and saves on Enter", async () => {
    const user = userEvent.setup();
    pintar();

    await user.type(await nombre(user), " Nueva{Escape}");
    expect(screen.getByRole("heading", { name: "Potosí" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();

    await user.type(await nombre(user), " Nueva{Enter}");
    expect(editCiudad.mock.calls[0][0]).toMatchObject({ name: "Potosí Nueva" });
  });

  it("opens the field again under the error of a name it refused", async () => {
    const user = userEvent.setup();
    pintar();

    const campo = await nombre(user);
    await user.clear(campo);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(screen.getByText("El nombre es requerido")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nombre de la ciudad" })).toBeInvalid();
    expect(editCiudad).not.toHaveBeenCalled();
  });

  it("saves the name with the position it had, as one write", async () => {
    const user = userEvent.setup();
    pintar();

    await user.type(await nombre(user), " Nueva");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(editCiudad).toHaveBeenCalledTimes(1);
    expect(editCiudad.mock.calls[0][0]).toMatchObject({ id: 11, name: "Potosí Nueva", lat: -19.58, lng: -65.75 });
  });

  it("discards back to the city", async () => {
    const user = userEvent.setup();
    pintar();

    await user.type(await nombre(user), " Nueva");
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));

    expect(screen.getByRole("heading", { name: "Potosí" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Nombre de la ciudad" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
    expect(editCiudad).not.toHaveBeenCalled();
  });

  it("moves the city with the next press on the map only once «Mover en el mapa» armed it", async () => {
    const user = userEvent.setup();
    pintar();
    await screen.findByRole("heading", { name: "Potosí" });

    // Unarmed: a press on the map is not a move.
    await user.click(screen.getByRole("button", { name: "mapa" }));
    expect(screen.getByLabelText("Latitud")).toHaveValue(-19.58);

    expect(screen.getByRole("button", { name: "mapa" })).toHaveAttribute("data-cursor", "mano");
    await user.click(screen.getByRole("button", { name: "Mover en el mapa" }));
    expect(screen.getByRole("status")).toHaveTextContent("Pulsa en el mapa para colocar la ciudad");
    // The pointer says the next press places something.
    expect(screen.getByRole("button", { name: "mapa" })).toHaveAttribute("data-cursor", "crosshair");
    await user.click(screen.getByRole("button", { name: "mapa" }));
    expect(screen.getByRole("button", { name: "mapa" })).toHaveAttribute("data-cursor", "mano");

    expect(screen.getByLabelText("Latitud")).toHaveValue(-19.6);
    expect(screen.getByLabelText("Longitud")).toHaveValue(-65.7);
    // One press, one move: the map is unarmed again, and nothing is saved yet.
    expect(screen.queryByRole("status")).toBeNull();
    clic = { lat: 1, lng: 1 };
    await user.click(screen.getByRole("button", { name: "mapa" }));
    expect(screen.getByLabelText("Latitud")).toHaveValue(-19.6);
    expect(editCiudad).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(editCiudad.mock.calls[0][0]).toMatchObject({ name: "Potosí", lat: -19.6, lng: -65.7 });
  });

  it("arms nothing once cancelled", async () => {
    const user = userEvent.setup();
    pintar();
    await screen.findByRole("heading", { name: "Potosí" });

    await user.click(screen.getByRole("button", { name: "Mover en el mapa" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "mapa" }));

    expect(screen.getByLabelText("Latitud")).toHaveValue(-19.58);
  });

  it("is read, not edited, by a role without `ciudades.editar`", async () => {
    negados = ["ciudades"];
    pintar();

    expect(await screen.findByRole("heading", { name: "Potosí" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar nombre" })).toBeNull();
    expect(screen.queryByText("Cambiar foto")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mover en el mapa" })).toBeNull();
    expect(screen.queryByLabelText("Latitud")).toBeNull();
    expect(screen.getByText("-19.580000, -65.750000")).toBeInTheDocument();
  });
});
