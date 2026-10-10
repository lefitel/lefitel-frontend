import { can, type Modulo } from "../lib/permissions";
import type { BitacoraInterface } from "../interfaces/interfaces";

/**
 * What a row of the audit log is called, and where its entity can be opened.
 *
 * **The names are not here.** This file was a table translating each stored
 * code to Spanish, written by hand, and it fell 58 codes behind the server:
 * `STEP_UP_DENIED` reached the screen in capitals. Two more screens kept tables
 * of their own. The server sends the name with every row now
 * (`action_label`, `entity_label`, from `api/src/utils/bitacoraVocabulary.ts`),
 * where the compiler can refuse a code that has none.
 *
 * What stays here is what only this application knows: its own addresses.
 */

type Fila = Pick<BitacoraInterface, "action" | "entity" | "entity_id" | "id_usuario" | "action_label" | "entity_label">;

/**
 * The stored code is the fallback, for a server that predates the labels: a
 * row is shown raw rather than blank.
 */
export const nombreDeAccion = (fila: Pick<Fila, "action" | "action_label">): string =>
  fila.action_label || fila.action;

export const nombreDeEntidad = (fila: Pick<Fila, "entity" | "entity_label">): string =>
  fila.entity_label || fila.entity;

/** The tab of the Parámetros screen each catalogue lives in. */
export const PARAMETRO_TAB = {
  Material: "material",
  Propietario: "propietario",
  Adss: "adss",
  TipoObs: "tipoobs",
  Obs: "obs",
} as const;

export interface DestinoDeEntidad {
  /** The module whose `ver` the address asks for — the one `ModuleRoute` checks. */
  modulo: Modulo;
  path: string;
}

/**
 * Where an entity can be opened, if anywhere.
 *
 * One table for every screen that lists audit rows. There were three — the
 * Bitácora, the history panel on the sheets and the user sheet — and two of
 * them pointed at `/eventos/7`, an address that does not exist: everything
 * lives under `/app`, so the catch-all route answered with the home page.
 *
 * A session, a key or an authenticator has no screen of its own, and the id
 * stored with it is the factor's, not the person's: no destination, rather
 * than a link to the wrong account.
 */
export const destinoDeEntidad = (entity: string, id: number | null | undefined): DestinoDeEntidad | null => {
  switch (entity) {
    case "Poste":   return id ? { modulo: "postes",    path: `/app/postes/${id}` } : null;
    case "Ciudad":  return id ? { modulo: "ciudades",  path: `/app/ciudades/${id}` } : null;
    case "Usuario": return id ? { modulo: "seguridad", path: `/app/usuarios/${id}` } : null;
    // A revision and a solution are written with the id of their incident.
    case "Evento":
    case "Revisión":
    case "Solución": return id ? { modulo: "eventos", path: `/app/eventos/${id}` } : null;
    case "Rol":
      return { modulo: "roles", path: id ? `/app/roles?rol=${id}` : "/app/roles" };
    case "Material":
    case "Propietario":
    case "Adss":
    case "TipoObs":
    case "Obs": {
      const tab = PARAMETRO_TAB[entity];
      return { modulo: "parametros", path: `/app/parametros?tab=${tab}${id ? `&id=${id}` : ""}` };
    }
    case "ReporteVista":
      return { modulo: "generador", path: id ? `/app/generador?vista=${id}` : "/app/generador" };
    case "File":
      return { modulo: "archivos", path: "/app/archivos" };
    default:
      return null;
  }
};

/**
 * Whether a row about a saved report may link to that report itself.
 *
 * A saved report is private to its author unless shared, and the server writes
 * `READ_REPORTE_DENIED` against whoever asks for somebody else's. A row cannot
 * tell which it is — but it does say who wrote it. So the report is linked only
 * from a row the reader wrote, about something that was not a refusal and not
 * an archiving; every other row links to the Generador itself.
 *
 * Without this, reading the log was itself what the log records as an attempt:
 * an administrator pressing «Vista de informe #12» on a colleague's row was
 * written down as trying to open a private report — and that new row was a
 * link that wrote another.
 */
const abreSuPropioInforme = (viewerId: number | null | undefined, fila: Fila): boolean =>
  fila.id_usuario === viewerId && !fila.action.endsWith("_DENIED") && !fila.action.startsWith("DELETE_");

/**
 * The address a row's entity opens, only when this person may open it.
 *
 * The link used to be drawn for anyone: a role with `bitacora` and without
 * `postes` saw «Poste #12» in blue, pressed it, and `ModuleRoute` put them on
 * some other screen without a word. Nobody got in — the route and the server
 * both refuse — but a link that lands somewhere else is worse than plain text.
 */
export const enlaceDeFila = (viewer: { id?: number | null; id_rol: number }, fila: Fila): string | null => {
  if (!fila.entity) return null;
  const id = fila.entity === "ReporteVista" && !abreSuPropioInforme(viewer.id, fila) ? null : fila.entity_id;
  const destino = destinoDeEntidad(fila.entity, id);
  return destino && can(viewer.id_rol, destino.modulo, "ver") ? destino.path : null;
};
