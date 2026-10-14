// The incident's sheet shows one thing at a time beside its map, chosen on a
// rail: the summary, the activity, the audit log.
//
// The log is only offered to a role that may read it. Its endpoint asks for
// `bitacora.ver`, which the seeded Coordinador and Cliente roles do not hold;
// a Bitácora tab was drawn for them anyway, holding nothing but "No tiene
// permiso para ver la bitácora".

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import EventoDetallePage from "./EventoDetallePage";
import { SesionContext } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";
import type { EventoInterface } from "../../../interfaces/interfaces";

let puedeVerBitacora = true;
let solucion: { id: number; date: Date; description: string; image: string; id_evento: number } | null = null;

vi.mock("../../../api/Poste.api", () => ({ getPostesDelTramo: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../api/Evento.api", () => ({ reabrirEvento: vi.fn() }));
vi.mock("../../../lib/orsRoute", () => ({ fetchOrsRoute: vi.fn().mockResolvedValue(null) }));
vi.mock("./useEventoDetalleData", () => ({
  useEventoDetalleData: () => ({
    evento: {
      id: 5, description: "Cable caído", image: "", state: false, priority: false, date: new Date("2026-01-05"),
      id_poste: 40, poste: { id: 40, name: "P-001", lat: -19.3, lng: -65.5 },
    } as unknown as EventoInterface,
    revisions: [
      { id: 1, date: new Date("2026-01-06"), description: "Se revisó el herraje" },
      { id: 2, date: new Date("2026-01-08"), description: "Se tensó el cable" },
    ],
    solucion, eventoObs: [], loading: false, load: vi.fn(),
  }),
}));
vi.mock("../../../components/map/BaseMap", () => ({ default: () => null }));
vi.mock("../../../components/BitacoraPanel", () => ({ default: () => <div>panel-bitacora</div> }));
vi.mock("../../../components/dialogs/AddRevisionSheet", () => ({ default: () => null }));
vi.mock("../../../components/dialogs/upsert/EventoSheet", () => ({ default: () => null }));
vi.mock("../../../components/dialogs/ResolverEventoSheet", () => ({ default: () => null }));
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: (_rol: unknown, modulo: string) => modulo !== "bitacora" || puedeVerBitacora,
}));
vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }));

const pintar = () =>
  render(
    <MemoryRouter>
      <SesionContext.Provider
        value={{ sesion: { usuario: usuarioExample, autenticado: true }, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <EventoDetallePage />
      </SesionContext.Provider>
    </MemoryRouter>,
  );

beforeEach(() => { puedeVerBitacora = true; solucion = null; });

describe("the views of an incident's sheet", () => {
  it("opens on the summary, with what can be done to the incident", () => {
    pintar();

    expect(screen.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: /Evento #5/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolver" })).toBeInTheDocument();
    // The activity is another view: its rows are not here.
    expect(screen.queryByText("Se tensó el cable")).toBeNull();
  });

  it("gives the activity the whole panel, counted on the rail, the latest first", async () => {
    const user = userEvent.setup();
    pintar();

    await user.click(screen.getByRole("tab", { name: "Actividad (2)" }));

    const filas = screen.getAllByText(/^Se /).map((el) => el.textContent);
    expect(filas).toEqual(["Se tensó el cable", "Se revisó el herraje"]);
    // And the summary has made room for it.
    expect(screen.queryByRole("heading", { name: /Evento #5/ })).toBeNull();
  });

  it("offers the log to a role that may read it, and asks for it only when opened", async () => {
    const user = userEvent.setup();
    pintar();

    expect(screen.queryByText("panel-bitacora")).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Bitácora" }));
    expect(screen.getByText("panel-bitacora")).toBeInTheDocument();
  });

  it("does not offer the log to a role that cannot read it", () => {
    puedeVerBitacora = false;
    pintar();

    expect(screen.queryByRole("tab", { name: "Bitácora" })).toBeNull();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("is one card: no card inside the panel in any view, nothing folds, and there is no refresh button", async () => {
    const user = userEvent.setup();
    pintar();

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("data-slot", "card");
    // The data is simply there under the header, with no title to fold it by.
    expect(screen.getByText("Fecha apertura")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Datos" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Datos/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Refrescar" })).toBeNull();

    for (const vista of [null, "Actividad (2)", "Bitácora"]) {
      if (vista) await user.click(screen.getByRole("tab", { name: vista }));
      expect(panel.querySelector('[data-slot="card"]')).toBeNull();
    }
  });
});

describe("the solution of a resolved incident, on its summary", () => {
  it("says how it was solved and shows its photo, without opening the activity", () => {
    solucion = { id: 9, date: new Date("2026-01-10T12:00:00"), description: "Se repuso el cable y se tensó", image: "solucion.jpg", id_evento: 5 };
    pintar();

    const bloque = screen.getByRole("region", { name: "Solución" });
    expect(within(bloque).getByRole("heading", { name: /Solución/ })).toBeInTheDocument();
    expect(within(bloque).getByText("Se repuso el cable y se tensó")).toBeInTheDocument();
    expect(within(bloque).getByText("10/1/2026")).toBeInTheDocument();
    expect(within(bloque).getByRole("img", { name: "Foto de la solución" })).toHaveAttribute("src", expect.stringContaining("solucion.jpg"));
  });

  it("shows no photo for a solution that has none", () => {
    solucion = { id: 9, date: new Date("2026-01-10T12:00:00"), description: "Se repuso el cable", image: "", id_evento: 5 };
    pintar();

    expect(screen.getByText("Se repuso el cable")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Foto de la solución" })).toBeNull();
  });

  it("is not there while the incident is still open", () => {
    pintar();

    expect(screen.queryByRole("region", { name: "Solución" })).toBeNull();
  });
});
