// El contrato del step-up, en un solo sitio.
//
// Antes vivía en dos: `CODIGO_STEP_UP` estaba declarado tanto en
// `Login.api.ts` como en `Mfa.api.ts`, y la tabla de mensajes sólo en el
// segundo. Con el interceptor global del plan 4D hay un tercer consumidor, y
// tres copias de una constante compartida entre dos repos desplegados por
// separado es como acaban diciendo cosas distintas. Este módulo es la copia
// buena; los otros dos importan de aquí.
//
// 🔴 **Es formato de cable, no un import compartido.** El servidor vive en
// otro repositorio y se despliega aparte, así que estos nombres son un
// acuerdo entre dos programas, no un tipo que el compilador vaya a
// comprobar por nosotros. Cada constante dice a qué se corresponde en
// `api/src/middleware/requireStepUp.ts`; si allí cambian, aquí no falla
// nada — deja de funcionar en producción.

/**
 * El campo del cuerpo donde viaja la contraseña — `STEP_UP_PASSWORD_FIELD` en
 * `api/src/config/security.ts`.
 *
 * 🔴 Y no es lo mismo que `oldPass` ni que `pass`, que otras rutas usan para
 * pedir la contraseña actual como parte de lo que hacen (cambiarla, renombrar
 * la cuenta, registrar el correo). Éste lo lee **la puerta**, antes de que el
 * controlador vea nada.
 */
export const STEP_UP_PASSWORD_FIELD = "stepup_password";

/** `CODIGO_STEP_UP` en `requireStepUp.ts` — el `code` que lleva todo 403 de
 *  esa puerta, venga con el `motivo` que venga. */
export const CODIGO_STEP_UP = "STEP_UP_REQUIRED";

/**
 * El discriminante que dice **qué** falta, no sólo que falta algo.
 *
 * Se corresponde con `MOTIVO_ESTADO_INCOMPLETO` / `MOTIVO_SIN_FACTOR_RECIENTE`
 * / `MOTIVO_CONTRASENA_INCORRECTA` / `MOTIVO_CONTRASENA_REQUERIDA` en
 * `requireStepUp.ts`. Comparar siempre por estas constantes, **nunca** por la
 * frase en español: la frase se mejora y el código deja de reconocerla.
 */
export const MOTIVO_ESTADO_INCOMPLETO = "estado-incompleto";
export const MOTIVO_SIN_FACTOR_RECIENTE = "sin-factor-reciente";
export const MOTIVO_CONTRASENA_INCORRECTA = "contraseña-incorrecta";
export const MOTIVO_CONTRASENA_REQUERIDA = "contraseña-requerida";

export type MotivoStepUp =
  | typeof MOTIVO_ESTADO_INCOMPLETO
  | typeof MOTIVO_SIN_FACTOR_RECIENTE
  | typeof MOTIVO_CONTRASENA_INCORRECTA
  | typeof MOTIVO_CONTRASENA_REQUERIDA;

/**
 * El cuerpo entero de un 403 de la puerta.
 *
 * Los tres últimos campos son **opcionales a propósito** —`exigeContrasena` e
 * `intentosRestantes` los añadió el plan 4D, `metodos` el 4C—: un servidor
 * anterior no los manda, y todo lo que los lea tiene que seguir funcionando
 * sin ellos.
 */
export interface RechazoStepUp {
  message?: string;
  code?: string;
  motivo?: string;
  /**
   * Sólo en `sin-factor-reciente`: además del factor hará falta la contraseña.
   *
   * Existe para que la ventana pueda pedir las dos cosas de una vez. El
   * servidor nombra **una** carencia por respuesta, así que sin este aviso la
   * ceremonia serían dos ventanas seguidas justo en las operaciones más
   * delicadas — restablecer el factor de otra persona, desbloquear su cuenta.
   */
  exigeContrasena?: boolean;
  /**
   * Cuántos intentos quedan antes de que la cuenta se bloquee, o antes de
   * agotar el presupuesto de contraseña. `0` significa que ya no queda
   * ninguno.
   *
   * Sin esto, cinco códigos mal tecleados —o el reloj del móvil desfasado—
   * bloquean la cuenta entera del ERP sin que nadie haya leído un aviso, y el
   * mensaje de error es idéntico al de un código simplemente mal escrito.
   */
  intentosRestantes?: number;
  /**
   * Sólo en `sin-factor-reciente`: cómo puede esta cuenta cubrirlo, en el
   * orden en que conviene ofrecerlo.
   *
   * Sin esto la ventana no puede saber si dibujar el botón de la huella o el
   * campo de seis dígitos, y equivocarse no es cosmético: a quien sólo tiene
   * passkey se le pediría un código que no existe, y cinco intentos bloquean
   * la cuenta detrás de esta misma puerta.
   *
   * Los valores se corresponden con `MetodoReautenticacion` en
   * `api/src/auth/factorInventory.ts`: `passkey`, `totp`, `codigo`.
   *
   * 🔴 **«Método», no «factor», y la palabra está elegida.** Un código de
   * recuperación **no** es un segundo factor —el servidor se niega a que
   * cuente como tal— pero sí es algo que esta ventana acepta. Llamar
   * «factores» a una lista que lo incluye desharía esa regla en el cable.
   *
   * 🔴 **Se lee como lista abierta, nunca con un `switch` exhaustivo.** El
   * servidor se despliega aparte y puede aprender un cuarto método antes que
   * esta pantalla; un valor que no se reconozca se ignora y se sigue pintando
   * el resto. Por eso el tipo es `string[]`.
   *
   * Opcional como los dos anteriores y por el mismo motivo: un servidor
   * anterior no lo manda. **Ausente** significa «no lo sé», y lo que lo lea
   * tiene que seguir funcionando —enseñando lo de siempre— sin él. **Vacío no
   * es lo mismo:** es el servidor diciendo que esta cuenta no puede probarse
   * con nada, que es el único caso en el que «lo de siempre» está mal.
   */
  metodos?: string[];
}

/**
 * Si un 403 es la puerta del step-up pidiendo una credencial más fresca, y
 * **no** el guardián de CSRF rechazando con el mismo estado.
 *
 * 🔴 Los dos no se distinguen por el estado, y el de CSRF **además borra la
 * cookie de sesión**. Confundirlos no es impreciso: es la diferencia entre
 * «vuelve a escribir tu contraseña» y «ya no tienes ninguna sesión donde
 * escribirla». Hay diecisiete respuestas 403 en el servidor sin `code`;
 * `code` es el único campo que las separa, y es en lo que tiene que ramificar
 * cualquier reacción a `STEP_UP_REQUIRED` — nunca en el estado a secas ni en
 * `sesion.estado`.
 *
 * Recibe el estado y el `code` por separado, y no un error de axios entero,
 * para que la misma comprobación sirva con una respuesta real y con un
 * fixture de test.
 */
export const esRechazoStepUp = (status: number, code: unknown): boolean =>
  status === 403 && code === CODIGO_STEP_UP;

/**
 * Cuatro frases distintas para cuatro remedios distintos — y **no** un
 * pasa-manos del `message` del servidor.
 *
 * `requireStepUp.ts` contesta a `sin-factor-reciente` y a
 * `contraseña-incorrecta` con exactamente la misma frase genérica: «Esta
 * operación necesita que confirmes tu identidad.» Allí está bien —el servidor
 * no quiere insinuar qué comparación acaba de hacer—, pero enseñar esa misma
 * frase para las dos aquí acusaría a alguien de teclear mal una contraseña que
 * nunca tecleó, justo en el caso en que no se comparó ninguna.
 */
const MOTIVO_MENSAJE: Record<MotivoStepUp, string> = {
  [MOTIVO_ESTADO_INCOMPLETO]:
    "Termina de configurar tu segundo factor antes de realizar esta operación.",
  [MOTIVO_SIN_FACTOR_RECIENTE]:
    "Antes de continuar, prueba tu segundo factor actual (o usa un código de recuperación) para confirmar que eres tú.",
  [MOTIVO_CONTRASENA_INCORRECTA]: "Esa contraseña no es correcta. Inténtalo de nuevo.",
  [MOTIVO_CONTRASENA_REQUERIDA]: "Escribe tu contraseña actual para continuar.",
};

/**
 * La frase que se enseña para un rechazo concreto.
 *
 * `motivo` manda siempre que sea uno de los cuatro conocidos. Cualquier otra
 * cosa —sin `motivo`, o un quinto valor que añada una versión futura del
 * servidor— cae en lo que el servidor haya dicho, para que un rechazo que no
 * reconocemos enseñe algo en vez de nada.
 */
/**
 * La frase de un `sin-factor-reciente` cuando el servidor dijo **con qué** se
 * puede cubrir — plan 4C, Tarea 8. `null` cuando no lo dijo (servidor
 * anterior), y entonces la ventana cae en `describeStepUpError`, que promete
 * un código de recuperación a todo el mundo: con `metodos` delante, esa
 * promesa sólo se hace a quien de verdad tiene uno sin gastar.
 *
 * Lista vacía: la cuenta tiene un factor —por eso la puerta rechaza— y ninguno
 * le sirve ahora mismo (un TOTP que este servidor no puede leer, sin llave y
 * sin códigos). Pintarle el formulario de siempre es dejarla tecleando contra
 * un 503; aquí la frase dice a quién avisar.
 *
 * No edita `MOTIVO_MENSAJE`: `TotpSection` y `RecoveryCodesSection` usan esa
 * tabla para avisos que no son la ventana y no tienen `metodos` que mirar.
 */
export function describeMetodos(metodos: string[] | undefined): string | null {
  if (!metodos) return null;
  if (metodos.length === 0) {
    return "Tu cuenta tiene un segundo factor que ahora mismo no se puede comprobar. Avisa a un administrador para que lo restablezca.";
  }
  const llave = metodos.includes("passkey");
  const codigo = metodos.includes("totp");
  const recuperacion = metodos.includes("codigo");
  const partes: string[] = [];
  if (llave) partes.push("usa tu llave de acceso");
  if (codigo) partes.push("escribe el código de tu aplicación");
  if (!llave && !codigo && recuperacion) partes.push("escribe uno de tus códigos de recuperación");
  // Ninguno de los que llegaron es de los que esta pantalla sabe dibujar: el
  // servidor aprendió un método antes que la aplicación. Operativamente es
  // como la lista vacía —no hay nada que pintar— y la frase dice por qué.
  if (partes.length === 0) {
    return "Tu cuenta usa un método de verificación que esta versión de la aplicación aún no conoce. Recarga la página; si sigue pasando, avisa a un administrador.";
  }
  const accion = partes.length === 1 ? partes[0] : `${partes[0]} o ${partes[1]}`;
  const extra = recuperacion && (llave || codigo) ? " También sirve un código de recuperación." : "";
  return `Antes de continuar, ${accion} para confirmar que eres tú.${extra}`;
}

export function describeStepUpError(
  motivo: string | undefined,
  fallbackMessage: string | null,
): string {
  if (motivo && motivo in MOTIVO_MENSAJE) return MOTIVO_MENSAJE[motivo as MotivoStepUp];
  return fallbackMessage || "Ocurrió un error en el servidor.";
}

/**
 * Cuánto espera la ventana antes de rendirse.
 *
 * 🔴 Sin esto, el diálogo puede dejar la aplicación inservible. Mientras la
 * confirmación está en vuelo se deshabilitan sus dos botones y se traga la
 * tecla Escape —para que nadie cierre la ventana a medias—, y `axios` no trae
 * ningún tiempo límite por defecto. Una petición que se acepta y nunca se
 * contesta (un móvil que entra en un túnel a mitad del envío es el caso
 * corriente) deja una ventana modal encima de la pantalla, con los dos botones
 * muertos, para siempre. La única salida sería recargar, y recargar pierde el
 * formulario del que venía la operación.
 */
export const TIMEOUT_CONFIRMACION_MS = 20_000;
