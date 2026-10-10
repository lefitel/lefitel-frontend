// La ventana del step-up: qué pide según lo que falte, a qué puerta canjea el
// código, y qué pasa cuando alguien se equivoca o cancela.
//
// Se ejercita a través del puente real (`registrarResolvedorStepUp`), que es
// como la alcanza el interceptor en producción: montar el componente, pedirle
// una resolución, y comprobar qué aparece en pantalla y con qué se resuelve la
// promesa.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { StepUpDialog } from "./StepUpDialog";
import { SesionContext, type contextProps } from "@/context/SesionContext";
import { usuarioExample } from "@/data/example";
import { sinPermisos } from "@/lib/permissions";
import type { EstadoSesion } from "@/interfaces/interfaces";
import * as interceptor from "@/api/stepUpInterceptor";
import type { PeticionStepUp, ResultadoStepUp } from "@/api/stepUpInterceptor";
import { TIMEOUT_CONFIRMACION_MS } from "@/api/stepUp";

const probarStepUp = vi.fn();
const pedirCodigoPorCorreo = vi.fn();
const verifySecondFactor = vi.fn();
const comprobarToken = vi.fn();
vi.mock("@/api/Mfa.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/Mfa.api")>()),
  probarStepUp: (...a: unknown[]) => probarStepUp(...a),
  pedirCodigoPorCorreo: (...a: unknown[]) => pedirCodigoPorCorreo(...a),
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
  pedirCodigoPorCorreo
    .mockReset()
    .mockResolvedValue({ status: 200, message: "ok", enviado_a: "i***@osefi.net", reintento_en_s: 60 });
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
    expect(screen.queryByText("Protegemos esta operación")).not.toBeInTheDocument();
  });

  it("sólo la contraseña cuando eso es lo que falta", async () => {
    montar();
    void pedir(PIDE_PASSWORD);

    await screen.findByText("Protegemos esta operación");
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

/**
 * Lo que el diálogo dice de sí mismo, que es una petición literal de Isaias
 * (2026-09-08): «esa petición de contraseña debería ser un diálogo solo, que
 * diga que es para proteger, y que se guarde unos minutos».
 *
 * Dos cosas, y las dos se miden aquí porque ninguna otra parte de la
 * aplicación las enseña: para qué sirve la confirmación, y cuánto dura.
 *
 * 🔴 **Lo segundo no es una frase fija, y ahí está el valor del bloque.** Las
 * rutas con `sinVentana` piden la contraseña en cada petición — dar de alta o
 * de baja un factor, registrar el correo — y el servidor las distingue con
 * `exigeContrasena`. Prometerle diez minutos a quien va a tener que teclearla
 * otra vez en la siguiente petición es una promesa falsa, y una promesa falsa
 * sobre seguridad es peor que no decir nada.
 */
describe("dice para qué es y que dura un rato", () => {
  it("el título habla de proteger, no de tramitar", async () => {
    montar();
    void pedir(PIDE_PASSWORD);

    // El título anterior era «Confirma que eres tú»: nombra el trámite y deja
    // sin decir por qué se pide. Se comprueba que el viejo ya no está, porque
    // añadir el nuevo en otro sitio y dejar aquel puesto enseñaría los dos.
    expect(await screen.findByText("Protegemos esta operación")).toBeInTheDocument();
    expect(screen.queryByText("Confirma que eres tú")).not.toBeInTheDocument();
  });

  it("con ventana, dice que no se volverá a pedir durante un rato", async () => {
    montar();
    void pedir(PIDE_PASSWORD);

    await screen.findByText("Protegemos esta operación");
    // 🔴 **Y sin cifra, que es una decisión y no una vaguedad.** El plazo real
    // vive en `STEP_UP_WINDOW_MINUTES`, en el otro repositorio, y no viaja en
    // ningún campo del 403. Un número aquí sería una copia que el día que
    // aquella cambiara dejaría esta pantalla mintiendo en verde. Ver
    // `describeProteccion`.
    expect(screen.getByText(/proteger tu cuenta.*unos minutos/i)).toBeInTheDocument();
    expect(screen.queryByText(/\d+ minutos/)).not.toBeInTheDocument();
  });

  it("sin ventana, dice que se pide cada vez en lugar de prometer minutos", async () => {
    // `exigeContrasena` es el campo con el que el servidor dice «esta ruta va
    // sin ventana». Aquí la promesa de los diez minutos sería mentira.
    montar();
    void pedir({ ...PIDE_FACTOR, exigeContrasena: true });

    await screen.findByText("Protegemos esta operación");
    expect(screen.getByText(/la confirmamos cada vez/i)).toBeInTheDocument();
    expect(screen.queryByText(/unos minutos/i)).not.toBeInTheDocument();
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

    await waitFor(() => expect(probarStepUp).toHaveBeenCalled());
    // Sin `metodos` no hay clase que nombrar: la forma decide, como siempre.
    expect(probarStepUp.mock.calls[0]).toEqual(["123456", undefined]);
    expect(verifySecondFactor).not.toHaveBeenCalled();
  });

  it("una sesión a medias va a /auth/mfa/verify, que es la que la levanta", async () => {
    montar("onboarding");
    void pedir(PIDE_FACTOR);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(verifySecondFactor).toHaveBeenCalled());
    expect(verifySecondFactor.mock.calls[0]).toEqual(["123456", undefined, undefined]);
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

    await screen.findByText("Protegemos esta operación");
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
    expect(screen.getByText("Protegemos esta operación")).toBeInTheDocument();
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

describe("el refresco de sesión no deja la ventana muerta", () => {
  // Tarea 10. `comprobarToken` es la única petición de la ceremonia que
  // llegaba sin `timeout`: mientras está en vuelo, «Cancelar» y «Confirmar»
  // están deshabilitados y Escape se traga, así que un servidor que acepta el
  // código y nunca contesta a `/auth/me` deja la ventana con los dos botones
  // muertos para siempre — la única salida sería recargar, perdiendo el
  // formulario del que venía la operación.
  beforeEach(() => {
    // `shouldAdvanceTime` deja correr el tiempo real por debajo, que es lo
    // que `findByRole` necesita para su sondeo, mientras el temporizador de
    // la ventana sigue siendo nuestro para moverlo a mano.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no deja la ventana muerta si el refresco de sesión no vuelve", async () => {
    // `pointerEventsCheck: Never` — con temporizadores falsos, el bloqueo de
    // `pointer-events` que Radix pone en el `<body>` mientras el diálogo entra
    // no se suelta a tiempo (depende de un timer/rAF que aquí no corre solo);
    // las demás pruebas de este fichero, con temporizadores reales, tecléan
    // en el mismo campo sin este ajuste. No es lo que esta prueba mide.
    const usuario = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    });
    comprobarToken.mockImplementation(() => new Promise(() => {})); // nunca resuelve
    montar("completa");
    // Envuelto en `act`, a diferencia del resto de este fichero: bajo
    // temporizadores reales, `findByLabelText` de abajo le da tiempo a React de
    // absorber lo que `pedir` escribe antes de que importe; bajo los falsos de
    // esta prueba, no, y sin esto React avisa de una actualización suelta.
    act(() => {
      void pedir(PIDE_FACTOR);
    });

    await usuario.type(await screen.findByLabelText("Código de tu aplicación"), "123456");
    await usuario.click(screen.getByRole("button", { name: /confirmar/i }));

    // Antes de adelantar el reloj: sin esto, `comprobarToken` podría no
    // haberse llamado todavía —y su temporizador no estar aún en la cola—
    // cuando se adelanta el tiempo, y la prueba pasaría por casualidad.
    await waitFor(() => expect(comprobarToken).toHaveBeenCalled());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TIMEOUT_CONFIRMACION_MS + 1);
      // Un segundo tirón: el temporizador de la carrera resuelve `refrescarSesion`,
      // pero lo que hace con eso `confirmar` —`setError`, y `setEnviando` en su
      // `finally`— cuelga de esa resolución por otra vuelta de microtareas.
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(await screen.findByRole("button", { name: /cancelar/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeEnabled();
  });

  // El mismo cuelgue, por el otro camino: probar la llave también llama a
  // `refrescarSesion` (`usarLlave`, en `useStepUpCeremony.ts`), y es
  // exactamente el escenario que motiva la tarea — el técnico en campo que
  // prueba su llave justo cuando el móvil pierde cobertura.
  //
  // 🔴 Ronda 1 de revisión: la primera versión de esta prueba sólo comprobaba
  // el síntoma —que «Confirmar» se desatasca— y eso pasaba incluso con
  // `usarLlave` descartando el booleano de `refrescarSesion` sin avisar de
  // nada. Un botón que se habilita no es lo mismo que un botón que, al
  // pulsarlo, hace lo correcto: aquí se comprueban las dos cosas, y la
  // segunda —que no cierra la ventana a ciegas— es la que la versión anterior
  // dejaba pasar.
  it("con la llave, si el refresco de sesión no vuelve, avisa y pulsar «Confirmar» no cierra a ciegas", async () => {
    const usuario = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    });
    comprobarToken.mockImplementation(() => new Promise(() => {})); // nunca resuelve
    montar();
    let promesa!: Promise<ResultadoStepUp | null>;
    act(() => {
      promesa = pedir(CON_LLAVE);
    });
    let resuelta = false;
    void promesa.then(() => {
      resuelta = true;
    });

    await usuario.click(await screen.findByRole("button", { name: /usar mi llave de acceso/i }));
    await screen.findByText(/llave comprobada/i);

    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TIMEOUT_CONFIRMACION_MS + 1);
      await vi.advanceTimersByTimeAsync(0);
    });

    // El síntoma: el botón se desatasca.
    expect(await screen.findByRole("button", { name: /confirmar/i })).toBeEnabled();
    // Lo que la versión anterior de esta prueba no comprobaba: hay un aviso
    // visible de que la sesión no se pudo confirmar — no sólo un botón vivo y
    // silencio.
    expect(screen.getByText(/no se pudo confirmar a tiempo/i)).toBeInTheDocument();

    // La propiedad, no el síntoma: al pulsar «Confirmar» con el refresco sin
    // confirmar, la ventana no cierra a ciegas — vuelve a intentarlo, y esa
    // segunda llamada tampoco ha vuelto todavía.
    await usuario.click(screen.getByRole("button", { name: /confirmar/i }));
    expect(resuelta).toBe(false);
    expect(comprobarToken).toHaveBeenCalledTimes(2);
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

/* ─────────────────────────────────────────────────────────────────────────
 * Plan 4E — el correo como método: se ofrece sólo si el servidor lo lista, el
 * código va con `metodo: "correo"` (seis cifras del correo son indistinguibles
 * de seis cifras de la aplicación), y el selector aparece con dos clases.
 * ───────────────────────────────────────────────────────────────────────── */
const CON_CORREO: PeticionStepUp = { ...PIDE_FACTOR, metodos: ["correo"] };
const APP_Y_CORREO: PeticionStepUp = { ...PIDE_FACTOR, metodos: ["totp", "correo"] };

describe("el correo como método (plan 4E)", () => {
  it("se ofrece sólo cuando `metodos` lo lista; sin el campo, no hay correo que ofrecer", async () => {
    montar();
    void pedir(PIDE_FACTOR);
    await screen.findByLabelText("Código de tu aplicación");
    expect(screen.queryByRole("button", { name: /enviar código/i })).not.toBeInTheDocument();

    cleanup();
    montar();
    void pedir(CON_CORREO);
    expect(await screen.findByRole("button", { name: /enviar código/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Código recibido por correo")).toBeInTheDocument();
  });

  it("con sólo el correo no hay selector; con la aplicación y el correo, aparece con las dos clases", async () => {
    montar();
    void pedir(CON_CORREO);
    await screen.findByLabelText("Código recibido por correo");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();

    cleanup();
    montar();
    void pedir(APP_Y_CORREO);
    const grupo = await screen.findByRole("radiogroup", { name: /con qué código/i });
    expect(grupo).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Aplicación" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Correo" })).toHaveAttribute("aria-checked", "false");
    // La aplicación va primero: es la clase de siempre, y la de recuperación
    // sigue cabiendo en su campo.
    expect(screen.getByLabelText("Código de tu aplicación")).toBeInTheDocument();
  });

  it("con correo y recuperación (sin aplicación), el selector ofrece Correo y Recuperación, el correo primero", async () => {
    montar();
    void pedir({ ...PIDE_FACTOR, metodos: ["correo", "codigo"] });

    await screen.findByRole("radiogroup");
    expect(screen.getByRole("radio", { name: "Correo" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Recuperación" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Aplicación" })).not.toBeInTheDocument();
  });

  // 🔴 La prueba de la ambigüedad: seis cifras tecleadas en la clase «correo»
  // NO pueden ir como TOTP, o el servidor las da por erróneas y carga el bloqueo.
  it("un código tecleado en la clase correo va con `metodo: \"correo\"`, nunca como código de la aplicación", async () => {
    montar("completa");
    void pedir(APP_Y_CORREO);

    await userEvent.click(await screen.findByRole("radio", { name: "Correo" }));
    await userEvent.type(screen.getByLabelText("Código recibido por correo"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(probarStepUp).toHaveBeenCalledWith("123456", "correo"));
    expect(verifySecondFactor).not.toHaveBeenCalled();
  });

  it("en una sesión a medias, el código del correo va a /auth/mfa/verify con su clase", async () => {
    montar("onboarding");
    void pedir(CON_CORREO);

    await userEvent.type(await screen.findByLabelText("Código recibido por correo"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(verifySecondFactor).toHaveBeenCalledWith("123456", undefined, "correo"));
    expect(probarStepUp).not.toHaveBeenCalled();
  });

  it("en la clase aplicación no se nombra ninguna clase: la forma decide, como siempre", async () => {
    montar("completa");
    void pedir(APP_Y_CORREO);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(probarStepUp).toHaveBeenCalled());
    expect(probarStepUp.mock.calls[0]).toEqual(["123456", undefined]);
  });

  it("cambiar de clase vacía el campo, para que un código no salga por la puerta equivocada", async () => {
    montar("completa");
    void pedir(APP_Y_CORREO);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "123456");
    await userEvent.click(screen.getByRole("radio", { name: "Correo" }));

    expect(screen.getByLabelText("Código recibido por correo")).toHaveValue("");
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled();
  });

  // 🔴 S4: nada se envía al abrirse la ventana. Cada envío gasta cuota, y la
  // ventana se abre también por una operación que luego se cancela.
  it("no pide el código al abrirse: sólo al pulsar el botón, y entonces enseña la dirección y la espera del servidor", async () => {
    montar();
    void pedir(CON_CORREO);

    const boton = await screen.findByRole("button", { name: /enviar código/i });
    expect(pedirCodigoPorCorreo).not.toHaveBeenCalled();

    await userEvent.click(boton);

    await waitFor(() => expect(pedirCodigoPorCorreo).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/i\*\*\*@osefi\.net/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reenviar en 60 s/i })).toBeDisabled();
  });

  it("con un 429, cuenta atrás los segundos del servidor y enseña su frase", async () => {
    pedirCodigoPorCorreo.mockResolvedValue({
      status: 429,
      message: "Espera antes de pedir otro código.",
      enviado_a: null,
      reintento_en_s: 540,
    });
    montar();
    void pedir(CON_CORREO);

    await userEvent.click(await screen.findByRole("button", { name: /enviar código/i }));

    expect(await screen.findByText("Espera antes de pedir otro código.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reenviar en 540 s/i })).toBeDisabled();
  });

  it("con un 503, enseña la frase del servidor y deja el botón disponible", async () => {
    pedirCodigoPorCorreo.mockResolvedValue({
      status: 503,
      message: "No se pudo enviar el código. Prueba otro método o inténtalo más tarde.",
      enviado_a: null,
      reintento_en_s: null,
    });
    montar();
    void pedir(CON_CORREO);

    await userEvent.click(await screen.findByRole("button", { name: /enviar código/i }));

    expect(await screen.findByText(/prueba otro método/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^enviar código$/i })).toBeEnabled();
  });

  it("la frase de la ventana nombra el correo cuando el servidor lo ofrece", async () => {
    montar();
    void pedir(CON_CORREO);

    expect(await screen.findByText(/pide un código a tu correo/i)).toBeInTheDocument();
  });
});
