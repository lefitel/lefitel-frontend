// The archived tramos: a plain list, and the one thing to do with a row is
// bring it back. The live tramos are not here — they are worked on the map,
// which is the other half of the Activos/Archivados pair.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { MemoryRouter } from "react-router-dom";
import TramosArchivadosPage from "./TramosArchivadosPage";
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import { olvidarPermisos, setPermisos, sinPermisos } from "../../../lib/permissions";
import type { TramoConCifras } from "../../../api/Tramo.api";

const getTramosArchivados = vi.fn();
const desarchivarTramo = vi.fn();
vi.mock("../../../api/Tramo.api", () => ({
  getTramosArchivados: (...a: unknown[]) => getTramosArchivados(...a),
  desarchivarTramo: (...a: unknown[]) => desarchivarTramo(...a),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const ROL = 3;

const ciudad = (id: number, name: string) => ({ id, name, lat: null, lng: null });

const fila = (id: number, nombre: string, dep: { id: number; name: string } | null): TramoConCifras => ({
  id,
  nombre,
  ciudades: [ciudad(id * 10, "A"), ciudad(id * 10 + 1, "B")],
  id_departamento: dep?.id ?? null,
  departamento: dep,
  archivado: true,
});

const pintar = (acciones: ("archivar")[] = []) => {
  olvidarPermisos();
  const permisos = sinPermisos();
  permisos.tramos.ver = true;
  for (const a of acciones) permisos.tramos[a] = true;
  setPermisos(ROL, permisos);
  const ctx = { sesion: { usuario: { id: 7, id_rol: ROL } } } as unknown as contextProps;
  render(
    <MemoryRouter>
      <SesionContext.Provider value={ctx}>
        <TramosArchivadosPage />
      </SesionContext.Provider>
    </MemoryRouter>,
  );
  return userEvent.setup();
};

const filaDe = (nombre: string) =>
  screen.getAllByRole("row").slice(1).find((tr) => within(tr).queryByText(nombre))!;

/** A refusal shaped like the real one: what `mensajeDeError` digs the sentence out of. */
const rechazo = (status: number, message: string) =>
  new AxiosError("falló", "ERR_BAD_REQUEST", undefined, undefined, {
    status, data: { message }, statusText: "", headers: {}, config: {} as never,
  } as AxiosResponse);

describe("the archived tramos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTramosArchivados.mockResolvedValue([
      fila(7, "Potosí – Sucre", null),
      fila(8, "Camargo – Tarija", { id: 6, name: "Chuquisaca" }),
    ]);
  });

  it("lists them on arrival, each with its department", async () => {
    pintar();

    await screen.findByText("Potosí – Sucre");
    expect(getTramosArchivados).toHaveBeenCalledTimes(1);
    expect(within(filaDe("Potosí – Sucre")).getByText("Sin departamento")).toBeInTheDocument();
    expect(within(filaDe("Camargo – Tarija")).getByText("Chuquisaca")).toBeInTheDocument();
  });

  it("leaves the name as text, not a link: an archived tramo is not on the map", async () => {
    pintar(["archivar"]);

    const nombre = await screen.findByText("Potosí – Sucre");
    expect(nombre.closest("a")).toBeNull();
    expect(within(filaDe("Potosí – Sucre")).queryByRole("link")).toBeNull();
  });

  it("brings one back after asking, and reads the list again", async () => {
    desarchivarTramo.mockResolvedValue(undefined);
    const user = pintar(["archivar"]);
    await screen.findByText("Potosí – Sucre");

    await user.click(within(filaDe("Potosí – Sucre")).getByRole("button", { name: "Desarchivar" }));
    // The confirmation: while it is open the row behind it is out of reach.
    await user.click(await screen.findByRole("button", { name: "Desarchivar" }));

    await waitFor(() => expect(desarchivarTramo).toHaveBeenCalledWith(7));
    expect(toast.success).toHaveBeenCalledWith("Tramo desarchivado");
    await waitFor(() => expect(getTramosArchivados).toHaveBeenCalledTimes(2));
  });

  it("says why when the server refuses", async () => {
    desarchivarTramo.mockRejectedValue(rechazo(409, "Ya existe un tramo activo entre esas ciudades"));
    const user = pintar(["archivar"]);
    await screen.findByText("Potosí – Sucre");

    await user.click(within(filaDe("Potosí – Sucre")).getByRole("button", { name: "Desarchivar" }));
    await user.click(await screen.findByRole("button", { name: "Desarchivar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Ya existe un tramo activo entre esas ciudades"));
    expect(getTramosArchivados).toHaveBeenCalledTimes(1);
  });

  it("offers nothing to press to a role that may not archive", async () => {
    pintar();
    await screen.findByText("Potosí – Sucre");

    expect(screen.queryByRole("button", { name: "Desarchivar" })).toBeNull();
  });

  it("says so when the list could not be read", async () => {
    getTramosArchivados.mockRejectedValue(new Error("x"));
    pintar();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al cargar tramos archivados"));
  });

  it("marks Archivados in the header pair and offers the way back to the map", async () => {
    pintar();
    await screen.findByText("Potosí – Sucre");

    expect(screen.getByRole("link", { name: "Archivados" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Activos" })).toHaveAttribute("href", "/app/tramos");
  });
});
