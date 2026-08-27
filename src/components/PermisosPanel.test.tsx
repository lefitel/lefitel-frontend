// The grid of checkboxes, and the cells that must not be one.
//
// This file did not exist while the panel drew a strict ten-by-four grid —
// which was survivable only because every module really did carry all four
// verbs. Now each module declares its own, so the panel has holes in it, and a
// hole is the one thing a checkbox grid gets wrong by default: an empty
// disabled box reads as "not granted yet, tick me", not as "this does not
// exist here".
//
// Two things are worth pinning beyond that. A cell the module does not have
// must never reach the server, because it would be refused by name and the
// administrator would be told off for something the screen offered them. And
// the panel must take its shape from the server's answer rather than from a
// list of its own — the whole reason the vocabulary travels with the data is
// that a module added later appears here without anybody remembering to add it.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SesionContext, type contextProps } from "../context/SesionContext";
import type { SesionInterface } from "../interfaces/interfaces";
import { setPermisos, olvidarPermisos, sinPermisos } from "../lib/permissions";
import PermisosPanel from "./PermisosPanel";

const getMatrizPermisos = vi.hoisted(() => vi.fn());
const savePermisos = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastWarning = vi.hoisted(() => vi.fn());

vi.mock("../api/Permisos.api", () => ({ getMatrizPermisos, savePermisos }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess, warning: toastWarning },
}));

const MI_ROL = 1;
const OTRO_ROL = 3;
const sesion = {
  usuario: { id: 7, id_rol: MI_ROL },
  autenticado: true,
} as unknown as SesionInterface;

/** The server's answer, in the shape the server now sends it. */
function matriz() {
  return {
    roles: [
      { id: MI_ROL, name: "Administrador", description: null },
      { id: OTRO_ROL, name: "Cliente", description: null },
    ],
    modulos: [
      { key: "postes", label: "Postes", acciones: ["ver", "crear", "editar", "archivar"] },
      { key: "archivos", label: "Archivos", acciones: ["ver", "archivar"] },
      { key: "bitacora", label: "Bitácora", acciones: ["ver"] },
    ],
    acciones: [
      { key: "ver", label: "Ver" },
      { key: "crear", label: "Crear" },
      { key: "editar", label: "Editar" },
      { key: "archivar", label: "Archivar" },
    ],
    permisos: {
      [OTRO_ROL]: {
        postes: { ver: true, crear: false, editar: false, archivar: false },
        archivos: { ver: false, archivar: false },
        bitacora: { ver: false },
      },
    },
  };
}

function renderPanel() {
  render(
    <SesionContext.Provider value={{ sesion } as unknown as contextProps}>
      <PermisosPanel />
    </SesionContext.Provider>,
  );
}

/** Everything granted on `roles`, which is what this panel is gated on. */
function puedeEditarPermisos() {
  const p = sinPermisos();
  p.roles.ver = true;
  p.roles.editar = true;
  return p;
}

/** The row of the grid for a module, found by its visible label. */
const filaDe = (label: string) => screen.getByRole("row", { name: new RegExp(label, "i") });

/**
 * Move off your own role before editing anything.
 *
 * The panel opens on the first role the server sent, which is the lowest id and
 * in practice the administrator's own — and it refuses to edit that one, because
 * unticking your own access to this screen is the one mistake with no way back.
 * So every test that saves has to do what an administrator does: pick somebody
 * else's role first.
 */
async function irAlRolCliente(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("tab", { name: /cliente/i }));
}

beforeEach(() => {
  olvidarPermisos();
  setPermisos(MI_ROL, puedeEditarPermisos());
  getMatrizPermisos.mockReset();
  savePermisos.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  toastWarning.mockReset();
  getMatrizPermisos.mockResolvedValue(matriz());
  savePermisos.mockResolvedValue({ status: 200 });
});

describe("the grid takes its shape from the server", () => {
  it("draws a row per module the server sent", async () => {
    renderPanel();

    expect(await screen.findByText("Postes")).toBeInTheDocument();
    expect(screen.getByText("Archivos")).toBeInTheDocument();
    expect(screen.getByText("Bitácora")).toBeInTheDocument();
  });

  it("draws a box only where the module has that action", async () => {
    renderPanel();
    await screen.findByText("Postes");

    // Four verbs, four boxes.
    expect(within(filaDe("Postes")).getAllByRole("checkbox")).toHaveLength(4);
    // `archivos` never had a `crear` or an `editar`.
    expect(within(filaDe("Archivos")).getAllByRole("checkbox")).toHaveLength(2);
    // A log that could be edited would not be a log.
    expect(within(filaDe("Bitácora")).getAllByRole("checkbox")).toHaveLength(1);
  });

  it("leaves the cell empty where the action does not exist", async () => {
    // The distinction this whole file exists for, asserted on the cell rather
    // than on the box. A disabled checkbox reads as "not granted yet, somebody
    // enable this" and the administrator waits for it; an empty cell says there
    // is nothing to grant.
    //
    // Deliberately not asserted as "the remaining box is enabled": the panel
    // opens on the reader's own role and disables every box there, so that
    // assertion would pass or fail on a different rule entirely.
    renderPanel();
    await screen.findByText("Bitácora");

    // One label cell plus one per verb.
    const celdas = within(filaDe("Bitácora")).getAllByRole("cell");
    expect(celdas).toHaveLength(5);
    expect(within(celdas[1]).getAllByRole("checkbox")).toHaveLength(1); // Ver
    for (const celda of celdas.slice(2)) {
      expect(celda).toBeEmptyDOMElement();
    }
  });
});

describe("what reaches the server", () => {
  it("sends only the cell that was ticked", async () => {
    renderPanel();
    await screen.findByText("Postes");
    const user = userEvent.setup();

    await irAlRolCliente(user);
    await user.click(within(filaDe("Archivos")).getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(savePermisos).toHaveBeenCalled());
    expect(savePermisos.mock.calls[0][1]).toEqual({ archivos: { ver: true } });
  });

  it("never names a cell the module does not have", async () => {
    // The server refuses `bitacora.archivar` by name now. A screen that could
    // send it would be getting the administrator told off for something it
    // offered them.
    renderPanel();
    await screen.findByText("Bitácora");
    const user = userEvent.setup();

    await irAlRolCliente(user);
    await user.click(within(filaDe("Bitácora")).getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(savePermisos).toHaveBeenCalled());
    const enviado = savePermisos.mock.calls[0][1] as Record<string, Record<string, boolean>>;
    expect(Object.keys(enviado.bitacora ?? {})).toEqual(["ver"]);
  });

  it("shows the server's refusal instead of inventing one", async () => {
    savePermisos.mockResolvedValue({
      status: 400,
      message: 'El módulo "bitacora" no tiene la acción "archivar".',
    });
    renderPanel();
    await screen.findByText("Postes");
    const user = userEvent.setup();

    await irAlRolCliente(user);
    await user.click(within(filaDe("Postes")).getAllByRole("checkbox")[1]);
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0][0])).toContain("archivar");
  });
});
