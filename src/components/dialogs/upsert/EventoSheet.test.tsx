// The incident form: its two lists, and the day the server refuses them.
//
// Two defects are pinned here, and the second one is the reason this file
// exists at all.
//
//   - **The observations must still be grouped by type.** Both incident forms
//     build their accordion with `listObs.filter(o => o.id_tipoObs === tipo.id)`.
//     `/api/evento/opciones` carries that column and `/api/reporte/opciones`
//     deliberately does not, so a single shared reader — the obvious tidy-up —
//     empties every group. On screen that is not an error: it reads as "nothing
//     is configured".
//   - **A refused catalogue must not blank the incident.** The two lists used
//     to travel in the same `Promise.all` as the incident, its revisions and its
//     solution. That was harmless while they came from two ungated addresses;
//     now they ask for `eventos.ver`, and this sheet is opened from the pole
//     list and the pole detail page, which are behind `postes.ver` and gate
//     their trigger on `crear`. One refusal used to reject the whole batch and
//     draw the sheet completely empty — no description, no revisions, no
//     solution — for an incident the role is entitled to read.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import EventoSheet from "./EventoSheet";
import { SesionContext } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";

const getOpcionesEvento = vi.fn();
const searchEvento = vi.fn();
const getRevision = vi.fn();
const getSolucion_evento = vi.fn();
const getEventoObs = vi.fn();
const getObs = vi.fn();
const getTipoObs = vi.fn();
const todosLosPostes = vi.fn();

vi.mock("../../../api/opciones.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/opciones.api")>()),
  getOpcionesEvento: () => getOpcionesEvento(),
}));
vi.mock("../../../api/Evento.api", () => ({
  searchEvento: (...a: unknown[]) => searchEvento(...a),
  createEvento: vi.fn(),
  editEvento: vi.fn(),
}));
vi.mock("../../../api/Poste.api", () => ({ todosLosPostes: (...a: unknown[]) => todosLosPostes(...a) }));
vi.mock("../../../api/Revision.api", () => ({ getRevision: (...a: unknown[]) => getRevision(...a) }));
vi.mock("../../../api/Solucion.api", () => ({ getSolucion_evento: (...a: unknown[]) => getSolucion_evento(...a) }));
vi.mock("../../../api/EventoObs.api", () => ({ getEventoObs: (...a: unknown[]) => getEventoObs(...a) }));
// The two the sheet used to call, kept here so a drift back to them fails.
vi.mock("../../../api/Obs.api", () => ({ getObs: (...a: unknown[]) => getObs(...a) }));
vi.mock("../../../api/TipoObs.api", () => ({ getTipoObs: (...a: unknown[]) => getTipoObs(...a) }));
vi.mock("../../../api/Upload.api", () => ({ uploadImage: vi.fn() }));
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: () => true,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

const OPCIONES = {
  obs: [
    { id: 5, name: "Poste inclinado", id_tipoObs: 2 },
    { id: 6, name: "Cable suelto", id_tipoObs: 3 },
  ],
  tipoObs: [
    { id: 2, name: "Estructura" },
    { id: 3, name: "Tendido" },
  ],
};

const TRAMO = {
  id: 14, nombre: "Potosí – Sucre", id_departamento: null, departamento: null, archivado: false,
  ciudades: [
    { id: 11, name: "Potosí", lat: -19.58, lng: -65.75 },
    { id: 12, name: "Sucre", lat: -19.03, lng: -65.26 },
  ],
};

const POSTES = [{
  id: 40, name: "P-001", image: "", date: new Date("2026-01-05"),
  lat: -18.0, lng: -70.2, id_adss: 3, id_material: 7, id_propietario: 2,
  id_tramo: 14, id_usuario: 1,
  tramo: TRAMO,
}];

const EVENTO = {
  id: 77, description: "Poste caído tras la tormenta", priority: true,
  state: false, date: new Date("2026-02-01"), image: "", id_poste: 40, id_usuario: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  getOpcionesEvento.mockResolvedValue(OPCIONES);
  searchEvento.mockResolvedValue(EVENTO);
  getRevision.mockResolvedValue([]);
  getSolucion_evento.mockResolvedValue(null);
  getEventoObs.mockResolvedValue([]);
  todosLosPostes.mockResolvedValue(POSTES);
});

const sesion = { usuario: usuarioExample, autenticado: true };
const pintar = (eventoId: number | null, posteId: number | null = 40) =>
  render(
    <MemoryRouter>
      <SesionContext.Provider
        value={{ sesion, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <EventoSheet eventoId={eventoId} posteId={posteId ?? undefined} open setOpen={vi.fn()} onSuccess={vi.fn()} />
      </SesionContext.Provider>
    </MemoryRouter>,
  );

describe("where the observations come from", () => {
  it("asks the options endpoint and never the two old catalogues", async () => {
    pintar(null);

    await waitFor(() => expect(getOpcionesEvento).toHaveBeenCalledTimes(1));
    expect(getObs, "la ficha volvió a pedir /api/obs/").not.toHaveBeenCalled();
    expect(getTipoObs, "la ficha volvió a pedir /api/tipo-obs/").not.toHaveBeenCalled();
  });

  it("groups each observation under its own type", async () => {
    pintar(null);

    // Every type is open now, so being on screen proves nothing: each
    // observation has to be inside its own type and outside the other. Without
    // `id_tipoObs` the filter yields nothing and both groups vanish.
    const estructura = await screen.findByRole("group", { name: "Estructura" });
    const tendido = screen.getByRole("group", { name: "Tendido" });

    expect(within(estructura).getByText("Poste inclinado")).toBeTruthy();
    expect(within(estructura).queryByText("Cable suelto")).toBeNull();
    expect(within(tendido).getByText("Cable suelto")).toBeTruthy();
  });
});

describe("when the observations are refused", () => {
  beforeEach(() => {
    getOpcionesEvento.mockRejectedValue({ response: { status: 403 } });
  });

  it("still shows the incident it was opened for", async () => {
    // The whole point of splitting the two loads. Before C2 this rendered
    // "Evento #" with an empty body.
    pintar(77);

    expect(await screen.findByText("Evento #77")).toBeTruthy();
    expect(await screen.findByDisplayValue(/Poste caído tras la tormenta/)).toBeTruthy();
  });

  it("says why the accordion is empty instead of implying nothing is configured", async () => {
    pintar(null);

    expect(await screen.findByText(/No tiene permiso para consultar las observaciones/i)).toBeTruthy();
    expect(screen.queryByText("Sin observaciones configuradas.")).toBeNull();
  });

  it("does not tell somebody editing that they cannot register the incident", async () => {
    // In edit mode the sentence written for the create form is simply false:
    // `selectedObs` comes from `getEventoObs`, a separate request that keeps
    // working, nothing disables Guardar, and the description saves with its
    // observations intact. Only *changing* the observations is out of reach.
    pintar(77);

    expect(await screen.findByText(/no puede cambiarlas/i)).toBeTruthy();
    expect(screen.queryByText(/no puede registrar la incidencia/i)).toBeNull();
  });
});

describe("choosing the observations", () => {
  it("repeats what is chosen at the top, and takes it back off from there", async () => {
    // The accordion hid a ticked observation as soon as another type was
    // opened; all that was left was a count.
    pintar(null);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Poste inclinado" }));
    const elegidas = screen.getByRole("list", { name: "Observaciones elegidas" });
    expect(within(elegidas).getByText("Poste inclinado")).toBeTruthy();
    expect(screen.getByText("1 elegida")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Quitar Poste inclinado" }));
    expect(screen.queryByRole("list", { name: "Observaciones elegidas" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Poste inclinado" }).getAttribute("aria-checked")).toBe("false");
  });

  it("narrows the list by what is typed, without minding accents", async () => {
    pintar(null);
    await userEvent.type(await screen.findByRole("searchbox", { name: "Buscar observación" }), "CÁBLE");

    expect(screen.getByText("Cable suelto")).toBeTruthy();
    expect(screen.queryByText("Poste inclinado")).toBeNull();
    expect(screen.queryByRole("group", { name: "Estructura" })).toBeNull();
  });

  it("says so when nothing matches", async () => {
    pintar(null);
    await userEvent.type(await screen.findByRole("searchbox", { name: "Buscar observación" }), "zzz");
    expect(screen.getByText(/Ninguna observación coincide/)).toBeTruthy();
  });
});

describe("the tramo of the pole", () => {
  it("is the server's name for the pole chosen in the register, with no two cities joined here", async () => {
    pintar(null, null);
    await waitFor(() => expect(todosLosPostes).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: /Buscar poste/ }));
    await userEvent.click(await screen.findByRole("button", { name: "P-001" }));

    const linea = await screen.findByText("Potosí – Sucre");
    expect(linea.textContent).not.toMatch(/ > | → | — /);
  });

  it("is the one in the dialog's description when an incident is opened", async () => {
    searchEvento.mockResolvedValue({ ...EVENTO, poste: POSTES[0] });
    pintar(77);

    expect(await screen.findByText("Tramo Potosí – Sucre")).toBeTruthy();
  });
});

describe("opened without a pole", () => {
  // This was a second form, `AddEventoPageSheet`. The home screen and the
  // incident list open this one that way now, and these are its tests.
  it("asks for the pole register, separately from the observations", async () => {
    pintar(null, null);

    await waitFor(() => expect(todosLosPostes).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Buscar poste...")).toBeTruthy();
  });

  it("does not ask for it when it was opened from a pole", async () => {
    pintar(null);

    await screen.findByRole("group", { name: "Estructura" });
    expect(todosLosPostes).not.toHaveBeenCalled();
    expect(screen.queryByText("Buscar poste...")).toBeNull();
  });

  it("keeps the observations when it is the pole register that failed", async () => {
    // The separation, asserted from the side that used to lose everything.
    todosLosPostes.mockRejectedValue(new Error("Network Error"));
    pintar(null, null);

    const estructura = await screen.findByRole("group", { name: "Estructura" });
    expect(within(estructura).getByText("Poste inclinado")).toBeTruthy();
  });

  it("counts the pole among what is missing", async () => {
    pintar(null, null);
    const crear = await screen.findByRole("button", { name: "Crear evento" });
    await waitFor(() => expect(crear).not.toBeDisabled());
    await userEvent.click(crear);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Faltan 5 campos: Poste, Descripción, Foto, Observaciones y Primera revisión",
    );
  });
});

describe("an incident that is already resolved", () => {
  beforeEach(() => {
    searchEvento.mockResolvedValue({ ...EVENTO, state: true });
    getSolucion_evento.mockResolvedValue({ id: 1, description: "Se cambió el herraje", date: new Date("2026-03-01"), image: "" });
    getEventoObs.mockResolvedValue([{ id_obs: 5 }]);
  });

  it("opens to be read: the solution, what was observed, and no way to save", async () => {
    // It used to open the form to say "no puede editarse".
    pintar(77);

    expect(await screen.findByText("Se cambió el herraje")).toBeTruthy();
    expect(screen.getByText("Poste caído tras la tormenta")).toBeTruthy();
    expect(screen.getByText("Poste inclinado")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Guardar/i })).toBeNull();
  });
});
