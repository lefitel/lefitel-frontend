// Task 19 of the 4B plan. The one test in this file that matters most to the
// plan itself is the DOM-order one below: hallazgo A5, reproduced with a
// clock in `docs/plans/2026-09-01-factores-mfa.md`, is a loop somebody with a
// dead TOTP factor falls into when "Añadir" reads before "Quitar" — pressing
// Añadir gets them a password prompt and then a refusal, because a factor is
// still on file, and every trip round that loop costs a recovery code. A
// test asserting both sections merely *exist* would stay green if that order
// were reversed; only a test that reads the DOM's own order catches it.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import TotpSection from "./TotpSection";
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";
import { sinPermisos } from "../../../lib/permissions";

const setupTotp = vi.fn();
const confirmTotp = vi.fn();
const deleteTotp = vi.fn();

vi.mock("../../../api/Mfa.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../api/Mfa.api")>();
  return {
    ...actual,
    setupTotp: (...args: unknown[]) => setupTotp(...args),
    confirmTotp: (...args: unknown[]) => confirmTotp(...args),
    deleteTotp: (...args: unknown[]) => deleteTotp(...args),
  };
});

// Hallazgo E-3/F12: `TotpSection` now asks `/auth/me` after a successful
// `confirmTotp`, to re-derive the session. Defaulted to the same anonymous,
// no-op answer `SesionProvider.test.tsx` defaults it to, so every test in
// this file that does not care about the refresh gets a harmless 401 rather
// than crashing on an unmocked `vi.fn()` return value.
const comprobarToken = vi.fn();
vi.mock("../../../api/Login.api", () => ({
  comprobarToken: (...args: unknown[]) => comprobarToken(...args),
}));

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/** The `setSesion` every test can assert against, without each one having to
 *  build its own `SesionContext.Provider`. */
const setSesion = vi.fn();

function renderTotp(usuario = usuarioExample) {
  const value: contextProps = {
    sesion: { usuario, autenticado: true, estado: "onboarding" },
    setSesion,
    loading: false,
    logout: vi.fn(),
  };
  return render(
    <SesionContext.Provider value={value}>
      <TotpSection />
    </SesionContext.Provider>,
  );
}

beforeEach(() => {
  comprobarToken.mockResolvedValue({ status: 401, usuario: null });
});

// `qrcode`'s SVG renderer is pure JS and safe to run for real under Vitest —
// see `totpQr.test.ts` — but it is async and irrelevant to every test here
// except the one that actually looks at the QR, so it is stubbed to resolve
// instantly everywhere else.
vi.mock("./totpQr", () => ({
  renderTotpQr: vi.fn().mockResolvedValue("<svg data-testid=\"qr-stub\"></svg>"),
}));

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

const OTPAUTH = "otpauth://totp/Osefi:ada?secret=JBSWY3DPEHPK3PXP&issuer=Osefi";
const SECRETO = "JBSWY3DPEHPK3PXP";

describe("layout", () => {
  it("shows the remove-factor action before the add-factor action", () => {
    renderTotp();

    const quitar = screen.getByRole("heading", { name: /quitar tu factor actual/i });
    const anadir = screen.getByRole("heading", { name: /configurar un nuevo factor/i });

    // DOCUMENT_POSITION_FOLLOWING (4) on `anadir` relative to `quitar` means
    // `quitar` comes first in the DOM — reading the tree's own order, not
    // merely asserting both headings exist.
    expect(quitar.compareDocumentPosition(anadir) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("names apps people already know, because half of an MFA rollout's support calls are 'which app do I install'", () => {
    renderTotp();

    expect(screen.getByText(/google authenticator/i)).toBeInTheDocument();
  });
});

describe("quitar el factor", () => {
  it("asks for the password before letting the confirm dialog open", async () => {
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Quitar mi factor" }));
    await user.click(screen.getByRole("button", { name: "Quitar factor" }));

    expect(toast.warning).toHaveBeenCalledWith("Debes escribir tu contraseña actual.");
    expect(screen.queryByText(/¿quitar tu segundo factor\?/i)).not.toBeInTheDocument();
  });

  it("says, before deleting, that the account may fall back to password-only entry", async () => {
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Quitar mi factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Quitar factor" }));

    expect(
      screen.getByText(/a partir de ahora volverás a entrar solo con tu contraseña/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/los códigos de recuperación no cuentan como un factor/i)).toBeInTheDocument();
  });

  // Plan 4E: with a verified address the account does not fall back to the
  // password alone, and saying so would be false.
  it("says instead that the verified email stays as the second factor, when there is one", async () => {
    const user = userEvent.setup();
    renderTotp({ ...usuarioExample, email: "isaias@osefi.net", email_verified_at: "2026-09-01T00:00:00.000Z" });

    await user.click(screen.getByRole("button", { name: "Quitar mi factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Quitar factor" }));

    expect(screen.getByText(/tu correo verificado sigue siendo tu segundo factor/i)).toBeInTheDocument();
    expect(screen.queryByText(/volverás a entrar solo con tu contraseña/i)).not.toBeInTheDocument();
  });

  it("deletes with the typed password once the dialog is confirmed", async () => {
    deleteTotp.mockResolvedValue({ status: 200, message: "Factor de autenticación eliminado." });
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Quitar mi factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Quitar factor" }));
    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));

    await waitFor(() => expect(deleteTotp).toHaveBeenCalledWith("la-mia"));
    expect(toast.success).toHaveBeenCalledWith("Factor de autenticación eliminado.");
    // The form collapses back to the plain button, not left open with a
    // stale password sitting in state.
    await waitFor(() => expect(screen.queryByLabelText(/contraseña actual/i)).not.toBeInTheDocument());
  });

  it("reads a 404 (nothing registered) as news, not as a red error", async () => {
    deleteTotp.mockResolvedValue({ status: 404, message: "No tienes ningún factor de autenticación registrado." });
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Quitar mi factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Quitar factor" }));
    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith("No tienes ningún factor de autenticación registrado."),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows a distinct sentence for 'sin-factor-reciente', not the same one a wrong password gets", async () => {
    deleteTotp.mockResolvedValue({
      status: 403,
      message: "Esta operación necesita que confirmes tu identidad. Vuelve a autenticarte y repite la acción.",
      code: "STEP_UP_REQUIRED",
      motivo: "sin-factor-reciente",
    });
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Quitar mi factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Quitar factor" }));
    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));

    await waitFor(() => expect(screen.getByText(/prueba tu segundo factor actual/i)).toBeInTheDocument());
    expect(screen.queryByText(/esa contraseña no es correcta/i)).not.toBeInTheDocument();
  });
});

describe("añadir un factor nuevo", () => {
  it("asks for the password, then shows the QR and the plain-text secret", async () => {
    setupTotp.mockResolvedValue({ status: 200, message: null, otpauth: OTPAUTH, secreto: SECRETO });
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(setupTotp).toHaveBeenCalledWith("la-mia"));
    expect(await screen.findByText(SECRETO)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /código qr/i })).toBeInTheDocument();
  });

  it("copies the plain-text secret for whoever cannot scan the QR", async () => {
    setupTotp.mockResolvedValue({ status: 200, message: null, otpauth: OTPAUTH, secreto: SECRETO });
    // See RecoveryCodesSection.test.tsx's own comment on this exact call:
    // this jsdom's `navigator.clipboard` is a real, working stub, so the
    // method is spied on the existing object rather than the whole global
    // being swapped out.
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText(SECRETO);

    await user.click(screen.getByRole("button", { name: /copiar código/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SECRETO));
  });

  it("warns that the copied secret sits in the Windows clipboard history — hallazgo E-13/F15", async () => {
    // Nothing on this side can stop Win+V from keeping it, or Microsoft
    // account sync from carrying it further — the only lever left is saying
    // so, since a TOTP secret in that history is equivalent to no second
    // factor at all.
    setupTotp.mockResolvedValue({ status: 200, message: null, otpauth: OTPAUTH, secreto: SECRETO });
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText(SECRETO);

    await user.click(screen.getByRole("button", { name: /copiar código/i }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/historial del portapapeles/i)),
    );
  });

  it("confirms with the same password already typed for setup — never asks for it twice in one attempt", async () => {
    setupTotp.mockResolvedValue({ status: 200, message: null, otpauth: OTPAUTH, secreto: SECRETO });
    confirmTotp.mockResolvedValue({ status: 200, message: "Segundo factor configurado correctamente." });
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText(SECRETO);

    // No second password field anywhere on screen at this point.
    expect(screen.queryByLabelText(/contraseña actual/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/código de 6 dígitos/i), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(confirmTotp).toHaveBeenCalledWith("123456", "la-mia"));
  });

  it("refreshes SesionContext from /auth/me right after a successful confirm — hallazgo E-3/F12", async () => {
    // Without this, `sesion.estado` in context stays `"onboarding"` after the
    // server already promoted the session: `HomeRoute` reads that stale
    // value on the very next "Inicio" click and sends the person right back
    // to this screen with the same expired-grace toast, the sidebar still
    // missing its permissions. Fixed only by a manual reload nothing on
    // screen suggests.
    setupTotp.mockResolvedValue({ status: 200, message: null, otpauth: OTPAUTH, secreto: SECRETO });
    confirmTotp.mockResolvedValue({ status: 200, message: "Segundo factor configurado correctamente." });
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: { ...usuarioExample, user: "ada" },
      permisos: sinPermisos(),
      estado: "completa",
    });
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText(SECRETO);
    await user.type(screen.getByLabelText(/código de 6 dígitos/i), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(setSesion).toHaveBeenCalledWith({
      usuario: { ...usuarioExample, user: "ada" },
      permisos: sinPermisos(),
      estado: "completa",
      autenticado: true,
    }));
  });

  it("tolerates a paste with the space Google Authenticator and Authy put in the middle of the code — hallazgo E-12/F14", async () => {
    setupTotp.mockResolvedValue({ status: 200, message: null, otpauth: OTPAUTH, secreto: SECRETO });
    confirmTotp.mockResolvedValue({ status: 200, message: "ok" });
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText(SECRETO);

    // "123 456", the way both apps display it. A bare `maxLength={6}` with no
    // sanitizer truncates this to "123 45" — six characters, none of them
    // the code.
    await user.type(screen.getByLabelText(/código de 6 dígitos/i), "123 456");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(confirmTotp).toHaveBeenCalledWith("123456", "la-mia"));
  });

  it("keeps the QR on screen and shows an inline error on a wrong code, so the person can just retry", async () => {
    setupTotp.mockResolvedValue({ status: 200, message: null, otpauth: OTPAUTH, secreto: SECRETO });
    confirmTotp.mockResolvedValue({
      status: 400,
      message: "El código no es válido. Comprueba la hora de tu dispositivo e inténtalo de nuevo.",
    });
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText(SECRETO);

    await user.type(screen.getByLabelText(/código de 6 dígitos/i), "000000");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText(/el código no es válido/i)).toBeInTheDocument();
    // Still there: a wrong code must not throw away the secret nobody has
    // written down yet.
    expect(screen.getByText(SECRETO)).toBeInTheDocument();
  });

  it("shows the verified-email 409 with a way there, not just a refusal", async () => {
    setupTotp.mockResolvedValue({
      status: 409,
      message:
        "Debes verificar tu correo antes de configurar un segundo factor. " +
        "Solicita el enlace de verificación desde tu perfil y confírmalo desde tu bandeja de entrada; " +
        "después vuelve a intentar este registro.",
      otpauth: null,
      secreto: null,
    });
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText(/debes verificar tu correo/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ir a mi perfil a verificar mi correo/i })).toHaveAttribute(
      "href",
      "/app/perfil",
    );
  });

  it("points back at the Quitar section on the 'already configured' 409, instead of leaving the trap A5 describes", async () => {
    setupTotp.mockResolvedValue({
      status: 409,
      message: "Ya tienes un factor de autenticación configurado. Elimínalo antes de registrar uno nuevo.",
      otpauth: null,
      secreto: null,
    });
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText(/cierra esta ventana, usa «quitar mi factor»/i)).toBeInTheDocument();
  });

  it("cancelling the QR step discards the attempt without calling the server again", async () => {
    setupTotp.mockResolvedValue({ status: 200, message: null, otpauth: OTPAUTH, secreto: SECRETO });
    const user = userEvent.setup();
    renderTotp();

    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText(SECRETO);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    // The step is a dialog now, and a secret that may already be in a phone
    // is not thrown away on one click: it asks, and the QR is still there.
    const descartar = await screen.findByRole("button", { name: "Descartar" });
    expect(screen.getByText(SECRETO)).toBeInTheDocument();
    await user.click(descartar);

    await waitFor(() => expect(screen.queryByText(SECRETO)).not.toBeInTheDocument());
    expect(await screen.findByRole("button", { name: "Configurar un nuevo factor" })).toBeInTheDocument();
    expect(confirmTotp).not.toHaveBeenCalled();
  });
});

describe("códigos de recuperación al confirmar (Isaias, 2026-09-02)", () => {
  // Same shape `RecoveryCodesSection.test.tsx` seeds its own fixture with:
  // 26 characters each, the canonical length `recoveryCodeStore.ts` mints.
  const CODIGOS = Array.from({ length: 10 }, (_, i) => `CODE${i}ABCDEFGHJKMNPQRSTUV`.slice(0, 26));

  async function llegarAlPasoDeCodigo(user: ReturnType<typeof userEvent.setup>) {
    setupTotp.mockResolvedValue({ status: 200, message: null, otpauth: OTPAUTH, secreto: SECRETO });
    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText(SECRETO);
    await user.type(screen.getByLabelText(/código de 6 dígitos/i), "123456");
  }

  it("shows the ten fresh codes on this same screen when confirming is what minted them", async () => {
    // Before this decision, confirming only ever printed a toast suggesting
    // a trip to a different screen. Now the ten codes `confirmTotp` returns
    // land right here, using the same reveal presentation
    // `RecoveryCodesSection.tsx` already uses for its own regenerate flow.
    confirmTotp.mockResolvedValue({
      status: 200,
      message: "Segundo factor configurado correctamente.",
      codigos: CODIGOS,
    });
    const user = userEvent.setup();
    renderTotp();
    await llegarAlPasoDeCodigo(user);

    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText(/tus códigos de recuperación/i)).toBeInTheDocument();
    // All ten land on screen, formatted — not the raw 26-character string.
    for (const codigo of CODIGOS) {
      expect(screen.getByText(codigo.match(/.{1,4}/g)!.join("-"))).toBeInTheDocument();
    }
    expect(screen.getByText(/única vez que vas a ver estos códigos/i)).toBeInTheDocument();
  });

  it("shows no codes dialog when the account already had an outstanding sheet (codigos: null)", async () => {
    // The "only the first factor" rule, from the server's own side of this
    // decision: `codigos: null` means nothing was minted, so there is
    // nothing for this screen to reveal.
    confirmTotp.mockResolvedValue({
      status: 200,
      message: "Segundo factor configurado correctamente.",
      codigos: null,
    });
    const user = userEvent.setup();
    renderTotp();
    await llegarAlPasoDeCodigo(user);

    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(screen.queryByText(/tus códigos de recuperación/i)).not.toBeInTheDocument();
  });

  it("does not close the codes on Escape — the acknowledgement button is the only way out", async () => {
    confirmTotp.mockResolvedValue({
      status: 200,
      message: "Segundo factor configurado correctamente.",
      codigos: CODIGOS,
    });
    const user = userEvent.setup();
    renderTotp();
    await llegarAlPasoDeCodigo(user);
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByText(/tus códigos de recuperación/i);

    await user.keyboard("{Escape}");

    expect(screen.getByText(/tus códigos de recuperación/i)).toBeInTheDocument();
  });

  it("requires clicking the mandatory acknowledgement before the codes disappear", async () => {
    confirmTotp.mockResolvedValue({
      status: 200,
      message: "Segundo factor configurado correctamente.",
      codigos: CODIGOS,
    });
    const user = userEvent.setup();
    renderTotp();
    await llegarAlPasoDeCodigo(user);
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByText(/tus códigos de recuperación/i);

    await user.click(screen.getByRole("button", { name: "Ya los guardé, cerrar" }));

    await waitFor(() => expect(screen.queryByText(/tus códigos de recuperación/i)).not.toBeInTheDocument());
  });
});
