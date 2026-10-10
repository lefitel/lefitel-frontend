// Lo que pasa cuando el servidor dice «antes de esto, demuéstrame que eres tú».
//
// El servidor pide esa prueba en una veintena de sitios. Antes de este fichero el
// cliente sabía contestar en cuatro, y sólo porque esas cuatro pantallas
// llevaban su propio campo de contraseña. En el resto la operación
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
import {
  STEP_UP_PASSWORD_FIELD,
  CODIGO_STEP_UP,
  MENSAJE_CANCELADO,
  MENSAJE_FACTOR_INCOMPLETO,
  MENSAJE_SIN_INTENTOS,
  MOTIVO_ESTADO_INCOMPLETO,
  MOTIVO_CONTRASENA_INCORRECTA,
} from "./stepUp";
import type { RechazoStepUp } from "./stepUp";
import { marcarExplicacion } from "./fallo";

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
  /**
   * Con qué puede la persona cubrir un `sin-factor-reciente`: `passkey`,
   * `totp`, `codigo`, en el orden en que conviene ofrecerlos.
   *
   * 🔴 **Se copia campo a campo, y por eso está aquí.** Todo lo que el
   * servidor mande y no se nombre en esta interfaz se pierde al reconstruir
   * la petición más abajo: llega al interceptor y no llega a la ventana. Sin
   * esta línea, el aviso del servidor existe y no lo lee nadie.
   *
   * 🔴 **Ausente y vacío no significan lo mismo, y la diferencia se conserva
   * aquí a propósito.** `undefined` es un servidor anterior que no manda el
   * campo: la ventana pinta lo de siempre. `[]` es el servidor diciendo que
   * esta cuenta **no puede probarse con nada** —tiene un factor, por eso la
   * puerta rechaza, pero ninguno le sirve ahora mismo—, y ahí lo de siempre
   * es un formulario contra el que teclear sin salida.
   */
  metodos?: string[];
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
 * La lista de métodos tal y como se puede confiar en ella.
 *
 * 🔴 **El tipo declarado no es una comprobación.** `datos` es JSON sin
 * validar: `metodos` está tipado `string[]` y en ejecución es `unknown[]`, así
 * que `[{}]` pasaría un `Array.isArray` y llegaría a la ventana, donde React
 * lanza al intentar pintar un objeto como hijo. Y la ventana es lo **único**
 * que puede resolver la ceremonia: si revienta al abrirse, las peticiones que
 * esperan quedan colgadas de una promesa que ya no resuelve nadie.
 *
 * Devuelve `undefined` —«no lo sé»— cuando no hay lista, y conserva la lista
 * vacía como lista vacía, que significa otra cosa: ver `RechazoStepUp`.
 */
const metodosDe = (valor: unknown): string[] | undefined =>
  Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : undefined;

/**
 * `null` significa que la persona canceló. No es un error del servidor y no
 * debe presentarse como tal.
 */
export type ResolvedorStepUp = (peticion: PeticionStepUp) => Promise<ResultadoStepUp | null>;

/**
 * Qué le queda por hacer a una petición que pidió ceremonia: con qué acabó la
 * suya y, sobre todo, **quién** la acabó.
 *
 * 🔴 **Los dos finales sin resultado no son la misma cosa, y con un `null` para
 * los dos no se podían distinguir.** Cancelar es una decisión de quien está
 * delante, y merece que se le diga que por eso no pasó nada. Lo demás —que la
 * aplicación aún no haya montado la ventana, que la sesión se corte por debajo,
 * que la ventana reviente— no lo ha decidido nadie: decirle a esa persona que
 * canceló sería mentirle, y en el caso de la sesión cortada, mentirle encima de
 * una pantalla que ya se está yendo al login.
 *
 * Va en el valor de la promesa y no en una variable del módulo a propósito:
 * cada petición que espera lee el desenlace de **su** ceremonia, y no el de la
 * siguiente, que puede haber empezado ya.
 */
type DesenlaceStepUp =
  | { fin: "resuelto"; resultado: ResultadoStepUp }
  | { fin: "cancelado" }
  | { fin: "sin-resolver" }
  /**
   * No hubo ventana para esta petición y aun así se reenvía: la ceremonia de
   * **otra** petición acaba de cambiar el estado de la sesión, así que lo que
   * decía su rechazo puede haber dejado de ser verdad. Se manda tal cual y se
   * deja que el servidor nombre la carencia que quede —el porqué está en
   * `resolver`.
   */
  | { fin: "reenviar" };

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
 * Con esto, la primera petición abre la ventana y las que necesiten lo mismo
 * esperan **esa misma promesa**: se reintentan con su resultado sin volver a
 * preguntar nada. Las que necesiten otra cosa esperan a que acabe y abren la
 * suya — `parCeremonia`, aquí debajo, es lo que separa un caso del otro.
 */
let ceremonia: Promise<DesenlaceStepUp> | null = null;

/**
 * Con qué se corta la ceremonia viva desde fuera, y el aviso para que la
 * ventana se entere.
 *
 * Guardar la promesa no basta: soltar la referencia no la resuelve, y las
 * peticiones que la esperaban se quedan **ni resueltas ni rechazadas** — sus
 * `await` no vuelven nunca. Hay que llamar a su `resolve`.
 */
let cerrarCeremonia: ((d: DesenlaceStepUp) => void) | null = null;
let abortoCeremonia: AbortController | null = null;

/**
 * Qué carencia está cubriendo la ceremonia viva, que es lo que decide quién
 * puede aprovecharla.
 *
 * 🔴 **`motivo` a secas no distingue lo que hay que pedir.** Dos operaciones
 * de la misma pantalla rechazan las dos con `sin-factor-reciente` y se
 * diferencian sólo en `exigeContrasena`: cerrar la sesión de otro dispositivo
 * se cubre probando el factor, y cambiar el nombre de la cuenta necesita
 * además la contraseña. Enganchar la segunda a la ventana de la primera le
 * entrega un resultado **sin contraseña** —la ventana ni siquiera dibujó el
 * campo—, así que su reenvío vuelve a fallar, gasta un reintento y acaba
 * abriendo una segunda ventana igualmente.
 *
 * 🔴 **Y por qué `contraseña-incorrecta` no lleva `exigeContrasena` sin que eso
 * sea un agujero**, que es la asimetría que alguien va a querer «arreglar». El
 * servidor manda el campo al pedir el factor y al pedir la contraseña, pero no
 * al rechazar una contraseña equivocada: allí llega siempre ausente, o sea
 * `false`, y todas las peticiones que estén ahí comparten par. Compartir es lo
 * correcto, porque ese motivo significa que la contraseña **ya se comparó** —y
 * para llegar a compararla la puerta del factor ya estaba pasada—, así que dos
 * peticiones con ese motivo están en el mismo estado y necesitan exactamente lo
 * mismo: teclear otra vez la contraseña. Añadir el campo allí no cambiaría
 * ninguna decisión de aquí.
 */
interface ParStepUp {
  motivo: string;
  exigeContrasena: boolean;
}
let parCeremonia: ParStepUp | null = null;

/** Si dos peticiones necesitan exactamente lo mismo y por tanto les vale una
 *  sola ventana. Sin ceremonia viva no hay par que igualar. */
const mismoPar = (viva: ParStepUp | null, otra: ParStepUp): boolean =>
  viva !== null && viva.motivo === otra.motivo && viva.exigeContrasena === otra.exigeContrasena;

/**
 * Las puertas que el interceptor no debe tocar nunca.
 *
 * `/auth/stepup` y `/auth/mfa/verify` son las que la propia ventana usa para
 * resolver el rechazo: reaccionar a un fallo suyo abriendo otra ventana es la
 * recursión evidente. `/auth/logout` por el mismo motivo por el que el
 * interceptor de sesión ya lo excluye — es la barrera que aguanta aunque todo
 * lo demás falle.
 *
 * `/auth/webauthn/login` cubre `/options` y `/verify` (la comparación es por
 * inclusión): es la tercera puerta con la que la ventana resuelve, desde el
 * plan 4C. Hoy ninguna de las dos puede emitir un 403 con `code` —no llevan
 * `requireStepUp`—, así que el bloqueo que evitaría no es alcanzable; está
 * aquí porque la lista es lo que sobrevive a que alguien monte una puerta ahí
 * más adelante. **No** van `/auth/webauthn/register` ni `/credentials`: esas
 * sí necesitan la ceremonia.
 *
 * `/auth/webauthn/passwordless` es el login sin contraseña (plan 4C, fase 2):
 * lo llama quien **no tiene sesión**, así que ninguna ventana de step-up puede
 * resolverle nada — no hay contraseña que reinyectar ni factor que reprobar
 * sobre una sesión que no existe. Un 403 suyo es la puerta de origen del
 * servidor, sin `code`, y ya no abriría la ventana; está aquí por el mismo
 * motivo que `/auth/webauthn/login`: la lista es lo que sobrevive a que
 * alguien monte una puerta ahí más adelante.
 *
 * `/auth/mfa/email-code` (plan 4E) es la cuarta puerta con la que la ventana
 * resuelve: pide el código que luego canjea en `/auth/stepup` o en
 * `/auth/mfa/verify`. **No la cubre `/auth/mfa/verify`**: la comparación es por
 * subcadena y `/auth/mfa/email-code` no contiene esa cadena (C29). Hoy no
 * lleva `requireStepUp` y no puede emitir el 403 con `code`; está aquí por lo
 * mismo que las dos anteriores — una ventana abierta desde el fallo de la
 * puerta con la que la propia ventana resuelve es la recursión evidente.
 *
 * Exportada para que su prueba recorra **esta** lista y no una copia a mano,
 * que es como una ruta faltó aquí sin que nada se pusiera rojo.
 */
export const RUTAS_EXCLUIDAS = [
  "/auth/stepup",
  "/auth/mfa/verify",
  "/auth/mfa/email-code",
  "/auth/logout",
  "/auth/webauthn/login",
  "/auth/webauthn/passwordless",
];

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
 * Cuántas veces se reintenta con el **mismo** `motivo` cuando el servidor no
 * dice cuántos intentos quedan.
 *
 * 🔴 **El que manda mientras venga es `intentosRestantes`**, que el servidor
 * cuenta y escribe en el cuerpo del 403 — `RechazoStepUp`, en `stepUp.ts`, dice
 * qué significa su `0`. El presupuesto es suyo, así que el número que él manda
 * es el que se obedece. Este tope sólo cubre a los motivos que no lo traen y a
 * un servidor anterior que no lo mande nunca.
 *
 * Puesto a la altura del presupuesto de contraseña del servidor
 * (`PASSWORD_CONFIRM_LIMIT`, en `api/src/config/security.ts`) para no quedarse
 * corto por debajo de él. Si allí sube, aquí no falla nada: manda el número que
 * llegue por el cable.
 */
const MAX_REINTENTOS_POR_MOTIVO = 5;

/**
 * El techo de la petición entera, sumando todos los motivos.
 *
 * 🔴 **Contra qué protege, que no es contra equivocarse.** Es lo único que
 * impide girar para siempre, y hace falta **además** del tope por motivo: como
 * cada motivo lleva su propia cuenta, un servidor que alterne dos motivos no
 * llega a agotar ninguna de las dos nunca. Sin este techo eso son vueltas
 * infinitas, con una línea de bitácora por vuelta y sin nada en pantalla que
 * lo explique.
 *
 * 🔴 **Y por qué sobra tanto, que es lo que alguien va a querer recortar.** El
 * número tiene holgura a propósito: nadie que teclee bien puede acercarse. La
 * ceremonia honrada son dos viajes —el servidor nombra una carencia por
 * respuesta— y el presupuesto de contraseña del servidor
 * (`PASSWORD_CONFIRM_LIMIT`, en `api/src/config/security.ts`) cabe entero por
 * debajo de lo que queda. Bajarlo hasta que «ajuste» vuelve a poner los pasos
 * de la ceremonia a competir con las equivocaciones por el mismo presupuesto,
 * que es exactamente el defecto que la cuenta por motivo vino a quitar: si
 * mañana la ceremonia gana un paso, esto tiene que seguir sobrando.
 */
const MAX_REINTENTOS = 10;

interface ConfigConIntentos extends InternalAxiosRequestConfig {
  /**
   * Cuántos reenvíos lleva hechos esta petición, **por `motivo`** del rechazo
   * que los pidió.
   *
   * Las claves llevan el prefijo de `claveDe`, y ahí está escrito por qué:
   * sin él, tres nombres de motivo se pierden en el clonado que hace axios al
   * reenviar y los dos frenos dejan de existir.
   *
   * 🔴 **Por motivo, y ahí está el arreglo.** Con una sola cuenta, los viajes
   * de la ceremonia honrada —el servidor nombra una carencia por respuesta, así
   * que pedir el factor y pedir después la contraseña son dos rechazos que
   * nadie ha hecho mal— salían del mismo presupuesto que las equivocaciones. El
   * resultado era que la primera contraseña mal tecleada mataba la operación,
   * teniendo el servidor intentos de sobra que ofrecer. Un motivo distinto es
   * un paso distinto de la ceremonia, no otra equivocación con lo mismo.
   */
  __stepUpIntentos?: Record<string, number>;
}

/** Lo que lleva contado esta petición, o el mapa vacío si es la primera vez. */
const intentosDe = (config: ConfigConIntentos): Record<string, number> =>
  config.__stepUpIntentos ?? {};

/** Cuántos reenvíos lleva la petición en total, sumando todos los motivos. */
const totalDe = (intentos: Record<string, number>): number =>
  Object.values(intentos).reduce((suma, n) => suma + n, 0);

/**
 * Con qué clave se cuenta un `motivo`.
 *
 * 🔴 **El prefijo no es cosmético: sin él el techo de reintentos no existe.**
 * El reenvío es `axios(config)`, y axios **no manda este mismo objeto**: lo
 * clona por el camino (`mergeConfig` → `utils.merge`), así que la
 * configuración que vuelve dentro del error de la vuelta siguiente es una
 * copia. Y ese clonado **descarta a propósito** las claves `__proto__`,
 * `constructor` y `prototype` — está en el `assignValue` de
 * `node_modules/axios/lib/utils.js`, contra la contaminación de prototipos.
 *
 * Un `motivo` llamado como una de las tres se perdía **entero** en el viaje: el
 * mapa llegaba vacío, `cuentaDe` y `totalDe` valían cero para siempre, y **no
 * se activaba ninguno de los dos frenos** — ni el del motivo ni el de la
 * petición entera. Medido contra el axios instalado: doscientas peticiones y
 * subiendo. Con el prefijo la clave viaja; sin él, no.
 *
 * 🔴 **Y por eso el recuento sigue viviendo en el `config` y no en un
 * `WeakMap`.** También medido, y es lo contrario de lo que parece: el clonado
 * **no conserva la identidad** del objeto de configuración, así que un
 * `WeakMap` con el `config` de clave perdería la cuenta en **todas** las
 * vueltas y no sólo en las tres claves malas. Lo que sobrevive al viaje es el
 * valor copiado, no el objeto.
 *
 * Se aplica aquí dentro, y no en cada sitio que toca el mapa, para que no haya
 * dónde olvidarlo.
 */
const claveDe = (motivo: string): string => `m:${motivo}`;

/**
 * Cuántos reenvíos lleva un motivo concreto.
 *
 * El `typeof` es porque `motivo` viaja en el cuerpo del 403 sin validar: la
 * clave es del servidor aunque el prefijo la haga inofensiva, y lo que no sea
 * un número no puede compararse con un tope.
 */
const cuentaDe = (intentos: Record<string, number>, motivo: string): number => {
  const n = intentos[claveDe(motivo)];
  return typeof n === "number" ? n : 0;
};

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
  const cuerpo = cuerpoDe(config);
  cuerpo[STEP_UP_PASSWORD_FIELD] = password;
  config.data = cuerpo;
  config.headers.set("Content-Type", "application/json");
}

/**
 * El cuerpo de una petición como objeto plano, o `{}` si no lo era. Copia,
 * nunca la referencia: quien lo pida lo va a modificar.
 */
function cuerpoDe(config: ConfigConIntentos): Record<string, unknown> {
  let cuerpo: Record<string, unknown> = {};
  if (typeof config.data === "string" && config.data !== "") {
    try {
      const parseado: unknown = JSON.parse(config.data);
      // 🔴 Un cuerpo que no es un objeto —una lista, un `FormData`, una cadena
      // que no sea JSON— **se pierde**: se sustituye por `{stepup_password}`.
      // Ninguna ruta con puerta manda hoy algo así —verificado llamada a
      // llamada para las once de permisos, roles y usuarios en la Tarea 10 del
      // plan 4C: todas mandan un objeto plano, y los `DELETE`/`PATCH` ya
      // llevan `{ data: {} }` o `{}` con el motivo escrito al lado; la única
      // llamada con `FormData` de la aplicación va a una ruta sin puerta—, pero este
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
  return cuerpo;
}

/**
 * Si la petición salió **ya** con una contraseña puesta por quien la hizo —
 * las secciones del segundo factor la piden en su propio formulario y la
 * mandan en sus dos o tres peticiones — y no una que este interceptor
 * inyectó en un reintento.
 */
const traiaContrasena = (config: ConfigConIntentos): boolean =>
  totalDe(intentosDe(config)) === 0 && STEP_UP_PASSWORD_FIELD in cuerpoDe(config);

/**
 * Quita la contraseña del cuerpo de una configuración, dejando el resto.
 *
 * Se llama sobre el `config` que sale de aquí hacia la pantalla que llamó,
 * tanto si el reintento acaba en respuesta (`respuesta.config`) como si acaba
 * en error (`error.config`). El cuerpo puede venir ya serializado a cadena
 * (es lo normal para cuando axios ha despachado) o seguir siendo un objeto,
 * así que se contemplan los dos.
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
    // Se tira entero, que es la dirección segura: perder el cuerpo de un
    // error ya fallido cuesta menos que dejar una contraseña dentro, y en una
    // respuesta que salió bien es un caso que hoy no se alcanza —
    // `inyectarPassword` siempre deja JSON válido— pero el mismo criterio
    // aplica si algún día deja de ser cierto.
    config.data = undefined;
  }
}

/**
 * Abre la ventana, se engancha a la que ya está abierta si pide lo mismo, o
 * espera turno si pide otra cosa.
 *
 * 🔴 **Esperar turno, no abrir encima.** La ventana atiende una ceremonia cada
 * vez: la segunda que se abriera sustituiría a la primera y las peticiones que
 * estaban esperando a aquélla se quedarían **ni resueltas ni rechazadas**, sus
 * `await` sin volver nunca — el mismo final que `cancelarStepUpEnCurso` existe
 * para evitar.
 *
 * 🔴 **Y al llegar su turno se reenvía, no se abre otra ventana. Lo que evita
 * eso es un intento fallido contra el bloqueo de la cuenta.** Reabrir con el
 * rechazo **viejo** vuelve a exigir prueba de factor, y lo que hay delante es
 * el mismo código de la aplicación, todavía en pantalla dentro de su medio
 * minuto: teclearlo otra vez es un reenvío del mismo paso, el servidor lo tiene
 * sellado como usado, lo da por no válido y **carga un intento** de los cinco
 * que bloquean la cuenta entera del ERP; con el código del correo o uno de
 * recuperación, además, se gasta. Reenviando la petición tal cual, el servidor
 * nombra lo que falta **ahora** —el factor acaba de probarse en la ceremonia de
 * al lado, así que lo que queda es la contraseña— y la ventana que salga de ese
 * rechazo pide sólo eso.
 *
 * Cuesta una ida y vuelta y un reintento del presupuesto de ese motivo, donde
 * cabe de sobra. Y **sólo se reenvía cuando la ceremonia de al lado se
 * resolvió**, que es lo único que pudo cambiar el estado de la sesión: si se
 * canceló, el rechazo viejo sigue describiendo exactamente lo que falta y el
 * viaje no enseñaría nada.
 *
 * La promesa se limpia en `finally` pase lo que pase: si se quedara colgada,
 * la siguiente petición rechazada esperaría eternamente a una ventana que ya
 * no existe.
 */
async function resolver(
  peticion: Omit<PeticionStepUp, "signal">,
): Promise<DesenlaceStepUp> {
  while (ceremonia) {
    if (mismoPar(parCeremonia, peticion)) return ceremonia;
    const desenlace = await ceremonia;
    /**
     * 🔴 **`sin-resolver` se hereda; `cancelado` no.** Los dos acaban la
     * ceremonia sin resultado, y aun así quien esperaba turno tiene que hacer
     * cosas distintas con cada uno.
     *
     * **Se hereda** porque una sesión caída no la arregla abrir otra ventana.
     * Así termina la que se corta desde fuera —`cancelarStepUpEnCurso`—, y la
     * ventana que abriera quien esperaba turno saldría encima de la pantalla de
     * login, con un abortador nuevo que ya no va a abortar nadie: pidiéndole
     * algo a quien no tiene sesión con la que responder, y sin nadie que la
     * resuelva, así que esa petición tampoco vuelve nunca. El otro final sin
     * resolver —la ventana lanzó al abrirse— tampoco mejora repitiéndolo.
     *
     * **No se hereda** la cancelación, porque ahí sí queda sitio para la
     * siguiente: quien cancela decide sobre la operación que tenía delante, no
     * sobre la que estaba en cola, y la sesión sigue en pie para atenderla.
     */
    if (desenlace.fin === "sin-resolver") return desenlace;
    // Se resolvió: el estado de la sesión ya no es el que provocó este rechazo,
    // así que la pregunta se le hace al servidor y no a la persona.
    if (desenlace.fin === "resuelto") return { fin: "reenviar" };
    // Cancelada: nada cambió, y el bucle vuelve a mirar por si mientras tanto
    // ha nacido otra ceremonia a la que esperar.
  }
  const fn = resolvedor;
  if (!fn) return { fin: "sin-resolver" };

  const control = new AbortController();
  abortoCeremonia = control;
  parCeremonia = { motivo: peticion.motivo, exigeContrasena: peticion.exigeContrasena };
  // Una carrera entre la ventana y `cancelarStepUpEnCurso`: gana quien llegue
  // primero, y la segunda llamada a `resolve` no hace nada — una promesa se
  // resuelve una vez. Eso es justo lo que se quiere.
  const propia: Promise<DesenlaceStepUp> = new Promise<DesenlaceStepUp>((resolve) => {
    cerrarCeremonia = resolve;
    void fn({ ...peticion, signal: control.signal }).then(
      (r) => resolve(r ? { fin: "resuelto", resultado: r } : { fin: "cancelado" }),
      // La ventana lanzó. Es un fallo de la ventana, no una decisión de nadie:
      // se acaba la ceremonia sin resultado y sin atribuírsela a la persona.
      () => resolve({ fin: "sin-resolver" }),
    );
  }).finally(() => {
    /**
     * 🔴 **Limpia sólo si el estado del módulo sigue siendo el de ESTA
     * ceremonia.** `cancelarStepUpEnCurso` resuelve la promesa y anula el
     * estado en el acto, mientras que este `finally` corre un microtask
     * después: si en ese hueco ha nacido otra ceremonia, borrar a ciegas le
     * quitaría a la que está viva su resolvedor, su abortador y su par — y con
     * el par ya perdido, la siguiente petición no podría saber si le vale la
     * ventana que tiene delante.
     */
    if (ceremonia !== propia) return;
    ceremonia = null;
    cerrarCeremonia = null;
    abortoCeremonia = null;
    parCeremonia = null;
  });
  ceremonia = propia;
  return propia;
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
  cerrarCeremonia?.({ fin: "sin-resolver" });
  ceremonia = null;
  cerrarCeremonia = null;
  abortoCeremonia = null;
  parCeremonia = null;
}

/**
 * El `code` de la otra negativa: se acabó el plazo y no hay ningún factor.
 *
 * Se corresponde con `CODIGO_FACTOR_PENDIENTE` en
 * `api/src/auth/sessionState.ts`. La responde `authenticate`, no la puerta del
 * step-up, y llega a toda ruta protegida que no esté en la lista de `onboarding`.
 */
const CODIGO_FACTOR_PENDIENTE = "FACTOR_PENDIENTE";

/** Dónde se arregla. */
const RUTA_SEGUNDO_FACTOR = "/app/segundo-factor";

/**
 * Se para la operación porque falta terminar de configurar el segundo factor:
 * se enseñan las dos cosas que hacen falta y se devuelve el rechazo.
 *
 * 🔴 **Una sola función porque son dos negativas distintas con la misma
 * carencia y el mismo remedio** — la de la puerta del step-up y la que contesta
 * `authenticate` cuando se acaba el plazo sin ningún factor. Que se vean igual
 * era el argumento entero para tocarlas; tenerlo escrito dos veces es
 * exactamente como dejan de verse igual.
 *
 * 🔴 **No abre la ventana, y no puede.** Aquí no hay nada que teclear: el
 * único remedio es registrar un segundo factor, así que una ventana pidiendo
 * una contraseña que el servidor no va a mirar giraría para siempre.
 *
 * **Las dos cosas, y dicen cosas distintas a propósito.** El aviso lleva el
 * botón y dice **dónde se arregla**; la frase marcada sustituye al «no se
 * pudo» genérico de la pantalla y dice **qué le pasó a la operación**. Si las
 * dos dijeran lo mismo, la segunda sería el aviso idéntico y sin botón que
 * `http.ts` lleva evitando desde que existe.
 *
 * Antes de esto, `createRol`, `editRol` y `createUsuario` se tragaban la
 * respuesta con un `.catch(() => 400)` y enseñaban un «no se pudo» pelado:
 * quien lo leía no tenía forma de saber qué le faltaba ni dónde arreglarlo, y
 * acababa preguntando.
 *
 * El `id` fijo es lo que evita que quince peticiones fallidas apilen quince
 * avisos idénticos: sonner reemplaza el que ya está en pantalla. Lo comparten
 * las dos negativas, que para esto son el mismo problema.
 */
function pararPorFactorIncompleto(error: AxiosError, mensaje: string | undefined): Promise<never> {
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
  marcarExplicacion(error, MENSAJE_FACTOR_INCOMPLETO);
  return Promise.reject(error);
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
        return pararPorFactorIncompleto(error, datos.message);
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

      /**
       * 🔴 **Una petición que ya traía su contraseña y recibe «contraseña
       * incorrecta» es de quien la mandó**, no de esta ventana. Las secciones
       * del segundo factor piden la contraseña en su propio formulario y la
       * mandan en las dos peticiones de un registro (`setup` + `confirm`,
       * `options` + `verify`). Si la ventana se abriera aquí, corregiría la
       * **primera** petición y la segunda saldría con la contraseña vieja del
       * formulario: 403 otra vez, segunda ventana, y —con las llaves— un reto
       * de dos minutos caducando mientras la persona teclea. Devolverle el
       * rechazo a la sección es lo que le deja pintar «esa contraseña no es
       * correcta» junto al campo donde se tecleó, antes de que ninguna
       * ceremonia empiece.
       *
       * Sólo en el primer intento: si la contraseña que falló la inyectó este
       * interceptor en un reintento, la ventana sí es quien tiene que volver a
       * pedirla. Y sólo con ese motivo: «sin factor reciente» y «contraseña
       * requerida» siguen siendo carencias que sólo la ventana puede cubrir.
       */
      if (datos?.motivo === MOTIVO_CONTRASENA_INCORRECTA && traiaContrasena(config)) {
        return Promise.reject(error);
      }

      // 🔴 `estado-incompleto` no se reintenta jamás. No hay nada que teclear:
      // el único remedio es registrar un segundo factor, algo que ninguna
      // ventana puede obtener. Reintentar aquí es un bucle infinito
      // garantizado, y hoy se alcanza en dos rutas de verdad.
      if (datos?.motivo === MOTIVO_ESTADO_INCOMPLETO) {
        // La misma salida que la otra negativa que pide esto, y por eso la
        // misma función: hasta ahora ésta no enseñaba ninguna de las dos cosas,
        // así que quien llegaba aquí leía el «no se pudo» de su pantalla y se
        // quedaba sin saber ni qué le faltaba ni dónde arreglarlo.
        return pararPorFactorIncompleto(error, datos.message);
      }

      const motivo = datos?.motivo ?? "";
      const intentos = intentosDe(config);
      // Se comprueba el tipo en ejecución y no sólo en la declaración: `datos`
      // es JSON sin validar, y una cadena colada aquí no sería ni «el servidor
      // dijo un número» ni «el servidor no dijo nada», que son los dos casos
      // que se reparten las comprobaciones de abajo.
      const restantes =
        typeof datos?.intentosRestantes === "number" ? datos.intentosRestantes : undefined;

      /**
       * 🔴 **El `0` del servidor es un final, no una sugerencia** — lo dice
       * `RechazoStepUp`, en `stepUp.ts`. Volver a abrir la ventana aquí le pide
       * a alguien que teclee algo que ya no le van a comparar, y la respuesta
       * al envío que saldría de ahí es la de un presupuesto agotado.
       *
       * Y hasta ahora eso llegaba a pantalla como el «no se pudo» genérico de
       * la pantalla, sin que nadie se enterase de que acababa de gastar el
       * último intento — justo lo que este campo existe para evitar.
       */
      if (restantes !== undefined && restantes <= 0) {
        marcarExplicacion(error, MENSAJE_SIN_INTENTOS);
        return Promise.reject(error);
      }

      // Los dos frenos de este lado: el del motivo cubre a un servidor que no
      // diga cuántos quedan, y el de la petición entera es lo que impide girar
      // para siempre cuando el servidor alterna motivos.
      if (
        (restantes === undefined && cuentaDe(intentos, motivo) >= MAX_REINTENTOS_POR_MOTIVO) ||
        totalDe(intentos) >= MAX_REINTENTOS
      ) {
        return Promise.reject(error);
      }

      const desenlace = await resolver({
        motivo,
        exigeContrasena: datos?.exigeContrasena === true,
        intentosRestantes: restantes,
        metodos: metodosDe(datos?.metodos),
        mensaje: datos?.message ?? null,
      });

      /**
       * 🔴 **Cancelar es lo único de aquí que decidió quien está delante, y por
       * eso es lo único que se cuenta.** El rechazo original sigue su camino en
       * los dos casos —la pantalla que llamó tiene que enterarse de que su
       * operación no ocurrió—, pero sin esta frase lo que leía era su propio
       * «No se pudo crear el rol»: cierto, y sin decir que la cancelación había
       * sido suya. La frase viaja aparte de `normalized` porque el normalizador
       * corre después y lo sustituye entero; el porqué está en `fallo.ts`.
       */
      if (desenlace.fin === "cancelado") {
        marcarExplicacion(error, MENSAJE_CANCELADO);
        return Promise.reject(error);
      }
      // Ni ventana montada, ni sesión, ni una ventana que funcione. Nada que
      // contar desde aquí: en el primer caso la aplicación todavía no ha
      // arrancado, y en el segundo el proveedor de sesión ya se está llevando
      // la pantalla al login.
      if (desenlace.fin === "sin-resolver") return Promise.reject(error);
      // Los dos finales que siguen al reenvío. `reenviar` es el de la petición
      // que esperaba turno y a la que la ceremonia de al lado le cambió el
      // estado de la sesión: sale tal cual, sin nada añadido, y lo que conteste
      // el servidor es lo que dirá qué falta de verdad ahora. Cuenta un
      // reintento igual, porque es un viaje más de esta petición.
      const resultado = desenlace.fin === "resuelto" ? desenlace.resultado : {};

      config.__stepUpIntentos = { ...intentos, [claveDe(motivo)]: cuentaDe(intentos, motivo) + 1 };
      if (resultado.password) inyectarPassword(config, resultado.password);
      /**
       * 🔴 Borrar la contraseña del cuerpo antes de que salga de aquí, gane o
       * pierda el reintento.
       *
       * Axios adjunta a la respuesta —o al error, si el reintento vuelve a
       * fallar— la configuración de la petición que acaba de mandar, y esa
       * configuración lleva el cuerpo que acabamos de ampliar. Sin esta
       * limpieza, quien recibe la respuesta o el error —cada pantalla, en su
       * `.then()` o en su `.catch()`— se encuentra, en claro:
       *
       *     response.config.data === '{"name":"x","stepup_password":"…"}'
       *
       * Hoy no hay ningún sitio en `web/src` que registre esos errores —ni
       * Sentry, ni un `console.error` en un `catch`, ni un botón de «informar
       * de un problema»—, así que nada la exfiltra. Pero el día que alguien
       * añada cualquiera de las tres cosas, el ERP empezaría a mandar las
       * contraseñas de la gente a un tercero, y ese cambio no tendría por qué
       * pasar por nadie que conozca este fichero. Se limpia aquí, que es
       * donde se sabe — en los dos caminos, porque la mitad de los reintentos
       * salen bien.
       */
      try {
        const respuesta = await axios(config);
        limpiarPassword(respuesta.config as ConfigConIntentos);
        return respuesta;
      } catch (fallo) {
        limpiarPassword((fallo as { config?: ConfigConIntentos } | undefined)?.config);
        throw fallo;
      }
    },
  );
}
