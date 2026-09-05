// The screen an urgent-incident alert sends you to has to be able to show you
// the urgent incidents.
//
// It could not. The table had no severity column — the API did not even send
// the level — and priority was not filterable, so "4 urgentes" landed you on a
// paginated list of every event ever recorded, ordered by id, with no way to
// narrow it. The alert was the easy half; this was the dead end behind it.
//
// Filtering and sorting happen on the server, so the assertions below are about
// what `getEvento` is *called with*: the filter names and values here and the
// ones `evento.list.test.ts` pins on the API are the same contract, written on
// two sides of the wire.
//
// The third group is a regression that predates the filters and would have made
// them worse than useless. `load()` took its arguments from default parameters
// captured in the closure of the first render, so a bare call — which is what
// every dialog does after saving, and what the refresh button does — always
// asked for page 1, unfiltered, unsorted. Resolve one event out of a filtered
// list and the filter silently vanished. Adding filters worth using to a screen
// that throws them away on the next save is not an improvement.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import { rechazoDelServidor } from "../../../test/fallos";
import type { EventoInterface, SesionInterface, UsuarioInterface } from "../../../interfaces/interfaces";

const getEvento = vi.fn();
const editEvento = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: () => true,
}));
vi.mock("../../../api/Evento.api", () => ({
  getEvento: (...args: unknown[]) => getEvento(...args),
  exportarEventos: vi.fn().mockResolvedValue({ blob: new Blob(["x"]), filename: "Incidencias.csv" }),
  // Desde C4 estas tres devuelven la fila o nada, y ninguna devuelve un
  // número. `reabrirEvento` es la excepción y está dicho en su propio
  // fichero: sigue devolviendo 200 hasta que la sesión de MapLibre suelte
  // `EventoDetallePage.tsx`.
  editEvento: (...args: unknown[]) => editEvento(...args),
  deleteEvento: vi.fn().mockResolvedValue(undefined),
  desarchivarEvento: vi.fn().mockResolvedValue(undefined),
  reabrirEvento: vi.fn().mockResolvedValue(200),
}));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: toastError, success: toastSuccess, info: vi.fn() },
}));
// The export libraries used to be mocked here because they were megabytes of
// parsing for a menu nothing in this file opens. This screen no longer imports
// them: the server builds the file now. `file-saver` still saves the bytes.
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));

const EventoPage = (await import("./index")).default;

const usuario: UsuarioInterface = {
  id: 7, name: "Isaias", lastname: "Salas", birthday: new Date("1990-01-01"),
  image: "", phone: "700", user: "isaias", pass: "", id_rol: 3,
};

/** An event whose observations carry the given severities. */
function evento(id: number, criticalities: (number | null)[] = []): EventoInterface {
  return {
    id,
    description: `Incidencia ${id}`,
    state: false,
    priority: false,
    date: new Date("2026-08-01"),
    image: "",
    id_poste: id,
    id_usuario: 7,
    eventoObs: criticalities.map((criticality, i) => ({
      id: id * 100 + i,
      id_evento: id,
      id_obs: i,
      ob: { id: i, name: `Observación ${i}`, description: "", id_tipoObs: 1, criticality },
    })),
  } as unknown as EventoInterface;
}

function renderPage() {
  const sesion: SesionInterface = { usuario, autenticado: true };
  const value: contextProps = { sesion, setSesion: vi.fn(), loading: false, logout: vi.fn() };
  return render(
    <SesionContext.Provider value={value}>
      <MemoryRouter>
        <EventoPage />
      </MemoryRouter>
    </SesionContext.Provider>,
  );
}

/** The filters on the most recent request, or an empty list. */
function lastFilters(): { column: string; value: string }[] {
  const calls = getEvento.mock.calls;
  const arg = calls[calls.length - 1]?.[0] as { filters?: { column: string; value: string }[] };
  return arg?.filters ?? [];
}

/** Presses one option of a labelled quick filter and waits for the round trip. */
async function pick(group: RegExp, option: RegExp) {
  const before = getEvento.mock.calls.length;
  await userEvent.click(
    within(screen.getByRole("tablist", { name: group })).getByRole("tab", { name: option }),
  );
  await waitFor(() => expect(getEvento.mock.calls.length).toBeGreaterThan(before));
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  getEvento.mockResolvedValue({ data: [], total: 0, page: 1 });
  editEvento.mockResolvedValue({ id: 1 });
});

describe("tabla de eventos — la gravedad se ve", () => {
  it("pinta el nivel de la peor observación del evento", async () => {
    getEvento.mockResolvedValue({
      data: [evento(1, [7, 2, 5])],
      total: 1,
      page: 1,
    });
    renderPage();

    // 2 is the worst of 7, 2 and 5 — lower is graver — and it is the one shown.
    expect(await screen.findByTitle(/^Nivel 2 —/)).toBeInTheDocument();
    expect(screen.queryByTitle(/^Nivel 5 —/)).toBeNull();
    expect(screen.queryByTitle(/^Nivel 7 —/)).toBeNull();
  });

  it("no inventa un nivel para un evento sin observaciones clasificadas", async () => {
    getEvento.mockResolvedValue({ data: [evento(2, [null])], total: 1, page: 1 });
    renderPage();

    await screen.findByText("Incidencia 2");
    expect(screen.queryByTitle(/^Nivel \d/)).toBeNull();
    expect(screen.getByTitle("Sin clasificar")).toBeInTheDocument();
  });
});

describe("tabla de eventos — los filtros rápidos", () => {
  it("pide al servidor la banda de gravedad elegida", async () => {
    renderPage();
    await waitFor(() => expect(getEvento).toHaveBeenCalled());

    await pick(/gravedad/i, /^Críticas$/);
    expect(lastFilters()).toContainEqual({ column: "criticality", value: "criticas" });
  });

  it("pide solo las prioritarias", async () => {
    renderPage();
    await waitFor(() => expect(getEvento).toHaveBeenCalled());

    await pick(/prioridad/i, /Solo prioritarias/);
    expect(lastFilters()).toContainEqual({ column: "priority", value: "true" });
  });

  it("acumula estado, gravedad y prioridad en la misma consulta", async () => {
    renderPage();
    await waitFor(() => expect(getEvento).toHaveBeenCalled());

    await pick(/estado/i, /Pendientes/);
    await pick(/gravedad/i, /^Críticas$/);
    await pick(/prioridad/i, /Solo prioritarias/);

    expect(lastFilters()).toEqual(
      expect.arrayContaining([
        { column: "state", value: "pending" },
        { column: "criticality", value: "criticas" },
        { column: "priority", value: "true" },
      ]),
    );
  });

  it("vuelve a la primera página al cambiar un filtro", async () => {
    renderPage();
    await waitFor(() => expect(getEvento).toHaveBeenCalled());

    await pick(/gravedad/i, /^Altas$/);
    const arg = getEvento.mock.calls.at(-1)?.[0] as { page: number };
    expect(arg.page).toBe(1);
  });

  it("«Quitar filtros» los quita todos de una vez", async () => {
    renderPage();
    await waitFor(() => expect(getEvento).toHaveBeenCalled());

    await pick(/estado/i, /Pendientes/);
    await pick(/gravedad/i, /^Críticas$/);

    const before = getEvento.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: /Quitar filtros/ }));
    await waitFor(() => expect(getEvento.mock.calls.length).toBeGreaterThan(before));

    expect(lastFilters()).toEqual([]);
  });
});

describe("tabla de eventos — ordenar por gravedad", () => {
  it("la cabecera pide al servidor el orden por gravedad", async () => {
    getEvento.mockResolvedValue({ data: [evento(1, [4])], total: 1, page: 1 });
    renderPage();
    await screen.findByText("Incidencia 1");

    const before = getEvento.mock.calls.length;
    // The column header, not the quick-filter label beside the table. The click
    // handler sits on the inner div, so the `th` itself is not the target.
    const header = screen.getByRole("columnheader", { name: /Gravedad/ });
    await userEvent.click(within(header).getByText("Gravedad"));
    await waitFor(() => expect(getEvento.mock.calls.length).toBeGreaterThan(before));

    // A column with only an `id` is a display column: its header does not
    // respond to a click at all, and nothing is ever requested.
    const arg = getEvento.mock.calls.at(-1)?.[0] as { sortBy?: string[] };
    expect(arg.sortBy).toContain("criticality");
  });
});

describe("tabla de eventos — recargar no descarta la vista", () => {
  it("mantiene los filtros al refrescar", async () => {
    renderPage();
    await waitFor(() => expect(getEvento).toHaveBeenCalled());

    await pick(/gravedad/i, /^Críticas$/);

    const before = getEvento.mock.calls.length;
    await userEvent.click(screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-refresh-cw"))!);
    await waitFor(() => expect(getEvento.mock.calls.length).toBeGreaterThan(before));

    // The bare `load()` used to reload page 1 unfiltered, so this was `[]`.
    expect(lastFilters()).toContainEqual({ column: "criticality", value: "criticas" });
  });
});

describe("tabla de eventos — la estrella de prioridad no puede mentir", () => {
  // The row is repainted before the server is asked, which is what makes the
  // screen feel instant — and what makes a refused write dangerous: with
  // nothing to undo it, the list goes on showing a priority that was never
  // stored, for as long as nobody reloads. C4 moved the write from "returns a
  // number" to "throws", so the revert moved from an `else` into a `catch`, and
  // until these two tests nothing in either repository was watching it.
  it("deja la marca puesta cuando el servidor la acepta", async () => {
    getEvento.mockResolvedValue({ data: [evento(1)], total: 1, page: 1 });
    renderPage();

    await userEvent.click(await screen.findByTitle(/cambiar prioridad/i));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Marcado como prioritario"));
    expect(await screen.findByText("Sí")).toBeInTheDocument();
  });

  it("la quita otra vez si el servidor la rechaza, y dice por qué", async () => {
    getEvento.mockResolvedValue({ data: [evento(1)], total: 1, page: 1 });
    editEvento.mockRejectedValue(rechazoDelServidor(403, "No puedes editar incidencias resueltas"));
    renderPage();

    await userEvent.click(await screen.findByTitle(/cambiar prioridad/i));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    // The server's own sentence, not "No se pudo actualizar".
    expect(String(toastError.mock.calls[0][0])).toMatch(/no puedes editar/i);
    // And the row is back to what the database really holds.
    expect(await screen.findByText("No")).toBeInTheDocument();
    expect(screen.queryByText("Sí")).not.toBeInTheDocument();
  });
});
