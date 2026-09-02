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
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

function Harness({
  onSesion,
  initialEntries = ["/segundo-factor"],
}: {
  onSesion: (s: SesionInterface) => void;
  initialEntries?: InitialEntry[];
}) {
  const [sesion, setSesionState] = useState<SesionInterface>({
    usuario: usuarioExample,
    autenticado: false,
    estado: "parcial",
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
      "Tu sesión cambió mientras verificabas el código. Volvé a intentarlo.",
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
