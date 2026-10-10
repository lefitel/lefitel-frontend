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
//
// The grid does not load or save any more: it is one part of a role's form,
// which holds both. So what is asserted here is what it draws and what it
// reports as changed; what goes on the wire is pinned in `RolDialog.test.tsx`.

import { describe, it, expect, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SesionContext, type contextProps } from "../context/SesionContext";
import type { SesionInterface } from "../interfaces/interfaces";
import type { MatrizPermisos } from "../api/Permisos.api";
import { setPermisos, olvidarPermisos, sinPermisos } from "../lib/permissions";
import { cambiosDePermisos, type PermisosPendientes as Pending } from "../lib/roles";
import PermisosPanel from "./PermisosPanel";

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
    // Two roles, and they differ in every cell of the first row. With only one
    // in here, a grid that ignored which role it was given and read the only
    // one there would have passed every test in this file.
    permisos: {
      [MI_ROL]: {
        postes: { ver: false, crear: true, editar: true, archivar: true },
        archivos: { ver: true, archivar: true },
        bitacora: { ver: true },
      },
      [OTRO_ROL]: {
        postes: { ver: true, crear: false, editar: false, archivar: false },
        archivos: { ver: false, archivar: false },
        bitacora: { ver: false },
      },
    },
  } as unknown as MatrizPermisos;
}

/** What the form around the grid would be holding. */
let pendiente: Pending = {};

/**
 * The grid of one role, held the way its form holds it. Somebody else's unless
 * a test says otherwise: the panel refuses to edit the reader's own, so every
 * test that ticks a box has to be looking at another one.
 */
function renderPanel(rolId = OTRO_ROL, disabled = false) {
  const Formulario = () => {
    const [pending, setPending] = useState<Pending>({});
    pendiente = pending;
    return (
      <PermisosPanel
        matriz={matriz()}
        rolId={rolId}
        pending={pending}
        onPendingChange={setPending}
        disabled={disabled}
      />
    );
  };
  render(
    <SesionContext.Provider value={{ sesion } as unknown as contextProps}>
      <Formulario />
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

beforeEach(() => {
  olvidarPermisos();
  setPermisos(MI_ROL, puedeEditarPermisos());
  pendiente = {};
});

describe("the grid takes its shape from the server", () => {
  it("draws a row per module the server sent", () => {
    renderPanel();

    expect(screen.getByText("Postes")).toBeInTheDocument();
    expect(screen.getByText("Archivos")).toBeInTheDocument();
    expect(screen.getByText("Bitácora")).toBeInTheDocument();
  });

  it("draws a box only where the module has that action", () => {
    renderPanel();

    // Four verbs, four boxes.
    expect(within(filaDe("Postes")).getAllByRole("checkbox")).toHaveLength(4);
    // `archivos` never had a `crear` or an `editar`.
    expect(within(filaDe("Archivos")).getAllByRole("checkbox")).toHaveLength(2);
    // A log that could be edited would not be a log.
    expect(within(filaDe("Bitácora")).getAllByRole("checkbox")).toHaveLength(1);
  });

  it("marks the cell as not applicable, with no checkbox in it", () => {
    // The distinction this whole file exists for, asserted on the cell rather
    // than on the box. A disabled checkbox reads as "not granted yet, somebody
    // enable this" and the administrator waits for it; an empty cell says there
    // is nothing to grant.
    //
    // Deliberately not asserted as "the remaining box is enabled": whether a
    // box can be ticked is a different rule — whose role this is, and what the
    // reader may do — with tests of its own below.
    renderPanel();

    // One label cell plus one per verb.
    const celdas = within(filaDe("Bitácora")).getAllByRole("cell");
    expect(celdas).toHaveLength(5);
    expect(within(celdas[1]).getAllByRole("checkbox")).toHaveLength(1); // Ver
    for (const celda of celdas.slice(2)) {
      expect(within(celda).queryByRole("checkbox")).toBeNull();
      // Not left blank either: somebody reading the table one cell at a time
      // hears "blank" and cannot tell "does not apply" from "a box failed to
      // render".
      expect(within(celda).getByLabelText("No aplica")).toBeInTheDocument();
    }
  });

  it("shows the boxes of the role it was given, and no other's", () => {
    renderPanel(OTRO_ROL);

    // This role's row, which is the reverse of the other one's in every cell.
    const cajas = within(filaDe("Postes")).getAllByRole("checkbox");
    expect(cajas.map((c) => (c as HTMLInputElement).getAttribute("aria-checked"))).toEqual(
      ["true", "false", "false", "false"],
    );
  });

  it("shows the other role's boxes when it is given the other role", () => {
    renderPanel(MI_ROL);

    const cajas = within(filaDe("Postes")).getAllByRole("checkbox");
    expect(cajas.map((c) => (c as HTMLInputElement).getAttribute("aria-checked"))).toEqual(
      ["false", "true", "true", "true"],
    );
  });
});

describe("what it reports as changed", () => {
  it("reports only the cell that was ticked", async () => {
    renderPanel();
    const user = userEvent.setup();

    await user.click(within(filaDe("Archivos")).getAllByRole("checkbox")[0]);

    expect(pendiente).toEqual({ "archivos.ver": true });
  });

  it("drops a cell ticked back to where it started", async () => {
    // Otherwise the form would say there is something to lose, and send a
    // change that changes nothing.
    renderPanel();
    const user = userEvent.setup();
    const caja = within(filaDe("Postes")).getAllByRole("checkbox")[0];

    await user.click(caja);
    expect(pendiente).toEqual({ "postes.ver": false });

    await user.click(caja);
    expect(pendiente).toEqual({});
  });

  it("never names a cell the module does not have", async () => {
    // The server refuses `bitacora.archivar` by name now. A screen that could
    // send it would be getting the administrator told off for something it
    // offered them.
    //
    // The row is asserted to hold exactly one box *before* anything is clicked,
    // and the click goes to the last one. The earlier version clicked index 0
    // and passed with the hole guard deleted — index 0 is `ver` whether the row
    // has one box or four, so it could never observe the failure it is named
    // after. An audit caught it by moving the click; this is that move, kept.
    renderPanel();
    const user = userEvent.setup();

    const cajas = within(filaDe("Bitácora")).getAllByRole("checkbox");
    expect(cajas).toHaveLength(1);

    await user.click(cajas[cajas.length - 1]);

    expect(Object.keys(pendiente)).toEqual(["bitacora.ver"]);
  });

  it("groups what changed by module, the way the server takes it", () => {
    expect(cambiosDePermisos({
      "postes.crear": true, "postes.archivar": false, "archivos.ver": true,
    })).toEqual({
      postes: { crear: true, archivar: false },
      archivos: { ver: true },
    });
    expect(cambiosDePermisos({})).toEqual({});
  });
});

describe("who may tick a box", () => {
  it("does not offer to edit the reader's own role", () => {
    // Shown the reader's own role. The server refuses that with a 409, and
    // offering a box it will reject is how an administrator learns to distrust
    // the screen.
    //
    // Both this and the test below were missing entirely: an audit deleted each
    // half of `disabled={!puedeEditar || esPropioRol || disabled}` in turn and
    // the six tests here stayed green through both.
    renderPanel(MI_ROL);

    for (const caja of within(filaDe("Postes")).getAllByRole("checkbox")) {
      expect(caja).toBeDisabled();
    }
    expect(screen.getByText(/no puedes cambiarlos/i)).toBeInTheDocument();
  });

  it("does not offer to edit anything to somebody who may only look", () => {
    const solo = sinPermisos();
    solo.roles.ver = true;
    setPermisos(MI_ROL, solo);
    renderPanel();

    for (const caja of within(filaDe("Postes")).getAllByRole("checkbox")) {
      expect(caja).toBeDisabled();
    }
    expect(screen.getByText(/solo puedes consultar/i)).toBeInTheDocument();
  });

  it("offers them to somebody who may edit another role", () => {
    renderPanel(OTRO_ROL);
    for (const caja of within(filaDe("Postes")).getAllByRole("checkbox")) {
      expect(caja).toBeEnabled();
    }
  });

  it("holds every box still while a save is out", () => {
    renderPanel(OTRO_ROL, true);
    for (const caja of within(filaDe("Postes")).getAllByRole("checkbox")) {
      expect(caja).toBeDisabled();
    }
  });
});
