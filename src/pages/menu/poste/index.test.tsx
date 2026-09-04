// The pole list's two inline dropdowns, which used to fail in complete silence.
//
// Material and Propietario are editable from the table itself. Their two lists
// were loaded with `.catch(() => { /* silent: dropdowns just won't populate */ })`.
// Since C2 they come from `/api/poste/opciones`, and whatever the reason a
// refusal or a network failure is, silence turns it into a menu that opens with
// nothing in it and no way to find out why. (The screen itself sits behind
// `postes.ver` through `<ModuleRoute>`, so the *refused* case is not reachable
// from here — it costs one branch and the screen should not have to know which
// gate protects it.)
//
// The third state matters as much as the other two: a catalogue that is
// legitimately empty must not say "Cargando…" for ever, which is the same class
// of lie this task removed from the pole sheet's "Sin ADSS registradas".
//
// The second thing pinned here is the one no other test can see: the cell's
// name is now resolved from the catalogue against `id_material`, which is what
// lets the optimistic update move only the id. Before C2 it wrote a whole
// `MaterialInterface` into the row — a shape the catalogue no longer hands
// back, and one this screen has in fact never received, since `GET /api/poste/`
// projects the association to `{id, name}` too.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import PostePage from "./index";
import { SesionContext } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";

const getOpcionesPoste = vi.fn();
const getPoste = vi.fn();
const exportPostes = vi.fn();
const editPoste = vi.fn();
const getMaterial = vi.fn();
const getPropietario = vi.fn();

vi.mock("../../../api/opciones.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/opciones.api")>()),
  getOpcionesPoste: () => getOpcionesPoste(),
}));
vi.mock("../../../api/Poste.api", () => ({
  getPoste: (...a: unknown[]) => getPoste(...a),
  exportPostes: (...a: unknown[]) => exportPostes(...a),
  editPoste: (...a: unknown[]) => editPoste(...a),
  searchPoste: vi.fn(),
  deletePoste: vi.fn(),
  desarchivarPoste: vi.fn(),
}));
vi.mock("../../../api/Evento.api", () => ({ getEvento_poste: vi.fn() }));
// The two this screen used to call.
vi.mock("../../../api/Material.api", () => ({ getMaterial: (...a: unknown[]) => getMaterial(...a) }));
vi.mock("../../../api/Propietario.api", () => ({ getPropietario: (...a: unknown[]) => getPropietario(...a) }));
// The two sheets are somebody else's tests.
vi.mock("../../../components/dialogs/upsert/PosteSheet", () => ({ default: () => null }));
vi.mock("../../../components/dialogs/upsert/EventoSheet", () => ({ default: () => null }));
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: () => true,
}));
vi.mock("exceljs", () => ({ default: { Workbook: class { } } }));
vi.mock("jspdf", () => ({ default: class { } }));
vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

const OPCIONES = {
  adss: [{ id: 3, name: "Preformado" }],
  material: [{ id: 7, name: "Madera" }, { id: 8, name: "Concreto" }],
  propietario: [{ id: 2, name: "Osefi" }],
  ciudad: [{ id: 11, name: "Tacna", lat: -18.0146, lng: -70.2536 }],
};

/** One row, with the association projected exactly as `GET /api/poste/` sends it. */
const FILA = {
  id: 40, name: "P-001", image: "", date: new Date("2026-01-05"),
  lat: -18.0, lng: -70.2, id_adss: 3, id_material: 7, id_propietario: 2,
  id_ciudadA: 11, id_ciudadB: 12, id_usuario: 1,
  material: { id: 7, name: "Madera" },
  propietario: { id: 2, name: "Osefi" },
};

beforeEach(() => {
  vi.clearAllMocks();
  getOpcionesPoste.mockResolvedValue(OPCIONES);
  getPoste.mockResolvedValue({ data: [FILA], total: 1, page: 1, totalPages: 1, limit: 15 });
  exportPostes.mockResolvedValue([]);
  editPoste.mockResolvedValue({ status: 200 });
});

const sesion = { usuario: usuarioExample, autenticado: true };
const pintar = () =>
  render(
    <MemoryRouter>
      <SesionContext.Provider
        value={{ sesion, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <PostePage />
      </SesionContext.Provider>
    </MemoryRouter>,
  );

/** The cell trigger, found by its title rather than its text, which changes. */
const abrirMaterial = async () => {
  const disparador = await screen.findByTitle("Click para cambiar material");
  await userEvent.click(disparador);
};

describe("where the two inline lists come from", () => {
  it("asks the options endpoint and never the two old catalogues", async () => {
    pintar();

    await waitFor(() => expect(getOpcionesPoste).toHaveBeenCalledTimes(1));
    expect(getMaterial, "la pantalla volvió a pedir /api/material/").not.toHaveBeenCalled();
    expect(getPropietario, "la pantalla volvió a pedir /api/propietario/").not.toHaveBeenCalled();
  });

  it("offers the catalogue as options", async () => {
    pintar();
    await waitFor(() => expect(getOpcionesPoste).toHaveBeenCalled());

    await abrirMaterial();

    expect(await screen.findByRole("menuitem", { name: /Concreto/ })).toBeTruthy();
  });

  it("shows the new material as soon as it is chosen, before the server answers", async () => {
    // What this proves: the cell resolves its name from the catalogue against
    // `id_material`, so moving only the id is enough to repaint it. It does
    // **not** prove the converse — a version that also wrote a nested row would
    // paint the same thing and pass. That one is caught by the compiler, since
    // `MaterialInterface` requires a `description` the catalogue does not
    // carry; the first version of this comment claimed the test caught it.
    // Never settles: the assertion is about what the row shows *before* the
    // server answers, and resolving afterwards would only add a state update
    // outside `act`.
    editPoste.mockReturnValue(new Promise(() => { }));

    pintar();
    await waitFor(() => expect(getOpcionesPoste).toHaveBeenCalled());
    await abrirMaterial();
    await userEvent.click(await screen.findByRole("menuitem", { name: /Concreto/ }));

    await waitFor(() => expect(screen.getByTitle("Click para cambiar material").textContent)
      .toContain("Concreto"));
    expect(editPoste).toHaveBeenCalled();
  });
});

describe("when the lists are refused", () => {
  it("says so inside the menu instead of opening it empty", async () => {
    getOpcionesPoste.mockRejectedValue({ response: { status: 403 } });

    pintar();
    await waitFor(() => expect(getOpcionesPoste).toHaveBeenCalled());
    await abrirMaterial();

    expect(await screen.findByText(/No tiene permiso para consultar los materiales/i)).toBeTruthy();
  });

  it("does not claim to still be loading once the answer is in", async () => {
    // A fresh install, or every material archived. `falloOpciones` stayed null
    // in that case and the menu said "Cargando…" with nothing coming.
    getOpcionesPoste.mockResolvedValue({ ...OPCIONES, material: [] });

    pintar();
    await waitFor(() => expect(getOpcionesPoste).toHaveBeenCalled());
    await abrirMaterial();

    expect(await screen.findByText("Sin materiales registrados.")).toBeTruthy();
    expect(screen.queryByText("Cargando…")).toBeNull();
  });

  it("keeps showing the material the row already had", async () => {
    // The fallback in the cell. Without it, a refusal would blank the column
    // for every pole on screen — turning a permission problem into what looks
    // like missing data.
    getOpcionesPoste.mockRejectedValue({ response: { status: 403 } });

    pintar();

    await waitFor(() => expect(screen.getByTitle("Click para cambiar material").textContent)
      .toContain("Madera"));
  });
});
