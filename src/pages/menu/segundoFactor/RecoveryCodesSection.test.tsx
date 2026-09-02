// Task 20 of the 4B plan. The two facts this file protects hardest: the ten
// codes are shown exactly once, in the one response that ever carries them
// (`generateRecoveryCodes`'s own comment in `Mfa.api.ts` — there is no
// second endpoint that returns them), and both of Task 20's warnings —
// "the old ten stop working" and "this is the only look you get" — have to
// land *before* the request fires, not as an afterthought once the new ten
// are already on screen.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecoveryCodesSection from "./RecoveryCodesSection";

const generateRecoveryCodes = vi.fn();
const getRecoveryCodesRemaining = vi.fn();

vi.mock("../../../api/Mfa.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../api/Mfa.api")>();
  return {
    ...actual,
    generateRecoveryCodes: (...args: unknown[]) => generateRecoveryCodes(...args),
    getRecoveryCodesRemaining: (...args: unknown[]) => getRecoveryCodesRemaining(...args),
  };
});

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const CODIGOS = Array.from({ length: 10 }, (_, i) => `CODE${i}ABCDEFGHJKMNPQRSTUV`.slice(0, 26));

async function generarHastaLaAdvertencia(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Generar códigos nuevos" }));
  await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
  await user.click(screen.getByRole("button", { name: "Generar códigos" }));
}

beforeEach(() => {
  getRecoveryCodesRemaining.mockResolvedValue({ status: 200, restantes: 5 });
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("cuántos quedan", () => {
  it("shows the remaining count on mount, without waiting for a click", async () => {
    getRecoveryCodesRemaining.mockResolvedValue({ status: 200, restantes: 7 });
    render(<RecoveryCodesSection />);

    expect(await screen.findByText(/7 de 10 sin usar/i)).toBeInTheDocument();
    expect(getRecoveryCodesRemaining).toHaveBeenCalledTimes(1);
  });

  it("flags a low count before the day it actually runs out", async () => {
    getRecoveryCodesRemaining.mockResolvedValue({ status: 200, restantes: 2 });
    render(<RecoveryCodesSection />);

    expect(await screen.findByText(/quedan 2 de 10/i)).toBeInTheDocument();
  });

  it("says plainly there are none left, rather than a bare '0 de 10'", async () => {
    getRecoveryCodesRemaining.mockResolvedValue({ status: 200, restantes: 0 });
    render(<RecoveryCodesSection />);

    expect(await screen.findByText(/sin códigos disponibles/i)).toBeInTheDocument();
  });
});

describe("generar códigos nuevos", () => {
  it("warns that the old ten stop working AND that this is a one-time look, both before generating", async () => {
    const user = userEvent.setup();
    render(<RecoveryCodesSection />);
    await screen.findByText(/5 de 10 sin usar/i);

    await generarHastaLaAdvertencia(user);

    expect(generateRecoveryCodes).not.toHaveBeenCalled();
    expect(screen.getByText(/los anteriores dejarán de servir de inmediato/i)).toBeInTheDocument();
    expect(screen.getByText(/solo se muestran una vez/i)).toBeInTheDocument();
  });

  it("sends the typed password and reveals the ten codes on confirmation", async () => {
    generateRecoveryCodes.mockResolvedValue({ status: 200, message: null, codigos: CODIGOS });
    const user = userEvent.setup();
    render(<RecoveryCodesSection />);
    await screen.findByText(/5 de 10 sin usar/i);

    await generarHastaLaAdvertencia(user);
    await user.click(screen.getByRole("button", { name: "Sí, generar" }));

    await waitFor(() => expect(generateRecoveryCodes).toHaveBeenCalledWith("la-mia"));
    expect(await screen.findByText(/tus códigos de recuperación/i)).toBeInTheDocument();
    // All ten land on screen, formatted — not the raw 26-character string.
    for (const codigo of CODIGOS) {
      expect(screen.getByText(codigo.match(/.{1,4}/g)!.join("-"))).toBeInTheDocument();
    }
    expect(await screen.findByText(/10 de 10 sin usar/i)).toBeInTheDocument();
  });

  it("shows a distinct sentence for a step-up refusal", async () => {
    generateRecoveryCodes.mockResolvedValue({
      status: 403,
      message: "x",
      code: "STEP_UP_REQUIRED",
      motivo: "contraseña-incorrecta",
    });
    const user = userEvent.setup();
    render(<RecoveryCodesSection />);
    await screen.findByText(/5 de 10 sin usar/i);

    await generarHastaLaAdvertencia(user);
    await user.click(screen.getByRole("button", { name: "Sí, generar" }));

    expect(await screen.findByText(/esa contraseña no es correcta/i)).toBeInTheDocument();
  });
});

describe("la hoja de códigos, mostrada una sola vez", () => {
  async function revelar(user: ReturnType<typeof userEvent.setup>) {
    generateRecoveryCodes.mockResolvedValue({ status: 200, message: null, codigos: CODIGOS });
    render(<RecoveryCodesSection />);
    await screen.findByText(/5 de 10 sin usar/i);
    await generarHastaLaAdvertencia(user);
    await user.click(screen.getByRole("button", { name: "Sí, generar" }));
    await screen.findByText(/tus códigos de recuperación/i);
  }

  it("says the warning before anything else in the dialog is read", async () => {
    const user = userEvent.setup();
    await revelar(user);

    expect(
      screen.getByText(/esta es la única vez que vas a ver estos códigos/i),
    ).toBeInTheDocument();
  });

  it("copies the formatted codes to the clipboard", async () => {
    // This jsdom ships a real, working `navigator.clipboard` (an in-memory
    // stub, not `undefined`) — measured while chasing why an earlier
    // `Object.defineProperty(window, "navigator", ...)` swap left the real
    // one answering instead of the fake: the component's `navigator` and
    // this test's turned out not to be the same reachable reference for the
    // purpose of a wholesale replacement. Spying on the existing object's
    // own method sidesteps that entirely — there is only one `Clipboard`
    // instance, and this patches the method on it in place.
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const user = userEvent.setup();
    await revelar(user);

    await user.click(screen.getByRole("button", { name: /copiar todos/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const texto = writeText.mock.calls[0][0] as string;
    expect(texto.split("\n")).toHaveLength(10);
    expect(texto).toContain(CODIGOS[0].match(/.{1,4}/g)!.join("-"));
  });

  it("opens a print window with the codes when 'Imprimir' is pressed", async () => {
    const ventana = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(ventana as unknown as Window);
    const user = userEvent.setup();
    await revelar(user);

    await user.click(screen.getByRole("button", { name: /imprimir/i }));

    expect(ventana.document.write).toHaveBeenCalledTimes(1);
    expect(ventana.document.write.mock.calls[0][0]).toContain(CODIGOS[0].match(/.{1,4}/g)!.join("-"));
    expect(ventana.print).toHaveBeenCalledTimes(1);
  });

  it("does not close on Escape — the only way out is the explicit button", async () => {
    const user = userEvent.setup();
    await revelar(user);

    await user.keyboard("{Escape}");

    expect(screen.getByText(/tus códigos de recuperación/i)).toBeInTheDocument();
  });

  it("closes only once the person presses 'Ya los guardé, cerrar'", async () => {
    const user = userEvent.setup();
    await revelar(user);

    await user.click(screen.getByRole("button", { name: /ya los guardé, cerrar/i }));

    await waitFor(() =>
      expect(screen.queryByText(/tus códigos de recuperación/i)).not.toBeInTheDocument(),
    );
  });
});
