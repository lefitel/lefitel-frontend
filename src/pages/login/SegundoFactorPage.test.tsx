// Plan 4B, Task 18. Reached only through `App.tsx`'s `SegundoFactorRoute`,
// which is what guarantees a genuinely `parcial` session (and its cookie)
// already exists — this file does not re-prove that guard, `App.test.tsx`
// does. What this file owns is the screen itself: does it send the code
// under the field the server reads, does it offer the recovery code as
// plainly as the app code (hallazgo A5/D4), and does a successful verify
// re-derive the session from `/auth/me` rather than guessing at a shape
// `POST /auth/mfa/verify` has not been built yet to promise.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, type InitialEntry } from "react-router-dom";
import { useState } from "react";
import SegundoFactorPage from "./SegundoFactorPage";
import { SesionContext, type contextProps } from "../../context/SesionContext";
import { ThemeProvider } from "../../components/theme-provider";
import { usuarioExample } from "../../data/example";
import { sinPermisos } from "../../lib/permissions";
import type { SesionInterface } from "../../interfaces/interfaces";

const verifySecondFactor = vi.fn();
const comprobarToken = vi.fn();
const abandonPartialSession = vi.fn();
vi.mock("../../api/Login.api", () => ({
  verifySecondFactor: (...args: unknown[]) => verifySecondFactor(...args),
  comprobarToken: (...args: unknown[]) => comprobarToken(...args),
  abandonPartialSession: (...args: unknown[]) => abandonPartialSession(...args),
}));
const pedirCodigoPorCorreo = vi.fn();
vi.mock("../../api/Mfa.api", () => ({
  pedirCodigoPorCorreo: (...args: unknown[]) => pedirCodigoPorCorreo(...args),
}));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

// La ceremonia con el navegador, detrás de un mock: `jsdom` no tiene WebAuthn,
// así que con el módulo real el botón no se pintaría nunca y una prueba
// negativa pasaría por eso, no por lo que afirma. `soporta` arranca en `false`
// —lo que el resto de este fichero siempre vio— y sólo las pruebas de la llave
// lo encienden.
const probarPasskey = vi.fn();
const cancelarCeremonia = vi.fn();
let soporta = false;
vi.mock("../../api/passkeyCeremony", () => ({
  probarPasskey: (...args: unknown[]) => probarPasskey(...args),
  soportaPasskeys: () => soporta,
  cancelarCeremonia: (...args: unknown[]) => cancelarCeremonia(...args),
}));

function Harness({
  onSesion,
  initialEntries = ["/segundo-factor"],
  usuario = usuarioExample,
  metodos,
}: {
  onSesion: (s: SesionInterface) => void;
  initialEntries?: InitialEntry[];
  usuario?: SesionInterface["usuario"];
  /** The account's factors, as `/auth/me` lists them for a `parcial` session. */
  metodos?: string[];
}) {
  const [sesion, setSesionState] = useState<SesionInterface>({
    usuario,
    autenticado: false,
    estado: "parcial",
    metodos,
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
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/segundo-factor" element={<SegundoFactorPage />} />
            <Route path="/login" element={<div>pantalla-login</div>} />
            <Route path="/app/home" element={<div>pantalla-app</div>} />
            <Route path="/app/postes" element={<div>pantalla-postes</div>} />
          </Routes>
        </MemoryRouter>
      </SesionContext.Provider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  soporta = false;
});

describe("entering the app code", () => {
  it("does not call the server for an empty code", async () => {
    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);

    await user.click(screen.getByRole("button", { name: /verificar/i }));

    expect(verifySecondFactor).not.toHaveBeenCalled();
    const { toast } = await import("sonner");
    expect(toast.warning).toHaveBeenCalled();
  });

  it("sends whatever was typed under `codigo`, and refreshes the session from /auth/me on success", async () => {
    verifySecondFactor.mockResolvedValue({ status: 200, message: "Segundo factor verificado." });
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: { ...usuarioExample, user: "ada" },
      permisos: sinPermisos(),
      estado: "completa",
    });

    const user = userEvent.setup();
    const sesiones: SesionInterface[] = [];
    render(<Harness onSesion={(s) => sesiones.push(s)} />);

    await user.type(screen.getByLabelText(/código de seis dígitos/i), "123456");
    await user.click(screen.getByRole("button", { name: /verificar/i }));

    // `false`: the "recordar este equipo" checkbox is unticked by default —
    // hallazgo E-7/F16 requires that, since it grants thirty days without a
    // second factor and must never be assumed.
    await waitFor(() => expect(verifySecondFactor).toHaveBeenCalledWith("123456", false));
    // The response `POST /auth/mfa/verify` gives back is not trusted for the
    // session shape — `comprobarToken` is what this screen actually reads,
    // same rule `LoginPage.tsx` follows for the login body itself.
    expect(comprobarToken).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(sesiones.length).toBeGreaterThan(0));
    expect(sesiones[0].autenticado).toBe(true);
    expect(sesiones[0].estado).toBe("completa");
    expect(await screen.findByText("pantalla-app")).toBeInTheDocument();
  });

  it("shows the server's own message verbatim on a wrong code, rather than one written on this side", async () => {
    // "Código incorrecto o ya utilizado." is `CODIGO_MFA_INVALIDO` in
    // `api/src/controllers/mfa.controller.ts` — the one sentence that
    // endpoint answers with for a wrong code, a corrupt row, a repeated
    // step, or a code that only matched in the wider clock-skew diagnostic
    // window (hallazgo C12: that window is logged to the bitácora, never
    // said back to the caller). This screen has no business improving on
    // that sentence or guessing at a distinction the server itself refuses
    // to draw in the response.
    verifySecondFactor.mockResolvedValue({
      status: 400,
      message: "Código incorrecto o ya utilizado.",
    });

    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);

    await user.type(screen.getByLabelText(/código de seis dígitos/i), "000000");
    await user.click(screen.getByRole("button", { name: /verificar/i }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Código incorrecto o ya utilizado."));
    expect(comprobarToken).not.toHaveBeenCalled();
  });

  it("lands on the originally requested screen, not always /app/home", async () => {
    verifySecondFactor.mockResolvedValue({ status: 200, message: "ok" });
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: { ...usuarioExample, user: "ada" },
      permisos: sinPermisos(),
      estado: "completa",
    });

    const user = userEvent.setup();
    render(
      <Harness
        onSesion={() => {}}
        initialEntries={[{ pathname: "/segundo-factor", state: { from: "/app/postes" } }]}
      />,
    );

    await user.type(screen.getByLabelText(/código de seis dígitos/i), "123456");
    await user.click(screen.getByRole("button", { name: /verificar/i }));

    expect(await screen.findByText("pantalla-postes")).toBeInTheDocument();
  });
});

describe("hallazgo D-3/E-4/F11 — the third entry of the MFA loop", () => {
  it("does not read a still-parcial /auth/me answer as a finished login", async () => {
    // The race this reproduces: the code was genuinely accepted (`verify`
    // returns 200), but by the time `comprobarToken()` lands, the cookie
    // this tab holds names a *different*, still-unproven session — another
    // login in another tab, or a `logout-all` elsewhere. Reading `estado`
    // unconditionally as `autenticado: true` used to send the very next
    // request into `authenticate`'s 401-outside-the-allow-list branch, which
    // the interceptor answers by calling `logout()` — "tu sesión se cerró"
    // for a code the server just accepted.
    verifySecondFactor.mockResolvedValue({ status: 200, message: "ok" });
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: { ...usuarioExample, user: "otra-cuenta" },
      estado: "parcial",
    });

    const user = userEvent.setup();
    const sesiones: SesionInterface[] = [];
    render(<Harness onSesion={(s) => sesiones.push(s)} />);

    await user.type(screen.getByLabelText(/código de seis dígitos/i), "123456");
    await user.click(screen.getByRole("button", { name: /verificar/i }));

    await waitFor(() => expect(sesiones.length).toBeGreaterThan(0));
    expect(sesiones.at(-1)!.autenticado).toBe(false);
    expect(sesiones.at(-1)!.estado).toBe("parcial");
    // Never sent into the app shell on this answer.
    expect(screen.queryByText("pantalla-app")).not.toBeInTheDocument();
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "Tu sesión cambió mientras verificabas tu identidad. Volvé a intentarlo.",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("hallazgo E-7/F16 — «recordar este equipo»", () => {
  it("is unticked by default", () => {
    render(<Harness onSesion={() => {}} />);

    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("sends `recordar: true` only once ticked by hand", async () => {
    verifySecondFactor.mockResolvedValue({ status: 200, message: "ok" });
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: usuarioExample,
      permisos: sinPermisos(),
      estado: "completa",
    });

    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);

    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByLabelText(/código de seis dígitos/i), "123456");
    await user.click(screen.getByRole("button", { name: /verificar/i }));

    await waitFor(() => expect(verifySecondFactor).toHaveBeenCalledWith("123456", true));
  });
});

describe("the recovery-code tab — hallazgo A5/D4: visible, not hidden behind a link", () => {
  it("is reachable as plainly as the app-code tab, with no disclosure to open first", () => {
    render(<Harness onSesion={() => {}} />);

    // Both tabs are on screen from the start — nothing to click through to
    // discover the recovery path exists.
    expect(screen.getByRole("tab", { name: /código de la app/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /código de recuperación/i })).toBeInTheDocument();
    // Plan 4E: the email code is the third tab, offered as plainly as the others.
    expect(screen.getByRole("tab", { name: /código por correo/i })).toBeInTheDocument();
  });

  it("sends a recovery code under the same `codigo` field the app code uses", async () => {
    verifySecondFactor.mockResolvedValue({ status: 200, message: "ok" });
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: usuarioExample,
      permisos: sinPermisos(),
      estado: "completa",
    });

    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);

    await user.click(screen.getByRole("tab", { name: /código de recuperación/i }));
    await user.type(screen.getByLabelText(/^código de recuperación$/i), "ABCD-2345-WXYZ");
    await user.click(screen.getByRole("button", { name: /verificar/i }));

    await waitFor(() => expect(verifySecondFactor).toHaveBeenCalledWith("ABCD-2345-WXYZ", false));
  });
});

describe("cancelling", () => {
  it("resets the session to anonymous and goes back to /login, without verifying a code", async () => {
    const user = userEvent.setup();
    const sesiones: SesionInterface[] = [];
    render(<Harness onSesion={(s) => sesiones.push(s)} />);

    await user.click(screen.getByRole("button", { name: /cancelar y volver a iniciar sesión/i }));

    expect(await screen.findByText("pantalla-login")).toBeInTheDocument();
    expect(sesiones.at(-1)).toEqual({ usuario: usuarioExample, autenticado: false });
    expect(verifySecondFactor).not.toHaveBeenCalled();
  });

  it("ends the parcial session on the server too — hallazgo E-10/F13, the shared-laptop gap", async () => {
    // `SesionProvider.tsx`'s own `logout()` never reaches the server for a
    // `parcial` session (`hasSessionRef` reads `sesion.autenticado`, which is
    // `false` here by `SesionInterface`'s own contract), so this is the one
    // caller that has to reach `POST /api/auth/logout` directly. Without it
    // the row — and its cookie, good for up to seven days — outlives the tab,
    // reachable by the next person who opens the same machine.
    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);

    await user.click(screen.getByRole("button", { name: /cancelar y volver a iniciar sesión/i }));

    await waitFor(() => expect(abandonPartialSession).toHaveBeenCalledTimes(1));
  });
});


/* ─────────────────────────────────────────────────────────────────────────
 * Plan 4C, Tarea 11 — la tercera vía: la llave de acceso.
 *
 * 🔴 Sin ella, la fase 1 enviaba una llave con la que no se podía entrar: esta
 * pantalla sólo tenía las dos pestañas de código, y quien sólo tuviera llave
 * quemaba un código de recuperación por login hasta quedarse fuera.
 * ───────────────────────────────────────────────────────────────────────── */
describe("only the ways in this account has", () => {
  // The screen used to draw all three code tabs and the passkey button for
  // everybody, and open on the authenticator app. An account whose only factor
  // is a verified address — the usual first one — was asked for a code it had
  // no way to produce. `/auth/me` now lists the account's factors for a
  // `parcial` session and the screen is drawn from that list.
  const pestanas = () => screen.queryAllByRole("tab").map((t) => t.textContent);

  it("goes straight to the email code when that is the only factor, with no tabs to choose from", () => {
    render(<Harness onSesion={() => {}} metodos={["correo"]} />);

    expect(pestanas()).toEqual([]);
    expect(screen.getByLabelText(/código recibido por correo/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/código de seis dígitos/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar código/i })).toBeInTheDocument();
  });

  it("offers a tab per factor and opens on the first one the server named", () => {
    render(<Harness onSesion={() => {}} metodos={["correo", "codigo"]} />);

    expect(pestanas()).toEqual(["Código por correo", "Código de recuperación"]);
    // Open on email, not on an app this account never set up.
    expect(screen.getByLabelText(/código recibido por correo/i)).toBeInTheDocument();
  });

  it("opens on the app code for an account that has one, as it always did", () => {
    render(<Harness onSesion={() => {}} metodos={["totp", "correo", "codigo"]} />);

    expect(pestanas()).toEqual(["Código de la app", "Código por correo", "Código de recuperación"]);
    expect(screen.getByLabelText(/código de seis dígitos/i)).toBeInTheDocument();
  });

  it("does not offer the passkey to an account that has none, even in a browser that could use one", () => {
    soporta = true;
    render(<Harness onSesion={() => {}} metodos={["totp"]} />);

    expect(screen.queryByRole("button", { name: /llave de acceso/i })).not.toBeInTheDocument();
  });

  it("shows the passkey alone when it is the only factor: no code field, nothing to verify", () => {
    soporta = true;
    render(<Harness onSesion={() => {}} metodos={["passkey"]} />);

    expect(screen.getByRole("button", { name: /llave de acceso/i })).toBeInTheDocument();
    expect(pestanas()).toEqual([]);
    expect(screen.queryByRole("button", { name: /verificar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/o con un código/i)).not.toBeInTheDocument();
  });

  it("says so when the only factor is a passkey and this browser cannot use one", () => {
    // Otherwise the screen would be a title and a cancel link.
    soporta = false;
    render(<Harness onSesion={() => {}} metodos={["passkey"]} />);

    expect(screen.getByText(/este navegador no puede usar llaves de acceso/i)).toBeInTheDocument();
  });

  it("draws everything when the server sent no list, which is what an older server does", () => {
    render(<Harness onSesion={() => {}} />);

    expect(pestanas()).toEqual(["Código de la app", "Código por correo", "Código de recuperación"]);
  });
});

describe("entering with the passkey", () => {
  // Leaving the screen with the system dialog open would leave it orphaned:
  // the library aborts from a module singleton, and this is the one place a
  // late answer could try to open a session over a screen that is gone. The
  // same cleanup `LoginPage.tsx` runs, so the two key screens behave alike.
  it("cancels a ceremony still open when the screen goes away, and not before", () => {
    soporta = true;
    cancelarCeremonia.mockClear();
    const { unmount } = render(<Harness onSesion={() => {}} />);
    expect(cancelarCeremonia).not.toHaveBeenCalled();
    unmount();
    expect(cancelarCeremonia).toHaveBeenCalledTimes(1);
  });

  it("draws the button only where the browser can run a ceremony", () => {
    render(<Harness onSesion={() => {}} />);
    expect(screen.queryByRole("button", { name: /llave de acceso/i })).not.toBeInTheDocument();
  });

  it("runs the ceremony and opens the session from /auth/me, like a code would", async () => {
    soporta = true;
    probarPasskey.mockResolvedValue({ ok: true });
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: { ...usuarioExample, user: "ada" },
      permisos: sinPermisos(),
      estado: "completa",
    });

    const user = userEvent.setup();
    const sesiones: SesionInterface[] = [];
    render(<Harness onSesion={(s) => sesiones.push(s)} />);

    await user.click(screen.getByRole("button", { name: /entrar con mi llave de acceso/i }));

    await waitFor(() => expect(probarPasskey).toHaveBeenCalledTimes(1));
    // No se canjea ningún código por costumbre: eso cargaría un intento
    // fallido contra el bloqueo de la cuenta.
    expect(verifySecondFactor).not.toHaveBeenCalled();
    // Y la sesión se lee de la misma autoridad que con el código.
    expect(comprobarToken).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(sesiones.length).toBeGreaterThan(0));
    expect(sesiones[0].estado).toBe("completa");
    expect(await screen.findByText("pantalla-app")).toBeInTheDocument();
  });

  // Cerró el diálogo del sistema. No es un error del servidor y no se enseña
  // como tal: la pantalla se queda donde está, con las pestañas disponibles.
  it("says nothing when the person cancels the system dialog", async () => {
    soporta = true;
    probarPasskey.mockResolvedValue({ ok: false, cancelado: true });

    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);

    await user.click(screen.getByRole("button", { name: /entrar con mi llave de acceso/i }));

    await waitFor(() => expect(probarPasskey).toHaveBeenCalled());
    const { toast } = await import("sonner");
    expect(toast.error).not.toHaveBeenCalled();
    expect(comprobarToken).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /entrar con mi llave de acceso/i })).toBeEnabled();
  });

  // El guardián D-3/E-4/F11 es compartido, y la frase que enseña también:
  // a quien entró con la huella no se le puede hablar de un código que no
  // tecleó — y, si sólo tiene llave, que no puede producir.
  it("does not read a still-parcial /auth/me as a finished login on the passkey path, and says so without mentioning a code", async () => {
    soporta = true;
    probarPasskey.mockResolvedValue({ ok: true });
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: { ...usuarioExample, user: "ada" },
      permisos: sinPermisos(),
      estado: "parcial",
    });

    const user = userEvent.setup();
    const sesiones: SesionInterface[] = [];
    render(<Harness onSesion={(s) => sesiones.push(s)} />);

    await user.click(screen.getByRole("button", { name: /entrar con mi llave de acceso/i }));

    await waitFor(() => expect(sesiones.length).toBeGreaterThan(0));
    expect(sesiones.at(-1)!.autenticado).toBe(false);
    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const frase = (toast.error as unknown as { mock: { calls: string[][] } }).mock.calls[0][0];
    expect(frase).not.toMatch(/código/i);
    expect(screen.queryByText("pantalla-app")).not.toBeInTheDocument();
  });

  it("shows the server's own sentence when the key is refused", async () => {
    soporta = true;
    probarPasskey.mockResolvedValue({
      ok: false,
      cancelado: false,
      status: 429,
      message: "Demasiados intentos con la llave. Espere unos minutos.",
    });

    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);

    await user.click(screen.getByRole("button", { name: /entrar con mi llave de acceso/i }));

    const { toast } = await import("sonner");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Demasiados intentos con la llave. Espere unos minutos."),
    );
    expect(comprobarToken).not.toHaveBeenCalled();
  });
});

/* ─────────────────────────────────────────────────────────────────────────
 * Plan 4E — la cuarta vía: el código por correo.
 *
 * Un correo verificado es un factor completo, y esta pestaña es por donde
 * entra quien perdió el teléfono. Dos propiedades que la preauditoría nombró:
 * no se envía nada al montar ni al abrir la pestaña (S4), y el código va con
 * `metodo: "correo"` porque seis cifras del correo son indistinguibles de seis
 * cifras de la aplicación.
 * ───────────────────────────────────────────────────────────────────────── */
describe("the email tab (plan 4E)", () => {
  const CON_CORREO = { ...usuarioExample, email: "i***@osefi.net", email_verified_at: "2026-09-01T00:00:00.000Z" };
  const abrirCorreo = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("tab", { name: /código por correo/i }));
  };

  beforeEach(() => {
    pedirCodigoPorCorreo.mockResolvedValue({
      status: 200,
      message: "Te enviamos un código.",
      enviado_a: "i***@osefi.net",
      reintento_en_s: 60,
    });
  });

  it("shows where the code would go — the address /auth/me already masked — and a field for it", async () => {
    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} usuario={CON_CORREO} />);
    await abrirCorreo(user);

    expect(screen.getByText(/i\*\*\*@osefi\.net/)).toBeInTheDocument();
    expect(screen.getByLabelText(/código recibido por correo/i)).toBeInTheDocument();
  });

  it("does not name an address that is saved but not verified — no code will go there", async () => {
    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} usuario={{ ...CON_CORREO, email_verified_at: null }} />);
    await abrirCorreo(user);

    expect(screen.queryByText(/i\*\*\*@osefi\.net/)).not.toBeInTheDocument();
    expect(screen.getByText(/a tu correo verificado/i)).toBeInTheDocument();
  });

  // 🔴 S4: nothing is sent on mount, nor when the tab opens. A send spends
  // the mail quota, and a tab is opened out of curiosity too.
  it("sends nothing when the screen mounts nor when the tab opens — only the button asks", async () => {
    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} usuario={CON_CORREO} />);
    expect(pedirCodigoPorCorreo).not.toHaveBeenCalled();
    await abrirCorreo(user);
    expect(pedirCodigoPorCorreo).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /enviar código/i }));

    await waitFor(() => expect(pedirCodigoPorCorreo).toHaveBeenCalledTimes(1));
  });

  it("after sending, shows the masked address the server answered and counts down the cooldown it chose", async () => {
    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);
    await abrirCorreo(user);
    await user.click(screen.getByRole("button", { name: /enviar código/i }));

    expect(await screen.findByText(/enviamos un código/i)).toBeInTheDocument();
    expect(screen.getByText(/i\*\*\*@osefi\.net/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reenviar en 60 s/i })).toBeDisabled();
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("Código enviado a i***@osefi.net.");
  });

  it("frees the button when the wait is over", async () => {
    pedirCodigoPorCorreo.mockResolvedValue({ status: 200, message: "ok", enviado_a: "i***@osefi.net", reintento_en_s: 1 });
    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);
    await abrirCorreo(user);
    await user.click(screen.getByRole("button", { name: /enviar código/i }));

    expect(await screen.findByRole("button", { name: /reenviar en 1 s/i })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("button", { name: /^reenviar código$/i })).toBeEnabled(), {
      timeout: 3000,
    });
  });

  it("on a 429, counts down the server's own seconds and shows its sentence — never a number chosen here", async () => {
    pedirCodigoPorCorreo.mockResolvedValue({
      status: 429,
      message: "Espera antes de pedir otro código.",
      enviado_a: null,
      reintento_en_s: 540,
    });
    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);
    await abrirCorreo(user);
    await user.click(screen.getByRole("button", { name: /enviar código/i }));

    expect(await screen.findByRole("button", { name: /reenviar en 540 s/i })).toBeDisabled();
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Espera antes de pedir otro código.");
  });

  it("on a 503 (no provider could send), shows the server's sentence and leaves the button available", async () => {
    pedirCodigoPorCorreo.mockResolvedValue({
      status: 503,
      message: "No se pudo enviar el código. Prueba otro método o inténtalo más tarde.",
      enviado_a: null,
      reintento_en_s: null,
    });
    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);
    await abrirCorreo(user);
    await user.click(screen.getByRole("button", { name: /enviar código/i }));

    const { toast } = await import("sonner");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No se pudo enviar el código. Prueba otro método o inténtalo más tarde."),
    );
    expect(screen.getByRole("button", { name: /^enviar código$/i })).toBeEnabled();
  });

  it("on a 400 (no verified address), shows the server's sentence", async () => {
    pedirCodigoPorCorreo.mockResolvedValue({
      status: 400,
      message: "Tu cuenta no tiene un correo verificado.",
      enviado_a: null,
      reintento_en_s: null,
    });
    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);
    await abrirCorreo(user);
    await user.click(screen.getByRole("button", { name: /enviar código/i }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Tu cuenta no tiene un correo verificado."));
  });

  // 🔴 The ambiguity the whole `metodo` field exists for: six digits from the
  // mail look exactly like six digits from the app.
  it("verifies the typed code with `metodo: \"correo\"`, never as an app code", async () => {
    verifySecondFactor.mockResolvedValue({ status: 200, message: "ok" });
    comprobarToken.mockResolvedValue({ status: 200, usuario: usuarioExample, permisos: sinPermisos(), estado: "completa" });
    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);
    await abrirCorreo(user);

    await user.type(screen.getByLabelText(/código recibido por correo/i), "123456");
    await user.click(screen.getByRole("button", { name: /verificar/i }));

    await waitFor(() => expect(verifySecondFactor).toHaveBeenCalledWith("123456", false, "correo"));
  });

  it("warns how many attempts are left when two or fewer remain, and not before", async () => {
    verifySecondFactor.mockResolvedValue({ status: 400, message: "Código incorrecto o ya utilizado.", intentosRestantes: 3 });
    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);
    await abrirCorreo(user);
    await user.type(screen.getByLabelText(/código recibido por correo/i), "000000");
    await user.click(screen.getByRole("button", { name: /verificar/i }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByText(/antes de que la cuenta se bloquee/i)).not.toBeInTheDocument();

    verifySecondFactor.mockResolvedValue({ status: 400, message: "Código incorrecto o ya utilizado.", intentosRestantes: 2 });
    await user.click(screen.getByRole("button", { name: /verificar/i }));

    expect(await screen.findByText(/te quedan 2 intentos antes de que la cuenta se bloquee/i)).toBeInTheDocument();
  });

  it("says the account is locked when nothing is left — on any code tab", async () => {
    verifySecondFactor.mockResolvedValue({ status: 400, message: "Código incorrecto o ya utilizado.", intentosRestantes: 0 });
    const user = userEvent.setup();
    render(<Harness onSesion={() => {}} />);

    await user.type(screen.getByLabelText(/código de seis dígitos/i), "000000");
    await user.click(screen.getByRole("button", { name: /verificar/i }));

    expect(await screen.findByText(/bloqueada temporalmente/i)).toBeInTheDocument();
  });
});
