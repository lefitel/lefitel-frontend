// What a failed request carries by the time a screen sees it.
//
// A module with no side effects on purpose. The normalizer that fills this in
// lives in `http.ts`, which also installs the interceptors and configures the
// axios singleton the moment it is imported; `descarga.ts` reads it, and
// `descarga.ts` is imported by a dozen screens, so putting the reader in
// `http.ts` would install the second-factor interceptor inside every component
// test that happens to render one of them.

/**
 * The two things every failure has, whatever went wrong.
 *
 * `status` is the server's, or **0** when there was no answer at all — a dead
 * network, DNS, the server not running. Zero was already the house convention
 * for that: `Rol.api.ts` and `Revision.api.ts` each wrote it by hand, in their
 * own `.catch`, with their own shape. Both of those went in the same change
 * that added this file — which is the point, one shape where there were
 * three.
 */
export interface FalloNormalizado {
  /** The HTTP status, or 0 when the request never got an answer. */
  status: number;
  /**
   * The server's own sentence, or the one for a request that never arrived.
   *
   * **Empty when the server answered and said nothing usable**, and that is a
   * decision rather than an omission: a screen knows what it was doing and its
   * own fallback ("No se pudo archivar la ciudad") is better than anything this
   * layer could invent. An empty string is how `mensajeDeError` knows to let
   * the screen's words through.
   */
  message: string;
}

interface ConNormalizado {
  normalized?: FalloNormalizado;
}

/** What the normalizer attached to this rejection, if it went through it. */
export const normalizado = (error: unknown): FalloNormalizado | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const fallo = (error as ConNormalizado).normalized;
  if (!fallo || typeof fallo !== "object") return undefined;
  return typeof fallo.status === "number" && typeof fallo.message === "string" ? fallo : undefined;
};

/** Attach one. Only `http.ts` calls this. */
export const marcarFallo = (error: unknown, fallo: FalloNormalizado): void => {
  if (error && typeof error === "object") (error as ConNormalizado).normalized = fallo;
};

/** What a request that never reached the server says. */
export const SIN_CONEXION = "Sin conexión con el servidor";

interface ConExplicacion {
  explicacion?: string;
}

/**
 * La frase de un interceptor que sabe **por qué** falló algo, cuando el cuerpo
 * de la respuesta no lo dice.
 *
 * El caso que la trajo: la ventana del segundo factor. Su interceptor devuelve
 * el rechazo original tal cual, así que quien cancelaba al crear un rol leía
 * «No se pudo crear el rol» — la frase que la pantalla pone cuando no sabe nada
 * de por qué falló. El interceptor es el único que sabe por cuál de sus salidas
 * se fue; la pantalla sólo sabe qué estaba intentando hacer.
 *
 * 🔴 **Va aparte de `normalized`, y no por gusto.** El normalizador de `http.ts`
 * se registra después del interceptor del segundo factor, o sea que corre
 * después de él, y `marcarFallo` **sustituye** `error.normalized` entero: una
 * frase escrita ahí antes se borraría sin que nada avisara. Esto es una
 * propiedad distinta, que `marcarFallo` no toca, y el normalizador la copia al
 * `message` a propósito — que es donde `mensajeDeError` ya mira.
 *
 * 🔴 **Lo hereda quien saca sus fallos por `mensajeDeError`, y sólo ése.**
 * Quedan `.catch` en esta carpeta que se fabrican el mensaje leyendo
 * `e.response?.data?.message`, y no pasa nada mientras su ruta no esté detrás
 * de la puerta del segundo factor: sin ventana que cancelar, el cuerpo del
 * servidor es lo único que hay que contar. **La regla no es «todos», es «el
 * que pueda encontrarse el diálogo delante»**, y no la escribo como una lista
 * porque una lista de otros ficheros caduca sola.
 *
 * El modo de fallar al que se vuelve, escrito porque es exactamente lo que
 * este campo existe para evitar: cancelar la ventana dejaba en pantalla lo que
 * la puerta había pedido — el texto reclamando la contraseña, justo después
 * de cerrar el diálogo que la pedía.
 *
 * Así que un `.catch` nuevo sobre una ruta con puerta se salta esto sin que
 * nada se ponga rojo por sí solo. Lo que lo sujeta es
 * `statusPropagation.test.ts`, que recorre los cinco por la cadena real.
 */
export const marcarExplicacion = (error: unknown, frase: string): void => {
  if (error && typeof error === "object") (error as ConExplicacion).explicacion = frase;
};

/** La frase que un interceptor dejó escrita sobre este rechazo, si la hay. */
export const explicacionDe = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const frase = (error as ConExplicacion).explicacion;
  return typeof frase === "string" && frase.trim() !== "" ? frase : undefined;
};
