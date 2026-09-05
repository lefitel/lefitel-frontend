// Registering an incident from the map, which asks two different questions.
//
// This sheet needs the observation catalogue and the pole register, and they do
// **not** come from the same place: `/api/evento/opciones` deliberately carries
// no `poste` block, because serving the pole register under `eventos.ver` would
// be a worse problem than the round trip it saves. The register still arrives
// through `?export=true`, and retiring that is C3's decision.
//
// So the thing worth pinning here is that the two stay apart. They shared one
// `Promise.all` and one `.catch` before C2: either failing emptied all three
// lists, which will matter more the day C5 puts a permission on the pole list —
// a role allowed to create incidents but not to read poles would lose the
// entire form, and be told "Error al cargar los datos" for a refusal that is
// permanent.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddEventoPageSheet from "./AddEventoPageSheet";
import { SesionContext } from "../../context/SesionContext";
import { usuarioExample } from "../../data/example";

const getOpcionesEvento = vi.fn();
const todosLosPostes = vi.fn();
const getObs = vi.fn();
const getTipoObs = vi.fn();

vi.mock("../../api/opciones.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/opciones.api")>()),
  getOpcionesEvento: () => getOpcionesEvento(),
}));
vi.mock("../../api/Poste.api", () => ({ todosLosPostes: (...a: unknown[]) => todosLosPostes(...a) }));
vi.mock("../../api/Evento.api", () => ({ createEvento: vi.fn() }));
vi.mock("../../api/Upload.api", () => ({ uploadImage: vi.fn() }));
// The two this sheet used to call.
vi.mock("../../api/Obs.api", () => ({ getObs: (...a: unknown[]) => getObs(...a) }));
vi.mock("../../api/TipoObs.api", () => ({ getTipoObs: (...a: unknown[]) => getTipoObs(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

const OPCIONES = {
  obs: [{ id: 5, name: "Poste inclinado", id_tipoObs: 2 }],
  tipoObs: [{ id: 2, name: "Estructura" }],
};

const POSTES = [{
  id: 40, name: "P-001", image: "", date: new Date("2026-01-05"),
  lat: -18.0, lng: -70.2, id_adss: 3, id_material: 7, id_propietario: 2,
  id_ciudadA: 11, id_ciudadB: 12, id_usuario: 1,
}];

beforeEach(() => {
  vi.clearAllMocks();
  getOpcionesEvento.mockResolvedValue(OPCIONES);
  todosLosPostes.mockResolvedValue(POSTES);
});

const sesion = { usuario: usuarioExample, autenticado: true };
const pintar = () =>
  render(
    <SesionContext.Provider
      value={{ sesion, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
    >
      <AddEventoPageSheet open setOpen={vi.fn()} onSuccess={vi.fn()} />
    </SesionContext.Provider>,
  );

describe("the two questions it asks", () => {
  it("gets the observations from the options endpoint, never from the old catalogues", async () => {
    pintar();

    await waitFor(() => expect(getOpcionesEvento).toHaveBeenCalledTimes(1));
    expect(getObs, "la ficha volvió a pedir /api/obs/").not.toHaveBeenCalled();
    expect(getTipoObs, "la ficha volvió a pedir /api/tipo-obs/").not.toHaveBeenCalled();
  });

  it("still asks for the pole register separately, which is C3's to change", async () => {
    pintar();

    await waitFor(() => expect(todosLosPostes).toHaveBeenCalled());
  });

  it("groups each observation under its type", async () => {
    pintar();

    await userEvent.click(await screen.findByRole("button", { name: /Estructura/i }));

    expect(await screen.findByText("Poste inclinado")).toBeTruthy();
  });
});

describe("when one of the two fails", () => {
  it("keeps the observations when it is the pole register that failed", async () => {
    // The separation, asserted from the side that used to lose everything.
    todosLosPostes.mockRejectedValue(new Error("Network Error"));

    pintar();

    await userEvent.click(await screen.findByRole("button", { name: /Estructura/i }));
    expect(await screen.findByText("Poste inclinado")).toBeTruthy();
  });

  it("says why the accordion is empty when the observations are refused", async () => {
    getOpcionesEvento.mockRejectedValue({ response: { status: 403 } });

    pintar();

    expect(await screen.findByText(/No tiene permiso para consultar las observaciones/i)).toBeTruthy();
    expect(screen.queryByText("Sin observaciones configuradas.")).toBeNull();
  });
});
