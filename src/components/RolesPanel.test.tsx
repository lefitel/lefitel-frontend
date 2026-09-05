// Managing roles from the screen, and the refusal that has to survive the trip.
//
// Archiving a role used to be a real DELETE against a table `usuarios.id_rol`
// cascades from — measured at six users and 4.835 revisions. The server refuses
// now while any account still holds the role, and answers 409 with the count.
// That count is the whole value of the guard: without it the administrator is
// told "no se pudo" and left hunting a user list for accounts that may not be
// on the current page. The house convention in `src/api` is `.catch(() => 400)`,
// which would have thrown the sentence away, so this file pins that it arrives.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SesionContext, type contextProps } from "../context/SesionContext";
import type { SesionInterface } from "../interfaces/interfaces";
import { setPermisos, olvidarPermisos, sinPermisos } from "../lib/permissions";
import RolesPanel from "./RolesPanel";
import { rechazoDelServidor } from "../test/fallos";

const getRol = vi.hoisted(() => vi.fn());
const createRol = vi.hoisted(() => vi.fn());
const archiveRol = vi.hoisted(() => vi.fn());
const desarchivarRol = vi.hoisted(() => vi.fn());
const editRol = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../api/Rol.api", () => ({ getRol, createRol, editRol, archiveRol, desarchivarRol }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess } }));

const ROL = 1;
const sesion = { usuario: { id: 7, id_rol: ROL }, autenticado: true } as unknown as SesionInterface;

function renderPanel() {
  const onChange = vi.fn();
  render(
    <SesionContext.Provider value={{ sesion } as unknown as contextProps}>
      <RolesPanel onChange={onChange} />
    </SesionContext.Provider>,
  );
  return { onChange };
}

/** Everything granted on `roles`, which is what this panel is gated on. */
function todoSobreRoles() {
  const p = sinPermisos();
  p.roles.ver = true; p.roles.crear = true; p.roles.editar = true; p.roles.archivar = true;
  return p;
}

beforeEach(() => {
  olvidarPermisos();
  setPermisos(ROL, todoSobreRoles());
  getRol.mockReset(); createRol.mockReset(); editRol.mockReset();
  archiveRol.mockReset(); desarchivarRol.mockReset();
  toastError.mockReset(); toastSuccess.mockReset();
  getRol.mockResolvedValue([
    { id: 1, name: "Administrador", description: "Todo" },
    { id: 4, name: "Supervisor de campo", description: "" },
  ]);
});

describe("RolesPanel", () => {
  it("lists the roles the server sends", async () => {
    renderPanel();

    expect(await screen.findByText("Supervisor de campo")).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
  });

  it("marks which one is yours, so you do not archive your own way in", async () => {
    renderPanel();

    expect(await screen.findByText("el tuyo")).toBeInTheDocument();
  });

  it("shows the server's refusal verbatim, with the number of accounts", async () => {
    // Since C4 the refusal travels the way every other refusal does: the call
    // rejects and `mensajeDeError` reads the server's own sentence off it. The
    // bespoke `{status, message, cuentas}` this used to mock no longer exists,
    // and `cuentas` never had a reader outside this fixture.
    archiveRol.mockRejectedValue(
      rechazoDelServidor(409, "No se puede archivar: hay 3 cuentas con este rol. Cámbiales el rol antes de archivarlo."),
    );
    renderPanel();
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole("button", { name: /archivar/i }))[0]);
    await user.click(await screen.findByRole("button", { name: /^archivar$/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0][0])).toContain("3 cuentas");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("does not tell the parent to reload when the archive was refused", async () => {
    archiveRol.mockRejectedValue(rechazoDelServidor(409, "No se puede archivar: hay 1 cuenta con este rol."));
    const { onChange } = renderPanel();
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole("button", { name: /archivar/i }))[0]);
    await user.click(await screen.findByRole("button", { name: /^archivar$/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("archives when nobody holds the role, and tells the parent to reload the matrix", async () => {
    archiveRol.mockResolvedValue(undefined);
    const { onChange } = renderPanel();
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole("button", { name: /archivar/i }))[0]);
    await user.click(await screen.findByRole("button", { name: /^archivar$/i }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Rol archivado"));
    expect(onChange).toHaveBeenCalled();
  });

  it("creates a role and says out loud that it has no permissions yet", async () => {
    // The server seeds thirty-two denied cells, so a new role can do nothing until
    // somebody grants it something. An administrator who does not know that
    // files a bug about the account being broken.
    createRol.mockResolvedValue({ id: 9, name: "Inspector" });
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /nuevo rol/i }));
    await user.type(screen.getByPlaceholderText(/supervisor de campo/i), "Inspector");
    await user.click(screen.getByRole("button", { name: /crear rol/i }));

    await waitFor(() => expect(createRol).toHaveBeenCalled());
    expect(createRol.mock.calls[0][0]).toMatchObject({ name: "Inspector" });
    expect(String(toastSuccess.mock.calls[0][0])).toMatch(/sin ningún permiso/i);
  });

  it("refuses to create a role with no name, without asking the server", async () => {
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /nuevo rol/i }));
    await user.click(screen.getByRole("button", { name: /crear rol/i }));

    expect(createRol).not.toHaveBeenCalled();
    expect(screen.getByText(/el nombre es requerido/i)).toBeInTheDocument();
  });

  it("hides every action from a role that may only look", async () => {
    const solo = sinPermisos();
    solo.roles.ver = true;
    setPermisos(ROL, solo);
    renderPanel();

    expect(await screen.findByText("Supervisor de campo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nuevo rol/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /archivar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
  });

  it("asks for the archived ones when the archived tab is chosen", async () => {
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("tab", { name: /archivados/i }));

    await waitFor(() => expect(getRol).toHaveBeenLastCalledWith(true));
  });
});
