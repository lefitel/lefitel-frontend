// La ventana del step-up: qué pide según lo que falte, a qué puerta canjea el
// código, y qué pasa cuando alguien se equivoca o cancela.
//
// Se ejercita a través del puente real (`registrarResolvedorStepUp`), que es
// como la alcanza el interceptor en producción: montar el componente, pedirle
// una resolución, y comprobar qué aparece en pantalla y con qué se resuelve la
// promesa.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepUpDialog } from "./StepUpDialog";
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

// La ceremonia con el navegador, entera detrás de un mock: `jsdom` no tiene
// `PublicKeyCredential`, así que `soportaPasskeys()` real diría `false` y el
// botón no se pintaría nunca — y una prueba negativa pasaría por eso, no por
// lo que afirma. `soporta` se fuerza a `true` salvo en la prueba que la pone
// a `false` a propósito.
const probarPasskey = vi.fn();
const cancelarCeremonia = vi.fn();
let soporta = true;
vi.mock("@/api/passkeyCeremony", () => ({
  probarPasskey: (...a: unknown[]) => probarPasskey(...a),
  cancelarCeremonia: (...a: unknown[]) => cancelarCeremonia(...a),
  soportaPasskeys: () => soporta,
}));

/** Lo que la ventana escribe en el contexto tras volver a leer `/auth/me`. */
const setSesion = vi.fn();

/** El resolvedor que el componente registró al montarse. */
let pedir: (p: PeticionStepUp) => Promise<ResultadoStepUp | null>;

function montar(estado: EstadoSesion = "completa") {
  const valor = {
    sesion: { autenticado: true, usuario: usuarioExample, permisos: sinPermisos(), estado },
    setSesion,
    loading: false,
    logout: vi.fn(),
  } as unknown as contextProps;

  const registrar = vi
    .spyOn(interceptor, "registrarResolvedorStepUp")
    .mockImplementation((fn) => {
      if (fn) pedir = fn;
    });

  render(
    <SesionContext.Provider value={valor}>
      <StepUpDialog />
    </SesionContext.Provider>,
  );
  return registrar;
}

const PIDE_PASSWORD: PeticionStepUp = {
  motivo: "contraseña-requerida",
  exigeContrasena: false,
  mensaje: null,
  signal: new AbortController().signal,
};

const PIDE_FACTOR: PeticionStepUp = {
  motivo: "sin-factor-reciente",
  exigeContrasena: false,
  mensaje: null,
  signal: new AbortController().signal,
};

beforeEach(() => {
  probarStepUp.mockReset().mockResolvedValue({ status: 200, message: "Identidad confirmada." });
  verifySecondFactor.mockReset().mockResolvedValue({ status: 200, message: "ok" });
  comprobarToken.mockReset().mockResolvedValue({
    status: 200,
    usuario: usuarioExample,
    permisos: sinPermisos(),
    estado: "completa",
  });
  probarPasskey.mockReset().mockResolvedValue({ ok: true });
  cancelarCeremonia.mockReset();
  setSesion.mockReset();
  soporta = true;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("qué pide", () => {
  it("no pinta nada mientras nadie pida nada", () => {
    montar();
    expect(screen.queryByText("Confirma que eres tú")).not.toBeInTheDocument();
  });

  it("sólo la contraseña cuando eso es lo que falta", async () => {
    montar();
    void pedir(PIDE_PASSWORD);

    await screen.findByText("Confirma que eres tú");
    expect(screen.getByLabelText("Tu contraseña")).toBeInTheDocument();
    expect(screen.queryByLabelText("Código de tu aplicación")).not.toBeInTheDocument();
  });

  it("sólo el código cuando la ruta no quiere la contraseña", async () => {
    montar();
    void pedir(PIDE_FACTOR);

    await screen.findByLabelText("Código de tu aplicación");
    expect(screen.queryByLabelText("Tu contraseña")).not.toBeInTheDocument();
  });

  // 🔴 La decisión de Isaias, y el motivo de que el servidor avise por
  // adelantado: una sola ventana, no dos seguidas.
  it("las DOS cosas a la vez cuando el servidor avisa de que hará falta la contraseña", async () => {
    montar();
    void pedir({ ...PIDE_FACTOR, exigeContrasena: true });

    await screen.findByLabelText("Código de tu aplicación");
    // Sin este aviso el servidor nombra una carencia por respuesta, y la
    // ceremonia serían dos ventanas encadenadas justo en las operaciones más
    // delicadas: restablecer el factor de otra persona, desbloquear su cuenta.
    expect(screen.getByLabelText("Tu contraseña")).toBeInTheDocument();
  });
});

describe("a qué puerta canjea el código", () => {
  // 🔴 Elegir mal no da un error útil: carga un intento fallido contra el
  // bloqueo de la cuenta, con el código correcto tecleado.
  it("una sesión completa va a /auth/stepup", async () => {
    montar("completa");
    void pedir(PIDE_FACTOR);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(probarStepUp).toHaveBeenCalledWith("123456"));
    expect(verifySecondFactor).not.toHaveBeenCalled();
  });

  it("una sesión a medias va a /auth/mfa/verify, que es la que la levanta", async () => {
    montar("onboarding");
    void pedir(PIDE_FACTOR);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(verifySecondFactor).toHaveBeenCalledWith("123456"));
    expect(probarStepUp).not.toHaveBeenCalled();
  });
});

describe("cómo termina", () => {
  it("resuelve con la contraseña para que el interceptor la reenvíe", async () => {
    montar();
    const promesa = pedir(PIDE_PASSWORD);

    await userEvent.type(await screen.findByLabelText("Tu contraseña"), "la-mia");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await expect(promesa).resolves.toEqual({ password: "la-mia" });
  });

  it("cancelar resuelve con null, que no es un error del servidor", async () => {
    montar();
    const promesa = pedir(PIDE_PASSWORD);

    await screen.findByText("Confirma que eres tú");
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    await expect(promesa).resolves.toBeNull();
  });

  it("un código erróneo deja la ventana abierta con el error a la vista", async () => {
    // Si se cerrara, la persona perdería lo tecleado y no sabría por qué falló:
    // `AlertDialogAction` cierra el diálogo por defecto, y aquí no puede.
    probarStepUp.mockResolvedValue({
      status: 400,
      message: "Código incorrecto o ya utilizado.",
      intentosRestantes: 2,
    });
    montar("completa");
    void pedir(PIDE_FACTOR);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "000000");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(await screen.findByText("Código incorrecto o ya utilizado.")).toBeInTheDocument();
    expect(screen.getByLabelText("Código de tu aplicación")).toBeInTheDocument();
  });
});

describe("el aviso antes del bloqueo", () => {
  // 🔴 Cinco fallos bloquean la cuenta entera del ERP —1, 2, 4, 8, hasta 15
  // minutos— y el mensaje de error es idéntico al de un código simplemente mal
  // escrito. Basta con que el reloj del móvil vaya desfasado.
  it("dice cuántos intentos quedan", async () => {
    montar();
    void pedir({ ...PIDE_PASSWORD, intentosRestantes: 3 });

    expect(await screen.findByText(/quedan 3 intentos/i)).toBeInTheDocument();
  });

  it("habla en singular cuando queda uno", async () => {
    montar();
    void pedir({ ...PIDE_PASSWORD, intentosRestantes: 1 });

    expect(await screen.findByText(/queda 1 intento/i)).toBeInTheDocument();
  });

  // 🔴 Son DOS contadores distintos con el mismo nombre, y confundirlos pone
  // una frase falsa en pantalla.
  it("con la contraseña dice que hay que esperar, y que la cuenta NO está bloqueada", async () => {
    // El cupo de la contraseña es un límite de ritmo: cinco fallos dan un 429
    // y quince minutos de espera. `verifyOwnPassword` **no** toca el contador
    // de bloqueo, a propósito. Decirle a alguien que su cuenta se ha bloqueado
    // le manda a pedir a un administrador algo que no arreglaría nada.
    montar();
    void pedir({ ...PIDE_PASSWORD, intentosRestantes: 0 });

    expect(await screen.findByText(/no está bloqueada/i)).toBeInTheDocument();
    expect(screen.queryByText(/bloqueada temporalmente/i)).not.toBeInTheDocument();
  });

  it("con el código sí dice que la cuenta se bloqueó, porque es verdad", async () => {
    probarStepUp.mockResolvedValue({ status: 400, message: "no", intentosRestantes: 0 });
    montar("completa");
    void pedir(PIDE_FACTOR);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "000000");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(await screen.findByText(/bloqueada temporalmente/i)).toBeInTheDocument();
  });

  it("y avisa de lo que toca en cada caso mientras aún quedan intentos", async () => {
    montar();
    void pedir({ ...PIDE_PASSWORD, intentosRestantes: 2 });

    expect(await screen.findByText(/antes de tener que esperar unos minutos/i)).toBeInTheDocument();
    expect(screen.queryByText(/antes de que la cuenta se bloquee/i)).not.toBeInTheDocument();
  });

  it("se actualiza con lo que dice el canje, no sólo con lo que traía el rechazo", async () => {
    probarStepUp.mockResolvedValue({ status: 400, message: "no", intentosRestantes: 1 });
    montar("completa");
    void pedir(PIDE_FACTOR);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "000000");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(await screen.findByText(/queda 1 intento/i)).toBeInTheDocument();
  });
});

/* ─────────────────────────────────────────────────────────────────────────
 * Plan 4C, Tarea 11 — el tercer camino: la llave de acceso.
 *
 * `metodos` es lo que el servidor dice que la cuenta puede ofrecer. Las tres
 * pruebas de arriba, sin ese campo, siguen siendo válidas: son el caso «servidor
 * anterior», que dibuja lo de siempre.
 * ───────────────────────────────────────────────────────────────────────── */

const CON_LLAVE: PeticionStepUp = { ...PIDE_FACTOR, metodos: ["passkey"] };

describe("qué pide según `metodos`", () => {
  it("con sólo la llave, ofrece el botón y ningún campo de código", async () => {
    montar();
    void pedir(CON_LLAVE);

    expect(await screen.findByRole("button", { name: /usar mi llave de acceso/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Código de tu aplicación")).not.toBeInTheDocument();
    // 🔴 El encierro que la tarea cierra: sin esto, «Confirmar» se habilitaba
    // con la contraseña sola, el reintento recibía el mismo rechazo, y la
    // operación moría en silencio al agotar los reintentos.
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled();
  });

  it("con la llave y el código, ofrece las dos cosas", async () => {
    montar();
    void pedir({ ...PIDE_FACTOR, metodos: ["passkey", "totp"] });

    expect(await screen.findByRole("button", { name: /usar mi llave de acceso/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Código de tu aplicación")).toBeInTheDocument();
  });

  it("con sólo el código, no ofrece la llave ni promete un código de recuperación", async () => {
    montar();
    void pedir({ ...PIDE_FACTOR, metodos: ["totp"] });

    await screen.findByLabelText("Código de tu aplicación");
    expect(screen.queryByRole("button", { name: /usar mi llave/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/códigos de recuperación/i)).not.toBeInTheDocument();
  });

  it("sólo promete un código de recuperación cuando el servidor dice que queda alguno", async () => {
    montar();
    void pedir({ ...PIDE_FACTOR, metodos: ["totp", "codigo"] });

    await screen.findByLabelText("Código de tu aplicación");
    expect(screen.getByText(/códigos de recuperación/i)).toBeInTheDocument();
  });

  // Un servidor anterior no manda el campo: lo de siempre, incluida la
  // promesa del código de recuperación, que es la única a ciegas que queda.
  it("sin el campo, dibuja lo de siempre", async () => {
    montar();
    void pedir(PIDE_FACTOR);

    await screen.findByLabelText("Código de tu aplicación");
    expect(screen.queryByRole("button", { name: /usar mi llave/i })).not.toBeInTheDocument();
    expect(screen.getByText(/códigos de recuperación/i)).toBeInTheDocument();
  });

  // 🔴 Lista vacía no es «no lo sé»: es «esta cuenta tiene un factor y ninguno
  // le sirve ahora». Sin nada que teclear, la ventana tiene que seguir teniendo
  // una salida, o las peticiones en cola esperan para siempre.
  it("con la lista vacía, no pinta ningún formulario, dice a quién avisar y deja cancelar", async () => {
    montar();
    // Con `exigeContrasena`, para que el guardián sea observable: sin él, la
    // ventana pintaría el campo de la contraseña a alguien que no puede
    // cubrir el factor con nada, y esta prueba seguiría verde.
    const promesa = pedir({ ...PIDE_FACTOR, exigeContrasena: true, metodos: [] });

    expect(await screen.findByText(/administrador/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Código de tu aplicación")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tu contraseña")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    await expect(promesa).resolves.toBeNull();
  });

  // `jsdom` no tiene WebAuthn, así que la prueba negativa sólo vale junto a
  // las positivas de arriba, que fuerzan el soporte a `true`.
  it("con sólo la llave en un navegador que no puede usarla, lo dice y no deja confirmar", async () => {
    soporta = false;
    montar();
    void pedir(CON_LLAVE);

    expect(await screen.findByText(/este navegador no puede usarla/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /usar mi llave/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled();
  });
});

describe("cómo se prueba la llave", () => {
  it("al pulsar, ejecuta la ceremonia y deja el factor por probado", async () => {
    montar();
    void pedir(CON_LLAVE);

    await userEvent.click(await screen.findByRole("button", { name: /usar mi llave de acceso/i }));

    expect(probarPasskey).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/llave comprobada/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeEnabled();
  });

  // 🔴 C5: probar la llave no resuelve la ceremonia. La resuelve «Confirmar»,
  // para que las peticiones en cola reciban la contraseña si la necesitaban.
  it("no resuelve la ceremonia al probar la llave: la resuelve Confirmar", async () => {
    montar();
    const promesa = pedir(CON_LLAVE);
    let resuelta = false;
    void promesa.then(() => {
      resuelta = true;
    });

    await userEvent.click(await screen.findByRole("button", { name: /usar mi llave de acceso/i }));
    await screen.findByText(/llave comprobada/i);
    expect(resuelta).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    await expect(promesa).resolves.toEqual({});
  });

  it("no canjea ningún código cuando el factor lo probó la llave", async () => {
    montar("completa");
    void pedir(CON_LLAVE);

    await userEvent.click(await screen.findByRole("button", { name: /usar mi llave de acceso/i }));
    await screen.findByText(/llave comprobada/i);
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    // Canjear un código vacío por costumbre cargaría un intento fallido
    // contra el bloqueo de la cuenta.
    expect(probarStepUp).not.toHaveBeenCalled();
    expect(verifySecondFactor).not.toHaveBeenCalled();
  });

  it("con la llave probada sigue pidiendo la contraseña cuando la ruta la quiere, y la entrega", async () => {
    montar();
    const promesa = pedir({ ...CON_LLAVE, exigeContrasena: true });

    await userEvent.click(await screen.findByRole("button", { name: /usar mi llave de acceso/i }));
    await screen.findByText(/llave comprobada/i);
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Tu contraseña"), "la-mia");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await expect(promesa).resolves.toEqual({ password: "la-mia" });
  });

  // La persona cerró el diálogo del sistema. No es un error del servidor y no
  // se enseña como tal: la ventana sigue abierta y el botón vuelve.
  it("si cancela el diálogo del sistema, no dice nada y deja repetir", async () => {
    probarPasskey.mockResolvedValue({ ok: false, cancelado: true });
    montar();
    void pedir(CON_LLAVE);

    await userEvent.click(await screen.findByRole("button", { name: /usar mi llave de acceso/i }));

    expect(await screen.findByRole("button", { name: /usar mi llave de acceso/i })).toBeEnabled();
    expect(screen.queryByText(/no se pudo/i)).not.toBeInTheDocument();
    expect(screen.getByText("Confirma que eres tú")).toBeInTheDocument();
  });

  // El cupo de ceremonias contesta 429 con su frase y sin `code`. Cuando la
  // llave es el único método no queda ningún control que satisfacer, así que
  // la frase se enseña tal cual y cancelar sigue disponible.
  it("enseña la frase del servidor cuando la llave falla, y deja cancelar", async () => {
    probarPasskey.mockResolvedValue({
      ok: false,
      cancelado: false,
      status: 429,
      message: "Demasiados intentos con la llave. Espere unos minutos.",
    });
    montar();
    void pedir(CON_LLAVE);

    await userEvent.click(await screen.findByRole("button", { name: /usar mi llave de acceso/i }));

    expect(await screen.findByText(/demasiados intentos con la llave/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeEnabled();
  });

  // 🔴 La librería aborta desde un singleton, no desde un controlador propio:
  // cancelar la ventana con el diálogo del sistema abierto tiene que abortarlo,
  // o se queda encima de lo que venga después.
  it("cancelar con el diálogo del sistema abierto aborta la ceremonia", async () => {
    probarPasskey.mockImplementation(() => new Promise(() => {}));
    montar();
    const promesa = pedir(CON_LLAVE);

    await userEvent.click(await screen.findByRole("button", { name: /usar mi llave de acceso/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(cancelarCeremonia).toHaveBeenCalled();
    await expect(promesa).resolves.toBeNull();
  });
});

describe("la sesión se vuelve a leer después de probar un factor", () => {
  // 🔴 El servidor acaba de promover la sesión y esta ventana no lo sabía:
  // `App.tsx` seguía leyendo `onboarding` y «Inicio» devolvía a la persona a
  // la pantalla del segundo factor que acababa de superar.
  it("tras la llave, pregunta a /auth/me y escribe lo que diga en el contexto", async () => {
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: usuarioExample,
      permisos: sinPermisos(),
      estado: "completa",
    });
    montar("onboarding");
    void pedir(CON_LLAVE);

    await userEvent.click(await screen.findByRole("button", { name: /usar mi llave de acceso/i }));
    await screen.findByText(/llave comprobada/i);

    expect(comprobarToken).toHaveBeenCalled();
    expect(setSesion).toHaveBeenCalledWith(expect.objectContaining({ estado: "completa", autenticado: true }));
  });

  it("tras un código aceptado, también", async () => {
    montar("onboarding");
    void pedir(PIDE_FACTOR);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(comprobarToken).toHaveBeenCalled());
  });

  // Con la contraseña sola no se ha probado ningún factor y el servidor no ha
  // promovido nada: no hay nada que volver a leer.
  it("con la contraseña sola, no pregunta nada", async () => {
    montar();
    void pedir(PIDE_PASSWORD);

    await userEvent.type(await screen.findByLabelText("Tu contraseña"), "la-mia");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(comprobarToken).not.toHaveBeenCalled();
  });
});

describe("el campo del código, según lo que hay detrás", () => {
  // Un TOTP que este servidor no puede leer y códigos sin gastar: lo único
  // que cabe es el de recuperación, y llamarlo «de tu aplicación» manda a la
  // persona a la aplicación equivocada.
  it("con sólo códigos de recuperación, el campo se llama así", async () => {
    montar();
    void pedir({ ...PIDE_FACTOR, metodos: ["codigo"] });

    expect(await screen.findByLabelText("Código de recuperación")).toBeInTheDocument();
    expect(screen.queryByLabelText("Código de tu aplicación")).not.toBeInTheDocument();
  });

  // El servidor aprendió un método antes que esta pantalla: no hay nada que
  // pintar, y la frase de siempre prometería un código de recuperación para un
  // campo que no existe.
  it("con sólo métodos que no conoce, no pinta formulario y dice que hay que recargar", async () => {
    montar();
    void pedir({ ...PIDE_FACTOR, exigeContrasena: true, metodos: ["un-metodo-futuro"] });

    expect(await screen.findByText(/recarga/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/código/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tu contraseña")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled();
  });

  // Confirmar con un código tecleado mientras el diálogo del sistema sigue
  // abierto dejaría esa ceremonia huérfana, resolviendo sobre una ventana que
  // ya no existe.
  it("no deja confirmar mientras el diálogo del sistema está abierto", async () => {
    probarPasskey.mockImplementation(() => new Promise(() => {}));
    montar();
    void pedir({ ...PIDE_FACTOR, metodos: ["passkey", "totp"] });

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /usar mi llave de acceso/i }));

    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled();
  });

  // El aviso de intentos hablaba de una contraseña anterior; con la llave
  // probada no describe nada que vaya a pasar, y debajo de «Llave comprobada»
  // sería una amenaza sin objeto.
  it("borra el aviso de intentos cuando la llave prueba el factor", async () => {
    montar();
    void pedir({ ...CON_LLAVE, intentosRestantes: 3 });

    expect(await screen.findByText(/quedan 3 intentos/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /usar mi llave de acceso/i }));
    await screen.findByText(/llave comprobada/i);

    expect(screen.queryByText(/quedan 3 intentos/i)).not.toBeInTheDocument();
  });
});
