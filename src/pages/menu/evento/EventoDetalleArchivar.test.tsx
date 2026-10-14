// An incident can be archived from its own sheet, and not only from the list.
// It is the one action there that is not behind `eventos.editar`: archiving has
// a permission of its own, so it is offered — or not — independently of the
// other three, and on a resolved incident as much as on an open one.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventoDetallePage from "./EventoDetallePage";
import { SesionContext } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";
import type { EventoInterface } from "../../../interfaces/interfaces";

const deleteEvento = vi.fn();
/** The actions this session holds on `eventos`. */
let acciones: string[] = [];
let evento: EventoInterface | null = null;

vi.mock("../../../api/Poste.api", () => ({ getPostesDelTramo: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../api/Evento.api", () => ({
  reabrirEvento: vi.fn(),
  deleteEvento: (...a: unknown[]) => deleteEvento(...a),
}));
vi.mock("../../../lib/orsRoute", () => ({ fetchOrsRoute: vi.fn().mockResolvedValue(null) }));
vi.mock("./useEventoDetalleData", () => ({
  useEventoDetalleData: () => ({
    evento, revisions: [], solucion: null, eventoObs: [], loading: false, load: vi.fn(),
  }),
}));
vi.mock("../../../components/map/BaseMap", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../components/map/MapPoint", () => ({ default: () => null }));
vi.mock("../../../components/map/MapLine", () => ({ default: () => null }));
vi.mock("../../../components/map/SonarMarker", () => ({ SonarMarker: () => null }));
vi.mock("../../../components/map/useFitCoords", () => ({ FitView: () => null }));
vi.mock("../../../components/BitacoraPanel", () => ({ default: () => null }));
vi.mock("../../../components/dialogs/AddRevisionSheet", () => ({ default: () => null }));
vi.mock("../../../components/dialogs/upsert/EventoSheet", () => ({ default: () => null }));
vi.mock("../../../components/dialogs/ResolverEventoSheet", () => ({ default: () => null }));
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: (_rol: unknown, modulo: string, accion: string) => modulo !== "eventos" || acciones.includes(accion),
}));
vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }));

const unEvento = (state: boolean) =>
  ({
    id: 5, description: "Cable caído", image: "", state, priority: false, date: new Date("2026-01-05"),
    id_poste: 40, poste: { id: 40, name: "P-001", lat: -19.3, lng: -65.5, id_tramo: null, tramo: null },
  }) as unknown as EventoInterface;

const pintar = () =>
  render(
    <MemoryRouter initialEntries={["/app/eventos/5"]}>
      <SesionContext.Provider
        value={{ sesion: { usuario: usuarioExample, autenticado: true }, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <Routes>
          <Route path="/app/eventos/:id" element={<EventoDetallePage />} />
          <Route path="/app/eventos" element={<p>la lista de eventos</p>} />
        </Routes>
      </SesionContext.Provider>
    </MemoryRouter>,
  );

const boton = (name: string) => screen.queryByRole("button", { name });

beforeEach(() => {
  vi.clearAllMocks();
  acciones = ["ver", "editar", "archivar"];
  evento = unEvento(false);
  deleteEvento.mockResolvedValue(undefined);
});

describe("archiving an incident from its sheet", () => {
  it("sits with the other three on an open incident", () => {
    pintar();

    for (const name of ["Resolver", "Revisión", "Editar", "Archivar"]) expect(boton(name)).toBeInTheDocument();
  });

  it("is offered on a resolved incident too, beside Reabrir", () => {
    evento = unEvento(true);
    pintar();

    expect(boton("Reabrir")).toBeInTheDocument();
    expect(boton("Archivar")).toBeInTheDocument();
    expect(boton("Editar")).not.toBeInTheDocument();
  });

  it("is not offered without eventos.archivar, and the rest stay", () => {
    acciones = ["ver", "editar"];
    pintar();

    expect(boton("Archivar")).not.toBeInTheDocument();
    expect(boton("Resolver")).toBeInTheDocument();
  });

  it("is offered alone to a session that may archive and not edit", () => {
    acciones = ["ver", "archivar"];
    pintar();

    expect(boton("Archivar")).toBeInTheDocument();
    expect(boton("Resolver")).not.toBeInTheDocument();
    expect(boton("Editar")).not.toBeInTheDocument();
  });

  it("asks first, and sends nothing until it is confirmed", async () => {
    const user = userEvent.setup();
    pintar();

    await user.click(boton("Archivar")!);
    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo).toHaveTextContent("¿Archivar evento?");
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(deleteEvento).not.toHaveBeenCalled();
  });

  it("archives the incident being looked at and leaves for the list", async () => {
    const user = userEvent.setup();
    pintar();

    await user.click(boton("Archivar")!);
    const dialogo = await screen.findByRole("alertdialog");
    await user.click(within(dialogo).getByRole("button", { name: "Archivar" }));

    await waitFor(() => expect(deleteEvento).toHaveBeenCalledWith(5));
    expect(await screen.findByText("la lista de eventos")).toBeInTheDocument();
  });

  it("stays on the sheet and says so when the server refuses", async () => {
    const user = userEvent.setup();
    deleteEvento.mockRejectedValue({ response: { status: 403, data: { message: "No tiene permiso" } } });
    pintar();

    await user.click(boton("Archivar")!);
    const dialogo = await screen.findByRole("alertdialog");
    await user.click(within(dialogo).getByRole("button", { name: "Archivar" }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByText("la lista de eventos")).not.toBeInTheDocument();
  });
});
