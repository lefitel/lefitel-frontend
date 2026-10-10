// A role's form: its name, its description and what it may do, under one button.
//
// One button and two requests. The name is one resource and the permissions
// another, so an edit that touches both can land half done, and what this file
// pins is that it never does so in silence: only what changed is sent, the
// request that gets interrupted goes first, and when the second half fails the
// notice says which half was saved.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrictMode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import type { RolInterface, SesionInterface } from "../../../interfaces/interfaces";
import { setPermisos, olvidarPermisos, sinPermisos } from "../../../lib/permissions";
import { rechazoDelServidor } from "../../../test/fallos";
import RolDialog from "./RolDialog";

const createRol = vi.hoisted(() => vi.fn());
const editRol = vi.hoisted(() => vi.fn());
const getMatrizPermisos = vi.hoisted(() => vi.fn());
const savePermisos = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../../../api/Rol.api", () => ({ createRol, editRol }));
vi.mock("../../../api/Permisos.api", () => ({ getMatrizPermisos, savePermisos }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess } }));

const MI_ROL = 1;
const CLIENTE = 3;
const sesion = { usuario: { id: 7, id_rol: MI_ROL }, autenticado: true } as unknown as SesionInterface;

const cliente: RolInterface = { id: CLIENTE, name: "Cliente", description: "Solo mira" };

function matriz() {
  return {
    roles: [
      { id: MI_ROL, name: "Administrador", description: null },
      { id: CLIENTE, name: "Cliente", description: "Solo mira" },
    ],
    modulos: [
      { key: "postes", label: "Postes", acciones: ["ver", "crear", "editar", "archivar"] },
      { key: "bitacora", label: "Bitácora", acciones: ["ver"] },
    ],
    acciones: [
      { key: "ver", label: "Ver" },
      { key: "crear", label: "Crear" },
      { key: "editar", label: "Editar" },
      { key: "archivar", label: "Archivar" },
    ],
    permisos: {
      [CLIENTE]: {
        postes: { ver: true, crear: false, editar: false, archivar: false },
        bitacora: { ver: false },
      },
    },
  };
}

function abrir(rol: RolInterface | null = cliente) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const arbol = (r: RolInterface | null, open = true) => (
    <SesionContext.Provider value={{ sesion } as unknown as contextProps}>
      <RolDialog rol={r} open={open} onClose={onClose} onSaved={onSaved} />
    </SesionContext.Provider>
  );
  const { rerender } = render(arbol(rol));
  return {
    onClose, onSaved, user: userEvent.setup(),
    /** What the screen does when it hands the form another role, or closes it. */
    cambiarA: (r: RolInterface | null, open = true) => rerender(arbol(r, open)),
  };
}

/** A request held open, to be answered when the test says. */
function pendiente<T>() {
  let responder: (valor: T) => void = () => {};
  const promesa = new Promise<T>((resolve) => { responder = resolve; });
  return { promesa, responder };
}

const filaDe = (label: string) => screen.getByRole("row", { name: new RegExp(label, "i") });
const guardar = () => screen.getByRole("button", { name: "Guardar cambios" });
const nombre = () => screen.getByLabelText(/^Nombre/);

/** The order the two requests went out in, recorded rather than inferred. */
let orden: string[] = [];

beforeEach(() => {
  olvidarPermisos();
  const p = sinPermisos();
  p.roles.ver = true; p.roles.crear = true; p.roles.editar = true;
  setPermisos(MI_ROL, p);
  createRol.mockReset(); editRol.mockReset();
  getMatrizPermisos.mockReset(); savePermisos.mockReset();
  toastError.mockReset(); toastSuccess.mockReset();
  orden = [];
  getMatrizPermisos.mockResolvedValue(matriz());
  savePermisos.mockImplementation(async () => { orden.push("permisos"); return { status: 200 }; });
  editRol.mockImplementation(async () => { orden.push("datos"); return {}; });
});

describe("opening a role", () => {
  it("shows its name, its description and its permissions", async () => {
    abrir();

    expect(nombre()).toHaveValue("Cliente");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Solo mira");
    await screen.findByText("Postes");
    expect(within(filaDe("Postes")).getAllByRole("checkbox")[0]).toBeChecked();
  });

  it("says so when the permissions could not be loaded, and still lets the name be changed", async () => {
    getMatrizPermisos.mockRejectedValue(rechazoDelServidor(500, "La base no responde."));
    const { user, onSaved } = abrir();

    expect(await screen.findByText(/no se pudieron cargar los permisos/i)).toBeInTheDocument();
    expect(String(toastError.mock.calls[0][0])).toContain("La base no responde");

    await user.clear(nombre());
    await user.type(nombre(), "Invitado");
    await user.click(guardar());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(savePermisos).not.toHaveBeenCalled();
  });

  it("is a form with nothing to press for somebody who may only look", async () => {
    const solo = sinPermisos();
    solo.roles.ver = true;
    setPermisos(MI_ROL, solo);
    abrir();
    await screen.findByText("Postes");

    expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    // Two ways out and both say "Cerrar": the cross in the corner, which is
    // always there, and the footer's own. Counted, because asserting that one
    // exists was true of the cross alone.
    expect(screen.getAllByRole("button", { name: "Cerrar" })).toHaveLength(2);
  });

  it("can still be read with the keyboard by somebody who may only look", async () => {
    // Read-only, not disabled: a disabled field leaves the tab order, and
    // reading is the one thing this person came to do.
    const solo = sinPermisos();
    solo.roles.ver = true;
    setPermisos(MI_ROL, solo);
    const { user } = abrir();
    await screen.findByText("Postes");

    for (const campo of [nombre(), screen.getByLabelText("Descripción")]) {
      expect(campo).toHaveAttribute("readonly");
      expect(campo).not.toBeDisabled();
    }
    await user.type(nombre(), "x");
    expect(nombre()).toHaveValue("Cliente");
  });

  it("ties the name's error to the name", async () => {
    const { user } = abrir();
    await screen.findByText("Postes");

    await user.clear(nombre());
    await user.click(guardar());

    expect(nombre()).toHaveAccessibleDescription("El nombre es requerido");
    expect(nombre()).toBeRequired();
  });
});

describe("what one press of Guardar sends", () => {
  it("only the permissions, when only boxes were ticked", async () => {
    const { user, onSaved } = abrir();
    await screen.findByText("Postes");

    await user.click(within(filaDe("Postes")).getAllByRole("checkbox")[1]);
    await user.click(guardar());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(savePermisos).toHaveBeenCalledWith(CLIENTE, { postes: { crear: true } });
    expect(editRol).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Rol actualizado");
  });

  it("only the name and description, when no box was ticked", async () => {
    const { user, onSaved } = abrir();
    await screen.findByText("Postes");

    await user.clear(nombre());
    await user.type(nombre(), "  Invitado ");
    await user.click(guardar());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(editRol.mock.calls[0][0]).toMatchObject({ id: CLIENTE, name: "Invitado", description: "Solo mira" });
    expect(savePermisos).not.toHaveBeenCalled();
  });

  it("nothing at all when nothing changed, and simply closes", async () => {
    const { user, onClose, onSaved } = abrir();
    await screen.findByText("Postes");

    await user.click(guardar());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(savePermisos).not.toHaveBeenCalled();
    expect(editRol).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("the permissions first and the name after, when both changed", async () => {
    // The permissions route asks for the password every time, so it is the one
    // that gets cancelled. First means a cancellation finds nothing written.
    const { user, onSaved } = abrir();
    await screen.findByText("Postes");

    await user.clear(nombre());
    await user.type(nombre(), "Invitado");
    await user.click(within(filaDe("Bitácora")).getAllByRole("checkbox")[0]);
    await user.click(guardar());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(orden).toEqual(["permisos", "datos"]);
  });

  it("refuses an empty name without asking the server anything", async () => {
    const { user } = abrir();
    await screen.findByText("Postes");

    await user.clear(nombre());
    await user.click(within(filaDe("Postes")).getAllByRole("checkbox")[1]);
    await user.click(guardar());

    expect(screen.getByText("El nombre es requerido")).toBeInTheDocument();
    expect(savePermisos).not.toHaveBeenCalled();
    expect(editRol).not.toHaveBeenCalled();
  });
});

describe("when half of it fails", () => {
  it("writes nothing more once the permissions are refused, and does not say it was saved", async () => {
    savePermisos.mockResolvedValue({ status: 403, message: "Introduce tu contraseña." });
    const { user, onSaved, onClose } = abrir();
    await screen.findByText("Postes");

    await user.clear(nombre());
    await user.type(nombre(), "Invitado");
    await user.click(within(filaDe("Postes")).getAllByRole("checkbox")[1]);
    await user.click(guardar());

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Introduce tu contraseña."));
    expect(editRol).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // Still open on what was typed and ticked, to be tried again.
    expect(nombre()).toHaveValue("Invitado");
    expect(within(filaDe("Postes")).getAllByRole("checkbox")[1]).toBeChecked();
  });

  it("says the permissions were saved when it is the name that fails, and stops resending them", async () => {
    editRol.mockRejectedValue(rechazoDelServidor(400, "El rol necesita un nombre."));
    const { user, onSaved } = abrir();
    await screen.findByText("Postes");

    await user.clear(nombre());
    await user.type(nombre(), "Invitado");
    await user.click(within(filaDe("Postes")).getAllByRole("checkbox")[1]);
    await user.click(guardar());

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const aviso = String(toastError.mock.calls[0][0]);
    expect(aviso).toMatch(/los permisos sí se guardaron/i);
    expect(aviso).toContain("El rol necesita un nombre.");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();

    // What was saved is on screen as saved: still ticked, and no longer
    // counted as something changed.
    expect(within(filaDe("Postes")).getAllByRole("checkbox")[1]).toBeChecked();
    expect(screen.queryByText(/casilla cambiada/)).toBeNull();

    // So the retry carries only what is still missing.
    editRol.mockResolvedValue({});
    await user.click(guardar());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(savePermisos).toHaveBeenCalledTimes(1);
    expect(editRol).toHaveBeenCalledTimes(2);
  });

  it("does not depend on reading the grid back to know the permissions were saved", async () => {
    // It used to: after a half save the grid was read again, and only that
    // read cleared the pending boxes. In the outage that failed the name, the
    // read failed too — the boxes stayed pending over a grid that was gone, and
    // the retry sent them again behind a second password prompt.
    editRol.mockRejectedValue(rechazoDelServidor(500, "La base no responde."));
    const { user } = abrir();
    await screen.findByText("Postes");
    getMatrizPermisos.mockRejectedValue(rechazoDelServidor(500, "La base no responde."));

    await user.clear(nombre());
    await user.type(nombre(), "Invitado");
    await user.click(within(filaDe("Postes")).getAllByRole("checkbox")[1]);
    await user.click(guardar());
    await waitFor(() => expect(toastError).toHaveBeenCalled());

    expect(getMatrizPermisos).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Postes")).toBeInTheDocument();

    await user.click(guardar());
    await waitFor(() => expect(editRol).toHaveBeenCalledTimes(2));
    expect(savePermisos).toHaveBeenCalledTimes(1);
  });

  it("takes a 204 from the permissions for the success it is, and goes on to the name", async () => {
    // Only 200 today. 204 is what this codebase's standard gives a write with
    // nothing to say; read as a failure, the name would never be sent — after
    // the boxes were saved.
    savePermisos.mockImplementation(async () => { orden.push("permisos"); return { status: 204 }; });
    const { user, onSaved } = abrir();
    await screen.findByText("Postes");

    await user.clear(nombre());
    await user.type(nombre(), "Invitado");
    await user.click(within(filaDe("Postes")).getAllByRole("checkbox")[1]);
    await user.click(guardar());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(orden).toEqual(["permisos", "datos"]);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("gives the name's own refusal, with no claim about permissions, when only the name was sent", async () => {
    editRol.mockRejectedValue(rechazoDelServidor(400, "El rol necesita un nombre."));
    const { user } = abrir();
    await screen.findByText("Postes");

    await user.clear(nombre());
    await user.type(nombre(), "Invitado");
    await user.click(guardar());

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("El rol necesita un nombre."));
  });
});

describe("a new role", () => {
  it("is the same form as an existing one: a name, a description and the boxes, all unticked", async () => {
    abrir(null);

    expect(screen.getByRole("heading", { name: "Nuevo rol" })).toBeInTheDocument();
    expect(nombre()).toHaveValue("");
    await screen.findByText("Postes");
    const cajas = screen.getAllByRole("checkbox");
    expect(cajas.length).toBeGreaterThan(0);
    // Nobody's row is read for a role that does not exist yet.
    for (const caja of cajas) {
      expect(caja).not.toBeChecked();
      expect(caja).toBeEnabled();
    }
  });

  it("creates the role and then gives it what was ticked, in that order", async () => {
    // The permissions need the role's number, so the role has to go first.
    createRol.mockImplementation(async () => { orden.push("crear"); return { id: 9, name: "Inspector", description: "" }; });
    const { user, onSaved } = abrir(null);
    await screen.findByText("Postes");

    await user.type(nombre(), "Inspector");
    await user.click(within(filaDe("Postes")).getAllByRole("checkbox")[0]);
    await user.click(within(filaDe("Bitácora")).getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "Crear rol" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(orden).toEqual(["crear", "permisos"]);
    expect(createRol).toHaveBeenCalledWith({ name: "Inspector", description: "" });
    // Against the role the server just made, not against the placeholder.
    expect(savePermisos).toHaveBeenCalledWith(9, { postes: { ver: true }, bitacora: { ver: true } });
    // The name went with the creation; it is not sent a second time.
    expect(editRol).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Rol creado");
  });

  it("creates one with nothing ticked, and says out loud that it can do nothing yet", async () => {
    // A role with every cell denied can do nothing. An administrator who does
    // not know that files a bug about the account being broken.
    createRol.mockResolvedValue({ id: 9, name: "Inspector", description: "" });
    const { user, onSaved } = abrir(null);
    await screen.findByText("Postes");

    await user.type(nombre(), "Inspector");
    await user.click(screen.getByRole("button", { name: "Crear rol" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(savePermisos).not.toHaveBeenCalled();
    expect(String(toastSuccess.mock.calls[0][0])).toMatch(/sin ningún permiso/i);
  });

  it("stays open on the role it made when its permissions are refused, and retries only them", async () => {
    // The role exists by then. Saying "no se pudo crear" would be false, and
    // pressing the button again would make a second one.
    createRol.mockResolvedValue({ id: 9, name: "Inspector", description: "" });
    savePermisos.mockResolvedValueOnce({ status: 403, message: "Introduce tu contraseña." });
    const { user, onSaved, onClose } = abrir(null);
    await screen.findByText("Postes");

    await user.type(nombre(), "Inspector");
    await user.click(within(filaDe("Postes")).getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "Crear rol" }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const aviso = String(toastError.mock.calls[0][0]);
    expect(aviso).toMatch(/el rol se creó, pero sin permisos/i);
    expect(aviso).toContain("Introduce tu contraseña.");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // It is that role's form now: its name on top, the box still ticked, and a
    // button that saves rather than creates.
    expect(screen.getByRole("heading", { name: "Inspector" })).toBeInTheDocument();
    expect(within(filaDe("Postes")).getAllByRole("checkbox")[0]).toBeChecked();
    expect(screen.queryByRole("button", { name: "Crear rol" })).toBeNull();

    await user.click(guardar());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(createRol).toHaveBeenCalledTimes(1);
    expect(savePermisos).toHaveBeenCalledTimes(2);
    expect(savePermisos).toHaveBeenLastCalledWith(9, { postes: { ver: true } });
  });

  it("has the list behind read again when it is closed after making a role", async () => {
    // Closed on the half-done state above, there is a new role in the list
    // whether or not it got its permissions.
    createRol.mockResolvedValue({ id: 9, name: "Inspector", description: "" });
    savePermisos.mockResolvedValue({ status: 403, message: "Introduce tu contraseña." });
    const { user, onSaved, onClose } = abrir(null);
    await screen.findByText("Postes");
    await user.type(nombre(), "Inspector");
    await user.click(within(filaDe("Postes")).getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "Crear rol" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(await screen.findByRole("button", { name: "Descartar" }));

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("is refused without a name, without asking the server", async () => {
    const { user } = abrir(null);

    await user.click(screen.getByRole("button", { name: "Crear rol" }));

    expect(createRol).not.toHaveBeenCalled();
    expect(screen.getByText("El nombre es requerido")).toBeInTheDocument();
  });

  it("shows the server's refusal instead of inventing one", async () => {
    createRol.mockRejectedValue(rechazoDelServidor(400, "El rol necesita un nombre."));
    const { user, onSaved } = abrir(null);

    await user.type(nombre(), "Inspector");
    await user.click(screen.getByRole("button", { name: "Crear rol" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("El rol necesita un nombre."));
    expect(onSaved).not.toHaveBeenCalled();
    // Nothing was made, so nothing is given permissions and the form is still
    // the form of a new role.
    expect(savePermisos).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Crear rol" })).toBeInTheDocument();
  });
});

describe("the role that was saved without a name", () => {
  it("opens under words that say which one it is, with the name empty to be filled", async () => {
    // It happened, and it took the account form down. This is where it is fixed.
    abrir({ id: 7, name: null as unknown as string, description: null as unknown as string });

    expect(screen.getByRole("heading", { name: "Rol sin nombre (#7)" })).toBeInTheDocument();
    expect(nombre()).toHaveValue("");
  });
});

// The grid arrives from the network, and the form is opened, closed and handed
// other roles while it does. What somebody ticked must survive all of that.
describe("what was ticked, against answers that arrive late", () => {
  it("keeps the ticks when a second answer for the same opening lands after them", async () => {
    // In development every effect runs twice, so every opening asks twice. The
    // first answer painted the grid, the person ticked, and the second answer
    // cleared the ticks. Reproduced the way it happened: under StrictMode.
    const primera = pendiente<ReturnType<typeof matriz>>();
    const segunda = pendiente<ReturnType<typeof matriz>>();
    getMatrizPermisos.mockReturnValueOnce(primera.promesa).mockReturnValueOnce(segunda.promesa);
    const user = userEvent.setup();
    render(
      <StrictMode>
        <SesionContext.Provider value={{ sesion } as unknown as contextProps}>
          <RolDialog rol={cliente} open onClose={vi.fn()} onSaved={vi.fn()} />
        </SesionContext.Provider>
      </StrictMode>,
    );
    expect(getMatrizPermisos).toHaveBeenCalledTimes(2);

    await act(async () => { segunda.responder(matriz()); });
    await user.click(within(filaDe("Postes")).getAllByRole("checkbox")[1]);
    expect(screen.getByText("1 casilla cambiada")).toBeInTheDocument();

    await act(async () => { primera.responder(matriz()); });

    expect(within(filaDe("Postes")).getAllByRole("checkbox")[1]).toBeChecked();
    expect(screen.getByText("1 casilla cambiada")).toBeInTheDocument();
  });

  it("ignores the answer for a role it is no longer open on", async () => {
    const delCliente = pendiente<ReturnType<typeof matriz>>();
    const delOtro = pendiente<ReturnType<typeof matriz>>();
    getMatrizPermisos.mockReturnValueOnce(delCliente.promesa).mockReturnValueOnce(delOtro.promesa);
    const otro: RolInterface = { id: 5, name: "Inspector", description: "" };
    const { cambiarA } = abrir();

    cambiarA(otro);
    const conPermisosDelOtro = matriz();
    (conPermisosDelOtro.permisos as Record<number, unknown>)[5] = {
      postes: { ver: false, crear: false, editar: false, archivar: true },
      bitacora: { ver: false },
    };
    await act(async () => { delOtro.responder(conPermisosDelOtro); });
    await act(async () => { delCliente.responder(matriz()); });

    // The grid is the second role's: only its last box is ticked.
    const cajas = within(filaDe("Postes")).getAllByRole("checkbox");
    expect(cajas[0]).not.toBeChecked();
    expect(cajas[3]).toBeChecked();
  });

  it("says nothing about a failure that arrives after the form was closed", async () => {
    // Rejected for real, and after the close. An earlier version of this test
    // resolved the promise instead, and so passed with the guard taken out.
    let rechazar: (motivo: unknown) => void = () => {};
    getMatrizPermisos.mockReturnValueOnce(new Promise((_, reject) => { rechazar = reject; }));
    const { cambiarA } = abrir();

    cambiarA(null, false);
    await act(async () => { rechazar(rechazoDelServidor(500, "La base no responde.")); });

    expect(toastError).not.toHaveBeenCalled();
  });

  it("does say so when the same failure arrives with the form still open", async () => {
    // The control for the test above: the notice exists, and it is the close
    // that silences it.
    let rechazar: (motivo: unknown) => void = () => {};
    getMatrizPermisos.mockReturnValueOnce(new Promise((_, reject) => { rechazar = reject; }));
    abrir();

    await act(async () => { rechazar(rechazoDelServidor(500, "La base no responde.")); });

    expect(toastError).toHaveBeenCalledWith("La base no responde.");
  });
});

describe("the form handed another role while open", () => {
  it("starts over on that role: its name, its boxes, nothing pending", async () => {
    const otro: RolInterface = { id: 5, name: "Inspector", description: "Revisa" };
    const { user, cambiarA } = abrir();
    await screen.findByText("Postes");
    await user.clear(nombre());
    await user.type(nombre(), "a medias");
    await user.click(within(filaDe("Postes")).getAllByRole("checkbox")[1]);

    cambiarA(otro);

    expect(nombre()).toHaveValue("Inspector");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Revisa");
    expect(screen.getByRole("heading", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.queryByText(/casilla cambiada/)).toBeNull();
  });
});

describe("somebody who may create roles and not edit them", () => {
  beforeEach(() => {
    const p = sinPermisos();
    p.roles.ver = true; p.roles.crear = true;
    setPermisos(MI_ROL, p);
  });

  it("is given a name and a description, and no boxes the server would refuse", () => {
    // Handing out permissions is `roles.editar`. Shown the grid, this person
    // would tick it, create the role, and be refused the second half.
    abrir(null);

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(getMatrizPermisos).not.toHaveBeenCalled();
    expect(screen.getByText(/necesita el permiso de editar roles/i)).toBeInTheDocument();
    expect(screen.queryByText(/marca lo que puede hacer/i)).toBeNull();
  });

  it("can still create it", async () => {
    createRol.mockResolvedValue({ id: 9, name: "Inspector" });
    const { user, onSaved } = abrir(null);

    await user.type(nombre(), "Inspector");
    await user.click(screen.getByRole("button", { name: "Crear rol" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(savePermisos).not.toHaveBeenCalled();
    expect(String(toastSuccess.mock.calls[0][0])).toMatch(/sin ningún permiso/i);
  });
});
