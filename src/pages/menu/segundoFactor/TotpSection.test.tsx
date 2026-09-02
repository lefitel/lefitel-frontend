// Task 19 of the 4B plan. The one test in this file that matters most to the
// plan itself is the DOM-order one below: hallazgo A5, reproduced with a
// clock in `docs/plans/2026-09-01-factores-mfa.md`, is a loop somebody with a
// dead TOTP factor falls into when "Añadir" reads before "Quitar" — pressing
// Añadir gets them a password prompt and then a refusal, because a factor is
// still on file, and every trip round that loop costs a recovery code. A
// test asserting both sections merely *exist* would stay green if that order
// were reversed; only a test that reads the DOM's own order catches it.

import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import TotpSection from "./TotpSection";

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

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

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
    render(<TotpSection />);

    const quitar = screen.getByRole("heading", { name: /quitar tu factor actual/i });
    const anadir = screen.getByRole("heading", { name: /configurar un nuevo factor/i });

    // DOCUMENT_POSITION_FOLLOWING (4) on `anadir` relative to `quitar` means
    // `quitar` comes first in the DOM — reading the tree's own order, not
    // merely asserting both headings exist.
    expect(quitar.compareDocumentPosition(anadir) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("names apps people already know, because half of an MFA rollout's support calls are 'which app do I install'", () => {
    render(<TotpSection />);

    expect(screen.getByText(/google authenticator/i)).toBeInTheDocument();
  });
});

describe("quitar el factor", () => {
  it("asks for the password before letting the confirm dialog open", async () => {
    const user = userEvent.setup();
    render(<TotpSection />);

    await user.click(screen.getByRole("button", { name: "Quitar mi factor" }));
    await user.click(screen.getByRole("button", { name: "Quitar factor" }));

    expect(toast.warning).toHaveBeenCalledWith("Debes escribir tu contraseña actual.");
    expect(screen.queryByText(/¿quitar tu segundo factor\?/i)).not.toBeInTheDocument();
  });

  it("says, before deleting, that the account may fall back to password-only entry", async () => {
    const user = userEvent.setup();
    render(<TotpSection />);

    await user.click(screen.getByRole("button", { name: "Quitar mi factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Quitar factor" }));

    expect(
      screen.getByText(/a partir de ahora volverás a entrar solo con tu contraseña/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/los códigos de recuperación no cuentan como un factor/i)).toBeInTheDocument();
  });

  it("deletes with the typed password once the dialog is confirmed", async () => {
    deleteTotp.mockResolvedValue({ status: 200, message: "Factor de autenticación eliminado." });
    const user = userEvent.setup();
    render(<TotpSection />);

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
    render(<TotpSection />);

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
    render(<TotpSection />);

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
    render(<TotpSection />);

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
    render(<TotpSection />);

    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText(SECRETO);

    await user.click(screen.getByRole("button", { name: /copiar código/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SECRETO));
  });

  it("confirms with the same password already typed for setup — never asks for it twice in one attempt", async () => {
    setupTotp.mockResolvedValue({ status: 200, message: null, otpauth: OTPAUTH, secreto: SECRETO });
    confirmTotp.mockResolvedValue({ status: 200, message: "Segundo factor configurado correctamente." });
    const user = userEvent.setup();
    render(<TotpSection />);

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

  it("keeps the QR on screen and shows an inline error on a wrong code, so the person can just retry", async () => {
    setupTotp.mockResolvedValue({ status: 200, message: null, otpauth: OTPAUTH, secreto: SECRETO });
    confirmTotp.mockResolvedValue({
      status: 400,
      message: "El código no es válido. Comprueba la hora de tu dispositivo e inténtalo de nuevo.",
    });
    const user = userEvent.setup();
    render(<TotpSection />);

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
    render(<TotpSection />);

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
    render(<TotpSection />);

    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText(/usa «quitar mi factor», arriba/i)).toBeInTheDocument();
  });

  it("cancelling the QR step discards the attempt without calling the server again", async () => {
    setupTotp.mockResolvedValue({ status: 200, message: null, otpauth: OTPAUTH, secreto: SECRETO });
    const user = userEvent.setup();
    render(<TotpSection />);

    await user.click(screen.getByRole("button", { name: "Configurar un nuevo factor" }));
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText(SECRETO);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByRole("button", { name: "Configurar un nuevo factor" })).toBeInTheDocument();
    expect(screen.queryByText(SECRETO)).not.toBeInTheDocument();
    expect(confirmTotp).not.toHaveBeenCalled();
  });
});
