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
