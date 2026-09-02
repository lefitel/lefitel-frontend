// What actually lets somebody in. `ValidarDatos` builds the session object
// that goes into context after a successful login, and the boolean the
// route gate reads (`sesion.autenticado`) has to end up `true` there — not
// merely present as an unrelated field on the interface. This is the guard
// against the exact regression the task brief called out: relying on the
// `as SesionInterface` cast alone leaves that boolean `undefined`, and
// nobody can ever get past `/login` again.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import LoginPage from "./LoginPage";
import { SesionContext, type contextProps } from "../context/SesionContext";
import { ThemeProvider } from "../components/theme-provider";
import { usuarioExample } from "../data/example";
import { sinPermisos } from "../lib/permissions";
import type { SesionInterface } from "../interfaces/interfaces";

const loginUsuario = vi.fn();
const comprobarToken = vi.fn();
vi.mock("../api/Login.api", () => ({
  loginUsuario: (...args: unknown[]) => loginUsuario(...args),
  comprobarToken: (...args: unknown[]) => comprobarToken(...args),
}));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  // The safe default for every test that never means to exercise the
  // `permisos`-missing branch: an unmocked `comprobarToken` reached by
  // accident must not throw, it must answer the way an anonymous request
  // really would.
  comprobarToken.mockResolvedValue({ status: 401, usuario: null });
});

function Harness({ onSesion }: { onSesion: (s: SesionInterface) => void }) {
  const [sesion, setSesionState] = useState<SesionInterface>({
    usuario: usuarioExample,
    autenticado: false,
  });

  const setSesion: contextProps["setSesion"] = (next) => {
    setSesionState((prev) => {
      const resolved = typeof next === "function" ? (next as (p: SesionInterface) => SesionInterface)(prev) : next;
      onSesion(resolved);
      return resolved;
    });
  };

  const value: contextProps = { sesion, setSesion, loading: false, logout: vi.fn() };

  return (
    <ThemeProvider>
      <SesionContext.Provider value={value}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </SesionContext.Provider>
    </ThemeProvider>
  );
}

/**
 * `HarnessConRutas`, separate from `Harness` above: this one needs a real
 * destination for "¿Olvidaste tu contraseña?" to land on, and the login
 * harness's bare `<MemoryRouter>` has nowhere for a `<Link>` to actually go.
 */
function HarnessConRutas() {
  const value: contextProps = {
    sesion: { usuario: usuarioExample, autenticado: false },
    setSesion: vi.fn(),
    loading: false,
    logout: vi.fn(),
  };

  return (
    <ThemeProvider>
      <SesionContext.Provider value={value}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/olvide-contrasena" element={<div>pantalla-olvide</div>} />
          </Routes>
        </MemoryRouter>
      </SesionContext.Provider>
    </ThemeProvider>
  );
}

describe("the 'olvidé mi contraseña' link", () => {
  afterEach(() => vi.clearAllMocks());

  it("navigates to the real recovery screen instead of showing a toast", async () => {
    // Before Task 9 this was a `<button>` whose `onClick` fired
    // `toast.info("Contacte con el administrador...")` — a dead end for
    // whoever actually forgot their password. It is a router `<Link>` now.
    const user = userEvent.setup();
    render(<HarnessConRutas />);

    await user.click(screen.getByRole("link", { name: /olvidaste tu contraseña/i }));

    expect(await screen.findByText("pantalla-olvide")).toBeInTheDocument();
    const { toast } = await import("sonner");
    expect(toast.info).not.toHaveBeenCalled();
  });
});

describe("logging in", () => {
  afterEach(() => vi.clearAllMocks());

  it("marks the session as authenticated once the server accepts the credentials", async () => {
    loginUsuario.mockResolvedValue({
      status: 200,
      message: null,
      usuario: {
        usuario: { ...usuarioExample, user: "ada" },
        // `permisos` present is what a `completa` session's login body looks
        // like — see `auth.controller.ts`'s own comment on `cuerpo`. Every
        // account today opens `completa` (nobody has a factor registered
        // yet), so this is the ordinary case this test still has to pin.
        permisos: sinPermisos(),
        // What the API wrapper actually hands back today: never true on its
        // own. If this test only checked "did setSesion get called", it
        // would pass whether or not LoginPage sets the boolean itself.
        autenticado: false,
      },
    });

    const user = userEvent.setup();
    const sesiones: SesionInterface[] = [];
    render(<Harness onSesion={(s) => sesiones.push(s)} />);

    await user.type(screen.getByLabelText("Usuario"), "ada");
    await user.type(screen.getByLabelText("Contraseña"), "secreto");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => expect(sesiones.length).toBeGreaterThan(0));
    expect(sesiones[0].autenticado).toBe(true);
    expect(sesiones[0].estado).toBe("completa");
    // The login body already said everything needed — no second round trip.
    expect(comprobarToken).not.toHaveBeenCalled();
  });

  it("leaves the session unauthenticated when the server refuses", async () => {
    loginUsuario.mockResolvedValue({
      status: 500,
      message: "Usuario o contraseña incorrectos",
      usuario: null,
    });

    const user = userEvent.setup();
    const sesiones: SesionInterface[] = [];
    render(<Harness onSesion={(s) => sesiones.push(s)} />);

    await user.type(screen.getByLabelText("Usuario"), "ada");
    await user.type(screen.getByLabelText("Contraseña"), "incorrecta");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => expect(loginUsuario).toHaveBeenCalledTimes(1));
    // No session was ever pushed into context — a refused login must not
    // move the boolean at all, in either direction.
    expect(sesiones).toHaveLength(0);
  });

  it("persists nothing at all to localStorage — the cookie is the credential now", async () => {
    // Nothing else in this file touches `localStorage`, so nothing clears it
    // between tests; start from a known-empty state rather than assume it.
    localStorage.clear();
    loginUsuario.mockResolvedValue({
      status: 200,
      message: null,
      usuario: {
        usuario: { ...usuarioExample, user: "ada" },
        permisos: sinPermisos(),
        autenticado: false,
      },
    });

    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);

    await user.type(screen.getByLabelText("Usuario"), "ada");
    await user.type(screen.getByLabelText("Contraseña"), "secreto");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => expect(loginUsuario).toHaveBeenCalledTimes(1));
    // No login response carries a credential any more — the API stopped
    // signing JWTs, `Login.api.ts` strips the field regardless, and the session
    // shape has nowhere to hold one — so there is nothing on this page to copy
    // into storage that the cookie has not already made redundant. This
    // assertion is what notices anybody putting it back.
    //
    // Counted, not looked up by name. This used to read
    // `localStorage.getItem("token")` and so only refused one spelling:
    // persisting the very same credential as `jwt`, `sesion` or `auth` passed
    // it without complaint. That is the shape of assertion — check that
    // something is absent or present, rather than that the state is correct —
    // which has passed against broken code sixteen times in this project.
    // Emptiness is the property that was actually meant, and the login screen
    // is entitled to store nothing whatsoever: the theme and the sidebar width
    // are written elsewhere and only when somebody changes them, so a key
    // appearing here at all is a credential nobody asked for.
    expect(Object.keys(localStorage)).toEqual([]);
    expect(localStorage.length).toBe(0);
  });
});

/**
 * `HarnessConDestinos`, separate from `Harness` above: these tests have to
 * observe *where* the login sends somebody, not only what it writes into
 * `sesion` — the bare `<MemoryRouter>` `Harness` uses has no `<Routes>` for a
 * `navigate()` call to land on.
 */
function HarnessConDestinos({ onSesion }: { onSesion: (s: SesionInterface) => void }) {
  const [sesion, setSesionState] = useState<SesionInterface>({
    usuario: usuarioExample,
    autenticado: false,
  });

  const setSesion: contextProps["setSesion"] = (next) => {
    setSesionState((prev) => {
      const resolved = typeof next === "function" ? (next as (p: SesionInterface) => SesionInterface)(prev) : next;
      onSesion(resolved);
      return resolved;
    });
  };

  const value: contextProps = { sesion, setSesion, loading: false, logout: vi.fn() };

  return (
    <ThemeProvider>
      <SesionContext.Provider value={value}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/segundo-factor" element={<div>pantalla-segundo-factor</div>} />
            <Route path="/app/home" element={<div>pantalla-app</div>} />
          </Routes>
        </MemoryRouter>
      </SesionContext.Provider>
    </ThemeProvider>
  );
}

/**
 * Hallazgo A10/D4: two entries to the same loop, one of them this page's own
 * `ValidarDatos`. `SesionProvider.test.tsx` covers the other (the startup
 * call to `comprobarToken`) — both have to refuse the same 200.
 */
describe("a session with a factor still owed (plan 4B, hallazgo A10/D4)", () => {
  afterEach(() => vi.clearAllMocks());

  it("sends the user to the second-factor step, not the dashboard, and never marks the session authenticated", async () => {
    // The login body carries no `permisos` at all — exactly what a `parcial`
    // or `onboarding` session's `login` response looks like today
    // (`auth.controller.ts`'s `cuerpo`, the non-`completa` branch).
    loginUsuario.mockResolvedValue({
      status: 200,
      message: null,
      usuario: { usuario: { ...usuarioExample, user: "ada" }, autenticado: false },
    });
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: { ...usuarioExample, user: "ada" },
      estado: "parcial",
    });

    const user = userEvent.setup();
    const sesiones: SesionInterface[] = [];
    render(<HarnessConDestinos onSesion={(s) => sesiones.push(s)} />);

    await user.type(screen.getByLabelText("Usuario"), "ada");
    await user.type(screen.getByLabelText("Contraseña"), "secreto");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByText("pantalla-segundo-factor")).toBeInTheDocument();
    expect(screen.queryByText("pantalla-app")).not.toBeInTheDocument();
    // Not merely "not on the dashboard" — never written into context as
    // authenticated at all, matching `autenticado` staying `false` for a
    // `parcial` session (`SesionInterface`'s own contract).
    expect(sesiones).toHaveLength(0);
  });

  it("logs an onboarding account straight in — there is no factor to prove", async () => {
    loginUsuario.mockResolvedValue({
      status: 200,
      message: null,
      usuario: { usuario: { ...usuarioExample, user: "ada" }, autenticado: false },
    });
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: { ...usuarioExample, user: "ada" },
      estado: "onboarding",
    });

    const user = userEvent.setup();
    const sesiones: SesionInterface[] = [];
    render(<HarnessConDestinos onSesion={(s) => sesiones.push(s)} />);

    await user.type(screen.getByLabelText("Usuario"), "ada");
    await user.type(screen.getByLabelText("Contraseña"), "secreto");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByText("pantalla-app")).toBeInTheDocument();
    await waitFor(() => expect(sesiones.length).toBeGreaterThan(0));
    expect(sesiones[0].autenticado).toBe(true);
    expect(sesiones[0].estado).toBe("onboarding");
  });

  it("does nothing destructive when /auth/me fails right after a successful login", async () => {
    loginUsuario.mockResolvedValue({
      status: 200,
      message: null,
      usuario: { usuario: { ...usuarioExample, user: "ada" }, autenticado: false },
    });
    comprobarToken.mockResolvedValue({ status: 500, usuario: null });

    const user = userEvent.setup();
    const sesiones: SesionInterface[] = [];
    render(<HarnessConDestinos onSesion={(s) => sesiones.push(s)} />);

    await user.type(screen.getByLabelText("Usuario"), "ada");
    await user.type(screen.getByLabelText("Contraseña"), "secreto");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(sesiones).toHaveLength(0);
    expect(screen.queryByText("pantalla-app")).not.toBeInTheDocument();
    expect(screen.queryByText("pantalla-segundo-factor")).not.toBeInTheDocument();
  });
});
