// The route table itself, mounted.
//
// Every other test of a route builds a small table of its own and checks one
// guard inside it, so the real one — which address shows which screen, behind
// which permission — was held by nothing. An audit deleted `<Route path="roles">`
// and then swapped `modulo="roles"` for `modulo="seguridad"`, and the suite
// stayed green through both. This mounts `<App />` with every screen replaced by
// a word, and asks where an address ends up.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { contextProps } from "./context/SesionContext";
import { setPermisos, olvidarPermisos, sinPermisos, type Modulo, type Permisos } from "./lib/permissions";

const ROL = 9;

vi.mock("./context/SesionProvider", async () => {
  const { SesionContext } = await import("./context/SesionContext");
  const value = {
    sesion: { usuario: { id: 7, id_rol: 9, user: "j", name: "J", lastname: "L" }, autenticado: true },
    loading: false,
    setSesion: () => {},
    logout: () => {},
  } as unknown as contextProps;
  return {
    SesionProvider: ({ children }: { children: ReactNode }) => (
      <SesionContext.Provider value={value}>{children}</SesionContext.Provider>
    ),
  };
});

// The shell is only the frame around the screen: the outlet is all of it that
// matters here.
vi.mock("./pages/HomePage", async () => {
  const { Outlet } = await import("react-router-dom");
  return { default: () => <Outlet /> };
});
vi.mock("./pages/menu/RolesPage", () => ({ default: () => <div>PANTALLA DE ROLES</div> }));
vi.mock("./pages/menu/SeguridadPage", () => ({ default: () => <div>PANTALLA DE USUARIOS</div> }));
vi.mock("./pages/menu/usuario/UsuarioDetallePage", async () => {
  const { useParams, useLocation } = await import("react-router-dom");
  const Ficha = () => {
    const { id } = useParams();
    const { search, hash } = useLocation();
    return <div>FICHA DEL USUARIO {id}{search}{hash}</div>;
  };
  return { default: Ficha };
});
vi.mock("./pages/menu/tramo/red/RedPage", () => ({ default: () => <div>MAPA DE TRAMOS</div> }));
vi.mock("./pages/menu/tramo/TramosArchivadosPage", () => ({ default: () => <div>TRAMOS ARCHIVADOS</div> }));
vi.mock("./pages/menu/inicio", () => ({ default: () => <div>PANEL</div> }));
vi.mock("./pages/menu/SinAccesoPage", () => ({ default: () => <div>SIN ACCESO</div> }));
vi.mock("./components/dialogs/StepUpDialog", () => ({ StepUpDialog: () => null }));
vi.mock("./components/UpdatePrompt", () => ({ UpdatePrompt: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const { default: App } = await import("./App");

function matrizCon(...modulos: Modulo[]): Permisos {
  const p = sinPermisos();
  for (const m of modulos) p[m].ver = true;
  return p;
}

/** Open the application at an address, as somebody who may `ver` these modules. */
function abrirEn(direccion: string, ...modulos: Modulo[]) {
  setPermisos(ROL, matrizCon(...modulos));
  window.history.pushState({}, "", direccion);
  render(<App />);
}

const direccion = () => window.location.pathname + window.location.search + window.location.hash;

beforeEach(() => {
  olvidarPermisos();
});

describe("roles and permissions, at their own address", () => {
  it("opens for somebody who may see roles and nothing else", async () => {
    // The point of the split: as a tab of the users screen this also needed
    // `seguridad`, so this person had no way in.
    abrirEn("/app/roles", "roles");

    expect(await screen.findByText("PANTALLA DE ROLES")).toBeInTheDocument();
  });

  it("does not open on the users permission", async () => {
    abrirEn("/app/roles", "seguridad");

    expect(await screen.findByText("PANTALLA DE USUARIOS")).toBeInTheDocument();
    expect(screen.queryByText("PANTALLA DE ROLES")).toBeNull();
    expect(direccion()).toBe("/app/usuarios");
  });

  it("is where somebody with only that permission lands from the home page", async () => {
    abrirEn("/app/home", "roles");

    expect(await screen.findByText("PANTALLA DE ROLES")).toBeInTheDocument();
    expect(direccion()).toBe("/app/roles");
  });
});

describe("the users screen, at its new address", () => {
  it("opens the list", async () => {
    abrirEn("/app/usuarios", "seguridad");
    expect(await screen.findByText("PANTALLA DE USUARIOS")).toBeInTheDocument();
  });

  it("opens one account by its number", async () => {
    abrirEn("/app/usuarios/42", "seguridad");
    expect(await screen.findByText("FICHA DEL USUARIO 42")).toBeInTheDocument();
  });

  it("does not open on the roles permission", async () => {
    abrirEn("/app/usuarios", "roles");

    expect(await screen.findByText("PANTALLA DE ROLES")).toBeInTheDocument();
    expect(screen.queryByText("PANTALLA DE USUARIOS")).toBeNull();
  });
});

describe("the addresses the users screen used to have", () => {
  it("sends the list on to the new one", async () => {
    abrirEn("/app/seguridad", "seguridad");

    expect(await screen.findByText("PANTALLA DE USUARIOS")).toBeInTheDocument();
    await waitFor(() => expect(direccion()).toBe("/app/usuarios"));
  });

  it("sends an account on to the same account", async () => {
    abrirEn("/app/seguridad/42", "seguridad");

    expect(await screen.findByText("FICHA DEL USUARIO 42")).toBeInTheDocument();
    await waitFor(() => expect(direccion()).toBe("/app/usuarios/42"));
  });

  it("keeps what came after the address", async () => {
    // `<Navigate to="…">` given a string builds a new location and drops both.
    abrirEn("/app/seguridad/42?desde=bitacora#actividad", "seguridad");

    expect(await screen.findByText("FICHA DEL USUARIO 42?desde=bitacora#actividad")).toBeInTheDocument();
    expect(direccion()).toBe("/app/usuarios/42?desde=bitacora#actividad");
  });

  it("keeps it on the list too", async () => {
    abrirEn("/app/seguridad?q=ana", "seguridad");

    await screen.findByText("PANTALLA DE USUARIOS");
    await waitFor(() => expect(direccion()).toBe("/app/usuarios?q=ana"));
  });

  it("is still behind the users permission, and loops nowhere", async () => {
    abrirEn("/app/seguridad/42");

    expect(await screen.findByText("SIN ACCESO")).toBeInTheDocument();
    expect(screen.queryByText(/FICHA DEL USUARIO/)).toBeNull();
  });
});

describe("the tramos screen, live on the map and archived in a list", () => {
  it("opens the map at /app/tramos", async () => {
    abrirEn("/app/tramos", "tramos");

    expect(await screen.findByText("MAPA DE TRAMOS")).toBeInTheDocument();
    expect(screen.queryByText("TRAMOS ARCHIVADOS")).toBeNull();
  });

  it("keeps what follows the address when it opens the map", async () => {
    abrirEn("/app/tramos?tramo=5", "tramos");

    expect(await screen.findByText("MAPA DE TRAMOS")).toBeInTheDocument();
    expect(direccion()).toBe("/app/tramos?tramo=5");
  });

  it("opens the map at a tramo's own address too: its card is drawn on that same screen", async () => {
    abrirEn("/app/tramos/52", "tramos");

    expect(await screen.findByText("MAPA DE TRAMOS")).toBeInTheDocument();
    expect(direccion()).toBe("/app/tramos/52");
  });

  it("opens the archived list at /app/tramos/archivados", async () => {
    // Not read as the card of a tramo called "archivados".
    abrirEn("/app/tramos/archivados", "tramos");

    expect(await screen.findByText("TRAMOS ARCHIVADOS")).toBeInTheDocument();
    expect(screen.queryByText("MAPA DE TRAMOS")).toBeNull();
  });

  it("is behind the tramos permission in both", async () => {
    abrirEn("/app/tramos/archivados");

    expect(await screen.findByText("SIN ACCESO")).toBeInTheDocument();
    expect(screen.queryByText("TRAMOS ARCHIVADOS")).toBeNull();
    expect(screen.queryByText("MAPA DE TRAMOS")).toBeNull();
  });
});
