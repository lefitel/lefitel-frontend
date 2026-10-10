// The failure that reaches a screen, and the two separate things that keep it
// intact.
//
// **What this exists for.** Thirty-seven functions in this folder used to end
// `.then(r => r.status).catch(() => 400)`. A 403 the administrator can act on, a
// 500 that means try again, and a dead network all arrived as the number 400 —
// the information was destroyed one layer below the screen, so a screen could
// only ever have one sentence. The normalizer in `http.ts` is what replaces it,
// and it is a single line of registration whose two properties protect
// different things and are easy to confuse:
//
//   - **Its position** is defence, and measured as such rather than assumed.
//     Axios runs response handlers in registration order, so the step-up
//     interceptor sees a rejection first — but putting the normalizer ahead of
//     it would not blind it either, because the normalizer adds a field and
//     re-rejects the same object. What the order buys is the day somebody
//     changes what it rejects with: then, and only then, position is the one
//     thing standing between step-up and a rejection it cannot read.
//   - **Rejecting with the original error** protects everything downstream:
//     `SesionProvider`, which registers at mount and is therefore always last,
//     and around thirty readers in this folder and in the screens that reach
//     for `error.response`. A plain `{status, message}` would leave every one
//     of them with `undefined`, and the loudest consequence is that **a revoked
//     session stops logging anyone out**.
//
// Neither could be seen by any test before this file. `stepUpInterceptor.test.ts`
// and `SesionProvider.test.tsx` both spy on `axios.interceptors.response.use`
// and capture the handler instead of registering it, so no suite ever built a
// real chain.
//
// Everything here drives that real chain through a fake adapter. Nothing
// reaches a server.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { ID_INTERCEPTOR_STEP_UP, ID_NORMALIZADOR } from "./http";
import { normalizado } from "./fallo";
import { mensajeDeError, mensajeDeErrorAsync } from "./descarga";
import { registrarResolvedorStepUp, cancelarStepUpEnCurso } from "./stepUpInterceptor";
import {
  CODIGO_STEP_UP,
  MENSAJE_CANCELADO,
  MENSAJE_FACTOR_INCOMPLETO,
  MENSAJE_SIN_INTENTOS,
  STEP_UP_PASSWORD_FIELD,
} from "./stepUp";
import { opcionesDenegadas } from "./opciones.api";
import { asignarRol, editUserName, editUserPass, resetMfaUsuario, desbloquearUsuario } from "./Usuario.api";
import { endSession, sendVerificationEmail } from "./Login.api";
import { savePermisos } from "./Permisos.api";
import { toast } from "sonner";
import { url } from "./url";

const RUTA = `${url}/api/probeta`;

/** A response the way an adapter has to produce one. */
const respuesta = (config: InternalAxiosRequestConfig, status: number, data: unknown) => ({
  data, status, statusText: "", headers: new AxiosHeaders(), config,
});

/**
 * A fake server.
 *
 * `settle` — the validateStatus check that turns a 4xx into a rejection — lives
 * inside axios's own adapters, not in the pipeline, so a custom adapter has to
 * do it. Getting that wrong makes every test here pass for the wrong reason: a
 * 403 would resolve and never touch an error handler at all.
 */
function servidor(programa: (config: InternalAxiosRequestConfig, intento: number) => { status: number; data?: unknown } | "sin-respuesta") {
  let intento = 0;
  const anterior = axios.defaults.adapter;
  axios.defaults.adapter = async (config) => {
    const salida = programa(config, intento++);
    if (salida === "sin-respuesta") {
      throw new AxiosError("Network Error", AxiosError.ERR_NETWORK, config, {});
    }
    const r = respuesta(config, salida.status, salida.data ?? {});
    if (salida.status >= 200 && salida.status < 300) return r;
    throw new AxiosError(`Request failed with status code ${salida.status}`, String(salida.status), config, {}, r);
  };
  return { intentos: () => intento, restaurar: () => { axios.defaults.adapter = anterior; } };
}

let restaurarAdaptador: (() => void) | null = null;
const ejectar: number[] = [];

afterEach(() => {
  restaurarAdaptador?.();
  restaurarAdaptador = null;
  while (ejectar.length) axios.interceptors.response.eject(ejectar.pop() as number);
  registrarResolvedorStepUp(null);
  cancelarStepUpEnCurso();
});

function montar(programa: Parameters<typeof servidor>[0]) {
  const s = servidor(programa);
  restaurarAdaptador = s.restaurar;
  return s;
}

/** An interceptor registered now, which is where `SesionProvider`'s really is. */
function despues() {
  const vistos: unknown[] = [];
  const exitos: unknown[] = [];
  ejectar.push(axios.interceptors.response.use(
    (r) => { exitos.push(r); return r; },
    (e) => { vistos.push(e); return Promise.reject(e); },
  ));
  return { vistos, exitos };
}

describe("dónde se registra el traductor de fallos", () => {
  it("va detrás del interceptor del segundo factor, nunca delante", () => {
    // `axios.interceptors.response.use` returns an increasing handle, so this
    // is the order itself and not a proxy for it. One integer, and it cannot be
    // satisfied by accident — which matters, because getting it backwards
    // breaks the second-factor window silently and no rendered assertion would
    // notice.
    expect(ID_NORMALIZADOR).toBeGreaterThan(ID_INTERCEPTOR_STEP_UP);
  });

  it("el del segundo factor sigue viendo la respuesta entera", async () => {
    montar(() => ({ status: 403, data: { code: CODIGO_STEP_UP, motivo: "contraseña-requerida", message: "x" } }));
    // The resolver is the proof, and the first version of this test did not
    // use it: asserting only that the call rejects with a 403 passes with the
    // step-up interceptor deleted entirely, and in either registration order.
    // Being **asked for a password** is what can only happen if the
    // interceptor read `response.data.code` off an error that still had it.
    const pedido: unknown[] = [];
    registrarResolvedorStepUp(async (peticion) => { pedido.push(peticion); return null; });

    await expect(axios.get(RUTA)).rejects.toMatchObject({ response: { status: 403 } });

    expect(pedido, "el interceptor del segundo factor no llegó a leer data.code").toHaveLength(1);
  });

  it("no dice dos veces lo mismo cuando el aviso ya lo ha dado el interceptor", async () => {
    // The step-up refusal is the one response in the whole API carrying a
    // `code`, and the interceptor that reads it already raises its own toast —
    // with a "Configurarlo" button — before re-rejecting. Leaving the sentence
    // empty is what stops the forty new `catch` blocks from raising a second,
    // identical toast without the button.
    //
    // 🔴 **El fixture es el rechazo que de verdad saca ese aviso**, y antes no
    // lo era: decía `STEP_UP_REQUIRED` con la ventana cancelando, que es la
    // salida en la que el interceptor **no** enseña nada. Así, este test
    // afirmaba a la vez lo que quería decir —no repitas un aviso ya dado— y lo
    // que no quería —una cancelación se lee como un «no se pudo» genérico—, y
    // era eso segundo lo que sujetaba.
    const aviso = vi.spyOn(toast, "error").mockReturnValue("" as never);
    montar(() => ({ status: 403, data: { code: "FACTOR_PENDIENTE", message: "Configura tu segundo factor para continuar." } }));

    const error = await axios.get(RUTA).catch((e: unknown) => e);

    expect(aviso).toHaveBeenCalledTimes(1);
    expect(normalizado(error)?.status).toBe(403);

    // 🔴 **«No dos veces lo mismo» es que las dos frases sean distintas**, no
    // que la segunda no exista. La del aviso lleva el botón y dice dónde se
    // arregla; la de la pantalla dice qué le pasó a la operación que se pidió.
    // Repetir la del servidor aquí sí sería el segundo aviso idéntico y sin
    // botón que esta línea lleva evitando desde que existe.
    const frasePantalla = mensajeDeError(error, "No se pudo guardar");
    expect(frasePantalla).not.toBe(aviso.mock.calls[0][0]);
    expect(frasePantalla).toBe(MENSAJE_FACTOR_INCOMPLETO);
    // Y tampoco es el «no se pudo» genérico, que era lo que salía antes.
    expect(frasePantalla).not.toBe("No se pudo guardar");
  });
});

describe("con qué rechaza", () => {
  it("rechaza con el AxiosError original, enriquecido", async () => {
    montar(() => ({ status: 403, data: { message: "No tienes permiso para archivar" } }));

    const error = await axios.get(RUTA).catch((e: unknown) => e);

    // The four together. `isAxiosError` is the one that fires the instant
    // somebody replaces the rejection with `{status, message}`.
    expect(axios.isAxiosError(error)).toBe(true);
    expect((error as AxiosError).config).toBeDefined();
    expect((error as AxiosError).response?.status).toBe(403);
    expect(normalizado(error)).toEqual({ status: 403, message: "No tienes permiso para archivar" });
  });

  it("deja al que se registra después leer el 401 y su petición", async () => {
    // The defect this is really about. `SesionProvider` registers its
    // interceptor when it mounts, so it is downstream of everything in
    // `http.ts` and no ordering choice can protect it: it reads
    // `error.response.status === 401` and `error.config.url` to decide whether
    // a revoked session should log the person out.
    const { vistos } = despues();
    montar(() => ({ status: 401, data: { message: "Sesión caducada" } }));

    await axios.get(RUTA).catch(() => undefined);

    expect(vistos).toHaveLength(1);
    expect((vistos[0] as AxiosError).response?.status).toBe(401);
    expect((vistos[0] as AxiosError).config?.url).toBe(RUTA);
  });

  it("una petición que nunca llegó vale 0 y lo dice con palabras", async () => {
    montar(() => "sin-respuesta");

    const error = await axios.get(RUTA).catch((e: unknown) => e);

    expect(normalizado(error)).toEqual({ status: 0, message: "Sin conexión con el servidor" });
  });

  it("deja la frase vacía cuando el servidor no dijo nada, para que hable la pantalla", async () => {
    // Deliberate. A 500 answers a neutral sentence and a 403 may answer none at
    // all; inventing one here would override the screen's own words, which are
    // the better ones because the screen knows what it was doing.
    montar(() => ({ status: 500, data: {} }));

    const error = await axios.get(RUTA).catch((e: unknown) => e);

    expect(normalizado(error)?.status).toBe(500);
    expect(normalizado(error)?.message).toBe("");
    expect(mensajeDeError(error, "No se pudo archivar la ciudad")).toBe("No se pudo archivar la ciudad");
  });

  it("no toca una petición que alguien canceló", async () => {
    // The generator cancels its own exports and tells them apart with
    // `axios.isCancel`. Marking one would put "sin conexión con el servidor" on
    // screen over a download the person stopped on purpose.
    const control = new AbortController();
    montar(() => { control.abort(); return { status: 200 }; });

    const error = await axios.get(RUTA, { signal: control.signal }).catch((e: unknown) => e);

    expect(axios.isCancel(error)).toBe(true);
    expect(normalizado(error)).toBeUndefined();
  });
});

describe("lo que sigue funcionando gracias a eso", () => {
  it("`opcionesDenegadas` sigue distinguiendo un permiso de un segundo factor", async () => {
    // C2's four-state loading pattern in eight screens, and the only thing that
    // separates "denegado" from "fallo". It reads `error.response.data.code`,
    // so a plain-object rejection would silently take all eight back to "fallo".
    montar(() => ({ status: 403, data: {} }));
    const sinCodigo = await axios.get(RUTA).catch((e: unknown) => e);
    restaurarAdaptador?.();

    montar(() => ({ status: 403, data: { code: CODIGO_STEP_UP } }));
    registrarResolvedorStepUp(async () => null);
    const conCodigo = await axios.get(RUTA).catch((e: unknown) => e);

    expect(opcionesDenegadas(sinCodigo)).toBe(true);
    expect(opcionesDenegadas(conCodigo)).toBe(false);
  });

  it("`mensajeDeError` prefiere la frase del traductor", async () => {
    montar(() => "sin-respuesta");

    const error = await axios.get(RUTA).catch((e: unknown) => e);

    // Without the `normalized` branch this is the case that stays mute: a dead
    // server has no `response`, so the older reader found nothing and every
    // caller printed its own generic sentence.
    expect(mensajeDeError(error, "Error al generar el reporte")).toBe("Sin conexión con el servidor");
  });

  it("una descarga sigue leyendo su mensaje del Blob y no del traductor", async () => {
    // `mensajeDeErrorAsync` has to keep winning for a download: the body is a
    // `Blob`, so the normalizer finds no `data.message` and leaves the sentence
    // empty — the server's real 413 or 429 is inside the blob and nowhere else.
    montar(() => ({ status: 413, data: new Blob([JSON.stringify({ message: "El fichero supera el máximo" })]) }));

    const error = await axios.get(RUTA, { responseType: "blob" }).catch((e: unknown) => e);

    expect(await mensajeDeErrorAsync(error, "No se pudo descargar")).toBe("El fichero supera el máximo");
  });
});

describe("el reintento del segundo factor", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("llega al llamante como un éxito, y el manejador de éxito no cuenta nada", async () => {
    // Measured, and then frozen: the step-up interceptor retries from inside
    // its own error branch with `await axios(config)`, and that inner call
    // walks the whole chain again — so every success handler registered after
    // it runs **twice** for one retried request. The normalizer's success
    // handler is therefore the identity and must stay that way; anything that
    // counts, logs or measures there is double.
    const { exitos } = despues();
    const recibidos: string[] = [];
    const s = montar((config, intento) => {
      recibidos.push(String(config.data ?? ""));
      return intento === 0
        ? { status: 403, data: { code: CODIGO_STEP_UP, motivo: "contraseña-requerida", message: "x" } }
        : { status: 200, data: { ok: true } };
    });
    registrarResolvedorStepUp(async () => ({ password: "la-de-verdad" }));

    const r = await axios.post(RUTA, {});

    expect(r.status).toBe(200);
    expect(s.intentos()).toBe(2);
    expect(exitos).toHaveLength(2);
    // And the password really travelled, so this is a retry and not the first
    // request answering 200 by luck.
    //
    // 🔴 **Lo que llegó al servidor, no lo que quedó en `r.config`.** Este
    // testigo era `r.config.data`, y dejó de servir en cuanto el interceptor
    // empezó a borrar la contraseña también del camino de éxito: pasaba a ser
    // una petición de que la contraseña **siguiera** en el objeto que ve quien
    // llamó, que es justo lo contrario de lo que ese borrado protege. Lo que
    // el test quiere afirmar es que hubo reenvío y que salió con la
    // contraseña; eso se mira en el cable.
    expect(recibidos[1]).toContain(STEP_UP_PASSWORD_FIELD);
    expect(recibidos[0]).not.toContain(STEP_UP_PASSWORD_FIELD);
  });
});

/**
 * El presupuesto de reintentos, medido de punta a punta.
 *
 * Aquí y no en `stepUpInterceptor.test.ts` porque la propiedad que importa
 * sólo existe con la cadena entera montada: cada reenvío que vuelve a fallar
 * entra **otra vez** por el mismo manejador, y es esa vuelta la que gasta o no
 * gasta el presupuesto. El fichero de al lado captura el manejador en vez de
 * registrarlo, así que allí la ceremonia hay que simularla a mano.
 */
describe("cuántas veces se puede uno equivocar", () => {
  /**
   * Cuántas equivocaciones da el servidor por cuarto de hora — `PASSWORD_CONFIRM_LIMIT`
   * en `api/src/config/security.ts`. Escrito aquí como parte del servidor de
   * mentira, no como una copia de la constante del cliente: lo que se está
   * imitando es el 403 que llega por el cable.
   */
  const PRESUPUESTO_DEL_SERVIDOR = 5;

  it("tres contraseñas mal tecleadas siguen abriendo la ventana mientras el servidor diga que quedan intentos", async () => {
    // 🔴 La propiedad, y no el número. Lo que se mide es que quien se equivoca
    // tres veces y acierta a la cuarta **acaba haciendo su operación**: el
    // servidor sigue diciendo que le quedan intentos y el cliente le hace caso.
    // Antes de esto la ceremonia honrada —el servidor nombra una carencia por
    // respuesta, así que son dos viajes— agotaba ella sola el presupuesto del
    // cliente, y la primera equivocación mataba la operación.
    const escritas: string[] = [];
    montar((config, intento) => {
      if (intento === 0) {
        return { status: 403, data: { code: CODIGO_STEP_UP, motivo: "sin-factor-reciente", message: "x" } };
      }
      const cuerpo = JSON.parse(String(config.data ?? "{}")) as Record<string, string>;
      const password = cuerpo[STEP_UP_PASSWORD_FIELD];
      if (password === undefined) {
        return { status: 403, data: { code: CODIGO_STEP_UP, motivo: "contraseña-requerida", message: "x" } };
      }
      if (password !== "la-mia") {
        escritas.push(password);
        return {
          status: 403,
          data: {
            code: CODIGO_STEP_UP,
            motivo: "contraseña-incorrecta",
            intentosRestantes: PRESUPUESTO_DEL_SERVIDOR - escritas.length,
            message: "x",
          },
        };
      }
      return { status: 200, data: { ok: true } };
    });
    const tecleadas = ["mal-1", "mal-2", "mal-3", "la-mia"];
    let abiertas = 0;
    registrarResolvedorStepUp(async (peticion) => {
      abiertas += 1;
      // El primer viaje sólo pide el factor: la ventana lo prueba contra su
      // propia puerta y vuelve sin contraseña que reinyectar.
      if (peticion.motivo === "sin-factor-reciente") return {};
      return { password: tecleadas.shift() ?? "no-quedan" };
    });

    const r = await axios.post(RUTA, { name: "x" });

    expect(r.status).toBe(200);
    // Y las tres equivocaciones llegaron de verdad al servidor: sin esto, un
    // 200 podría venir de que la ventana nunca se abriera.
    expect(escritas).toEqual(["mal-1", "mal-2", "mal-3"]);
    expect(abiertas).toBe(5);
  });

  it("un `motivo` con el nombre de una clave que axios descarta sigue teniendo techo", async () => {
    // 🔴 **El reenvío clona la configuración, y el clon pierde tres claves.**
    // `axios(config)` pasa por `mergeConfig` → `utils.merge`, cuyo `assignValue`
    // descarta a propósito `__proto__`, `constructor` y `prototype`. El
    // recuento de reintentos vive en el `config`, así que un `motivo` llamado
    // como una de las tres se perdía **entero** por el camino: el mapa llegaba
    // vacío a la vuelta siguiente, los dos frenos leían cero para siempre y
    // esto giraba sin fin. Medido: doscientas peticiones y subiendo.
    //
    // 🔴 **Y por eso este test vive aquí y no al lado del interceptor.** Tiene
    // que pasar por el clonado de verdad. Reconstruyendo a mano el error de la
    // vuelta siguiente sobre el **mismo** objeto `config` no se pierde ninguna
    // clave, y eso mide un modelo que no es el de producción — que es
    // exactamente por lo que la primera versión de esta comprobación pasaba
    // estando el fallo dentro.
    const TOPE = 40;
    for (const motivo of ["__proto__", "constructor", "prototype"]) {
      restaurarAdaptador?.();
      // Pasado el tope contesta que sí: un test no puede depender de que el
      // arreglo funcione para terminar.
      const s = montar((_config, intento) =>
        intento < TOPE
          ? { status: 403, data: { code: CODIGO_STEP_UP, motivo, message: "x" } }
          : { status: 200, data: {} });
      registrarResolvedorStepUp(async () => ({ password: "la-mia" }));

      await axios.post(RUTA, {}).catch(() => undefined);

      expect(s.intentos(), `el freno no paró a \`${motivo}\``).toBeLessThan(TOPE);
    }
  });

  it("deja de reintentar en cuanto el servidor dice que no queda ninguno, y lo cuenta", async () => {
    // 🔴 El `0` del servidor es un final, no una sugerencia: el siguiente envío
    // se lo come el cupo con un 429 y la persona habría tecleado para nada.
    // Y hasta ahora eso llegaba a pantalla como «No se pudo crear el rol».
    montar(() => ({
      status: 403,
      data: {
        code: CODIGO_STEP_UP,
        motivo: "contraseña-incorrecta",
        intentosRestantes: 0,
        message: "Esta operación necesita que confirmes tu identidad.",
      },
    }));
    let abiertas = 0;
    registrarResolvedorStepUp(async () => {
      abiertas += 1;
      return { password: "otra-mas" };
    });

    const error = await axios.post(RUTA, { name: "x" }).catch((e: unknown) => e);

    expect(abiertas).toBe(0);
    expect(mensajeDeError(error, "No se pudo crear el rol")).toBe(MENSAJE_SIN_INTENTOS);
  });
});

/**
 * Quién pone la frase cuando la ceremonia no llega a resolverse.
 *
 * El interceptor devuelve el rechazo original tal cual, así que la frase la
 * pone la pantalla: «No se pudo crear el rol» para una cancelación que fue de
 * quien la leyó. Lo que se mide aquí es lo que ve la pantalla, con la cadena
 * entera montada y a través de `mensajeDeError`, que es por donde las pantallas
 * de esta aplicación sacan sus fallos.
 */
describe("lo que lee la pantalla cuando la ventana no resuelve", () => {
  it("una cancelación se lee como una cancelación, y no como la frase genérica de la pantalla", async () => {
    montar(() => ({
      status: 403,
      data: { code: CODIGO_STEP_UP, motivo: "contraseña-requerida", message: "Esta operación necesita que confirmes tu identidad." },
    }));
    registrarResolvedorStepUp(async () => null);

    const error = await axios.post(RUTA, {}).catch((e: unknown) => e);

    expect(mensajeDeError(error, "No se pudo crear el rol")).toBe(MENSAJE_CANCELADO);
  });

  it("y un fallo del servidor detrás de la ventana sigue dejando hablar a la pantalla", async () => {
    // La otra mitad de «distinguible de un fallo del servidor». Si toda salida
    // del interceptor llevara frase propia, «cancelaste» acabaría encima de un
    // 500 que nadie canceló.
    montar((_config, intento) =>
      intento === 0
        ? { status: 403, data: { code: CODIGO_STEP_UP, motivo: "contraseña-requerida", message: "x" } }
        : { status: 500, data: {} });
    registrarResolvedorStepUp(async () => ({ password: "la-mia" }));

    const error = await axios.post(RUTA, {}).catch((e: unknown) => e);

    expect(normalizado(error)?.status).toBe(500);
    expect(mensajeDeError(error, "No se pudo crear el rol")).toBe("No se pudo crear el rol");
  });

  /**
   * Los envoltorios que no lo heredaban, y ahora sí.
   *
   * `mensajeDeError` es el embudo por el que casi todas las pantallas sacan sus
   * fallos, y por eso los tres tests de arriba bastan para casi todas. Los
   * `.catch` de `Usuario.api.ts`, `Permisos.api.ts` y `Login.api.ts` se lo
   * saltaban leyendo `e.response.data.message` a pelo, y todos ellos están
   * detrás de la puerta del segundo factor.
   *
   * 🔴 **Lo que se mide es la propiedad, no el síntoma.** No basta con
   * comprobar que devuelven *algún* mensaje: el defecto era que devolvían el
   * del servidor, que en este caso es la frase de la puerta pidiendo la
   * contraseña. Así que cada caso comprueba las dos cosas — que sale la frase
   * de la cancelación **y** que no sale la del servidor. Un envoltorio que
   * volviera a leer el cuerpo crudo pasaría la primera mitad de una asersión
   * escrita a medias.
   *
   * 🔴 **El censo no se hace de memoria sino ruta por ruta**, y esta tabla
   * ha estado corta tres veces por no hacerlo así: se le escaparon
   * `sendVerificationEmail` y `endSession` —los dos de Mi perfil— y después
   * `asignarRol`, que nació en la revisión final del arco. Las tres por
   * trabajar desde una lista heredada en vez de cruzar cada `.catch` de esta
   * carpeta contra las rutas con `requireStepUp`. El criterio que sí los
   * encuentra: **¿puede abrirse el diálogo delante de esta llamada?** Es decir,
   * ¿su ruta está en `STEP_UP_OPTIONS` (`api/src/routes/routeGuards.test.ts`) y
   * **fuera** de `RUTAS_EXCLUIDAS` (`stepUpInterceptor.ts`)? Las dos
   * condiciones, porque `/auth/stepup` y `/auth/mfa/verify` fallan y no abren
   * nada.
   *
   * El barrido que ya no depende de que nadie se acuerde vive en
   * `rutasProtegidas.test.ts`: compara las rutas con puerta contra las
   * direcciones que esta carpeta construye. Encuentra la ruta sin función; el
   * envoltorio sin embudo sigue siendo este censo.
   *
   * Por eso los casos son **datos y no tests copiados**: añadir uno cuesta una
   * línea, que es lo que hace barato mantener el censo completo.
   *
   * Se conduce por la cadena real, con los envoltorios de verdad: un mock de
   * axios aquí probaría el test y no el código.
   */
  describe("y las pantallas que no pasaban por `mensajeDeError` ya lo hacen", () => {
    /**
     * Lo que contesta **el servidor**, palabra por palabra —
     * `MENSAJE_CONTRASENA_REQUERIDA` en `api/src/middleware/requireStepUp.ts`.
     *
     * 🔴 No es la frase que el cliente enseña para ese mismo `motivo`: la de
     * `MOTIVO_MENSAJE` en `stepUp.ts` dice «Escribe tu contraseña actual para
     * continuar.», y son dos cadenas distintas a propósito. Aquí hace falta la
     * del servidor y sólo la del servidor, porque lo que se está reproduciendo
     * es un envoltorio leyendo el **cuerpo de la respuesta**. Con la del
     * cliente, el test seguiría en verde y estaría midiendo una cadena que
     * nunca llega por el cable.
     */
    const FRASE_DEL_SERVIDOR = "Introduce tu contraseña actual para completar esta operación.";

    const puertaQueRechaza = () =>
      montar(() => ({
        status: 403,
        data: { code: CODIGO_STEP_UP, motivo: "contraseña-requerida", message: FRASE_DEL_SERVIDOR },
      }));

    const casos: [string, () => Promise<{ status: number; message?: string | null }>][] = [
      ["editUserName", () => editUserName({ id: 7 } as never)],
      ["editUserPass", () => editUserPass({ id: 7 } as never)],
      ["resetMfaUsuario", () => resetMfaUsuario(7)],
      ["desbloquearUsuario", () => desbloquearUsuario(7)],
      ["savePermisos", () => savePermisos(7, {})],
      // El sexto, y el que más cerca está de la persona: es la tarjeta de
      // «Correo de recuperación» de Mi perfil. Su ruta va detrás de la puerta
      // igual que las otras cinco, así que el diálogo sale en cada envío y
      // cancelarlo dejaba la frase del servidor sobre la tarjeta.
      ["sendVerificationEmail", () => sendVerificationEmail("nueva@osefi.net")],
      // El séptimo. `DELETE /auth/sessions/:id` lleva `requireStepUp()`, y su
      // botón está en la misma pantalla que los dos anteriores: «cerrar esta
      // sesión», en Mi perfil.
      ["endSession", () => endSession("una-sesion")],
      // Y el que faltaba por no existir todavía. `PUT /usuario/:id/rol` lleva
      // `sinVentana`, o sea que pide la contraseña en **cada** intento: de los
      // ocho, es el que abre el diálogo más a menudo, y por tanto el que más
      // veces puede cancelarse.
      ["asignarRol", () => asignarRol(7, 5)],
    ];

    for (const [nombre, llamar] of casos) {
      it(`${nombre} dice que cancelaste, no lo que pidió la puerta`, async () => {
        puertaQueRechaza();
        registrarResolvedorStepUp(async () => null);

        const res = await llamar();

        expect(res.message, nombre).toBe(MENSAJE_CANCELADO);
        // La mitad que de verdad describe el defecto: la frase de la puerta
        // llegaba a la pantalla justo después de cerrar el diálogo que la pedía.
        expect(res.message, nombre).not.toBe(FRASE_DEL_SERVIDOR);
        expect(res.status, nombre).toBe(403);
      });
    }

    it("y con un fallo del servidor de verdad siguen enseñando lo que dijo el servidor", async () => {
      // La otra mitad, que es lo que impide «arreglarlo» poniendo la frase de
      // cancelación en todos los fallos: un 500 no lo canceló nadie, y el
      // envoltorio tiene que seguir dejando pasar lo que diga el servidor.
      montar(() => ({ status: 500, data: { message: "Se rompió algo al guardar." } }));

      const res = await savePermisos(7, {});

      expect(res.status).toBe(500);
      expect(res.message).toBe("Se rompió algo al guardar.");
    });
  });

  it("no acusa de cancelar a quien no canceló: sin ventana montada, habla la pantalla", async () => {
    // Verde antes y después, y está aquí a propósito: la implementación
    // evidente —marcar todo lo que salga sin resultado— la pone roja. Sin
    // ventana montada la aplicación aún no ha arrancado y no hay nadie que
    // haya decidido nada.
    montar(() => ({ status: 403, data: { code: CODIGO_STEP_UP, motivo: "contraseña-requerida", message: "x" } }));
    registrarResolvedorStepUp(null);

    const error = await axios.post(RUTA, {}).catch((e: unknown) => e);

    expect(mensajeDeError(error, "No se pudo crear el rol")).toBe("No se pudo crear el rol");
  });
});
