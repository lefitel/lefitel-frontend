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
 * 🔴 Y no es lo mismo que `oldPass`, que el cambio de contraseña manda como
 * parte de lo que hace: ahí «contraseña actual» no prueba quién eres, es la
 * mitad de lo que se está cambiando. Éste lo lee **la puerta**, antes de que
 * el controlador vea nada.
 *
 * Hubo un tiempo en que varios formularios pedían la contraseña por su cuenta
 * además de este diálogo, y eso significaba teclear el mismo secreto dos veces
 * por operación: una en la página y otra aquí. Es la molestia que dio origen a
 * este trabajo, y la forma de no repetirla es la regla de arriba — no una
 * lista de pantallas, que caduca sola.
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

/**
 * Lo que lee quien llamó cuando la ventana se cierra sin resolver nada porque
 * la persona lo decidió.
 *
 * 🔴 **Sustituye a la frase de la pantalla, no se suma a ella.** La pantalla
 * dice «No se pudo crear el rol», que es lo que sabe: que falló. Quien cancela
 * ya sabe que falló y lo que no sabía era que la cancelación contara como
 * fallo. Y no se compone con la de la pantalla porque no todas terminan igual
 * —hay fallbacks que acaban en punto— y pegarles algo detrás produce frases
 * rotas en unas y no en otras.
 */
export const MENSAJE_CANCELADO =
  "Cancelaste la confirmación de identidad, así que la operación no se realizó.";

/**
 * Lo que lee quien llamó cuando el servidor ha dicho que no le queda ningún
 * intento — `intentosRestantes` a `0`, más abajo.
 *
 * 🔴 **No nombra la contraseña, y eso es deliberado.** `intentosRestantes`
 * cuenta lo que falte para agotar el presupuesto **o** para bloquear la cuenta
 * —lo dice su propia documentación, aquí al lado—, así que una frase que diera
 * por hecho cuál de los dos se acaba de gastar sería falsa la mitad de las
 * veces. Se pide esperar en vez de volver a probar, que es lo que contesta el
 * propio servidor cuando es él quien corta — `PASSWORD_CONFIRM_MESSAGE` en
 * `api/src/middleware/loginLimiters.ts`.
 */
export const MENSAJE_SIN_INTENTOS =
  "Se acabaron los intentos para confirmar tu identidad. Espera unos minutos antes de volver a intentarlo.";

/**
 * Lo que lee quien llamó cuando la operación se paró porque falta terminar de
 * configurar el segundo factor.
 *
 * Sirve para las dos negativas que piden eso — la de la puerta del step-up y
 * la que contesta `authenticate` cuando se acaba el plazo sin ningún factor.
 * Son la misma carencia y el mismo remedio, así que se leen igual.
 *
 * 🔴 **No repite la frase del aviso, la completa.** El interceptor saca además
 * un aviso con el botón que lleva a arreglarlo, y las dos cosas salen a la vez:
 * si dijeran lo mismo, ésta sería el segundo aviso idéntico y sin botón que
 * `http.ts` lleva evitando desde que existe. Ésta dice qué le pasó a la
 * operación que la persona pidió; la del aviso dice dónde se arregla.
 */
export const MENSAJE_FACTOR_INCOMPLETO =
  "La operación no se realizó: te falta terminar de configurar tu segundo factor.";

/**
 * Lo que el diálogo dice sobre para qué sirve la confirmación y cuánto dura.
 *
 * 🔴 **Son dos frases porque hay dos comportamientos, y prometer el de la
 * ventana en una ruta que no la tiene sería mentir.** Las rutas que dan de
 * alta o de baja un factor —o que registran un correo, que desde el plan 4E
 * es un factor— piden la contraseña en **cada** petición: son las que
 * contestan con `exigeContrasena: true`, que es el mismo campo con el que el
 * servidor dice «esta ruta va sin ventana». En las demás, una confirmación
 * cubre un rato de trabajo.
 *
 * 🔴 **«Unos minutos» y no una cifra, a propósito.** El plazo real lo
 * decide `STEP_UP_WINDOW_MINUTES` (`api/src/config/security.ts`) y **no viaja
 * por el cable**: no hay ningún campo del 403 que lo diga. Una cifra escrita
 * aquí sería una copia de un número de otro repositorio que se despliega
 * aparte, así que el día que allí cambiara, esta pantalla prometería un plazo
 * falso **y todo seguiría en verde** — justo la clase de deriva silenciosa que
 * este trabajo existe para quitar. Una frase que no afirma un número no puede
 * desincronizarse de nadie, y cumple lo que se pedía: que se sepa que el
 * permiso se guarda un rato. (Isaias, 2026-09-09.)
 *
 * `exigeContrasena` es opcional en el cable —un servidor anterior no lo
 * manda— y su ausencia se lee como «con ventana», que es el caso de la
 * inmensa mayoría de las rutas y el único en el que la frase larga aporta
 * algo.
 */
export const describeProteccion = (sinVentana: boolean | undefined): string =>
  sinVentana
    ? "Esta operación cambia cómo entras a tu cuenta, así que la confirmamos cada vez."
    : "Lo preguntamos para proteger tu cuenta. No volveremos a pedírtelo durante unos minutos.";

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
   * `api/src/auth/factorInventory.ts`: `passkey`, `totp`, `correo` (plan 4E:
   * un código de seis cifras enviado al correo verificado), `codigo`.
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
 * Por qué puerta entra un código — `metodo` en `api/src/controllers/mfa.controller.ts`
 * (plan 4E). Sin él, el servidor decide por la forma: seis cifras son TOTP y
 * cualquier otra cosa un código de recuperación. El correo también son seis
 * cifras, así que un código de correo **tiene** que ir con `metodo: "correo"`
 * o el servidor lo probará contra la aplicación y lo dará por erróneo — y
 * cargará un intento contra el bloqueo de la cuenta.
 */
export type MetodoSegundoFactor = "totp" | "codigo" | "correo";

/**
 * El cuerpo de un canje de código, sin nada de más. `JSON.stringify` ya tira
 * un `undefined`, pero construir el objeto sin la clave es lo que deja a un
 * test fijar la forma exacta del cable con `toStrictEqual`, en vez de
 * confiar en el serializador para que una clave sobrante no cuente.
 */
export const cuerpoDeCanje = (
  codigo: string,
  recordar?: boolean,
  metodo?: MetodoSegundoFactor,
): { codigo: string; recordar?: boolean; metodo?: MetodoSegundoFactor } => ({
  codigo,
  ...(recordar !== undefined ? { recordar } : {}),
  ...(metodo !== undefined ? { metodo } : {}),
});

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
  // Plan 4E: el correo verificado es un método de pleno derecho, en el orden
  // en que el servidor lo lista (llave, aplicación, correo, recuperación).
  const correo = metodos.includes("correo");
  const recuperacion = metodos.includes("codigo");
  const partes: string[] = [];
  if (llave) partes.push("usa tu llave de acceso");
  if (codigo) partes.push("escribe el código de tu aplicación");
  if (correo) partes.push("pide un código a tu correo");
  if (!llave && !codigo && !correo && recuperacion) partes.push("escribe uno de tus códigos de recuperación");
  // Ninguno de los que llegaron es de los que esta pantalla sabe dibujar: el
  // servidor aprendió un método antes que la aplicación. Operativamente es
  // como la lista vacía —no hay nada que pintar— y la frase dice por qué.
  if (partes.length === 0) {
    return "Tu cuenta usa un método de verificación que esta versión de la aplicación aún no conoce. Recarga la página; si sigue pasando, avisa a un administrador.";
  }
  const accion =
    partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} o ${partes[partes.length - 1]}`;
  const extra = recuperacion && (llave || codigo || correo) ? " También sirve un código de recuperación." : "";
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
 * confirmación está en vuelo se deshabilitan **los dos** botones y se traga la
 * tecla Escape —para que nadie cierre la ventana a medias—, y `axios` no trae
 * ningún tiempo límite por defecto. Una petición que se acepta y nunca se
 * contesta (un móvil que entra en un túnel a mitad del envío es el caso
 * corriente) deja una ventana modal encima de la pantalla, con los dos botones
 * muertos, para siempre. La única salida sería recargar, y recargar pierde el
 * formulario del que venía la operación.
 *
 * El otro camino que espera este plazo —probar la llave— **no apaga
 * «Cancelar»**, a propósito: es la única salida cuando la llave es el único
 * método. Ahí lo que se atasca es terminar la ceremonia, no salir de ella.
 */
export const TIMEOUT_CONFIRMACION_MS = 20_000;
