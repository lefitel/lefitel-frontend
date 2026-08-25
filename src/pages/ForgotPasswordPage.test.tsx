// The screen that has to keep a secret it is never told: `/password/forgot`
// answers the exact same 200 whether or not an address has an account behind
// it (Global Constraint #1), so nothing here may branch on anything but that
// one status code. These tests pin two things — that a 200 always renders the
// server's own sentence and never a homemade one, and that the 200 path is
// the *only* path that reaches the confirmation view, whatever the server's
// message happens to say.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ForgotPasswordPage from "./ForgotPasswordPage";
import { ThemeProvider } from "../components/theme-provider";

const forgotPassword = vi.fn();
vi.mock("../api/Login.api", () => ({
  forgotPassword: (...args: unknown[]) => forgotPassword(...args),
}));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

function Harness() {
  return (
    <ThemeProvider>
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    </ThemeProvider>
  );
}

const RESPUESTA_UNIFORME =
  "Si la dirección corresponde a una cuenta con el correo verificado, se envió un enlace para restablecer la contraseña.";

async function pedirEnlace(email: string) {
  const user = userEvent.setup();
  render(<Harness />);
  if (email) await user.type(screen.getByLabelText(/correo de recuperación/i), email);
  await user.click(screen.getByRole("button", { name: /enviar enlace/i }));
  return user;
}

describe("asking for a reset link", () => {
  afterEach(() => vi.clearAllMocks());

  it("shows the server's own sentence, verbatim, for an address that has an account", async () => {
    forgotPassword.mockResolvedValue({ status: 200, message: RESPUESTA_UNIFORME });

    await pedirEnlace("existe@osefi.net");

    expect(await screen.findByText(RESPUESTA_UNIFORME)).toBeInTheDocument();
  });

  it("shows the exact same sentence for an address that has no account at all", async () => {
    // The point of this pair of tests: the component has no information to
    // tell these two cases apart, because the server never sends any. Both
    // tests drive the same code path to the same assertion — if this one ever
    // diverged from the test above, that divergence would have to be written
    // into ForgotPasswordPage.tsx itself, which is exactly the leak Global
    // Constraint #1 forbids.
    forgotPassword.mockResolvedValue({ status: 200, message: RESPUESTA_UNIFORME });

    await pedirEnlace("no-existe@osefi.net");

    expect(await screen.findByText(RESPUESTA_UNIFORME)).toBeInTheDocument();
  });

  it("never invents its own wording for the 200 — whatever the server says is what shows", async () => {
    // A wording change on the server must not need a matching change here;
    // if it did, this test would be pinning a string this component wrote
    // rather than one it only forwarded.
    forgotPassword.mockResolvedValue({ status: 200, message: "un texto que este componente no puede conocer" });

    await pedirEnlace("cualquiera@osefi.net");

    expect(await screen.findByText("un texto que este componente no puede conocer")).toBeInTheDocument();
  });

  it("sends the trimmed address to forgotPassword", async () => {
    forgotPassword.mockResolvedValue({ status: 200, message: RESPUESTA_UNIFORME });

    await pedirEnlace("  espacios@osefi.net  ");

    await waitFor(() => expect(forgotPassword).toHaveBeenCalledWith("espacios@osefi.net"));
  });

  it("refuses locally to send a malformed address, so an obvious typo does not spend the daily quota", async () => {
    await pedirEnlace("no-es-un-correo");

    expect(forgotPassword).not.toHaveBeenCalled();
    const { toast } = await import("sonner");
    expect(toast.warning).toHaveBeenCalled();
  });

  it("shows a plain 'wait' message for a 429, not whatever the limiter bucket happened to send", async () => {
    forgotPassword.mockResolvedValue({ status: 429, message: "algo que no debería llegar a la pantalla" });

    await pedirEnlace("perdido@osefi.net");

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith(
      "Has hecho demasiadas solicitudes. Espera unos minutos antes de volver a intentarlo."
    );
    // And the confirmation view never appears for a refusal.
    expect(screen.queryByText(RESPUESTA_UNIFORME)).not.toBeInTheDocument();
  });

  it("shows the server's own sentence for a 400 about the request's own shape", async () => {
    forgotPassword.mockResolvedValue({ status: 400, message: "Debe indicar una dirección de correo válida." });

    await pedirEnlace("cualquiera@osefi.net");

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Debe indicar una dirección de correo válida."));
  });
});
