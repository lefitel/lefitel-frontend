// Lo que pasa cuando el servidor dice «antes de esto, demuéstrame que eres tú».
//
// El servidor pide esa prueba en diecinueve sitios. Antes de este fichero el
// cliente sabía contestar en cuatro, y sólo porque esas cuatro pantallas
// llevaban su propio campo de contraseña. En los quince restantes la operación
// simplemente fallaba: dos de ellas siempre, y las trece demás en el instante
// en que su dueño registrara un segundo factor.
//
// Aquí se resuelve una vez para todas, y para las rutas que se añadan después.
//
// ── Cómo encaja ──────────────────────────────────────────────────────────────
//
// Tres piezas, y la separación es deliberada:
//
//   1. **Este interceptor** no sabe nada de React. Detecta el rechazo,
//      garantiza que sólo haya una ceremonia viva, y reenvía la petición.
//   2. **El puente** (`registrarResolvedorStepUp`) es una función que el
//      proveedor de React registra al montarse. Vive en el módulo, no en un
//      contexto, por el motivo del punto siguiente.
//   3. **La ventana** decide qué pedir y hace las llamadas que hagan falta
//      —probar el factor es una petición aparte, y a cuál de las dos puertas
//      va depende del estado de la sesión, que es cosa de React.
//
// Este fichero se instala **a nivel de módulo**, no dentro de un `useEffect`.
// 🔴 Y no es una preferencia de estilo: axios congela la cadena de
// interceptores en el orden de registro, y `React.StrictMode` monta, desmonta
// y vuelve a montar los efectos en desarrollo. Un interceptor registrado en un
// efecto se da de baja y se vuelve a dar de alta, quedando **detrás** de los
// que no lo hicieron. En producción no hay doble montaje. O sea que el orden
// en `npm run dev` no dice nada del orden desplegado, y probarlo allí da una
// falsa tranquilidad.

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { esNuestraApi } from "./esNuestraApi";
import { toast } from "sonner";
import { STEP_UP_PASSWORD_FIELD, CODIGO_STEP_UP, MOTIVO_ESTADO_INCOMPLETO } from "./stepUp";
import type { RechazoStepUp } from "./stepUp";

/**
 * Lo que la ventana devuelve cuando ha terminado.
 *
 * `password` sólo viene si el servidor la pidió; la prueba del factor no
 * aparece aquí porque no viaja en la petición original: la ventana la canjea
 * contra su propia puerta y el servidor deja constancia en la sesión. Lo que
 * el interceptor necesita saber es únicamente si puede reintentar y con qué
 * añadido.
 */
export interface ResultadoStepUp {
  password?: string;
}

export interface PeticionStepUp {
  motivo: string;
  /** El servidor avisa de que, además del factor, hará falta la contraseña.
   *  Es lo que permite pedir las dos cosas en una sola ventana. */
  exigeContrasena: boolean;
  /** Cuántos intentos quedan antes de bloquear la cuenta, si el servidor lo dijo. */
  intentosRestantes?: number;
  /** Lo que el servidor contestó, por si el motivo no es de los conocidos. */
  mensaje: string | null;
  /**
   * Se dispara cuando la ceremonia se corta desde fuera —al cerrarse la
   * sesión, típicamente. La ventana la escucha para cerrarse sola: si no, se
   * queda encima de la pantalla de login, tapándola, esperando a alguien que
   * ya no tiene sesión con la que responder.
   */
  signal: AbortSignal;
}

/**
 * `null` significa que la persona canceló. No es un error del servidor y no
 * debe presentarse como tal.
 */
export type ResolvedorStepUp = (peticion: PeticionStepUp) => Promise<ResultadoStepUp | null>;

let resolvedor: ResolvedorStepUp | null = null;

/**
 * Conecta la ventana. La registra el proveedor al montarse y la retira al
 * desmontarse; pasar `null` desconecta.
 *
 * Sin resolvedor registrado el interceptor no hace nada y deja pasar el
 * rechazo tal cual, que es lo correcto: antes de que la aplicación esté
 * montada no hay ninguna ventana que enseñar.
 */
export function registrarResolvedorStepUp(fn: ResolvedorStepUp | null): void {
  resolvedor = fn;
}

/**
 * La ceremonia viva, si la hay.
 *
 * 🔴 **Serializar no es una optimización: es lo que impide bloquear la cuenta
 * de alguien que ha tecleado bien.** Cuando dos peticiones reciben el rechazo
 * a la vez y cada una abre su ceremonia, se disparan dos canjes con el *mismo*
 * código. El servidor sella el paso del TOTP para que no pueda reutilizarse,
 * así que el primero gana y el segundo cuenta como intento fallido. Dos
 * operaciones simultáneas en dos rondas y la cuenta queda bloqueada —con el
 * código correcto tecleado todas las veces, y sin nada en pantalla que lo
 * explique.
 *
 * Con esto, la primera petición abre la ventana y las demás esperan **esa
 * misma promesa**: se reintentan con su resultado sin volver a preguntar nada.
 */
let ceremonia: Promise<ResultadoStepUp | null> | null = null;

/**
 * Con qué se corta la ceremonia viva desde fuera, y el aviso para que la
 * ventana se entere.
 *
 * Guardar la promesa no basta: soltar la referencia no la resuelve, y las
 * peticiones que la esperaban se quedan **ni resueltas ni rechazadas** — sus
 * `await` no vuelven nunca. Hay que llamar a su `resolve`.
 */
let cerrarCeremonia: ((r: ResultadoStepUp | null) => void) | null = null;
let abortoCeremonia: AbortController | null = null;

/**
 * Las puertas que el interceptor no debe tocar nunca.
 *
 * `/auth/stepup` y `/auth/mfa/verify` son las que la propia ventana usa para
 * resolver el rechazo: reaccionar a un fallo suyo abriendo otra ventana es la
 * recursión evidente. `/auth/logout` por el mismo motivo por el que el
 * interceptor de sesión ya lo excluye — es la barrera que aguanta aunque todo
 * lo demás falle.
 */
const RUTAS_EXCLUIDAS = ["/auth/stepup", "/auth/mfa/verify", "/auth/logout"];

/**
 * Cuerpos que caducan, y que por eso no se reenvían.
 *
 * `POST /auth/totp/confirm` lleva un código de seis dígitos que vale treinta
 * segundos. Reenviarlo después de que alguien haya tecleado en una ventana
 * manda un código muerto, y el servidor culpa a la persona de un retraso que
 * puso el interceptor. Esa pantalla ya pide el código ella misma.
 */
const CUERPOS_QUE_CADUCAN = ["/auth/totp/confirm"];

/**
 * Cuántas veces se reintenta una misma petición antes de rendirse.
 *
 * Dos, y hace falta que sean dos: en las rutas que quieren el factor **y** la
 * contraseña el servidor nombra una carencia por respuesta, así que la
 * ceremonia honrada son dos viajes. El tope existe porque sin él un cuerpo mal
 * serializado —o un motivo que el servidor repite— gira para siempre, dejando
 * una línea de bitácora por vuelta.
 */
const MAX_REINTENTOS = 2;

interface ConfigConIntentos extends InternalAxiosRequestConfig {
  __stepUpIntentos?: number;
}

const rutaDe = (config: { url?: string } | undefined): string => config?.url ?? "";

const coincide = (config: { url?: string } | undefined, rutas: string[]): boolean =>
  rutas.some((r) => rutaDe(config).includes(r));

/**
 * Mete la contraseña en el cuerpo que va a salir por el cable.
 *
 * 🔴 **Aquí es donde la implementación evidente entra en bucle infinito, y está
 * medido, no razonado.** Tres formas distintas, y las tres importan:
 *
 * 1. **El cuerpo ya es una cadena.** Para cuando un interceptor de respuesta
 *    ve `config.data`, axios ya aplicó sus transformaciones: un `PUT` con un
 *    objeto llega aquí como `'{"name":"x"}'`. Un `{ ...config.data, campo }`
 *    sobre eso produce `{"0":"{","1":"\""...}` — un cuerpo sin el campo, que
 *    el servidor rechaza otra vez, en silencio y para siempre.
 * 2. **No hay cuerpo.** Hay que asignar un **objeto**, no una cadena: una
 *    cadena la deja pasar tal cual sin fijar el tipo de contenido.
 * 3. **La cabecera puede venir envenenada.** `axios.post(url)` sin segundo
 *    argumento deja `Content-Type: application/x-www-form-urlencoded` escrito
 *    en la configuración, y ahí se queda. El servidor sólo monta
 *    `express.json()`, así que ese cuerpo no se parsea: `req.body` llega vacío
 *    y la respuesta es «falta la contraseña» **con la contraseña correcta**.
 *    Por eso se fuerza el tipo en vez de confiar en el que traiga.
 *
 * Las cinco llamadas que provocaban el caso 3 se arreglaron además en origen.
 * Esto no es redundancia: aquello cierra el bucle de hoy, esto cierra el de la
 * función que alguien escriba mañana sin haber leído nada de esto.
 */
export function inyectarPassword(config: ConfigConIntentos, password: string): void {
  let cuerpo: Record<string, unknown> = {};
  if (typeof config.data === "string" && config.data !== "") {
    try {
      const parseado: unknown = JSON.parse(config.data);
      // 🔴 Un cuerpo que no es un objeto —una lista, un `FormData`, una cadena
      // que no sea JSON— **se pierde**: se sustituye por `{stepup_password}`.
      // Ninguna de las diecinueve rutas manda hoy algo así (la única llamada
      // con `FormData` de la aplicación va a una ruta sin puerta), pero este
      // fichero existe también para las rutas que vengan después, y para ésas
      // esto falla en silencio. Documentado a propósito en vez de disimulado
      // con un comentario que diga que se conserva, que es lo que decía antes.
      if (parseado && typeof parseado === "object" && !Array.isArray(parseado)) {
        cuerpo = parseado as Record<string, unknown>;
      }
    } catch {
      // No era JSON. Mismo criterio.
    }
  } else if (config.data && typeof config.data === "object") {
    cuerpo = { ...(config.data as Record<string, unknown>) };
  }

  cuerpo[STEP_UP_PASSWORD_FIELD] = password;
  config.data = cuerpo;
  config.headers.set("Content-Type", "application/json");
}

/**
 * Quita la contraseña del cuerpo de una configuración, dejando el resto.
 *
 * Se llama sobre el error que sale de aquí hacia la pantalla que llamó. El
 * cuerpo puede venir ya serializado a cadena (es lo normal para cuando axios
 * ha despachado) o seguir siendo un objeto, así que se contemplan los dos.
 */
function limpiarPassword(config: ConfigConIntentos | undefined): void {
  if (!config) return;
  try {
    if (typeof config.data === "string") {
      const cuerpo: unknown = JSON.parse(config.data);
      if (cuerpo && typeof cuerpo === "object" && STEP_UP_PASSWORD_FIELD in cuerpo) {
        delete (cuerpo as Record<string, unknown>)[STEP_UP_PASSWORD_FIELD];
        config.data = JSON.stringify(cuerpo);
      }
    } else if (config.data && typeof config.data === "object") {
      delete (config.data as Record<string, unknown>)[STEP_UP_PASSWORD_FIELD];
    }
  } catch {
    // Un cuerpo que no se puede leer tampoco se puede limpiar campo a campo.
    // Se tira entero, que es la dirección segura: perder el cuerpo de un error
    // ya fallido cuesta menos que dejar una contraseña dentro.
    config.data = undefined;
  }
}

/**
 * Abre la ventana, o se engancha a la que ya está abierta.
 *
 * La promesa se limpia en `finally` pase lo que pase: si se quedara colgada,
 * la siguiente petición rechazada esperaría eternamente a una ventana que ya
 * no existe.
 */
async function resolver(
  peticion: Omit<PeticionStepUp, "signal">,
): Promise<ResultadoStepUp | null> {
  if (ceremonia) return ceremonia;
  const fn = resolvedor;
  if (!fn) return null;

  const control = new AbortController();
  abortoCeremonia = control;
  // Una carrera entre la ventana y `cancelarStepUpEnCurso`: gana quien llegue
  // primero, y la segunda llamada a `resolve` no hace nada — una promesa se
  // resuelve una vez. Eso es justo lo que se quiere.
  ceremonia = new Promise<ResultadoStepUp | null>((resolve) => {
    cerrarCeremonia = resolve;
    void fn({ ...peticion, signal: control.signal }).then(resolve, () => resolve(null));
  }).finally(() => {
    ceremonia = null;
    cerrarCeremonia = null;
    abortoCeremonia = null;
  });
  return ceremonia;
}

/**
 * Corta en seco todo lo que estuviera esperando.
 *
 * La llama el proveedor cuando la sesión se cierra por debajo. Sin esto, una
 * sesión que caduca con la ventana abierta desmonta el árbol de React que la
 * contiene, y las peticiones que esperaban su resolución no se resuelven **ni
 * se rechazan**: sus `await` no vuelven nunca y los indicadores de carga giran
 * en componentes que ya no existen.
 */
export function cancelarStepUpEnCurso(): void {
  // 🔴 **El resolvedor NO se toca, y esto costó un fallo grave.**
  //
  // La primera versión lo ponía a `null`. Como la ventana se registra en un
  // efecto de montaje y vive **fuera** de las rutas para no desmontarse nunca,
  // tampoco se vuelve a montar nunca: cerrar sesión una sola vez dejaba el
  // mecanismo muerto para el resto de la vida de la pestaña. Quien volvía a
  // entrar sin recargar se encontraba con que ninguna operación protegida
  // volvía a funcionar, y el mensaje del servidor le decía «vuelve a
  // autenticarte y repite la acción» — exactamente lo que ya había hecho.
  //
  // Lo que sí hay que hacer es **resolver** la ceremonia viva, no soltarla:
  // soltar la referencia deja a quien la esperaba ni resuelto ni rechazado.
  abortoCeremonia?.abort();
  cerrarCeremonia?.(null);
  ceremonia = null;
  cerrarCeremonia = null;
  abortoCeremonia = null;
}

/**
 * El `code` de la otra negativa: se acabó el plazo y no hay ningún factor.
 *
 * Se corresponde con `CODIGO_FACTOR_PENDIENTE` en
 * `api/src/auth/sessionState.ts`. La responde `authenticate`, no la puerta del
 * step-up, y llega a quince de las diecinueve rutas protegidas.
 */
const CODIGO_FACTOR_PENDIENTE = "FACTOR_PENDIENTE";

/** Dónde se arregla. */
const RUTA_SEGUNDO_FACTOR = "/app/segundo-factor";

/**
 * Lo que se enseña cuando se acabó el plazo y no hay factor.
 *
 * 🔴 **No abre la ventana, y no puede.** Aquí no hay nada que teclear: el
 * único remedio es registrar un segundo factor, así que una ventana pidiendo
 * una contraseña que el servidor no va a mirar giraría para siempre. Es un
 * aviso con un enlace, y se acabó.
 *
 * Antes de esto, `createRol`, `editRol` y `createUsuario` se tragaban la
 * respuesta con un `.catch(() => 400)` y enseñaban un «no se pudo» pelado:
 * quien lo leía no tenía forma de saber qué le faltaba ni dónde arreglarlo, y
 * acababa preguntando.
 *
 * El `id` fijo es lo que evita que quince peticiones fallidas apilen quince
 * avisos idénticos: sonner reemplaza el que ya está en pantalla.
 */
function avisarFactorPendiente(mensaje: string | undefined): void {
  toast.error(mensaje ?? "Termina de configurar tu segundo factor para continuar.", {
    id: "factor-pendiente",
    duration: 10_000,
    action: {
      label: "Configurarlo",
      // `window.location` y no el router: este módulo vive fuera de React a
      // propósito, y una navegación completa es aceptable para algo que sólo
      // ocurre cuando la persona ya no puede trabajar.
      onClick: () => { window.location.href = RUTA_SEGUNDO_FACTOR; },
    },
  });
}

/** Registra el interceptor. La llama `http.ts` una sola vez, al importarse. */
export function instalarInterceptorStepUp(): number {
  return axios.interceptors.response.use(
    (r) => r,
    async (error: AxiosError<RechazoStepUp>) => {
      const config = error.config as ConfigConIntentos | undefined;
      const datos = error.response?.data;

      // 🔴 El disparador, y es exactamente éste. Hay diecisiete respuestas 403
      // en el servidor **sin** `code`, y la peligrosa es la del guardián de
      // CSRF, que borra la cookie de sesión antes de contestar: abrir la
      // ventana ahí le pide a alguien su contraseña para reenviar una petición
      // que ya no lleva credencial, y acaba en la pantalla de login. `code`
      // aparece en una sola respuesta de todo el servidor, así que discriminar
      // por él es exacto.
      // La otra negativa, la de «se te acabó el plazo». No abre ventana: se
      // avisa y se deja pasar el error a quien llamó.
      if (
        config &&
        error.response?.status === 403 &&
        datos?.code === CODIGO_FACTOR_PENDIENTE &&
        esNuestraApi(config)
      ) {
        avisarFactorPendiente(datos.message);
        return Promise.reject(error);
      }

      if (
        !config ||
        error.response?.status !== 403 ||
        datos?.code !== CODIGO_STEP_UP ||
        !esNuestraApi(config)
      ) {
        return Promise.reject(error);
      }

      if (coincide(config, RUTAS_EXCLUIDAS) || coincide(config, CUERPOS_QUE_CADUCAN)) {
        return Promise.reject(error);
      }

      // 🔴 `estado-incompleto` no se reintenta jamás. No hay nada que teclear:
      // el único remedio es registrar un segundo factor, algo que ninguna
      // ventana puede obtener. Reintentar aquí es un bucle infinito
      // garantizado, y hoy se alcanza en dos rutas de verdad.
      if (datos?.motivo === MOTIVO_ESTADO_INCOMPLETO) {
        return Promise.reject(error);
      }

      const intentos = config.__stepUpIntentos ?? 0;
      if (intentos >= MAX_REINTENTOS) return Promise.reject(error);

      const resultado = await resolver({
        motivo: datos?.motivo ?? "",
        exigeContrasena: datos?.exigeContrasena === true,
        intentosRestantes: datos?.intentosRestantes,
        mensaje: datos?.message ?? null,
      });

      // Canceló, o no hay ventana montada. El rechazo original sigue su
      // camino: la pantalla que llamó decide qué enseñar.
      if (!resultado) return Promise.reject(error);

      config.__stepUpIntentos = intentos + 1;
      if (resultado.password) inyectarPassword(config, resultado.password);
      try {
        return await axios(config);
      } catch (fallo) {
        /**
         * 🔴 Borrar la contraseña del error antes de que salga de aquí.
         *
         * Axios adjunta la configuración de la petición al error, y esa
         * configuración lleva el cuerpo que acabamos de ampliar. Sin esta
         * limpieza, el error que recibe el `.catch()` de cada pantalla
         * contiene, en claro, la contraseña que la persona acaba de teclear:
         *
         *     error.config.data === '{"name":"x","stepup_password":"…"}'
         *
         * Hoy no hay ningún sitio en `web/src` que registre esos errores —ni
         * Sentry, ni un `console.error` en un `catch`, ni un botón de «informar
         * de un problema»—, así que nada la exfiltra. Pero el día que alguien
         * añada cualquiera de las tres cosas, el ERP empezaría a mandar las
         * contraseñas de la gente a un tercero, y ese cambio no tendría por qué
         * pasar por nadie que conozca este fichero. Se limpia aquí, que es
         * donde se sabe.
         */
        limpiarPassword((fallo as { config?: ConfigConIntentos } | undefined)?.config);
        throw fallo;
      }
    },
  );
}
