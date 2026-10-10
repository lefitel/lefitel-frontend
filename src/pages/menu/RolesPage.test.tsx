// Roles and permissions: a list like every other list here, and a role opens
// in a form.
//
// Archiving a role used to be a real DELETE against a table `usuarios.id_rol`
// cascades from — measured at six users and 4.835 revisions. The server refuses
// now while any account still holds the role, and answers 409 with the count.
// That count is the whole value of the guard: without it the administrator is
// told "no se pudo" and left hunting a user list for accounts that may not be
// on the current page. So this file pins that the sentence arrives, and that
// the count is on the list before anybody presses.
//
// The form has a file of its own. Here it is a stand-in that says which role it
// was opened on, which is all the list decides.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { SesionContext, type contextProps } from "../../context/SesionContext";
import type { RolInterface, SesionInterface } from "../../interfaces/interfaces";
import { setPermisos, olvidarPermisos, sinPermisos } from "../../lib/permissions";
import { rechazoDelServidor } from "../../test/fallos";
import RolesPage from "./RolesPage";

const getRol = vi.hoisted(() => vi.fn());
const archiveRol = vi.hoisted(() => vi.fn());
const desarchivarRol = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastInfo = vi.hoisted(() => vi.fn());

const getMatrizPermisos = vi.hoisted(() => vi.fn());

vi.mock("../../api/Rol.api", () => ({ getRol, archiveRol, desarchivarRol }));
vi.mock("../../api/Permisos.api", () => ({ getMatrizPermisos }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess, info: toastInfo } }));
vi.mock("../../components/dialogs/upsert/RolDialog", () => ({
  default: ({ rol, open, onClose, onSaved }: {
    rol: RolInterface | null; open: boolean; onClose: () => void; onSaved: () => void;
  }) => open ? (
    <div role="dialog" aria-label="formulario de rol">
      <p>{rol ? `formulario del rol ${rol.id}` : "formulario de rol nuevo"}</p>
      <button type="button" onClick={onClose}>cerrar formulario</button>
      <button type="button" onClick={() => onSaved()}>guardar formulario</button>
    </div>
  ) : null,
}));

const ROL = 1;
const sesion = { usuario: { id: 7, id_rol: ROL }, autenticado: true } as unknown as SesionInterface;

const ACTIVOS = [
  { id: 1, name: "Administrador", description: "Todo", cuentas: 3, cuentasArchivadas: 0 },
  { id: 4, name: "Supervisor de campo", description: "", cuentas: 0, cuentasArchivadas: 0 },
];
const ARCHIVADOS = [{ id: 6, name: "Becario", description: "", deletedAt: "2026-09-01T12:00:00.000Z" }];

/** Prints the address, so a test can see what the page did to it. */
function Direccion() {
  const { pathname, search } = useLocation();
  return <p data-testid="direccion">{pathname + search}</p>;
}

/** What each role may do, as the server sends it for the whole list at once. */
function matriz() {
  return {
    roles: [],
    modulos: [
      { key: "postes", label: "Postes", acciones: ["ver", "crear", "editar", "archivar"] },
      { key: "eventos", label: "Eventos", acciones: ["ver", "crear", "editar", "archivar"] },
      { key: "bitacora", label: "Bitácora", acciones: ["ver"] },
    ],
    acciones: [
      { key: "ver", label: "Ver" }, { key: "crear", label: "Crear" },
      { key: "editar", label: "Editar" }, { key: "archivar", label: "Archivar" },
    ],
    permisos: {
      1: {
        postes: { ver: true, crear: true, editar: true, archivar: true },
        eventos: { ver: true, crear: true, editar: false, archivar: false },
        bitacora: { ver: true },
      },
      4: {
        // Granted a write on a module it cannot open: counted, not listed.
        postes: { ver: false, crear: true, editar: false, archivar: false },
        eventos: { ver: true, crear: false, editar: false, archivar: false },
        bitacora: { ver: false },
      },
    },
  };
}

function renderPage(direccion = "/app/roles") {
  render(
    <MemoryRouter initialEntries={[direccion]}>
      <SesionContext.Provider value={{ sesion } as unknown as contextProps}>
        <RolesPage />
      </SesionContext.Provider>
      <Direccion />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

/** Everything granted on `roles`, which is what this screen is gated on. */
function todoSobreRoles() {
  const p = sinPermisos();
  p.roles.ver = true; p.roles.crear = true; p.roles.editar = true; p.roles.archivar = true;
  return p;
}

const filaDe = async (nombre: string) => {
  const celda = await screen.findByRole("button", { name: nombre });
  return celda.closest("tr") as HTMLElement;
};

/** Open a row's menu and press one of its entries. */
async function accion(user: ReturnType<typeof userEvent.setup>, rol: string, entrada: string) {
  await screen.findByRole("button", { name: rol });
  await user.click(screen.getByRole("button", { name: `Acciones de ${rol}` }));
  await user.click(await screen.findByRole("menuitem", { name: entrada }));
}

beforeEach(() => {
  olvidarPermisos();
  setPermisos(ROL, todoSobreRoles());
  getRol.mockReset(); archiveRol.mockReset(); desarchivarRol.mockReset();
  toastError.mockReset(); toastSuccess.mockReset(); toastInfo.mockReset();
  getRol.mockImplementation(async (archived = false) => (archived ? ARCHIVADOS : ACTIVOS));
  getMatrizPermisos.mockReset();
  getMatrizPermisos.mockResolvedValue(matriz());
});

describe("the list of roles", () => {
  it("lists the roles the server sends, under the screen's own title", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Roles y permisos" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Supervisor de campo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Administrador" })).toBeInTheDocument();
  });

  it("marks which one is yours, so you do not archive your own way in", async () => {
    renderPage();

    expect(within(await filaDe("Administrador")).getByText("el tuyo")).toBeInTheDocument();
    expect(within(await filaDe("Supervisor de campo")).queryByText("el tuyo")).toBeNull();
  });

  it("says how many accounts hold each role, before anybody tries to archive it", async () => {
    renderPage();

    expect(within(await filaDe("Administrador")).getByText("3")).toBeInTheDocument();
    expect(within(await filaDe("Supervisor de campo")).getByText("0")).toBeInTheDocument();
    expect(screen.queryByText(/archivada/)).toBeNull();
  });

  it("says how many of them are archived accounts, which no list of users will show", async () => {
    // They keep the role from being archived just the same. "0" beside a role
    // that two archived accounts hold was the list vouching for an archive the
    // server refuses.
    getRol.mockResolvedValue([
      { id: 5, name: "Inspector", description: "", cuentas: 2, cuentasArchivadas: 2 },
      { id: 2, name: "Coordinador", description: "", cuentas: 6, cuentasArchivadas: 1 },
    ]);
    renderPage();

    expect(await filaDe("Inspector")).toHaveTextContent("2 (2 archivadas)");
    expect(await filaDe("Coordinador")).toHaveTextContent("6 (1 archivada)");
  });

  it("gives a name to the role that was saved without one, so it can be opened and fixed", async () => {
    getRol.mockResolvedValue([{ id: 7, name: null, description: null, cuentas: 0 }]);
    const user = renderPage();

    await user.click(await screen.findByRole("button", { name: "Rol sin nombre (#7)" }));

    expect(screen.getByText("formulario del rol 7")).toBeInTheDocument();
  });
});

describe("opening a role", () => {
  it("opens its form when its name is pressed", async () => {
    const user = renderPage();

    await user.click(await screen.findByRole("button", { name: "Supervisor de campo" }));

    expect(screen.getByText("formulario del rol 4")).toBeInTheDocument();
  });

  it("opens its form when anywhere on its row is pressed", async () => {
    const user = renderPage();

    await user.click(within(await filaDe("Supervisor de campo")).getByText("0"));

    expect(screen.getByText("formulario del rol 4")).toBeInTheDocument();
  });

  it("opens its form from the row's menu", async () => {
    const user = renderPage();

    await accion(user, "Administrador", "Editar");

    expect(screen.getByText("formulario del rol 1")).toBeInTheDocument();
  });

  it("reads the list again once the form has saved, and closes it", async () => {
    const user = renderPage();
    await user.click(await screen.findByRole("button", { name: "Supervisor de campo" }));

    await user.click(screen.getByRole("button", { name: "guardar formulario" }));

    await waitFor(() => expect(getRol).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not read the list again when the form was only closed", async () => {
    const user = renderPage();
    await user.click(await screen.findByRole("button", { name: "Supervisor de campo" }));

    await user.click(screen.getByRole("button", { name: "cerrar formulario" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getRol).toHaveBeenCalledTimes(1);
  });
});

describe("a new role", () => {
  it("opens an empty form", async () => {
    const user = renderPage();

    await user.click(await screen.findByRole("button", { name: /nuevo rol/i }));

    expect(screen.getByText("formulario de rol nuevo")).toBeInTheDocument();
  });

  it("closes and reads the list again once it is made, with nothing left to open", async () => {
    // The form gives a new role its permissions as it makes it, so there is no
    // second step to send the person to.
    const user = renderPage();
    await user.click(await screen.findByRole("button", { name: /nuevo rol/i }));
    getRol.mockResolvedValue([{ id: 9, name: "Inspector", description: "", cuentas: 0 }, ...ACTIVOS]);

    await user.click(screen.getByRole("button", { name: "guardar formulario" }));

    expect(await screen.findByRole("button", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves alone a form the person opened while the list was reloading", async () => {
    const user = renderPage();
    await user.click(await screen.findByRole("button", { name: /nuevo rol/i }));
    let entregar: (lista: unknown[]) => void = () => {};
    getRol.mockImplementation(() => new Promise((resolve) => { entregar = resolve; }));

    await user.click(screen.getByRole("button", { name: "guardar formulario" }));
    await waitFor(() => expect(getRol).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "Supervisor de campo" }));

    await act(async () => {
      entregar([{ id: 9, name: "Inspector", description: "", cuentas: 0 }, ...ACTIVOS]);
    });

    expect(screen.getByText("formulario del rol 4")).toBeInTheDocument();
  });
});

describe("archiving a role", () => {
  it("shows the server's refusal verbatim, with the number of accounts", async () => {
    archiveRol.mockRejectedValue(
      rechazoDelServidor(409, "No se puede archivar: hay 3 cuentas con este rol. Cámbiales el rol antes de archivarlo."),
    );
    const user = renderPage();

    await accion(user, "Administrador", "Archivar");
    await user.click(await screen.findByRole("button", { name: "Archivar" }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0][0])).toContain("3 cuentas");
    expect(toastSuccess).not.toHaveBeenCalled();
    // Nothing changed, so nothing is read again.
    expect(getRol).toHaveBeenCalledTimes(1);
  });

  it("archives when nobody holds the role, and reads the list again", async () => {
    archiveRol.mockResolvedValue(undefined);
    const user = renderPage();

    await accion(user, "Supervisor de campo", "Archivar");
    await user.click(await screen.findByRole("button", { name: "Archivar" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Rol archivado"));
    expect(archiveRol).toHaveBeenCalledWith(4);
    await waitFor(() => expect(getRol).toHaveBeenCalledTimes(2));
  });

  it("does not open the role it is archiving", async () => {
    // The row opens the form on a click, and a click on a menu entry is a
    // click inside the row as far as React is concerned.
    const user = renderPage();

    await accion(user, "Supervisor de campo", "Archivar");

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.queryByText("formulario del rol 4")).toBeNull();
  });
});

describe("somebody who may only look", () => {
  beforeEach(() => {
    const solo = sinPermisos();
    solo.roles.ver = true;
    setPermisos(ROL, solo);
  });

  it("is offered nothing that writes", async () => {
    const user = renderPage();
    await screen.findByRole("button", { name: "Supervisor de campo" });
    // Nor told it can change anything.
    expect(screen.getByText("Pulsa un rol para ver lo que puede hacer")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /nuevo rol/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Acciones de Supervisor de campo" }));
    expect(await screen.findByRole("menuitem", { name: "Ver permisos" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Archivar" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Editar" })).toBeNull();
  });

  it("can still open a role to read what it may do", async () => {
    const user = renderPage();

    await user.click(await screen.findByRole("button", { name: "Supervisor de campo" }));

    expect(screen.getByText("formulario del rol 4")).toBeInTheDocument();
  });
});

describe("the archived roles", () => {
  it("are asked for when their tab is chosen, and not before", async () => {
    const user = renderPage();
    await screen.findByRole("button", { name: "Supervisor de campo" });
    expect(getRol).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("tab", { name: /archivados/i }));

    await waitFor(() => expect(getRol).toHaveBeenLastCalledWith(true));
    expect(await screen.findByText("Becario")).toBeInTheDocument();
  });

  it("cannot be opened: there is nothing in them to grant", async () => {
    const user = renderPage();
    await user.click(await screen.findByRole("tab", { name: /archivados/i }));

    await user.click(await screen.findByText("Becario"));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("come back with one press, and both lists are read again", async () => {
    desarchivarRol.mockResolvedValue(undefined);
    const user = renderPage();
    await user.click(await screen.findByRole("tab", { name: /archivados/i }));
    await screen.findByText("Becario");
    const antes = getRol.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Desarchivar" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Rol restaurado"));
    expect(desarchivarRol).toHaveBeenCalledWith(6);
    await waitFor(() => expect(getRol.mock.calls.length).toBe(antes + 2));
    // One of each, not the same list twice: the role left one and joined the other.
    const nuevas = getRol.mock.calls.slice(antes).map(([archivados]) => archivados === true);
    expect(nuevas.sort()).toEqual([false, true]);
  });

  it("asks once and says so once when a refresh of them fails", async () => {
    // A failed read left the list empty-handed, and "read whenever it is
    // empty-handed" answered by reading again: two requests, two notices.
    const user = renderPage();
    await user.click(await screen.findByRole("tab", { name: /archivados/i }));
    await screen.findByText("Becario");
    const antes = getRol.mock.calls.length;
    getRol.mockRejectedValue(new Error("sin red"));

    await user.click(screen.getAllByRole("button", { name: "Refrescar" }).at(-1)!);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("No se pudieron cargar los roles archivados"));
    await act(async () => { await Promise.resolve(); });
    expect(getRol.mock.calls.length).toBe(antes + 1);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("are read again after a role is archived, the next time their tab is shown", async () => {
    archiveRol.mockResolvedValue(undefined);
    const user = renderPage();
    await user.click(await screen.findByRole("tab", { name: /archivados/i }));
    await screen.findByText("Becario");
    await user.click(screen.getByRole("tab", { name: /activos/i }));

    await accion(user, "Supervisor de campo", "Archivar");
    await user.click(await screen.findByRole("button", { name: "Archivar" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Rol archivado"));
    const antes = getRol.mock.calls.filter(([archivados]) => archivados === true).length;

    await user.click(screen.getByRole("tab", { name: /archivados/i }));

    await waitFor(() =>
      expect(getRol.mock.calls.filter(([archivados]) => archivados === true).length).toBe(antes + 1));
  });

  it("shows the server's refusal when one cannot come back", async () => {
    desarchivarRol.mockRejectedValue(rechazoDelServidor(409, "Ya existe un rol activo con ese nombre."));
    const user = renderPage();
    await user.click(await screen.findByRole("tab", { name: /archivados/i }));
    await screen.findByText("Becario");

    await user.click(screen.getByRole("button", { name: "Desarchivar" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Ya existe un rol activo con ese nombre."));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe("a role named in the address, which is how the Bitácora links to one", () => {
  it("opens that role's form once the list is in", async () => {
    renderPage("/app/roles?rol=4");

    expect(await screen.findByText("formulario del rol 4")).toBeInTheDocument();
  });

  it("takes the role out of the address, so a reload does not open it again", async () => {
    // Asserted on the address itself. "Does not reopen" below is held by a
    // guard inside the page and would stay green with the address untouched —
    // and the address is what a reload reads.
    renderPage("/app/roles?rol=4");
    await screen.findByText("formulario del rol 4");

    // The router applies the change a tick after the effect asks for it.

    await waitFor(() => expect(screen.getByTestId("direccion")).toHaveTextContent(/^\/app\/roles$/));
  });

  it("clears the address for an archived role and for one that is gone, too", async () => {
    renderPage("/app/roles?rol=6");
    await waitFor(() => expect(toastInfo).toHaveBeenCalled());
    // The router applies the change a tick after the effect asks for it.
    await waitFor(() => expect(screen.getByTestId("direccion")).toHaveTextContent(/^\/app\/roles$/));
  });

  it("does not open it again after the form is closed and the list is read again", async () => {
    // Every `load()` — and there is one after each save — runs the effect that
    // reads the address again. What stops it reopening is that the request is
    // attended once.
    const user = renderPage("/app/roles?rol=4");
    await screen.findByText("formulario del rol 4");

    await user.click(screen.getByRole("button", { name: "cerrar formulario" }));
    await user.click(screen.getByRole("button", { name: "Refrescar" }));
    await waitFor(() => expect(getRol.mock.calls.filter((c) => !c[0]).length).toBe(2));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("looks among the archived before saying anything, and shows that tab", async () => {
    renderPage("/app/roles?rol=6");

    await waitFor(() => expect(toastInfo).toHaveBeenCalledWith("«Becario» está archivado"));
    expect(await screen.findByText("Becario")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("says it is gone only when it is in neither list", async () => {
    renderPage("/app/roles?rol=99");

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("El rol #99 ya no existe"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens nothing when the address names no role", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Administrador" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getRol).toHaveBeenCalledTimes(1);
  });
});

// A list that said a role's name and how many accounts hold it said nothing
// about the role. What it is for is what it may do.
describe("what each role may do, on the list", () => {
  it("names the modules it can open", async () => {
    renderPage();

    const admin = await filaDe("Administrador");
    await waitFor(() => expect(within(admin).getByText("Postes")).toBeInTheDocument());
    expect(within(admin).getByText("Eventos")).toBeInTheDocument();
    expect(within(admin).getByText("Bitácora")).toBeInTheDocument();

    // Only what it may `ver`: a write on a module it cannot open is not a
    // screen it can reach.
    const supervisor = await filaDe("Supervisor de campo");
    expect(within(supervisor).getByText("Eventos")).toBeInTheDocument();
    expect(within(supervisor).queryByText("Postes")).toBeNull();
  });

  it("counts the boxes it has ticked out of the ones that exist", async () => {
    renderPage();

    // Nine boxes exist: four, four, and the one a log has.
    await waitFor(async () => expect(await filaDe("Administrador")).toHaveTextContent("7 de 9"));
    expect(await filaDe("Supervisor de campo")).toHaveTextContent("2 de 9");
  });

  it("says so of a role that can open nothing", async () => {
    getRol.mockResolvedValue([{ id: 8, name: "nuevo", description: "", cuentas: 0 }]);
    renderPage();

    const fila = await filaDe("nuevo");
    await waitFor(() => expect(within(fila).getByText("Ningún módulo")).toBeInTheDocument());
    expect(fila).toHaveTextContent("0 de 9");
  });

  it("still lists the roles, with a dash in both columns, when that cannot be read", async () => {
    getMatrizPermisos.mockRejectedValue(new Error("sin red"));
    const user = renderPage();

    const fila = await filaDe("Administrador");
    expect(within(fila).getAllByText("—").length).toBeGreaterThanOrEqual(2);
    // And says nothing: the list is the screen, and the form says it on opening.
    expect(toastError).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Administrador" }));
    expect(screen.getByText("formulario del rol 1")).toBeInTheDocument();
  });

  it("is read again with the list after a save, since a save is what changes it", async () => {
    const user = renderPage();
    await user.click(await screen.findByRole("button", { name: "Supervisor de campo" }));
    const antes = getMatrizPermisos.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "guardar formulario" }));

    await waitFor(() => expect(getMatrizPermisos.mock.calls.length).toBe(antes + 1));
  });
});
