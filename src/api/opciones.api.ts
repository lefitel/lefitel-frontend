// The dropdown lists each form needs, one request per form.
//
// Three endpoints, mirroring `api/src/controllers/opciones.controller.ts`, and
// this file is deliberately a module of its own rather than three functions
// added to `Poste.api.ts` and `Evento.api.ts`:
//
//   - The server keeps all three handlers in one file because their blocks
//     overlap and their projections do not. The client reads them the same way.
//   - And **`vi.mock` with a factory replaces a module whole.**
//     `pages/menu/evento/index.test.tsx` mocks `Evento.api` by listing six
//     exports; anything not on that list arrives as `undefined`. Adding
//     `getOpcionesEvento` there would hand `EventoSheet` an undefined function
//     — a loud `TypeError` out of the effect, not a quiet one: the call throws
//     synchronously, before any promise exists, so the sheet's own `.catch`
//     never sees it. Survivable, then, but it makes one screen's test file
//     responsible for another screen's imports, which is not a relationship
//     worth having.
//
// **The types here are narrower than `interfaces.ts` on purpose, and that is the
// whole point of the file.** `AdssInterface`, `MaterialInterface`,
// `TipoObsInterface` and `ObsInterface` all declare `description: string` as
// required, and `CiudadInterface` declares `image: string` — none of which the
// projections carry. Typing these responses with the shared interfaces would
// either not compile or, with a cast, promise a `string` that is `undefined` at
// runtime. So the shape a caller gets is the shape the wire really carries, and
// the compiler is the one that notices when a screen wants more than that.

import axios from "axios";
import { urlApi, urlEvento, urlPoste, urlReporte } from "./url";

/** A dropdown entry: what every list here has, and all that most of them need. */
export interface OpcionSimple {
  id: number;
  name: string;
}

/**
 * A city the caller is going to draw.
 *
 * `lat`/`lng` are `allowNull: false` on the model and always projected, so this
 * cannot arrive half-filled. They matter more than they look: `PosteSheet`
 * guards its map with `if (!a?.lat …) return` and `ReportRecorrido` wraps its
 * whole route calculation in `if (a?.lat && a?.lng …)`. Lose the two columns and
 * both screens render with no error at all and nothing drawn.
 */
export interface OpcionCiudad extends OpcionSimple {
  lat: number;
  lng: number;
}

/**
 * An observation the caller is going to group by type.
 *
 * Only `/api/evento/opciones` serves this shape. The `obs` block of
 * `/api/reporte/opciones` is a plain `OpcionSimple` — no report groups
 * observations by type, and the two are typed apart here so that a screen which
 * starts doing so fails to compile instead of rendering empty groups that read
 * as "no observations configured".
 */
export interface OpcionObs extends OpcionSimple {
  id_tipoObs: number;
}

/** The two cities a stretch of line runs between. Not a row: a pair. */
export interface TramoPair {
  id_ciudadA: number;
  id_ciudadB: number;
}

export interface OpcionesPoste {
  adss: OpcionSimple[];
  material: OpcionSimple[];
  propietario: OpcionSimple[];
  ciudad: OpcionCiudad[];
}

export interface OpcionesEvento {
  obs: OpcionObs[];
  tipoObs: OpcionSimple[];
}

export interface OpcionesReporte {
  ciudad: OpcionCiudad[];
  adss: OpcionSimple[];
  material: OpcionSimple[];
  propietario: OpcionSimple[];
  obs: OpcionSimple[];
  tramos: TramoPair[];
}

/**
 * The pole form's four lists, under `postes.ver`.
 *
 * Replaces `getAdss()`, `getCiudad()`, `getMaterial()` and `getPropietario()`.
 * None of those four carried a permission, so a role holding `postes.editar`
 * without `postes.ver` used to fill this form and now gets a 403 — see the
 * comment where each caller handles it.
 */
export const getOpcionesPoste = (): Promise<OpcionesPoste> =>
  axios.get(urlApi + urlPoste + "opciones").then((r) => r.data as OpcionesPoste);

/** Both incident forms' two lists, under `eventos.ver`. */
export const getOpcionesEvento = (): Promise<OpcionesEvento> =>
  axios.get(urlApi + urlEvento + "opciones").then((r) => r.data as OpcionesEvento);

/** The three report screens' six lists, under `reportes.ver`. */
export const getOpcionesReporte = (): Promise<OpcionesReporte> =>
  axios.get(urlApi + urlReporte + "opciones").then((r) => r.data as OpcionesReporte);

/**
 * Whether a rejection was the server refusing this role the permission, rather
 * than anything else.
 *
 * §5.5 of the standard: an options endpoint may answer 403 — the role does not
 * hold the permission that screen's forms need — but it never returns a block
 * half-filled. That answer is permanent, and retrying it is pointless; every
 * other failure is worth another go. Every screen that used to fill these lists
 * showed the same "Error al cargar…" for both, and two of them showed nothing
 * at all.
 *
 * **Not every 403 is that one, and the difference is `code`.** `authenticate`
 * answers 403 with `code: FACTOR_PENDIENTE` to an account whose grace period
 * for setting up a second factor has run out, and `requireStepUp` answers 403
 * with `code: STEP_UP_REQUIRED`. The step-up interceptor shows its own message
 * and re-rejects, so the error arrives here intact — and calling it a missing
 * permission would put a second, contradictory and false sentence on the screen
 * beside the true one. `code` appears in exactly those responses and in no
 * other 403 in the server, which is what makes the test exact rather than a
 * guess. `BitacoraPanel` predates this and has the same gap; it is C2's to fix
 * only here.
 */
export const opcionesDenegadas = (error: unknown): boolean => {
  const respuesta = (error as {
    response?: { status?: number; data?: { code?: unknown } };
  })?.response;
  return respuesta?.status === 403 && respuesta?.data?.code === undefined;
};

/**
 * Where a screen's option lists are, which is four states and not two.
 *
 * The one this replaces was a nullable "what went wrong", and `null` meant both
 * *in flight* and *arrived*. That is not a nuance: on the Por Tramo report it
 * left the whole loading window open, with Generar enabled and the export it
 * leads to buildable from four empty lists. And on the pole list it printed
 * "Cargando…" for ever whenever a catalogue was legitimately empty.
 */
export type EstadoOpciones = "cargando" | "listas" | "denegado" | "fallo";

/** `"denegado"` or `"fallo"`, from whatever the request rejected with. */
export const estadoTrasFallo = (error: unknown): EstadoOpciones =>
  opcionesDenegadas(error) ? "denegado" : "fallo";
