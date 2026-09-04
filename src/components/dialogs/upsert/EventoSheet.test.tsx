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
import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../../../api/opciones.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/opciones.api")>()),
  getOpcionesEvento: () => getOpcionesEvento(),
}));
vi.mock("../../../api/Evento.api", () => ({
  searchEvento: (...a: unknown[]) => searchEvento(...a),
  createEvento: vi.fn(),
  editEvento: vi.fn(),
}));
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
});

const sesion = { usuario: usuarioExample, autenticado: true };
const pintar = (eventoId: number | null) =>
  render(
    <MemoryRouter>
      <SesionContext.Provider
        value={{ sesion, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <EventoSheet eventoId={eventoId} posteId={40} open setOpen={vi.fn()} onSuccess={vi.fn()} />
      </SesionContext.Provider>
    </MemoryRouter>,
  );

describe("where the observations come from", () => {
  it("asks the options endpoint and never the two old catalogues", async () => {
    pintar(null);

    await waitFor(() => expect(getOpcionesEvento).toHaveBeenCalledTimes(1));
    expect(getObs, "la ficha volvió a pedir /api/obs/").not.toHaveBeenCalled();
    expect(getTipoObs, "la ficha volvió a pedir /api/tipoObs/").not.toHaveBeenCalled();
  });

  it("groups each observation under its own type", async () => {
    pintar(null);

    const estructura = await screen.findByRole("button", { name: /Estructura/i });
    // Closed, the observation is not rendered at all: finding it after the
    // click is what proves the group was built. Without `id_tipoObs` the filter
    // yields nothing and this button opens onto an empty section.
    await userEvent.click(estructura);

    expect(await screen.findByText("Poste inclinado")).toBeTruthy();
    expect(screen.queryByText("Cable suelto")).toBeNull();
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
