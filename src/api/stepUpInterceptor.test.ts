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
  RUTAS_EXCLUIDAS,
  instalarInterceptorStepUp,
  registrarResolvedorStepUp,
  cancelarStepUpEnCurso,
  inyectarPassword,
} from "./stepUpInterceptor";
import {
  CODIGO_STEP_UP,
  MENSAJE_CANCELADO,
  MENSAJE_FACTOR_INCOMPLETO,
  MENSAJE_SIN_INTENTOS,
} from "./stepUp";
import { explicacionDe } from "./fallo";
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

    // Recorre la lista real, no una copia: con una copia a mano, añadir una
    // ruta al módulo y olvidar la prueba dejaba todo verde, y al revés igual.
    // Y la ruta de la llave se afirma por su nombre, porque un bucle sobre la
    // lista no nota que falte de la lista.
    expect(RUTAS_EXCLUIDAS).toContain("/auth/webauthn/login");
    // Y la del login sin contraseña (fase 2), por lo mismo: quien la llama no
    // tiene sesión, y una ventana que pidiera algo giraría sobre nada.
    expect(RUTAS_EXCLUIDAS).toContain("/auth/webauthn/passwordless");
    // Y la del código por correo (plan 4E), por su nombre: `/auth/mfa/verify`
    // no la cubre, porque la comparación es por subcadena.
    expect(RUTAS_EXCLUIDAS).toContain("/auth/mfa/email-code");
    for (const ruta of RUTAS_EXCLUIDAS) {
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

  it("`estado-incompleto` enseña el mismo remedio que la otra negativa que lo pide", async () => {
    // 🔴 **El mismo remedio tiene que verse igual.** `FACTOR_PENDIENTE` y este
    // motivo piden exactamente lo mismo —registra un segundo factor— y hasta
    // ahora uno sacaba un aviso con botón y el otro no sacaba nada: quien
    // llegaba por aquí leía el «no se pudo» de su pantalla y se quedaba sin
    // saber ni qué le faltaba ni dónde arreglarlo.
    const aviso = vi.spyOn(toast, "error").mockReturnValue("" as never);
    const resolvedor = vi.fn();
    registrarResolvedorStepUp(resolvedor);
    const err = rechazo({
      code: CODIGO_STEP_UP,
      motivo: "estado-incompleto",
      message: "Termina de configurar tu segundo factor antes de realizar esta operación.",
    });

    await expect(alFallar(err)).rejects.toBe(err);

    // Sigue sin abrir la ventana: aquí no hay nada que teclear.
    expect(resolvedor).not.toHaveBeenCalled();
    // El botón que lleva a arreglarlo.
    expect(aviso).toHaveBeenCalledWith(
      "Termina de configurar tu segundo factor antes de realizar esta operación.",
      expect.objectContaining({ action: expect.objectContaining({ label: "Configurarlo" }) }),
    );
    // Y la frase que sustituye al «no se pudo» genérico de la pantalla. Las dos
    // cosas, porque arreglan problemas distintos: el aviso dice dónde ir, la
    // marca dice qué le pasó a la operación que la persona pidió.
    expect(explicacionDe(err)).toBe(MENSAJE_FACTOR_INCOMPLETO);
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
  // la mayoría de las rutas protegidas. No abre ventana **y no puede**: aquí no hay
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
    // Y la pantalla deja de decir su «no se pudo» pelado: el aviso dice dónde
    // se arregla, y esto dice qué le pasó a la operación que se pidió.
    expect(explicacionDe(err)).toBe(MENSAJE_FACTOR_INCOMPLETO);
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
    // Ni el aviso ni la frase: un host ajeno controla su cuerpo, así que
    // dejarle escribir lo que lee la pantalla es la misma puerta con otra
    // forma.
    expect(explicacionDe(err)).toBeUndefined();
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
  /** Otro rechazo sobre la MISMA petición: es lo que ve el manejador cuando
   *  un reenvío vuelve a fallar, y lo que hace girar la ceremonia. */
  const otraVuelta = (config: unknown, datos: Record<string, unknown>): AxiosError =>
    ({
      config,
      response: { status: 403, data: datos, headers: {}, statusText: "", config: {} },
      isAxiosError: true,
      name: "AxiosError",
      message: "",
      toJSON: () => ({}),
    }) as unknown as AxiosError;

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

  // 🔴 La petición se reconstruye campo a campo, así que lo que el servidor
  // manda y esta función no nombra **no llega a la ventana**. Con `metodos`
  // perdido, la ventana vuelve a dibujar el campo de seis dígitos a quien
  // sólo tiene huella, que es el encierro que la tarea 8 existe para cerrar.
  it("le pasa también con qué puede probarse la persona", async () => {
    const { restaurar } = capturarReenvios();
    const resolvedor = vi.fn().mockResolvedValue({ password: "x" });
    registrarResolvedorStepUp(resolvedor);

    await alFallar(
      rechazo({
        code: CODIGO_STEP_UP,
        motivo: "sin-factor-reciente",
        metodos: ["passkey", "codigo"],
      }),
    );
    restaurar();

    expect(resolvedor).toHaveBeenCalledWith(
      expect.objectContaining({ metodos: ["passkey", "codigo"] }),
    );
  });

  // 🔴 Lista vacía y campo ausente NO son lo mismo, y esta es la única prueba
  // que lo sujeta a este lado. Ausente es un servidor viejo: se pinta lo de
  // siempre. Vacía es el servidor diciendo que la cuenta no puede probarse con
  // nada —tiene factor, por eso rechaza, pero ninguno le sirve ahora—, y ahí
  // «lo de siempre» es un formulario sin salida. La simplificación obvia
  // (`datos?.metodos?.length ? … : undefined`) las funde en una sola y no
  // rompe nada más: por eso hace falta afirmarlo.
  it("conserva la lista vacía como lista vacía, no como ausente", async () => {
    const { restaurar } = capturarReenvios();
    const resolvedor = vi.fn().mockResolvedValue({ password: "x" });
    registrarResolvedorStepUp(resolvedor);

    await alFallar(
      rechazo({ code: CODIGO_STEP_UP, motivo: "sin-factor-reciente", metodos: [] }),
    );
    restaurar();

    const recibida = resolvedor.mock.calls[0][0] as { metodos?: unknown };
    expect(recibida.metodos).toEqual([]);
    expect(recibida.metodos).not.toBeUndefined();
  });

  // El tipo declarado no es una comprobación: `datos` es JSON sin validar. Un
  // objeto colado en la lista revienta a React al pintarlo, y la ventana es lo
  // único que puede resolver la ceremonia — si revienta, las peticiones que
  // esperan se quedan colgadas para siempre.
  it("tira lo que no sea una cadena en vez de pasárselo a la ventana", async () => {
    const { restaurar } = capturarReenvios();
    const resolvedor = vi.fn().mockResolvedValue({ password: "x" });
    registrarResolvedorStepUp(resolvedor);

    await alFallar(
      rechazo({
        code: CODIGO_STEP_UP,
        motivo: "sin-factor-reciente",
        metodos: ["passkey", { malo: 1 }, null, 7] as unknown as string[],
      }),
    );
    restaurar();

    expect(resolvedor).toHaveBeenCalledWith(
      expect.objectContaining({ metodos: ["passkey"] }),
    );
  });

  // Un servidor anterior no manda el campo, y uno futuro podría mandar
  // cualquier cosa. Ninguna de las dos puede dejar la ventana sin abrir.
  it("no se rompe si el campo no viene, o viene con una forma que no es una lista", async () => {
    const { restaurar } = capturarReenvios();
    const resolvedor = vi.fn().mockResolvedValue({ password: "x" });
    registrarResolvedorStepUp(resolvedor);

    await alFallar(rechazo({ code: CODIGO_STEP_UP, motivo: "sin-factor-reciente" }));
    await alFallar(
      rechazo({
        code: CODIGO_STEP_UP,
        motivo: "sin-factor-reciente",
        metodos: "passkey" as unknown as string[],
      }),
    );
    restaurar();

    expect(resolvedor).toHaveBeenCalledTimes(2);
    for (const llamada of resolvedor.mock.calls) {
      expect((llamada[0] as { metodos?: unknown }).metodos).toBeUndefined();
    }
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

  /**
   * 🔴 **Una sola ventana para dos carencias distintas entrega lo que no era.**
   *
   * En la pantalla del perfil conviven las sesiones y los editores de la
   * cuenta: cerrar la sesión de otro dispositivo se cubre probando el factor y
   * cambiar el nombre necesita además la contraseña. Las dos rechazan con
   * `sin-factor-reciente` y sólo se distinguen por `exigeContrasena`, así que
   * enganchar la segunda a la ventana de la primera le da un resultado sin
   * contraseña: el reenvío vuelve a fallar, gasta un reintento y abre una
   * segunda ventana de todas formas.
   *
   * El arreglo no es abrir dos ventanas seguidas —la segunda saldría del
   * rechazo viejo y volvería a pedir el factor, que es un intento fallido
   * contra el bloqueo de la cuenta—, sino que la que espera turno pregunte al
   * servidor qué le falta **ahora** y abra una ventana que pida sólo eso.
   */
  describe("dos peticiones que necesitan cosas distintas", () => {
    /** Un rechazo de la puerta con la carencia y el cuerpo que se le digan.
     *  El cuerpo distingue a cada petición en lo que sale por el cable. */
    const faltaFactor = (exigeContrasena: boolean, cuerpo: Record<string, string>) =>
      rechazo(
        { code: CODIGO_STEP_UP, motivo: "sin-factor-reciente", exigeContrasena, message: "x" },
        { data: JSON.stringify(cuerpo) },
      );

    it("la que esperaba turno se reenvía en vez de reabrir, y su ventana pide sólo lo que falta", async () => {
      const { enviados, restaurar } = capturarReenvios();
      const pedido: { motivo: string; exigeContrasena: boolean }[] = [];
      let abiertas = 0;
      let aLaVez = 0;
      registrarResolvedorStepUp(async (p) => {
        pedido.push({ motivo: p.motivo, exigeContrasena: p.exigeContrasena });
        abiertas += 1;
        aLaVez = Math.max(aLaVez, abiertas);
        await new Promise((r) => setTimeout(r, 5));
        abiertas -= 1;
        // La ventana del factor se resuelve probándolo, sin contraseña; la que
        // pide contraseña la devuelve.
        return p.motivo === "sin-factor-reciente" && !p.exigeContrasena
          ? {}
          : { password: "la-mia" };
      });

      // Cerrar la sesión de otro dispositivo, que se cubre probando el factor,
      // y a la vez el cambio de nombre, que necesita además la contraseña.
      const sesion = faltaFactor(false, { que: "sesion" });
      const nombre = faltaFactor(true, { que: "nombre" });
      await Promise.all([alFallar(sesion), alFallar(nombre)]);

      // Nunca dos ventanas a la vez: la ventana atiende una ceremonia cada vez
      // y la segunda que se abriera encima dejaría a las peticiones de la
      // primera ni resueltas ni rechazadas.
      expect(aLaVez).toBe(1);
      // 🔴 Y **una sola en total**: la que esperaba turno no reabre nada. Si
      // reabriera, lo haría con su rechazo viejo —que exige prueba de factor—
      // y lo que hay delante es el mismo código de la aplicación, todavía en
      // pantalla: teclearlo otra vez es un paso ya sellado, el servidor lo da
      // por no válido y carga un intento de los que bloquean la cuenta.
      expect(pedido).toEqual([{ motivo: "sin-factor-reciente", exigeContrasena: false }]);
      // Las dos salen, y las dos **sin contraseña**: la del nombre va justamente
      // a que el servidor le diga qué le queda por cubrir ahora.
      //
      // Sin fijar el orden entre ellas, que no lo decide nada de este contrato:
      // son dos peticiones concurrentes y cuál de las dos vuelve antes depende
      // de cuántos turnos de microtask cueste despertar a cada una.
      const cuerpos = enviados.map((e) => JSON.parse(String(e.data)) as unknown);
      expect(cuerpos).toHaveLength(2);
      expect(cuerpos).toContainEqual({ que: "sesion" });
      expect(cuerpos).toContainEqual({ que: "nombre" });

      // Y eso es lo que contesta, con el factor ya fresco: sólo la contraseña.
      //
      // La vuelta se monta sobre el MISMO `config`, que es lo que este fichero
      // puede hacer; el viaje de verdad —axios clona la configuración al
      // reenviar— se mide en `statusPropagation.test.ts`. Aquí no se depende de
      // que sobreviva nada: la ventana se abre por el motivo del rechazo nuevo.
      await alFallar(
        otraVuelta(nombre.config, {
          code: CODIGO_STEP_UP,
          motivo: "contraseña-requerida",
          exigeContrasena: true,
        }),
      );
      restaurar();

      // AHORA se abre la segunda ventana, y con el motivo que hace que pida
      // sólo la contraseña en vez de volver a pedir el factor.
      expect(pedido[1]).toEqual({ motivo: "contraseña-requerida", exigeContrasena: true });
      expect(JSON.parse(String(enviados[2].data))).toEqual({
        que: "nombre",
        stepup_password: "la-mia",
      });
    });

    it("si la persona cancela, la que esperaba turno abre la suya", async () => {
      // La otra mitad de la asimetría: `sin-resolver` se hereda, `cancelado`
      // no. Cancelar no cambia nada en el servidor —el rechazo viejo sigue
      // describiendo lo que falta, así que reenviar no enseñaría nada— y la
      // sesión sigue en pie, o sea que sí hay sitio para la ventana siguiente.
      const { enviados, restaurar } = capturarReenvios();
      const pedido: { motivo: string; exigeContrasena: boolean }[] = [];
      registrarResolvedorStepUp(async (p) => {
        pedido.push({ motivo: p.motivo, exigeContrasena: p.exigeContrasena });
        await new Promise((r) => setTimeout(r, 5));
        // Se cancela la primera; la segunda se confirma.
        return pedido.length === 1 ? null : { password: "la-mia" };
      });

      const sesion = faltaFactor(false, { que: "sesion" });
      const nombre = faltaFactor(true, { que: "nombre" });
      const [primera, segunda] = await Promise.allSettled([alFallar(sesion), alFallar(nombre)]);
      restaurar();

      // La cancelada no se reenvía, y se le dice que la cancelación fue suya.
      expect(primera.status).toBe("rejected");
      expect(explicacionDe(sesion)).toBe(MENSAJE_CANCELADO);
      // Y la que esperaba turno abre SU ventana y sale adelante. Heredando la
      // cancelación se quedaría sin ventana y sin operación sin que nadie lo
      // haya decidido por ella.
      expect(segunda.status).toBe("fulfilled");
      expect(pedido).toEqual([
        { motivo: "sin-factor-reciente", exigeContrasena: false },
        { motivo: "sin-factor-reciente", exigeContrasena: true },
      ]);
      expect(enviados.map((e) => JSON.parse(String(e.data)) as unknown)).toEqual([
        { que: "nombre", stepup_password: "la-mia" },
      ]);
    });

    it("la misma carencia sigue compartiendo una sola ventana", async () => {
      // El otro lado del mismo criterio: partir de más abre dos canjes con el
      // mismo código, el servidor sella el paso del primero y el segundo
      // cuenta como intento fallido.
      const { restaurar } = capturarReenvios();
      let abiertas = 0;
      registrarResolvedorStepUp(async () => {
        abiertas += 1;
        await new Promise((r) => setTimeout(r, 5));
        return { password: "la-mia" };
      });

      await Promise.all([
        alFallar(faltaFactor(true, { que: "uno" })),
        alFallar(faltaFactor(true, { que: "dos" })),
      ]);
      restaurar();

      expect(abiertas).toBe(1);
    });

    it("con la sesión cortada, la que esperaba turno no abre ninguna ventana", async () => {
      // La ceremonia viva acaba sin resolver porque la sesión se cayó por
      // debajo. Abrir entonces la de quien esperaba turno la deja encima de la
      // pantalla de login, pidiéndole algo a quien ya no tiene sesión con la
      // que responder — y sin nadie que la resuelva, esa petición tampoco
      // vuelve nunca.
      //
      // Aquí no hace falta capturar reenvíos: las dos peticiones se rechazan
      // sin llegar a reenviarse.
      let abiertas = 0;
      registrarResolvedorStepUp(() => {
        abiertas += 1;
        return new Promise(() => undefined);
      });

      const sesion = faltaFactor(false, { que: "sesion" });
      const nombre = faltaFactor(true, { que: "nombre" });
      const enVuelo = [alFallar(sesion), alFallar(nombre)];
      await Promise.resolve();
      cancelarStepUpEnCurso();

      await expect(enVuelo[0]).rejects.toBe(sesion);
      expect(abiertas).toBe(1);
      await expect(enVuelo[1]).rejects.toBe(nombre);
      // Y a la que esperaba tampoco se le dice que canceló: no decidió nada.
      expect(explicacionDe(nombre)).toBeUndefined();
    });

    it("la ceremonia que nace justo después de cortar la anterior conserva su par", async () => {
      // 🔴 El hueco: `cancelarStepUpEnCurso` resuelve la ceremonia viva y anula
      // el estado en el acto, pero el `finally` de esa promesa corre un
      // microtask **después**. Si en ese hueco nace otra ceremonia, un `finally`
      // que limpie a ciegas le borra su par — y sin par, la petición siguiente
      // no puede saber si le vale la ventana que ya está abierta y abre otra
      // encima, que es el fallo que todo esto viene a evitar.
      let abiertas = 0;
      registrarResolvedorStepUp(() => {
        abiertas += 1;
        return new Promise(() => undefined);
      });

      const cortada = faltaFactor(false, { que: "sesion" });
      const enVuelo = alFallar(cortada);
      await Promise.resolve();

      // La sesión se cae y, en el mismo turno, otra petición abre la suya.
      cancelarStepUpEnCurso();
      const viva = alFallar(faltaFactor(true, { que: "nombre" }));
      await expect(enVuelo).rejects.toBe(cortada);

      // Con el mismo par que la viva: tiene que engancharse a ella.
      const acompanante = alFallar(faltaFactor(true, { que: "otro" }));
      await Promise.resolve();
      expect(abiertas).toBe(2);

      // Y se recogen las dos, que siguen esperando a una ventana que nadie va
      // a resolver en este test.
      cancelarStepUpEnCurso();
      await expect(viva).rejects.toBeDefined();
      await expect(acompanante).rejects.toBeDefined();
    });
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

  // 🔴 El camino de éxito es el que se olvidaba: `limpiarPassword` sólo se
  // llamaba en el `catch`, así que tras un reintento CORRECTO la contraseña
  // se quedaba en el cuerpo que ve quien llamó.
  it("borra la contraseña del cuerpo también cuando el reintento sale bien", async () => {
    const { enviados, restaurar } = capturarReenvios();
    registrarResolvedorStepUp(async () => ({ password: "la-mia" }));

    let respuesta: { config?: { data?: unknown } } | undefined;
    try {
      respuesta = (await alFallar(
        rechazo(PASO, { data: '{"name":"x"}', contentType: "application/json" }),
      )) as { config?: { data?: unknown } };
    } finally {
      restaurar();
    }

    // Primero se comprueba que salió CON la contraseña — si no, borrarla
    // después no demuestra nada.
    expect(JSON.parse(String(enviados[0].data))).toMatchObject({ stepup_password: "la-mia" });

    const cuerpo = String(respuesta?.config?.data ?? "");
    expect(cuerpo).not.toContain("stepup_password");
    expect(cuerpo).not.toContain("la-mia");
    // Y lo demás sigue ahí: limpiar no es tirar el cuerpo a la basura.
    expect(cuerpo).toContain("name");
  });

  /**
   * Los dos frenos de este lado, y lo que cada uno cubre.
   *
   * El que manda mientras venga es `intentosRestantes`: lo cuenta el servidor y
   * lo dice en el cuerpo del 403. Cuántos deja el cliente cuando el servidor no
   * lo dice se mide de punta a punta en `statusPropagation.test.ts`, que es
   * donde la ceremonia gira de verdad; aquí sólo se sujeta que **para**.
   *
   * 🔴 Este bloque sustituye a «se rinde después de dos reintentos»: aquel
   * número era el defecto, no la propiedad. Dos reintentos son exactamente los
   * que gasta la ceremonia honrada en las rutas que quieren el factor y la
   * contraseña, así que lo que aquel test dejaba fijado era que la primera
   * equivocación matara la operación.
   */
  describe("los frenos", () => {
    const peticion = () => ({ url: `${url}/api/usuario/7`, headers: new AxiosHeaders() });

    it("para en seco cuando el servidor dice que no queda ningún intento", async () => {
      const { enviados, restaurar } = capturarReenvios();
      const resolvedor = vi.fn().mockResolvedValue({ password: "otra-mas" });
      registrarResolvedorStepUp(resolvedor);
      const err = rechazo({
        code: CODIGO_STEP_UP,
        motivo: "contraseña-incorrecta",
        intentosRestantes: 0,
      });

      try {
        await expect(alFallar(err)).rejects.toBe(err);
      } finally {
        restaurar();
      }

      // Ni siquiera se abre: el siguiente envío se lo comería el cupo del
      // servidor con un 429 y la persona habría tecleado para nada.
      expect(resolvedor).not.toHaveBeenCalled();
      expect(enviados).toHaveLength(0);
    });

    it("se rinde con el mismo motivo repetido, en vez de girar para siempre", async () => {
      const { enviados, restaurar } = capturarReenvios();
      registrarResolvedorStepUp(async () => ({ password: "la-mia" }));
      const config = peticion();

      try {
        for (let i = 0; i < 30; i += 1) {
          await alFallar(otraVuelta(config, PASO)).catch(() => undefined);
        }
      } finally {
        restaurar();
      }

      // Sin `intentosRestantes` el servidor no dice nada, así que el freno es
      // el de aquí. Lo que se mide es que existe y que la ceremonia honrada
      // cabe por debajo, no cuál es el número.
      expect(enviados.length).toBeGreaterThan(2);
      expect(enviados.length).toBeLessThan(30);
    });

    it("tampoco gira para siempre cuando el servidor alterna motivos", async () => {
      // 🔴 Cada motivo lleva su propia cuenta — es lo que impide que los viajes
      // de la ceremonia honrada gasten el presupuesto de equivocarse — así que
      // un servidor que alterne dos motivos no llega a agotar ninguna de las
      // dos. El techo de la petición entera es lo único que lo para, y sin él
      // esto son vueltas infinitas con una línea de bitácora por vuelta.
      const { enviados, restaurar } = capturarReenvios();
      registrarResolvedorStepUp(async () => ({ password: "la-mia" }));
      const config = peticion();
      const motivos = ["sin-factor-reciente", "contraseña-requerida"];

      try {
        for (let i = 0; i < 60; i += 1) {
          await alFallar(
            otraVuelta(config, { code: CODIGO_STEP_UP, motivo: motivos[i % 2] }),
          ).catch(() => undefined);
        }
      } finally {
        restaurar();
      }

      expect(enviados.length).toBeLessThan(60);
    });

    it("un `motivo` que no es un nombre corriente no desactiva el freno", async () => {
      // La clave del recuento la elige el servidor: `motivo` viaja en el cuerpo
      // del 403 sin validar, y `__proto__` leído a pelo no devuelve un número
      // sino lo que el objeto hereda. El prefijo de `claveDe` lo desactiva.
      //
      // 🔴 **Lo que este test NO cubre, y hay que saberlo para no confiarse.**
      // `otraVuelta` reconstruye el rechazo sobre el **mismo** objeto `config`,
      // y en producción no es el mismo: axios clona la configuración al
      // reenviar, y ese clonado se come tres nombres de clave. Aquí no se
      // pierde ninguna, así que este test sujeta el prefijo del lado de la
      // **lectura** — se pone rojo si alguien lo quita de la escritura y lo
      // deja en la lectura, o al revés. El viaje de verdad, que es donde el
      // fallo estaba, se mide en `statusPropagation.test.ts`, que es el único
      // fichero que monta la cadena entera.
      const { enviados, restaurar } = capturarReenvios();
      registrarResolvedorStepUp(async () => ({ password: "la-mia" }));
      const config = peticion();

      try {
        for (let i = 0; i < 30; i += 1) {
          await alFallar(
            otraVuelta(config, { code: CODIGO_STEP_UP, motivo: "__proto__" }),
          ).catch(() => undefined);
        }
      } finally {
        restaurar();
      }

      expect(enviados.length).toBeLessThan(30);
    });

    it("un motivo distinto no gasta el presupuesto del anterior", async () => {
      // La ceremonia honrada: el servidor nombra una carencia por respuesta,
      // así que pedir el factor y pedir después la contraseña son dos viajes
      // que nadie ha hecho mal. Salían del mismo presupuesto que las
      // equivocaciones, y por eso la primera contraseña mal tecleada mataba la
      // operación.
      const { enviados, restaurar } = capturarReenvios();
      registrarResolvedorStepUp(async () => ({ password: "la-mia" }));
      const config = peticion();

      const paso = (datos: Record<string, unknown>) =>
        alFallar(otraVuelta(config, { code: CODIGO_STEP_UP, ...datos })).catch(() => undefined);

      try {
        await paso({ motivo: "sin-factor-reciente" });
        await paso({ motivo: "contraseña-requerida" });
        // Y ahora la primera equivocación, que es la que se perdía.
        await paso({ motivo: "contraseña-incorrecta", intentosRestantes: 4 });
      } finally {
        restaurar();
      }

      expect(enviados).toHaveLength(3);
    });
  });

  /**
   * Ocho salidas y una sola frase: cancelar al crear un rol enseñaba «No se
   * pudo crear el rol», que es lo que la pantalla dice cuando no sabe nada.
   *
   * La marca viaja aparte de `normalized` a propósito — ver `fallo.ts` —, así
   * que aquí se comprueba que se pone, y en `statusPropagation.test.ts` que
   * llega hasta la frase que lee la pantalla.
   */
  describe("quién dice que la ceremonia no acabó", () => {
    it("marca la cancelación en el rechazo que devuelve", async () => {
      registrarResolvedorStepUp(async () => null);
      const err = rechazo(PASO);

      await expect(alFallar(err)).rejects.toBe(err);

      expect(explicacionDe(err)).toBe(MENSAJE_CANCELADO);
    });

    it("no acusa de cancelar a quien no canceló", async () => {
      // 🔴 Las tres formas de acabar sin resultado no son la misma cosa, y
      // antes lo eran: la ventana devolvía `null` para las tres. Sin ventana
      // montada la aplicación no ha arrancado; con la sesión cortada por debajo
      // el proveedor de sesión ya se lleva la pantalla al login. En ninguna de
      // las dos hay nadie delante que haya decidido nada.
      registrarResolvedorStepUp(null);
      const sinVentana = rechazo(PASO);
      await expect(alFallar(sinVentana)).rejects.toBe(sinVentana);
      expect(explicacionDe(sinVentana)).toBeUndefined();

      registrarResolvedorStepUp(() => new Promise(() => undefined));
      const cortada = rechazo(PASO);
      const enVuelo = alFallar(cortada);
      await Promise.resolve();
      cancelarStepUpEnCurso();

      await expect(enVuelo).rejects.toBe(cortada);
      expect(explicacionDe(cortada)).toBeUndefined();
    });

    it("dice que se acabaron los intentos cuando el servidor cuenta cero", async () => {
      const { restaurar } = capturarReenvios();
      registrarResolvedorStepUp(async () => ({ password: "otra-mas" }));
      const err = rechazo({
        code: CODIGO_STEP_UP,
        motivo: "contraseña-incorrecta",
        intentosRestantes: 0,
      });

      try {
        await alFallar(err).catch(() => undefined);
      } finally {
        restaurar();
      }

      expect(explicacionDe(err)).toBe(MENSAJE_SIN_INTENTOS);
    });

    it("no dice nada cuando el que falló fue el reenvío", async () => {
      // El servidor contestó de verdad y con su propio fallo: la frase que
      // toca es la de la pantalla, que sabe qué estaba haciendo.
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

      const capturado = await alFallar(rechazo(PASO)).catch((e: unknown) => e);
      axios.defaults.adapter = anterior;

      expect(explicacionDe(capturado)).toBeUndefined();
    });
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
    // rutas protegidas manda hoy un cuerpo así —la única llamada con
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

/* ─────────────────────────────────────────────────────────────────────────
 * Plan 4C, Tarea 11 — la contraseña que ya venía en la petición.
 *
 * Las secciones del segundo factor piden la contraseña en su propio
 * formulario y la mandan en las dos peticiones de un registro. Si la ventana
 * se abriera para corregir la primera, la segunda saldría con la vieja: 403
 * otra vez, segunda ventana, y con las llaves un reto de dos minutos
 * caducando. El rechazo se le devuelve a la sección, que tiene el campo.
 * ───────────────────────────────────────────────────────────────────────── */
describe("la contraseña que ya venía en la petición", () => {
  const CONTRASENA_INCORRECTA = { code: CODIGO_STEP_UP, motivo: "contraseña-incorrecta", message: "x" };

  it("no abre la ventana cuando la petición ya traía su contraseña y era ella la incorrecta", async () => {
    const { restaurar } = capturarReenvios();
    const resolvedor = vi.fn().mockResolvedValue({ password: "otra" });
    registrarResolvedorStepUp(resolvedor);
    const err = rechazo(CONTRASENA_INCORRECTA, {
      ruta: `${url}/api/auth/webauthn/register/options`,
      data: JSON.stringify({ stepup_password: "la-que-tecleo-mal" }),
    });

    try {
      await expect(alFallar(err)).rejects.toBe(err);
    } finally {
      restaurar();
    }
    expect(resolvedor).not.toHaveBeenCalled();
  });

  // La misma negativa sin contraseña en la petición es una carencia de
  // verdad: nadie más que la ventana puede cubrirla.
  it("sí la abre cuando la petición no traía ninguna", async () => {
    const { restaurar } = capturarReenvios();
    const resolvedor = vi.fn().mockResolvedValue({ password: "otra" });
    registrarResolvedorStepUp(resolvedor);

    try {
      await alFallar(rechazo(CONTRASENA_INCORRECTA, { data: JSON.stringify({ name: "x" }) }));
    } finally {
      restaurar();
    }
    expect(resolvedor).toHaveBeenCalledTimes(1);
  });

  // Y si la contraseña incorrecta la puso este interceptor en un reintento,
  // quien tiene que volver a pedirla es la ventana, no la pantalla.
  it("sí la abre en un reintento, aunque el cuerpo lleve contraseña: la puso el interceptor", async () => {
    const { restaurar } = capturarReenvios();
    const resolvedor = vi.fn().mockResolvedValue({ password: "otra" });
    registrarResolvedorStepUp(resolvedor);
    const err = rechazo(CONTRASENA_INCORRECTA, { data: JSON.stringify({ stepup_password: "mal" }) });
    // Una petición que ya lleva un reenvío hecho. La cuenta va por `motivo`
    // desde que el presupuesto sigue al del servidor; lo que se está montando
    // aquí es «esta contraseña la puso el interceptor», o sea, cualquier
    // reenvío anterior.
    (err.config as { __stepUpIntentos?: Record<string, number> }).__stepUpIntentos = {
      "contraseña-requerida": 1,
    };

    try {
      await alFallar(err);
    } finally {
      restaurar();
    }
    expect(resolvedor).toHaveBeenCalledTimes(1);
  });
});
