// The users screen.
//
// It is called «Usuarios» now and lives at `/app/usuarios`; the file keeps the
// name of the permission module it is gated on. Until this file it had no test
// at all, so nothing held its title, its links, or the one thing an audit found
// wrong with it: it offered "Nuevo Usuario" to somebody the server would refuse.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { SesionContext, type contextProps } from "../../context/SesionContext";
import { usuarioExample } from "../../data/example";
import { olvidarPermisos, setPermisos, sinPermisos, type Accion } from "../../lib/permissions";
import { TooltipProvider } from "../../components/ui/tooltip";
import SeguridadPage from "./SeguridadPage";

const getUsuario = vi.hoisted(() => vi.fn());
vi.mock("../../api/Usuario.api", async (original) => ({
  ...(await original<object>()),
  getUsuario,
}));
// The form has a file of its own; here it only has to say that it opened.
vi.mock("../../components/dialogs/upsert/UsuarioSheet", () => ({
  default: ({ open, usuario }: { open: boolean; usuario?: { id: number } | null }) =>
    open ? <div role="dialog">{usuario ? `editar usuario ${usuario.id}` : "usuario nuevo"}</div> : null,
}));

const ROL = 1;

const fila = (id: number, extra: object = {}) => ({
  id, name: `Persona${id}`, lastname: "Paz", birthday: "1976-06-22T13:41:57.000Z",
  image: "", phone: "700", user: `u${id}`, id_rol: 2,
  rol: { id: 2, name: "Coordinador", description: "" },
  ...extra,
});

/** Grant these actions on `seguridad`, and these on `roles`. */
function puede(seguridad: Accion[], roles: Accion[] = []) {
  const p = sinPermisos();
  for (const a of seguridad) p.seguridad[a] = true;
  for (const a of roles) p.roles[a] = true;
  setPermisos(ROL, p);
}

const Ficha = () => <div>ficha del usuario {useParams().id}</div>;

function renderPage() {
  const sesion: contextProps = {
    sesion: { usuario: { ...usuarioExample, id: 99, id_rol: ROL }, autenticado: true },
    setSesion: vi.fn(), loading: false, logout: vi.fn(),
  };
  render(
    <MemoryRouter initialEntries={["/app/usuarios"]}>
      <TooltipProvider>
        <SesionContext.Provider value={sesion}>
          <Routes>
            <Route path="/app/usuarios" element={<SeguridadPage />} />
            <Route path="/app/usuarios/:id" element={<Ficha />} />
          </Routes>
        </SesionContext.Provider>
      </TooltipProvider>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  olvidarPermisos();
  getUsuario.mockReset();
  getUsuario.mockResolvedValue([fila(1), fila(4)]);
});

describe("the users screen", () => {
  it("is titled for what is on it, and no longer holds the permissions", async () => {
    puede(["ver"], ["ver"]);
    renderPage();

    expect(screen.getByRole("heading", { name: "Usuarios" })).toBeInTheDocument();
    await screen.findByRole("button", { name: "Persona4" });
    // Roles and permissions have a screen of their own; as a tab here they
    // also needed this screen's permission to be reached.
    expect(screen.queryByRole("tab", { name: "Permisos" })).toBeNull();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Activos", "Archivados"]);
  });

  it("opens an account at the screen's new address", async () => {
    puede(["ver"]);
    const user = renderPage();

    await user.click(await screen.findByRole("button", { name: "Persona4" }));

    expect(screen.getByText("ficha del usuario 4")).toBeInTheDocument();
  });
});

// Creating an account is also handing out a role. The server asks for
// `roles.editar` as well, and the form cannot list the roles without
// `roles.ver`. Offered on `seguridad.crear` alone, the form filled in whole,
// uploaded the photo and was then refused — with a critical line in the audit
// log against somebody who had only used the button they were given.
describe("offering a new account", () => {
  const boton = () => screen.findByRole("button", { name: "Nuevo Usuario" });

  it("offers it to somebody who may also see and hand out roles", async () => {
    puede(["ver", "crear"], ["ver", "editar"]);
    const user = renderPage();

    await user.click(await boton());

    expect(screen.getByRole("dialog")).toHaveTextContent("usuario nuevo");
  });

  for (const [caso, roles] of [
    ["no permission on roles at all", []],
    ["only the one to see them", ["ver"]],
    ["only the one to edit them", ["editar"]],
  ] as const) {
    it(`holds it, and says what is missing, for somebody with ${caso}`, async () => {
      puede(["ver", "crear"], [...roles]);
      renderPage();

      const nuevo = await boton();
      expect(nuevo).toBeDisabled();
      expect(nuevo).toHaveAttribute("title", expect.stringMatching(/permiso de ver y editar roles/));
    });
  }

  it("does not show it at all to somebody who may not create accounts", async () => {
    puede(["ver"], ["ver", "editar"]);
    renderPage();
    await screen.findByRole("button", { name: "Persona4" });

    expect(screen.queryByRole("button", { name: "Nuevo Usuario" })).toBeNull();
  });
});

describe("the role beside each account", () => {
  it("is named the way the roles screen names it when it has no name", async () => {
    // Three screens called this role three different things.
    puede(["ver"]);
    getUsuario.mockResolvedValue([fila(1, { id_rol: 7, rol: { id: 7, name: null, description: null } })]);
    renderPage();

    expect(await screen.findByText("Rol sin nombre (#7)")).toBeInTheDocument();
  });

  it("is its number when the role did not arrive, which is what an archived role looks like", async () => {
    puede(["ver"]);
    getUsuario.mockResolvedValue([fila(1, { id_rol: 7, rol: null })]);
    renderPage();

    expect(await screen.findByText("Rol #7")).toBeInTheDocument();
  });
});

// Bringing an account back is the same permission as archiving it, on the
// server as well. Offered to everybody who could see the list, the button
// asked for confirmation and then answered 403.
describe("bringing an archived account back", () => {
  const abrirArchivados = async () => {
    getUsuario.mockImplementation(async (archivados = false) =>
      archivados ? [fila(15, { deletedAt: "2026-09-01T12:00:00.000Z" })] : [fila(1)]);
    const user = renderPage();
    await user.click(await screen.findByRole("tab", { name: "Archivados" }));
    await screen.findByText("Persona15");
    return user;
  };

  it("is offered to somebody who may archive accounts", async () => {
    puede(["ver", "archivar"]);
    await abrirArchivados();

    expect(screen.getByRole("button", { name: "Desarchivar" })).toBeInTheDocument();
  });

  it("is not offered to somebody who may only look", async () => {
    puede(["ver"]);
    await abrirArchivados();

    expect(screen.queryByRole("button", { name: "Desarchivar" })).toBeNull();
  });
});
