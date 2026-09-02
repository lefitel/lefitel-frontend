// El interceptor del step-up: qué abre la ventana, qué no la abre nunca, y qué
// sale por el cable cuando se reenvía la petición.
//
// Se prueba capturando el manejador que `instalarInterceptorStepUp` registra
// en axios —el mismo patrón que `SesionProvider.test.tsx` ya usa para el otro
// interceptor global— porque es la única forma de alcanzar este código sin un
// servidor que conteste.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios, { AxiosHeaders } from "axios";
import type { AxiosError } from "axios";
import {
  instalarInterceptorStepUp,
  registrarResolvedorStepUp,
  cancelarStepUpEnCurso,
  inyectarPassword,
} from "./stepUpInterceptor";
import { CODIGO_STEP_UP } from "./stepUp";
import { toast } from "sonner";
import { url } from "./url";

type Manejador = (error: unknown) => Promise<unknown>;

/**
 * Captura el reenvío con un adaptador falso.
 *
 * No sirve espiar `axios.request`: `axios(config)` es una función ligada que
 * axios construye aparte, así que el espía no la ve — el primer intento de
 * este fichero lo hizo así y las peticiones salieron de verdad contra jsdom.
 * El adaptador es además más honesto: lo que se comprueba es la configuración
 * final, con el cuerpo ya serializado y las cabeceras resueltas.
 */
function capturarReenvios() {
  const enviados: { data: unknown; contentType: unknown }[] = [];
  const anterior = axios.defaults.adapter;
  axios.defaults.adapter = (config) => {
    enviados.push({
      data: config.data,
      contentType: config.headers?.["Content-Type"] ?? config.headers?.["content-type"],
    });
    return Promise.resolve({ data: {}, status: 200, statusText: "OK", headers: {}, config });
  };
  return { enviados, restaurar: () => { axios.defaults.adapter = anterior; } };
}

let alFallar: Manejador;

/** Un error de axios con la forma exacta que produce un rechazo de la puerta. */
function rechazo(
  datos: Record<string, unknown> | undefined,
  {
    status = 403,
    ruta = `${url}/api/usuario/7`,
    data,
    contentType,
  }: { status?: number; ruta?: string; data?: unknown; contentType?: string } = {},
): AxiosError {
  const headers = new AxiosHeaders();
  if (contentType) headers.set("Content-Type", contentType);
  return {
    config: { url: ruta, headers, data },
    response: { status, data: datos, headers: {}, statusText: "", config: {} },
    isAxiosError: true,
    name: "AxiosError",
    message: "",
    toJSON: () => ({}),
  } as unknown as AxiosError;
}

const PASO = { code: CODIGO_STEP_UP, motivo: "contraseña-requerida", message: "x" };

beforeEach(() => {
  vi.spyOn(axios.interceptors.response, "use").mockImplementation(((_ok: never, fail: never) => {
    alFallar = fail as unknown as Manejador;
    return 1;
  }) as never);
  instalarInterceptorStepUp();
  cancelarStepUpEnCurso();
});

afterEach(() => {
  cancelarStepUpEnCurso();
  vi.restoreAllMocks();
});

describe("qué NO abre la ventana", () => {
  // 🔴 Éste es el que más daño hace. El guardián de CSRF contesta 403 y
  // **borra la cookie de sesión antes de hacerlo**. Si la ventana se abriera
  // aquí, le pediríamos su contraseña a alguien para reenviar una petición que
  // ya no lleva credencial: teclearía la contraseña, el reenvío daría 401, y
  // acabaría en la pantalla de login sin entender nada. Hay diecisiete
  // respuestas 403 sin `code` en el servidor; `code` es lo único que las separa.
  it("un 403 sin `code` — el rechazo de CSRF, que ya borró la cookie", async () => {
    const resolvedor = vi.fn();
    registrarResolvedorStepUp(resolvedor);
    const err = rechazo({ message: "Petición no permitida." });

    await expect(alFallar(err)).rejects.toBe(err);
    expect(resolvedor).not.toHaveBeenCalled();
  });

  it("un 403 con otro `code` cualquiera", async () => {
    const resolvedor = vi.fn();
    registrarResolvedorStepUp(resolvedor);
    const err = rechazo({ code: "OTRA_COSA", motivo: "contraseña-requerida" });

    await expect(alFallar(err)).rejects.toBe(err);
    expect(resolvedor).not.toHaveBeenCalled();
  });

  it("un 429: esperar no es teclear, y reintentar lo realimenta", async () => {
    const resolvedor = vi.fn();
    registrarResolvedorStepUp(resolvedor);
    const err = rechazo({ message: "Demasiados intentos." }, { status: 429 });

    await expect(alFallar(err)).rejects.toBe(err);
    expect(resolvedor).not.toHaveBeenCalled();
  });

  it("una respuesta de otro origen que se inventa nuestro `code`", async () => {
    // El interceptor es global: ve también las fotos que los exportadores
    // descargan contra rutas guardadas en la base de datos. Un host ajeno
    // controla sus cabeceras y su CORS, así que puede devolver este cuerpo
    // exacto para que le pidamos la contraseña a alguien en su nombre.
    const resolvedor = vi.fn();
    registrarResolvedorStepUp(resolvedor);
    const err = rechazo(PASO, { ruta: "https://atacante.tld/x.jpg" });

    await expect(alFallar(err)).rejects.toBe(err);
    expect(resolvedor).not.toHaveBeenCalled();
  });

  it("las puertas que la propia ventana usa para resolverse", async () => {
    const resolvedor = vi.fn();
    registrarResolvedorStepUp(resolvedor);

    for (const ruta of ["/auth/stepup", "/auth/mfa/verify", "/auth/logout"]) {
      const err = rechazo(PASO, { ruta: `${url}/api${ruta}` });
      await expect(alFallar(err)).rejects.toBe(err);
    }
    // Reaccionar al fallo de la puerta abriendo otra ventana es la recursión
    // evidente, y la exclusión por URL es la barrera que aguanta.
    expect(resolvedor).not.toHaveBeenCalled();
  });

  it("`estado-incompleto`, que no tiene ningún remedio que teclear", async () => {
    // El único arreglo es registrar un segundo factor, algo que ninguna
    // ventana puede obtener. Reintentar aquí gira para siempre, y hoy se llega
    // en dos rutas reales.
    const resolvedor = vi.fn();
    registrarResolvedorStepUp(resolvedor);
    const err = rechazo({ code: CODIGO_STEP_UP, motivo: "estado-incompleto" });

    await expect(alFallar(err)).rejects.toBe(err);
    expect(resolvedor).not.toHaveBeenCalled();
  });

  it("un cuerpo que caduca: el código de seis dígitos vale treinta segundos", async () => {
    const resolvedor = vi.fn();
    registrarResolvedorStepUp(resolvedor);
    const err = rechazo(PASO, { ruta: `${url}/api/auth/totp/confirm` });

    await expect(alFallar(err)).rejects.toBe(err);
    expect(resolvedor).not.toHaveBeenCalled();
  });

  it("nada, si no hay ninguna ventana montada", async () => {
    registrarResolvedorStepUp(null);
    const err = rechazo(PASO);

    await expect(alFallar(err)).rejects.toBe(err);
  });
});

describe("cuando se acabó el plazo sin configurar nada", () => {
  // 🔴 Es una negativa distinta, de `authenticate` y no de la puerta, y llega a
  // quince de las diecinueve rutas. No abre ventana **y no puede**: aquí no hay
  // nada que teclear, el único remedio es registrar un factor, así que una
  // ventana pidiendo una contraseña que el servidor no va a mirar giraría para
  // siempre.
  it("avisa con un enlace en vez de abrir la ventana", async () => {
    const aviso = vi.spyOn(toast, "error").mockReturnValue("" as never);
    const resolvedor = vi.fn();
    registrarResolvedorStepUp(resolvedor);
    const err = rechazo({
      code: "FACTOR_PENDIENTE",
      message: "Termina de configurar tu segundo factor antes de realizar esta operación.",
    });

    await expect(alFallar(err)).rejects.toBe(err);

    expect(resolvedor).not.toHaveBeenCalled();
    expect(aviso).toHaveBeenCalledWith(
      "Termina de configurar tu segundo factor antes de realizar esta operación.",
      expect.objectContaining({ action: expect.objectContaining({ label: "Configurarlo" }) }),
    );
  });

  it("no apila un aviso por cada petición fallida", async () => {
    // Quince pantallas fallando a la vez apilarían quince avisos idénticos. El
    // `id` fijo hace que sonner reemplace el que ya está en pantalla.
    const aviso = vi.spyOn(toast, "error").mockReturnValue("" as never);
    const err = rechazo({ code: "FACTOR_PENDIENTE", message: "x" });

    await expect(alFallar(err)).rejects.toBe(err);
    await expect(alFallar(err)).rejects.toBe(err);

    for (const llamada of aviso.mock.calls) {
      expect(llamada[1]).toMatchObject({ id: "factor-pendiente" });
    }
  });

  it("no avisa por una respuesta de otro origen que se invente ese code", async () => {
    const aviso = vi.spyOn(toast, "error").mockReturnValue("" as never);
    const err = rechazo({ code: "FACTOR_PENDIENTE", message: "x" }, { ruta: "https://atacante.tld/x" });

    await expect(alFallar(err)).rejects.toBe(err);
    expect(aviso).not.toHaveBeenCalled();
  });
});

describe("cortar la ceremonia cuando muere la sesión", () => {
  // 🔴 **Esto fue un fallo grave y por eso hay tres tests.**
  //
  // La primera versión de `cancelarStepUpEnCurso` desarmaba el resolvedor. Como
  // la ventana se registra al montarse y vive fuera de las rutas para no
  // desmontarse nunca, tampoco se vuelve a montar: cerrar sesión **una vez**
  // dejaba el mecanismo muerto para el resto de la vida de la pestaña. Quien
  // volvía a entrar sin recargar se encontraba con que ninguna operación
  // protegida funcionaba, y el mensaje del servidor le decía «vuelve a
  // autenticarte y repite la acción» — lo que acababa de hacer.

  it("resuelve de verdad lo que estuviera esperando, en vez de soltarlo", async () => {
    // Soltar la referencia deja a quien la esperaba ni resuelto ni rechazado:
    // su `await` no vuelve nunca y el indicador de carga gira para siempre.
    const { restaurar } = capturarReenvios();
    registrarResolvedorStepUp(() => new Promise(() => {}));
    const err = rechazo(PASO);
    const enVuelo = alFallar(err);

    // Un turno para que la ceremonia arranque antes de cortarla.
    await Promise.resolve();
    cancelarStepUpEnCurso();

    await expect(enVuelo).rejects.toBe(err);
    restaurar();
  });

  it("y la ventana sigue viva después: se puede volver a entrar sin recargar", async () => {
    const { restaurar } = capturarReenvios();
    let abiertas = 0;
    registrarResolvedorStepUp(async () => {
      abiertas += 1;
      return { password: "la-mia" };
    });

    cancelarStepUpEnCurso();
    await alFallar(rechazo(PASO));
    restaurar();

    expect(abiertas).toBe(1);
  });

  it("avisa a la ventana con la señal, para que no se quede encima del login", async () => {
    const { restaurar } = capturarReenvios();
    let señal: AbortSignal | undefined;
    registrarResolvedorStepUp(
      (p) =>
        new Promise(() => {
          señal = p.signal;
        }),
    );
    const enVuelo = alFallar(rechazo(PASO));
    await Promise.resolve();

    expect(señal?.aborted).toBe(false);
    cancelarStepUpEnCurso();
    expect(señal?.aborted).toBe(true);

    await expect(enVuelo).rejects.toBeDefined();
    restaurar();
  });
});

describe("la ceremonia", () => {
  it("reenvía la petición con la contraseña dentro", async () => {
    const { enviados, restaurar } = capturarReenvios();
    registrarResolvedorStepUp(async () => ({ password: "la-mia" }));
    try {
      await alFallar(rechazo(PASO));
    } finally {
      restaurar();
    }

    expect(enviados).toHaveLength(1);
    expect(JSON.parse(String(enviados[0].data))).toMatchObject({ stepup_password: "la-mia" });
    expect(String(enviados[0].contentType)).toContain("application/json");
  });

  it("no reenvía si la persona cancela, y devuelve el rechazo original", async () => {
    const { enviados, restaurar } = capturarReenvios();
    registrarResolvedorStepUp(async () => null);
    const err = rechazo(PASO);

    try {
      // Cancelar no es un error del servidor, pero la petición sí falló: la
      // pantalla que llamó tiene que enterarse, y con el error de verdad.
      await expect(alFallar(err)).rejects.toBe(err);
    } finally {
      restaurar();
    }
    expect(enviados).toHaveLength(0);
  });

  it("le pasa a la ventana lo que el servidor dijo que falta", async () => {
    const { restaurar } = capturarReenvios();
    const resolvedor = vi.fn().mockResolvedValue({ password: "x" });
    registrarResolvedorStepUp(resolvedor);

    await alFallar(
      rechazo({
        code: CODIGO_STEP_UP,
        motivo: "sin-factor-reciente",
        exigeContrasena: true,
        intentosRestantes: 2,
        message: "sea lo que sea",
      }),
    );
    restaurar();

    expect(resolvedor).toHaveBeenCalledWith(
      expect.objectContaining({
        motivo: "sin-factor-reciente",
        exigeContrasena: true,
        intentosRestantes: 2,
        mensaje: "sea lo que sea",
      }),
    );
    // Y la señal con la que la ventana se entera de que la sesión murió por
    // debajo, para cerrarse en vez de quedarse encima del login.
    const recibida = resolvedor.mock.calls[0][0] as { signal?: AbortSignal };
    expect(recibida.signal).toBeInstanceOf(AbortSignal);
  });

  // 🔴 La prueba que justifica toda la cola.
  it("abre UNA sola ventana aunque fallen tres peticiones a la vez", async () => {
    const { restaurar } = capturarReenvios();
    let abiertas = 0;
    registrarResolvedorStepUp(async () => {
      abiertas += 1;
      await new Promise((r) => setTimeout(r, 5));
      return { password: "la-mia" };
    });

    await Promise.all([
      alFallar(rechazo(PASO, { ruta: `${url}/api/usuario/1` })),
      alFallar(rechazo(PASO, { ruta: `${url}/api/usuario/2` })),
      alFallar(rechazo(PASO, { ruta: `${url}/api/rol/3` })),
    ]);
    restaurar();

    // Sin esto se disparan tres canjes con el MISMO código: el servidor sella
    // el paso del TOTP, el primero gana y los otros dos cuentan como intentos
    // fallidos. Dos rondas así y la cuenta queda bloqueada, con el código bien
    // tecleado todas las veces.
    expect(abiertas).toBe(1);
  });

  it("vuelve a abrir la ventana en la siguiente ocasión, no una sola vez por sesión", async () => {
    const { restaurar } = capturarReenvios();
    let abiertas = 0;
    registrarResolvedorStepUp(async () => {
      abiertas += 1;
      return { password: "la-mia" };
    });

    await alFallar(rechazo(PASO));
    await alFallar(rechazo(PASO));
    restaurar();

    // La promesa compartida se limpia al terminar. Si se quedara colgada, la
    // siguiente petición rechazada esperaría eternamente a una ventana que ya
    // no existe.
    expect(abiertas).toBe(2);
  });

  // 🔴 La contraseña no puede salir de aquí dentro del error.
  it("borra la contraseña del error que llega a la pantalla que llamó", async () => {
    // Axios adjunta la configuración de la petición al error, y esa
    // configuración lleva el cuerpo que acabamos de ampliar. Hoy nada en
    // `web/src` registra esos errores, así que nada la exfiltra — pero el día
    // que alguien añada Sentry, un botón de «informar de un problema» o un
    // simple `console.error(e)` en un `catch`, el ERP empezaría a mandar las
    // contraseñas de la gente fuera, y ese cambio no pasaría por este fichero.
    const anterior = axios.defaults.adapter;
    axios.defaults.adapter = (config) =>
      Promise.reject(
        Object.assign(new Error("500"), {
          config,
          response: { status: 500, data: {}, headers: {}, statusText: "", config },
          isAxiosError: true,
        }),
      );
    registrarResolvedorStepUp(async () => ({ password: "la-mia" }));

    let capturado: { config?: { data?: unknown } } | undefined;
    try {
      await alFallar(rechazo(PASO, { data: '{"name":"x"}', contentType: "application/json" }));
    } catch (e) {
      capturado = e as { config?: { data?: unknown } };
    } finally {
      axios.defaults.adapter = anterior;
    }

    const cuerpo = String(capturado?.config?.data ?? "");
    expect(cuerpo).not.toContain("la-mia");
    expect(cuerpo).not.toContain("stepup_password");
    // Y lo demás sigue ahí: limpiar no es tirar el error a la basura.
    expect(cuerpo).toContain("name");
  });

  it("se rinde después de dos reintentos en vez de girar para siempre", async () => {
    const { enviados, restaurar } = capturarReenvios();
    registrarResolvedorStepUp(async () => ({ password: "la-mia" }));
    const err = rechazo(PASO);

    try {
      await alFallar(err);
      await alFallar(err);
      // El tercero, sobre la misma configuración, ya no reintenta.
      await expect(alFallar(err)).rejects.toBe(err);
    } finally {
      restaurar();
    }

    expect(enviados).toHaveLength(2);
  });
});

// ── Lo medido: la inyección del cuerpo ───────────────────────────────────────
//
// Estas tres formas son las que hacen que la implementación evidente entre en
// bucle infinito con la contraseña correcta. Se comprobaron ejecutando el axios
// de este repositorio contra un servidor que imprimía lo que recibía.
describe("qué sale por el cable", () => {
  /**
   * 🔴 `as unknown as Parameters<...>` y **no** `as never`. `never` es
   * asignable a todo, así que un fixture tipado `never` compila diga lo que
   * diga — y las aserciones sobre él dejan de comprobarse. Este mismo repo ya
   * perdió diecisiete comprobaciones así, y en este arco volvió a pasar.
   */
  const configCon = (data: unknown, contentType?: string) => {
    const headers = new AxiosHeaders();
    if (contentType) headers.set("Content-Type", contentType);
    return { url: "/x", headers, data } as unknown as Parameters<typeof inyectarPassword>[0];
  };

  it("un cuerpo JSON que ya es una CADENA no se destroza", () => {
    // Para cuando un interceptor de respuesta lo ve, axios ya lo serializó. Un
    // spread sobre esa cadena produce {"0":"{","1":"\""...}: un cuerpo sin el
    // campo, que el servidor vuelve a rechazar, en silencio y para siempre.
    const config = configCon('{"name":"x"}', "application/json");
    inyectarPassword(config, "la-mia");

    expect(config.data).toEqual({ name: "x", stepup_password: "la-mia" });
  });

  it("sin cuerpo, se crea uno", () => {
    const config = configCon(undefined);
    inyectarPassword(config, "la-mia");

    expect(config.data).toEqual({ stepup_password: "la-mia" });
  });

  it("una cabecera envenenada a formulario se corrige", () => {
    // `axios.post(url)` sin segundo argumento deja esto escrito en la
    // configuración, y ahí se queda. El servidor sólo monta `express.json()`,
    // así que ese cuerpo no se parsea y la respuesta es «falta la contraseña»
    // con la contraseña correcta.
    const config = configCon(undefined, "application/x-www-form-urlencoded");
    inyectarPassword(config, "la-mia");

    expect(config.headers.get("Content-Type")).toBe("application/json");
  });

  it("un cuerpo que no es un objeto SÍ se pierde, y hay que saberlo", () => {
    // 🔴 Este test se llamaba «no se pierde por el camino» y afirmaba
    // exactamente lo contrario de lo que comprueba. El comentario del código
    // decía «se deja intacto», y tampoco era verdad.
    //
    // Lo que pasa de verdad: una lista, un `FormData`, un `Blob` o una cadena
    // que no sea JSON **se sustituyen** por `{stepup_password}`. Ninguna de las
    // diecinueve rutas protegidas manda hoy un cuerpo así —la única llamada con
    // `FormData` de toda la aplicación va a una ruta sin puerta—, pero este
    // fichero existe para cubrir «las rutas que se añadan después», y para ésas
    // esto falla en silencio en vez de a gritos.
    //
    // Se deja documentado en vez de disimulado: el arreglo de verdad es que el
    // interceptor se niegue a reenviar un cuerpo que no sabe ampliar, y eso es
    // una decisión de alcance, no una línea.
    const config = configCon("[1,2,3]", "application/json");
    inyectarPassword(config, "la-mia");

    expect(config.data).toEqual({ stepup_password: "la-mia" });
  });
});
