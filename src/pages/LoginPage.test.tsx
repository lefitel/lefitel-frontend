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
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { useState } from "react";
import LoginPage from "./LoginPage";
import { SegundoFactorRoute } from "../App";
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
// The passkey ceremony — plan 4C phase 2. `soporta` stands in for
// `browserSupportsWebAuthn()`, which is `false` under jsdom: the button is
// drawn only where a ceremony can run, so every test that wants it says so,
// and `beforeEach` puts the flag back rather than trusting test order.
const entrarSinContrasena = vi.fn();
const cancelarCeremonia = vi.fn();
let soporta = false;
vi.mock("../api/passkeyCeremony", () => ({
  entrarSinContrasena: (...args: unknown[]) => entrarSinContrasena(...args),
  cancelarCeremonia: (...args: unknown[]) => cancelarCeremonia(...args),
  soportaPasskeys: () => soporta,
}));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  soporta = false;
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
/**
 * What the second step was told to go back to, rendered so a test can read
 * it: `SegundoFactorPage` reads `location.state.from` and falls back to
 * `/app/home` when it is missing, silently — so dropping `state` from the
 * navigate has no visible symptom anywhere but here.
 */
function PantallaSegundoFactor() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "(sin destino)";
  return (
    <div>
      pantalla-segundo-factor
      <span data-testid="destino">{from}</span>
    </div>
  );
}

function HarnessConDestinos({
  onSesion,
  desde,
}: {
  onSesion: (s: SesionInterface) => void;
  /** The screen somebody was on before `PrivateRoutes` sent them to log in. */
  desde?: string;
}) {
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
  const entrada = desde ? { pathname: "/login", state: { from: { pathname: desde } } } : "/login";

  return (
    <ThemeProvider>
      <SesionContext.Provider value={value}>
        <MemoryRouter initialEntries={[entrada]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* 🔴 The real guard, not a bare div. Drawn without it, the parcial
                test below stayed green while the application bounced every
                account with a factor straight back to `/login`: the guard
                renders only for `sesion.estado === "parcial"`, and the login
                never wrote that field before navigating. */}
            <Route element={<SegundoFactorRoute />}>
              <Route path="/segundo-factor" element={<PantallaSegundoFactor />} />
            </Route>
            <Route path="/app/home" element={<div>pantalla-app</div>} />
            <Route path="/app/eventos/5" element={<div>pantalla-evento</div>} />
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
    // Written into context exactly once, as what it is: a `parcial` session
    // that is NOT authenticated. Both halves matter. `autenticado: false` is
    // `SesionInterface`'s own contract for this state; `estado: "parcial"` is
    // what the real guard above renders on — until plan 4C's phase 2 the login
    // wrote neither and navigated anyway, and the guard sent the person back
    // to an empty password box with the login already accepted.
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0]).toMatchObject({ autenticado: false, estado: "parcial" });
    expect(sesiones[0].usuario.user).toBe("ada");
  });

  it("tells the second step where to go back to afterwards", async () => {
    // `PrivateRoutes` sends somebody who opened `/app/eventos/5` without a
    // session to `/login` with that path in `state.from`; the second step has
    // to be handed the same destination, or a deep link ends on the home
    // screen with no visible symptom.
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
    render(<HarnessConDestinos onSesion={() => {}} desde="/app/eventos/5" />);

    await user.type(screen.getByLabelText("Usuario"), "ada");
    await user.type(screen.getByLabelText("Contraseña"), "secreto");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByText("pantalla-segundo-factor")).toBeInTheDocument();
    expect(screen.getByTestId("destino")).toHaveTextContent("/app/eventos/5");
  });

  it("returns a finished login to the screen it was sent here from", async () => {
    loginUsuario.mockResolvedValue({
      status: 200,
      message: null,
      usuario: { usuario: { ...usuarioExample, user: "ada" }, permisos: sinPermisos(), autenticado: false },
    });

    const user = userEvent.setup();
    render(<HarnessConDestinos onSesion={() => {}} desde="/app/eventos/5" />);

    await user.type(screen.getByLabelText("Usuario"), "ada");
    await user.type(screen.getByLabelText("Contraseña"), "secreto");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByText("pantalla-evento")).toBeInTheDocument();
    expect(screen.queryByText("pantalla-app")).not.toBeInTheDocument();
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

/**
 * Entering with a passkey and nothing else — plan 4C phase 2, Task 15.
 *
 * The ceremony is mocked whole (`entrarSinContrasena`): what this file owns is
 * what the page does with each of its four answers, and that the two doors
 * land on the same screen by the same rules — `abrirSesion` is shared, and
 * these tests are what keep it shared.
 */
describe("entering with a passkey (plan 4C, fase 2)", () => {
  afterEach(() => vi.clearAllMocks());

  const SESION_COMPLETA = {
    usuario: { ...usuarioExample, user: "ada" },
    permisos: sinPermisos(),
    autenticado: false,
  };

  it("draws the button only where the browser can run a ceremony", () => {
    render(<Harness onSesion={() => {}} />);
    expect(screen.queryByRole("button", { name: /llave de acceso/i })).not.toBeInTheDocument();
  });

  it("lands a finished login on the same screen a password login lands on", async () => {
    soporta = true;
    entrarSinContrasena.mockResolvedValue({ ok: true, sesion: SESION_COMPLETA });

    const user = userEvent.setup();
    const sesiones: SesionInterface[] = [];
    render(<HarnessConDestinos onSesion={(s) => sesiones.push(s)} desde="/app/eventos/5" />);

    await user.click(screen.getByRole("button", { name: /llave de acceso/i }));

    expect(await screen.findByText("pantalla-evento")).toBeInTheDocument();
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0]).toMatchObject({ autenticado: true, estado: "completa" });
    expect(sesiones[0].usuario.user).toBe("ada");
    // No password was typed, none was sent, and no second round trip: the
    // body already said everything.
    expect(loginUsuario).not.toHaveBeenCalled();
    expect(comprobarToken).not.toHaveBeenCalled();
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("Bienvenido");
  });

  it("asks /auth/me when the body came without the matrix, and copies what it says", async () => {
    // The server cannot answer this for a key login except in a race it
    // refuses — but the page must not assume: the same fallback as the
    // password door, through the same function.
    soporta = true;
    entrarSinContrasena.mockResolvedValue({
      ok: true,
      sesion: { usuario: { ...usuarioExample, user: "ada" }, autenticado: false },
    });
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: { ...usuarioExample, user: "ada" },
      permisos: sinPermisos(),
      estado: "completa",
    });

    const user = userEvent.setup();
    const sesiones: SesionInterface[] = [];
    render(<HarnessConDestinos onSesion={(s) => sesiones.push(s)} />);

    await user.click(screen.getByRole("button", { name: /llave de acceso/i }));

    expect(await screen.findByText("pantalla-app")).toBeInTheDocument();
    expect(comprobarToken).toHaveBeenCalledTimes(1);
    expect(sesiones[0]).toMatchObject({ autenticado: true, estado: "completa" });
  });

  it("shows the server's own sentence, verbatim, when the key was refused", async () => {
    soporta = true;
    entrarSinContrasena.mockResolvedValue({
      ok: false,
      cancelado: false,
      status: 400,
      message: "No se pudo iniciar sesión con esa llave. Inténtalo otra vez.",
    });

    const user = userEvent.setup();
    const sesiones: SesionInterface[] = [];
    render(<HarnessConDestinos onSesion={(s) => sesiones.push(s)} />);

    await user.click(screen.getByRole("button", { name: /llave de acceso/i }));

    const { toast } = await import("sonner");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No se pudo iniciar sesión con esa llave. Inténtalo otra vez."),
    );
    expect(sesiones).toHaveLength(0);
    expect(screen.queryByText("pantalla-app")).not.toBeInTheDocument();
  });

  it("answers a closed system dialog with a hint on the page, not a toast and not silence", async () => {
    // On this screen the server cannot say "this account has no key" — asking
    // would be the oracle the endpoint exists to avoid — so somebody with no
    // key gets an empty dialog, closes it, and without this line is left
    // looking at a button that did nothing.
    soporta = true;
    entrarSinContrasena.mockResolvedValue({ ok: false, cancelado: true });

    const user = userEvent.setup();
    render(<HarnessConDestinos onSesion={() => {}} />);

    // The live region is there before it has anything to say — a region that
    // appears in the same mutation as its text is the one screen readers skip.
    expect(screen.getByRole("status")).toHaveTextContent("");
    await user.click(screen.getByRole("button", { name: /llave de acceso/i }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/no se eligió ninguna llave/i));
    const { toast } = await import("sonner");
    expect(toast.error).not.toHaveBeenCalled();
    // And it goes away as soon as the person reaches for the password instead.
    await user.type(screen.getByLabelText("Usuario"), "a");
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("clears the hint of a previous attempt before showing a refusal", async () => {
    soporta = true;
    entrarSinContrasena
      .mockResolvedValueOnce({ ok: false, cancelado: true })
      .mockResolvedValueOnce({ ok: false, cancelado: false, status: 400, message: "Rechazada." });

    const user = userEvent.setup();
    render(<HarnessConDestinos onSesion={() => {}} />);

    await user.click(screen.getByRole("button", { name: /llave de acceso/i }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/ninguna llave/i));
    await user.click(screen.getByRole("button", { name: /llave de acceso/i }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Rechazada."));
    // Two failures, one sentence on screen: the toast, not the stale hint.
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("disables both doors while the system dialog is open, and ignores Enter in the password box", async () => {
    // A ceremony in flight with focus still in the password field: Enter must
    // not fire a password login on top of it — a mistyped one would charge the
    // lockout the key exists to avoid, and a correct one would race two logins.
    soporta = true;
    let terminar!: (r: unknown) => void;
    entrarSinContrasena.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
    loginUsuario.mockResolvedValue({ status: 200, message: null, usuario: SESION_COMPLETA });

    const user = userEvent.setup();
    render(<HarnessConDestinos onSesion={() => {}} />);

    await user.type(screen.getByLabelText("Usuario"), "ada");
    await user.type(screen.getByLabelText("Contraseña"), "secreto");
    await user.click(screen.getByRole("button", { name: /llave de acceso/i }));

    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeDisabled();
    expect(screen.getByRole("button", { busy: true })).toBeDisabled();
    await user.type(screen.getByLabelText("Contraseña"), "{Enter}");
    expect(loginUsuario).not.toHaveBeenCalled();

    terminar({ ok: false, cancelado: true });
    await waitFor(() => expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeEnabled());
  });

  it("cancels a ceremony still open when the page goes away, and not before", () => {
    soporta = true;
    cancelarCeremonia.mockClear();
    const { unmount } = render(<Harness onSesion={() => {}} />);
    // Not at mount: this page mounting is exactly the moment another screen's
    // ceremony may still be open, and cancelling then would abort it.
    expect(cancelarCeremonia).not.toHaveBeenCalled();
    unmount();
    expect(cancelarCeremonia).toHaveBeenCalledTimes(1);
  });
});
