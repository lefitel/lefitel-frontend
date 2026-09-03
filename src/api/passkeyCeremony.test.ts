// La ceremonia con el navegador: qué devuelve según lo que diga la librería y
// el servidor. Lo importante es la clasificación de los errores — la auditoría
// midió en `@simplewebauthn/browser` v14 que cancelar el diálogo del sistema
// llega como `WebAuthnError` con `name === "NotAllowedError"`, y que la propia
// librería aborta con `AbortError`; los dos son silencio, no un toast rojo.

import { describe, it, expect, vi, beforeEach } from "vitest";

const startAuthentication = vi.fn();
const startRegistration = vi.fn();
const cancelCeremony = vi.fn();
let soporta = true;

// Lo que importa es que lleve `name` y `code`, como el `WebAuthnError` de la
// librería: `clasificar` mira eso y no la clase.
class WebAuthnErrorFalso extends Error {
  code: string;
  constructor(name: string, code: string) {
    super("x");
    this.name = name;
    this.code = code;
  }
}

vi.mock("@simplewebauthn/browser", () => ({
  startAuthentication: (...a: unknown[]) => startAuthentication(...a),
  startRegistration: (...a: unknown[]) => startRegistration(...a),
  browserSupportsWebAuthn: () => soporta,
  WebAuthnAbortService: { cancelCeremony: (...a: unknown[]) => cancelCeremony(...a) },
}));

const loginOptions = vi.fn();
const loginVerify = vi.fn();
const registerOptions = vi.fn();
const registerVerify = vi.fn();
vi.mock("./Webauthn.api", () => ({
  loginOptions: (...a: unknown[]) => loginOptions(...a),
  loginVerify: (...a: unknown[]) => loginVerify(...a),
  registerOptions: (...a: unknown[]) => registerOptions(...a),
  registerVerify: (...a: unknown[]) => registerVerify(...a),
}));

const { probarPasskey, registrarPasskey, soportaPasskeys, cancelarCeremonia } = await import(
  "./passkeyCeremony"
);

const OPCIONES = { challenge: "reto" };
const ASERCION = { id: "cred", rawId: "cred", type: "public-key", response: {} };

beforeEach(() => {
  vi.clearAllMocks();
  soporta = true;
  loginOptions.mockResolvedValue({ status: 200, message: null, opciones: OPCIONES });
  startAuthentication.mockResolvedValue(ASERCION);
  loginVerify.mockResolvedValue({ status: 200, message: "Identidad confirmada." });
  registerOptions.mockResolvedValue({ status: 200, message: null, opciones: OPCIONES });
  startRegistration.mockResolvedValue(ASERCION);
  registerVerify.mockResolvedValue({ status: 201, message: "Llave registrada.", codigos: null });
});

describe("probarPasskey", () => {
  it("pide las opciones, abre el diálogo con ellas y canjea lo que devuelve", async () => {
    const r = await probarPasskey();

    expect(r).toEqual({ ok: true });
    expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: OPCIONES });
    expect(loginVerify).toHaveBeenCalledWith(ASERCION);
  });

  it("no abre el diálogo si el servidor no dio opciones, y devuelve su frase", async () => {
    loginOptions.mockResolvedValue({ status: 400, message: "Esta cuenta no tiene ninguna llave.", opciones: null });

    const r = await probarPasskey();

    expect(r).toMatchObject({ ok: false, cancelado: false, status: 400, message: "Esta cuenta no tiene ninguna llave." });
    expect(startAuthentication).not.toHaveBeenCalled();
  });

  // 🔴 La persona cerró el diálogo del sistema. No es un error.
  it("trata NotAllowedError como cancelado, sin frase", async () => {
    startAuthentication.mockRejectedValue(new WebAuthnErrorFalso("NotAllowedError", "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY"));

    const r = await probarPasskey();

    expect(r).toEqual({ ok: false, cancelado: true });
    expect(loginVerify).not.toHaveBeenCalled();
  });

  it("trata el aborto propio (AbortError) como cancelado también", async () => {
    startAuthentication.mockRejectedValue(new WebAuthnErrorFalso("AbortError", "ERROR_CEREMONY_ABORTED"));

    expect(await probarPasskey()).toEqual({ ok: false, cancelado: true });
  });

  it("cualquier otro fallo del navegador es un error con frase, no un silencio", async () => {
    startAuthentication.mockRejectedValue(new WebAuthnErrorFalso("SecurityError", "ERROR_INVALID_RP_ID"));

    const r = await probarPasskey();

    expect(r).toMatchObject({ ok: false, cancelado: false });
    expect((r as { message: string }).message).toBeTruthy();
  });

  // El 429 del cupo de ceremonias llega sin `code`, sólo con su frase, y la
  // frase es lo único que la pantalla puede enseñar.
  it("devuelve el estado y la frase del servidor cuando el canje falla", async () => {
    loginVerify.mockResolvedValue({ status: 429, message: "Demasiados intentos con la llave. Espere unos minutos." });

    const r = await probarPasskey();

    expect(r).toMatchObject({ ok: false, cancelado: false, status: 429 });
    expect((r as { message: string }).message).toContain("Demasiados intentos");
  });
});

describe("registrarPasskey", () => {
  // 🔴 La contraseña va en las DOS peticiones: las dos rutas llevan puerta, y
  // dejar que la ventana global la pidiera serían tres avisos para un gesto.
  it("manda la contraseña en las opciones y en el canje, y el nombre en el canje", async () => {
    const r = await registrarPasskey("mi móvil", "la-mia");

    expect(r).toEqual({ ok: true, codigos: null });
    expect(registerOptions).toHaveBeenCalledWith("la-mia");
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: OPCIONES });
    expect(registerVerify).toHaveBeenCalledWith("mi móvil", ASERCION, "la-mia");
  });

  it("devuelve los códigos de recuperación cuando el canje los trae", async () => {
    registerVerify.mockResolvedValue({ status: 201, message: "ok", codigos: ["ABCDEFGH"] });

    expect(await registrarPasskey("x", "p")).toEqual({ ok: true, codigos: ["ABCDEFGH"] });
  });

  // Rechazo de la puerta en las opciones: `code` y `motivo` viajan enteros
  // para que la sección pinte la frase correcta con `describeStepUpError`.
  it("pasa el rechazo de la puerta tal cual, con code y motivo", async () => {
    registerOptions.mockResolvedValue({
      status: 403,
      message: "x",
      code: "STEP_UP_REQUIRED",
      motivo: "contraseña-incorrecta",
      opciones: null,
    });

    const r = await registrarPasskey("x", "mal");

    expect(r).toMatchObject({ ok: false, cancelado: false, status: 403, code: "STEP_UP_REQUIRED", motivo: "contraseña-incorrecta" });
    expect(startRegistration).not.toHaveBeenCalled();
  });

  it("distingue el autenticador que ya tenía una llave de esta cuenta", async () => {
    startRegistration.mockRejectedValue(
      new WebAuthnErrorFalso("InvalidStateError", "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"),
    );

    const r = await registrarPasskey("x", "p");

    expect(r).toMatchObject({ ok: false, cancelado: false, yaRegistrada: true });
    expect((r as { message: string }).message).toContain("ya tiene una llave");
    expect(registerVerify).not.toHaveBeenCalled();
  });

  it("trata cancelar el diálogo del sistema como cancelado, sin frase", async () => {
    startRegistration.mockRejectedValue(new WebAuthnErrorFalso("NotAllowedError", "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY"));

    expect(await registrarPasskey("x", "p")).toEqual({ ok: false, cancelado: true });
  });
});

describe("soporte y cancelación", () => {
  it("dice si el navegador puede, según la librería", () => {
    expect(soportaPasskeys()).toBe(true);
    soporta = false;
    expect(soportaPasskeys()).toBe(false);
  });

  // 🔴 La librería aborta desde un singleton: no hay `AbortController` propio
  // que abortar. Esto es lo que la ventana llama al cancelar.
  it("cancelar delega en el servicio de aborto de la librería", () => {
    cancelarCeremonia();
    expect(cancelCeremony).toHaveBeenCalledTimes(1);
  });
});
