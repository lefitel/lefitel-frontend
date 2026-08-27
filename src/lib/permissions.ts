/**
 * What the person looking at this screen may do.
 *
 * This file used to *be* the permission matrix: a constant listing, for each of
 * three hardcoded roles, which modules and actions it held. Two problems with
 * that. It ran in the browser, so it decided which buttons to draw and nothing
 * more — the server never asked, and every write endpoint was open to any
 * account with a session. And it could not know about a role created from the
 * Seguridad screen, so a fourth role could do nothing and there was nowhere to
 * change that.
 *
 * The matrix now lives in the database and the server enforces it. What arrives
 * here is the answer for the current session, handed over at login and refreshed
 * whenever the session is checked. This file is the place it is kept and the
 * question is asked; it no longer holds an opinion of its own.
 */

// There was a `ROLES = { ADMIN: 1, EDITOR: 2, VIEWER: 3 }` here, exported and
// imported by nobody. It was the last piece of the hardcoded matrix described
// above: three role ids written down in the one file whose own header explains
// that roles are database rows and can be created from the Seguridad screen.
// Removed rather than left for a reader to trust — a name that promises the
// roles are these three is worse than no name, and a fourth role has been
// creatable for as long as that constant sat here saying otherwise.

/**
 * The mirror of the server's `PERMISSIONS`, module by module.
 *
 * Every module used to carry all four verbs whether it used them or not, which
 * left eight cells nothing ever asked about — and, worse, meant a permission
 * that is not one of those four verbs had nowhere to live at all. This is the
 * client half of ending that; the binding half is the server's.
 *
 * Kept in step by hand, like the labels above it. `getMatrizPermisos` sends the
 * real list with every response, so the Seguridad screen never reads this
 * constant — it is here for `sinPermisos()` and for the types.
 */
/**
 * Every action name that exists anywhere — the vocabulary, not the grid.
 *
 * Declared before `PERMISOS` so the `satisfies` below can refuse a module that
 * declares an action this list does not have. Without that tie the constant
 * accepts any string, which on the server side meant a permission that gets
 * honoured, cannot be revoked from the screen, and is never drawn.
 */
export const ACCIONES = ["ver", "crear", "editar", "archivar"] as const;

export const PERMISOS = {
  postes: ["ver", "crear", "editar", "archivar"],
  eventos: ["ver", "crear", "editar", "archivar"],
  ciudades: ["ver", "crear", "editar", "archivar"],
  parametros: ["ver", "crear", "editar", "archivar"],
  reportes: ["ver"],
  generador: ["ver", "crear", "editar", "archivar"],
  seguridad: ["ver", "crear", "editar", "archivar"],
  roles: ["ver", "crear", "editar", "archivar"],
  archivos: ["ver", "archivar"],
  bitacora: ["ver"],
} as const satisfies Record<string, readonly (typeof ACCIONES)[number][]>;

export const MODULOS = Object.keys(PERMISOS) as readonly Modulo[];

export type Modulo = keyof typeof PERMISOS;
export type Accion = (typeof ACCIONES)[number];

/**
 * `Partial` because a module only carries its own actions now, and the type has
 * to say so rather than promise a boolean in every cell. Nothing downstream
 * needs changing for it: `can()` below ends in `?? false`, so a hole reads as a
 * denial exactly like an absent module already did.
 */
export type Permisos = Record<Modulo, Partial<Record<Accion, boolean>>>;

/** The actions this module has. */
export const accionesDe = (modulo: Modulo): readonly Accion[] =>
  PERMISOS[modulo] as readonly Accion[];

/** Every cell denied. What an unknown role, or no session, is allowed. */
export const sinPermisos = (): Permisos => {
  const out = {} as Permisos;
  for (const modulo of MODULOS) {
    out[modulo] = {} as Partial<Record<Accion, boolean>>;
    for (const accion of accionesDe(modulo)) out[modulo][accion] = false;
  }
  return out;
};

/**
 * The current session's permissions, by role.
 *
 * Module-level rather than a hook because `can()` is called from 57 places, most
 * of them inside render expressions and a few outside React entirely. A browser
 * tab has exactly one session, so one place to keep it is honest — and the
 * session provider is the only writer.
 */
let vigentes: Record<number, Permisos> = {};

/** Called by the session provider whenever the server tells us what we may do. */
export const setPermisos = (rol: number, permisos: Permisos): void => {
  vigentes = { [rol]: permisos };
};

/** Called on logout, so the next session cannot inherit the last one's answers. */
export const olvidarPermisos = (): void => {
  vigentes = {};
};

/**
 * May this role do this?
 *
 * Anything unknown is a no — a role we hold nothing for, a module the server did
 * not send. The window between opening the app and the server answering is the
 * one that matters: during it every question answers "no", which shows an empty
 * interface for a moment rather than one the person cannot actually use.
 */
export const can = (rol: number, modulo: Modulo, accion: Accion): boolean =>
  vigentes[rol]?.[modulo]?.[accion] ?? false;
