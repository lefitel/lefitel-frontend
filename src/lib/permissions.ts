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

export const ROLES = {
  ADMIN: 1,
  EDITOR: 2,
  VIEWER: 3,
} as const;

export const MODULOS = [
  "postes",
  "eventos",
  "ciudades",
  "parametros",
  "reportes",
  "generador",
  "seguridad",
  "roles",
  "archivos",
  "bitacora",
] as const;

export const ACCIONES = ["ver", "crear", "editar", "archivar"] as const;

export type Modulo = (typeof MODULOS)[number];
export type Accion = (typeof ACCIONES)[number];
export type Permisos = Record<Modulo, Record<Accion, boolean>>;

/** Every cell denied. What an unknown role, or no session, is allowed. */
export const sinPermisos = (): Permisos => {
  const out = {} as Permisos;
  for (const modulo of MODULOS) {
    out[modulo] = {} as Record<Accion, boolean>;
    for (const accion of ACCIONES) out[modulo][accion] = false;
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
