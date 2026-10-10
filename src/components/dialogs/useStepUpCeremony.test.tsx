// La máquina de estados de la ceremonia, sin la ventana por delante.
//
// `StepUpDialog.test.tsx` la ejercita entera a través del DOM, que es como la
// vive la persona. Aquí se comprueban las piezas que desde el DOM sólo se
// alcanzan de refilón: la decisión de qué se ofrece según `metodos` —que es
// pura y tiene una rama por combinación— y las transiciones que no dejan rastro
// visible, como el reinicio entre dos ceremonias seguidas o el código que es
// sólo espacios.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { decidirFormulario, useStepUpCeremony } from "./useStepUpCeremony";
import { SesionContext, type contextProps } from "@/context/SesionContext";
import { usuarioExample } from "@/data/example";
import { sinPermisos } from "@/lib/permissions";
import type { EstadoSesion } from "@/interfaces/interfaces";
import * as interceptor from "@/api/stepUpInterceptor";
import type { PeticionStepUp, ResultadoStepUp } from "@/api/stepUpInterceptor";

const probarStepUp = vi.fn();
const verifySecondFactor = vi.fn();
const comprobarToken = vi.fn();
vi.mock("@/api/Mfa.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/Mfa.api")>()),
  probarStepUp: (...a: unknown[]) => probarStepUp(...a),
}));
vi.mock("@/api/Login.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/Login.api")>()),
  verifySecondFactor: (...a: unknown[]) => verifySecondFactor(...a),
  comprobarToken: (...a: unknown[]) => comprobarToken(...a),
}));

// `jsdom` no tiene `PublicKeyCredential`, así que `soportaPasskeys()` real
// diría siempre `false` y las ramas de la llave se comprobarían por eso y no
// por lo que afirman. `soporta` se fuerza a `true` salvo donde se dice.
let soporta = true;
vi.mock("@/api/passkeyCeremony", () => ({
  probarPasskey: vi.fn(),
  cancelarCeremonia: vi.fn(),
  soportaPasskeys: () => soporta,
}));

const PIDE_FACTOR: PeticionStepUp = {
  motivo: "sin-factor-reciente",
  exigeContrasena: false,
  mensaje: null,
  signal: new AbortController().signal,
};

const PIDE_PASSWORD: PeticionStepUp = {
  motivo: "contraseña-requerida",
  exigeContrasena: false,
  mensaje: null,
  signal: new AbortController().signal,
};

beforeEach(() => {
  soporta = true;
  probarStepUp.mockReset().mockResolvedValue({ status: 200, message: "ok" });
  verifySecondFactor.mockReset().mockResolvedValue({ status: 200, message: "ok" });
  comprobarToken.mockReset().mockResolvedValue({
    status: 200,
    usuario: usuarioExample,
    permisos: sinPermisos(),
    estado: "completa",
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("qué se ofrece, según `metodos`", () => {
  it("sin ceremonia no hay nada que dibujar", () => {
    const f = decidirFormulario(null, null);
    expect(f.pideFactor).toBe(false);
    expect(f.pidePassword).toBe(false);
    expect(f.ofreceLlave).toBe(false);
    expect(f.ofreceCodigo).toBe(false);
    expect(f.sinMetodos).toBe(false);
    expect(f.llaveSinNavegador).toBe(false);
    expect(f.clases).toEqual([]);
    expect(f.claseActiva).toBeNull();
    expect(f.descripcion).toBeNull();
  });

  it("sin el campo `metodos` —un servidor anterior— se ofrece lo de siempre", () => {
    const f = decidirFormulario(PIDE_FACTOR, null);
    expect(f.ofreceCodigo).toBe(true);
    expect(f.ofreceRecuperacion).toBe(true);
    expect(f.ofreceLlave).toBe(false);
    expect(f.sinMetodos).toBe(false);
    expect(f.etiquetaCodigo).toBe("Código de tu aplicación");
  });

  it("con la lista vacía no hay formulario, y la frase manda avisar a un administrador", () => {
    const f = decidirFormulario({ ...PIDE_FACTOR, metodos: [] }, null);
    expect(f.sinMetodos).toBe(true);
    expect(f.ofreceCodigo).toBe(false);
    expect(f.ofreceLlave).toBe(false);
    expect(f.descripcion).toMatch(/avisa a un administrador/i);
  });

  it("con un método que esta versión no conoce, tampoco hay formulario, y la frase manda recargar", () => {
    const f = decidirFormulario({ ...PIDE_FACTOR, metodos: ["holograma"] }, null);
    expect(f.sinMetodos).toBe(true);
    expect(f.ofreceCodigo).toBe(false);
    expect(f.descripcion).toMatch(/recarga la página/i);
  });

  it("con sólo la llave, se ofrece la llave y ningún campo", () => {
    const f = decidirFormulario({ ...PIDE_FACTOR, metodos: ["passkey"] }, null);
    expect(f.ofreceLlave).toBe(true);
    expect(f.ofreceCodigo).toBe(false);
    expect(f.llaveSinNavegador).toBe(false);
    expect(f.sinMetodos).toBe(false);
  });

  it("con sólo la llave en un navegador que no puede, no queda nada que teclear y se dice", () => {
    soporta = false;
    const f = decidirFormulario({ ...PIDE_FACTOR, metodos: ["passkey"] }, null);
    expect(f.ofreceLlave).toBe(false);
    expect(f.llaveSinNavegador).toBe(true);
  });

  it("con la llave y el código en un navegador que no puede, queda el código y no se avisa de nada", () => {
    soporta = false;
    const f = decidirFormulario({ ...PIDE_FACTOR, metodos: ["passkey", "totp"] }, null);
    expect(f.ofreceLlave).toBe(false);
    expect(f.ofreceCodigo).toBe(true);
    // El aviso sólo tiene sentido cuando la llave era la única salida.
    expect(f.llaveSinNavegador).toBe(false);
  });

  it("con sólo la aplicación, no promete un código de recuperación", () => {
    const f = decidirFormulario({ ...PIDE_FACTOR, metodos: ["totp"] }, null);
    expect(f.ofreceRecuperacion).toBe(false);
    expect(f.clases).toEqual(["totp"]);
    expect(f.etiquetaCodigo).toBe("Código de tu aplicación");
  });

  it("con sólo códigos de recuperación, el campo se llama así", () => {
    const f = decidirFormulario({ ...PIDE_FACTOR, metodos: ["codigo"] }, null);
    expect(f.clases).toEqual(["codigo"]);
    expect(f.etiquetaCodigo).toBe("Código de recuperación");
  });

  it("la recuperación sólo es una clase propia cuando no hay aplicación", () => {
    const con = decidirFormulario({ ...PIDE_FACTOR, metodos: ["totp", "correo", "codigo"] }, null);
    expect(con.clases).toEqual(["totp", "correo"]);
    expect(con.ofreceRecuperacion).toBe(true);

    const sin = decidirFormulario({ ...PIDE_FACTOR, metodos: ["correo", "codigo"] }, null);
    expect(sin.clases).toEqual(["correo", "codigo"]);
  });

  it("sin clase elegida manda la primera que se ofrezca", () => {
    const f = decidirFormulario({ ...PIDE_FACTOR, metodos: ["correo", "codigo"] }, null);
    expect(f.claseActiva).toBe("correo");
    expect(f.etiquetaCodigo).toBe("Código recibido por correo");
  });

  it("una clase elegida que ya no se ofrece no deja el campo sin clase: cae a la primera", () => {
    // El servidor puede contestar la siguiente ceremonia con otros métodos.
    const f = decidirFormulario({ ...PIDE_FACTOR, metodos: ["totp"] }, "correo");
    expect(f.claseActiva).toBe("totp");
  });

  it("la clase elegida manda mientras se siga ofreciendo", () => {
    const f = decidirFormulario({ ...PIDE_FACTOR, metodos: ["totp", "correo"] }, "correo");
    expect(f.claseActiva).toBe("correo");
    expect(f.etiquetaCodigo).toBe("Código recibido por correo");
  });

  it("la contraseña se pide por el motivo, o porque el servidor avisa de que hará falta", () => {
    expect(decidirFormulario(PIDE_PASSWORD, null).pidePassword).toBe(true);
    expect(decidirFormulario(PIDE_FACTOR, null).pidePassword).toBe(false);
    expect(decidirFormulario({ ...PIDE_FACTOR, exigeContrasena: true }, null).pidePassword).toBe(true);
  });
});

/** El resolvedor que el hook registró al montarse. */
let pedir: (p: PeticionStepUp) => Promise<ResultadoStepUp | null>;

function montar(estado: EstadoSesion = "completa") {
  const registrar = vi
    .spyOn(interceptor, "registrarResolvedorStepUp")
    .mockImplementation((fn) => {
      if (fn) pedir = fn;
    });

  const valor = {
    sesion: { autenticado: true, usuario: usuarioExample, permisos: sinPermisos(), estado },
    setSesion: vi.fn(),
    loading: false,
    logout: vi.fn(),
  } as unknown as contextProps;

  const vista = renderHook(() => useStepUpCeremony(), {
    wrapper: ({ children }) => (
      <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
    ),
  });
  return { ...vista, registrar };
}

describe("cómo se abre y se cierra", () => {
  it("se registra al montar y se desregistra al desmontar", () => {
    const { registrar, unmount } = montar();
    expect(registrar).toHaveBeenCalledTimes(1);
    expect(typeof registrar.mock.calls[0][0]).toBe("function");
    unmount();
    expect(registrar).toHaveBeenLastCalledWith(null);
  });

  it("no hay ventana hasta que alguien pide una", async () => {
    const { result } = montar();
    expect(result.current.abierta).toBe(false);

    act(() => void pedir(PIDE_FACTOR));
    await waitFor(() => expect(result.current.abierta).toBe(true));
  });

  it("el contador que llega con el rechazo habla del cupo de la contraseña", async () => {
    const { result } = montar();
    act(() => void pedir({ ...PIDE_PASSWORD, intentosRestantes: 3 }));

    await waitFor(() => expect(result.current.restantes).toEqual({ n: 3, de: "espera" }));
  });

  it("cancelar resuelve con null y cierra, sin desarmar el resolvedor", async () => {
    const { result, registrar } = montar();
    let promesa!: Promise<ResultadoStepUp | null>;
    act(() => {
      promesa = pedir(PIDE_FACTOR);
    });
    await waitFor(() => expect(result.current.abierta).toBe(true));

    act(() => result.current.cancelar());
    await expect(promesa).resolves.toBeNull();
    expect(result.current.abierta).toBe(false);

    // 🔴 El puente con el interceptor se arma **una sola vez** y sobrevive a la
    // ceremonia: se registra al montar y sólo se suelta al desmontar. La cuenta
    // de llamadas es lo único observable, porque el resolvedor que este test
    // guardó en `pedir` sigue funcionando aunque el interceptor ya no lo tenga
    // — sin esta cuenta, un `registrarResolvedorStepUp(null)` colado en
    // `cerrar`, o unas dependencias `[pendiente]` en el efecto que lo registra,
    // pasan en verde aquí y dejan la aplicación sin ventana a partir de la
    // segunda vez que el servidor la pida.
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it("la contraseña se resuelve hacia el interceptor y no se queda en memoria", async () => {
    const { result } = montar();
    let promesa!: Promise<ResultadoStepUp | null>;
    act(() => {
      promesa = pedir(PIDE_PASSWORD);
    });
    await waitFor(() => expect(result.current.abierta).toBe(true));

    act(() => result.current.setPassword("secreta"));
    await act(async () => {
      await result.current.confirmar();
    });

    await expect(promesa).resolves.toEqual({ password: "secreta" });
    expect(result.current.password).toBe("");
  });

  it("una segunda ceremonia no hereda nada de la primera", async () => {
    const { result } = montar();
    act(() => void pedir({ ...PIDE_FACTOR, metodos: ["totp", "correo"], intentosRestantes: 2 }));
    await waitFor(() => expect(result.current.abierta).toBe(true));

    act(() => {
      result.current.setCodigo("111111");
      result.current.elegirClase("correo");
    });
    await waitFor(() => expect(result.current.claseActiva).toBe("correo"));
    act(() => result.current.cancelar());

    act(() => void pedir({ ...PIDE_FACTOR, metodos: ["totp", "correo"] }));
    await waitFor(() => expect(result.current.abierta).toBe(true));
    expect(result.current.codigo).toBe("");
    expect(result.current.claseActiva).toBe("totp");
    expect(result.current.restantes).toBeUndefined();
  });
});

describe("cuándo se puede confirmar", () => {
  it("con el factor pendiente, un código de sólo espacios no cuenta como tecleado", async () => {
    const { result } = montar();
    act(() => void pedir(PIDE_FACTOR));
    await waitFor(() => expect(result.current.abierta).toBe(true));
    expect(result.current.puedeConfirmar).toBe(false);

    act(() => result.current.setCodigo("   "));
    await waitFor(() => expect(result.current.codigo).toBe("   "));
    expect(result.current.puedeConfirmar).toBe(false);

    act(() => result.current.setCodigo("123456"));
    await waitFor(() => expect(result.current.puedeConfirmar).toBe(true));
  });

  it("sin nada que teclear —la lista vacía— no se puede confirmar", async () => {
    const { result } = montar();
    act(() => void pedir({ ...PIDE_FACTOR, metodos: [] }));
    await waitFor(() => expect(result.current.abierta).toBe(true));

    expect(result.current.puedeConfirmar).toBe(false);
  });

  it("con la contraseña además del factor, hacen falta las dos", async () => {
    const { result } = montar();
    act(() => void pedir({ ...PIDE_FACTOR, exigeContrasena: true }));
    await waitFor(() => expect(result.current.abierta).toBe(true));

    act(() => result.current.setCodigo("123456"));
    await waitFor(() => expect(result.current.codigo).toBe("123456"));
    expect(result.current.puedeConfirmar).toBe(false);

    act(() => result.current.setPassword("secreta"));
    await waitFor(() => expect(result.current.puedeConfirmar).toBe(true));
  });
});

describe("cambiar de clase", () => {
  it("vacía el campo y borra el error, para que un código no salga por la puerta equivocada", async () => {
    probarStepUp.mockResolvedValue({ status: 400, message: "Código incorrecto." });
    const { result } = montar();
    act(() => void pedir({ ...PIDE_FACTOR, metodos: ["totp", "correo"] }));
    await waitFor(() => expect(result.current.abierta).toBe(true));

    act(() => result.current.setCodigo("111111"));
    await waitFor(() => expect(result.current.codigo).toBe("111111"));
    await act(async () => {
      await result.current.confirmar();
    });
    expect(result.current.error).toBe("Código incorrecto.");

    act(() => result.current.elegirClase("correo"));
    await waitFor(() => expect(result.current.claseActiva).toBe("correo"));
    expect(result.current.codigo).toBe("");
    expect(result.current.error).toBeNull();
  });
});
