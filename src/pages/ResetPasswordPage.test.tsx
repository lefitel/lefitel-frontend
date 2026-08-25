// `{origin}/nueva-contrasena#t=TOKEN` — the token rides in the URL fragment
// specifically because a fragment never reaches a server, a proxy, or a
// `Referer` header (see `password.controller.ts`'s `resetLinkFor`, the code
// that actually builds this link). These tests are about the guarantees that
// make that hold on this side — the token is read once and cleared from the
// address bar regardless of outcome — and about the one rule the brief calls
// out by name: an expired, an already-used and a never-existed token all
// answer with the same sentence, and this screen must not try to tell them
// apart either.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ResetPasswordPage, { ENLACE_INVALIDO as ENLACE_INVALIDO_EXPORTADO } from "./ResetPasswordPage";
import { ThemeProvider } from "../components/theme-provider";
import { PASSWORD_MIN_LENGTH } from "../lib/password";

const resetPassword = vi.fn();
vi.mock("../api/Login.api", () => ({
  resetPassword: (...args: unknown[]) => resetPassword(...args),
}));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const ENLACE_INVALIDO = "Este enlace ya no es válido. Solicite uno nuevo.";
const UNA_CLAVE_VALIDA = "una-clave-nueva-larga";

function Harness() {
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={["/nueva-contrasena"]}>
        <Routes>
          <Route path="/nueva-contrasena" element={<ResetPasswordPage />} />
          <Route path="/login" element={<div>pantalla-login</div>} />
          <Route path="/olvide-contrasena" element={<div>pantalla-olvide</div>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

async function elegirContrasena(pass: string, confirmPass: string) {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(screen.getByLabelText(/^nueva contraseña$/i), pass);
  await user.type(screen.getByLabelText(/confirmar contraseña/i), confirmPass);
  await user.click(screen.getByRole("button", { name: /actualizar contraseña/i }));
  return user;
}

beforeEach(() => {
  // Left over from a previous test otherwise: the fragment is read exactly
  // once per mount, so a stale value here would leak into a test that has
  // nothing to do with it.
  window.location.hash = "";
});

describe("reading the token from the address bar", () => {
  afterEach(() => vi.clearAllMocks());

  it("clears the fragment on mount, before any request is made", async () => {
    window.location.hash = "#t=un-token-opaco";

    render(<Harness />);

    expect(window.location.hash).toBe("");
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("sends the token read from the fragment, not anything typed on screen", async () => {
    window.location.hash = "#t=un-token-opaco";
    resetPassword.mockResolvedValue({ status: 200, message: "Contraseña actualizada. Inicia sesión con tu contraseña nueva." });

    await elegirContrasena(UNA_CLAVE_VALIDA, UNA_CLAVE_VALIDA);

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith("un-token-opaco", UNA_CLAVE_VALIDA));
  });

  it("shows the broken-link panel immediately when the page is opened with no token at all — a bookmark, or the fragment stripped along the way", async () => {
    window.location.hash = "";

    render(<Harness />);

    expect(await screen.findByText(/enlace no válido/i)).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    // No password form to submit, and nothing sent for a token that was never there.
    expect(screen.queryByLabelText(/^nueva contraseña$/i)).not.toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });
});

describe("finishing a reset", () => {
  afterEach(() => vi.clearAllMocks());

  it("goes to /login on success, never to the application — there is no session to land in", async () => {
    window.location.hash = "#t=un-token-opaco";
    resetPassword.mockResolvedValue({ status: 200, message: "Contraseña actualizada. Inicia sesión con tu contraseña nueva." });

    await elegirContrasena(UNA_CLAVE_VALIDA, UNA_CLAVE_VALIDA);

    expect(await screen.findByText("pantalla-login")).toBeInTheDocument();
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("Contraseña actualizada. Inicia sesión con tu contraseña nueva.");
  });

  it("refuses locally when the two fields do not match, without spending a request", async () => {
    window.location.hash = "#t=un-token-opaco";

    await elegirContrasena(UNA_CLAVE_VALIDA, "otra-clave-distinta-larga");

    expect(resetPassword).not.toHaveBeenCalled();
    const { toast } = await import("sonner");
    expect(toast.warning).toHaveBeenCalledWith("Las contraseñas no coinciden.");
  });

  it("refuses locally a password shorter than the server's own rule, imported rather than reimplemented", async () => {
    window.location.hash = "#t=un-token-opaco";
    const corta = "a".repeat(PASSWORD_MIN_LENGTH - 1);

    await elegirContrasena(corta, corta);

    expect(resetPassword).not.toHaveBeenCalled();
    const { toast } = await import("sonner");
    expect(toast.warning).toHaveBeenCalledWith(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  });
});

describe("a link that will never work — expired, already used, or never existed", () => {
  afterEach(() => vi.clearAllMocks());

  // The server answers all three with the exact same sentence on purpose
  // (Global Constraint's reasoning, restated in `password.controller.ts`'s own
  // `TOKEN_INVALIDO`), so from this screen's side there is only one case to
  // draw, however many real causes it stands for.
  it("shows the same 'pide otro enlace' panel the server's uniform refusal describes", async () => {
    window.location.hash = "#t=un-token-caducado";
    resetPassword.mockResolvedValue({ status: 400, message: ENLACE_INVALIDO });

    await elegirContrasena(UNA_CLAVE_VALIDA, UNA_CLAVE_VALIDA);

    expect(await screen.findByText(/enlace no válido/i)).toBeInTheDocument();
    expect(screen.getByText(ENLACE_INVALIDO)).toBeInTheDocument();
  });

  it("sends 'solicitar un enlace nuevo' back to the first screen, not to the login or the app", async () => {
    window.location.hash = "#t=un-token-ya-usado";
    resetPassword.mockResolvedValue({ status: 400, message: ENLACE_INVALIDO });

    const user = await elegirContrasena(UNA_CLAVE_VALIDA, UNA_CLAVE_VALIDA);
    await user.click(await screen.findByRole("button", { name: /solicitar un enlace nuevo/i }));

    expect(await screen.findByText("pantalla-olvide")).toBeInTheDocument();
  });

  it("does not confuse a still-good token's own weak-password refusal with a dead link", async () => {
    // A 400 here fires *before* the token is ever touched server-side — see
    // `password.controller.ts`'s own ordering comment on `resetPassword` — so
    // the token is still good and the person should be told to pick another
    // password, not sent back for a whole new email.
    window.location.hash = "#t=un-token-bueno";
    resetPassword.mockResolvedValue({ status: 400, message: "Esa contraseña es demasiado común." });

    await elegirContrasena(UNA_CLAVE_VALIDA, UNA_CLAVE_VALIDA);

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Esa contraseña es demasiado común."));
    expect(screen.queryByText(/enlace no válido/i)).not.toBeInTheDocument();
  });
});

describe("rate limiting", () => {
  afterEach(() => vi.clearAllMocks());

  it("shows a plain 'wait' message for a 429, not whichever bucket's own text came back", async () => {
    window.location.hash = "#t=un-token-opaco";
    resetPassword.mockResolvedValue({ status: 429, message: "algo que no debería llegar a la pantalla" });

    await elegirContrasena(UNA_CLAVE_VALIDA, UNA_CLAVE_VALIDA);

    const { toast } = await import("sonner");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Demasiados intentos. Espera unos minutos antes de volver a intentarlo.")
    );
    expect(screen.queryByText(/enlace no válido/i)).not.toBeInTheDocument();
  });
});

/**
 * The mirror check `password.test.ts` already runs for `PASSWORD_MIN_LENGTH`,
 * repeated here for `ENLACE_INVALIDO`.
 *
 * Every test above compares a server response against `ENLACE_INVALIDO` —
 * this screen's own copy of the sentence — so none of them can notice the
 * copy going stale: a rename on the server's side would leave every test in
 * this file still comparing the constant against itself, all still green,
 * while the real site quietly stopped recognising a dead link. This is the
 * one test that reads the actual source instead of trusting the copy.
 */
describe("the sentence the server actually sends for a dead link", () => {
  it("matches TOKEN_INVALIDO in the api repository", (ctx) => {
    // Same resolution `password.test.ts` uses, one directory further down
    // (`src/pages` instead of `src/lib`) — same three `..` to reach the
    // sibling `api` checkout either way.
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    const controladorDelServidor = path.resolve(aqui, "../../../api/src/controllers/password.controller.ts");

    // Copied from `password.test.ts` rather than reinvented: a build that has
    // only `web` checked out — a CI job, a Vercel deploy — has nowhere to
    // read the server's source from, so this skips visibly there instead of
    // failing for a reason that has nothing to do with this change.
    if (!existsSync(controladorDelServidor)) {
      ctx.skip(`sin el repositorio api al lado no se puede comprobar (${controladorDelServidor})`);
      return;
    }

    const fuente = readFileSync(controladorDelServidor, "utf-8");
    const declarado = /export const TOKEN_INVALIDO\s*=\s*"([^"]+)"/.exec(fuente);

    expect(
      declarado,
      `TOKEN_INVALIDO ya no se declara en ${controladorDelServidor}: ` +
        "la fuente de verdad se movió y este espejo dejó de estar comprobado."
    ).not.toBeNull();
    expect(
      ENLACE_INVALIDO_EXPORTADO,
      "el servidor cambió la frase que marca un enlace muerto (expirado, ya usado o " +
        "inexistente) y ResetPasswordPage.tsx no se enteró: compara su propio " +
        "ENLACE_INVALIDO contra el mensaje que llega para decidir si muestra el panel " +
        "\"pide otro enlace\" con su botón, así que un enlace realmente muerto caería " +
        "ahora en el toast de error genérico — sin ese botón — justo para la persona " +
        "que ya está bloqueada fuera de su cuenta. web/src/pages/ResetPasswordPage.tsx " +
        "tiene que seguir a api/src/controllers/password.controller.ts."
    ).toBe(declarado![1]);
  });
});
