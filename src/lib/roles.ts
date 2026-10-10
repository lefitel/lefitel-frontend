import type { RolInterface } from "../interfaces/interfaces";
import type { Accion, Modulo } from "./permissions";

/** What to call a role, including the one that was saved without a name. */
export const nombreDeRol = (rol: Pick<RolInterface, "id" | "name">): string =>
  rol.name?.trim() || `Rol sin nombre (#${rol.id})`;

/** The cells somebody has changed and not yet saved, by `modulo.accion`. */
export type PermisosPendientes = Record<string, boolean>;

export const clavePermiso = (modulo: Modulo, accion: Accion): string => `${modulo}.${accion}`;

/**
 * The changed cells in the shape the server takes them: only what moved,
 * grouped by module. A cell ticked back to where it started is not in
 * `pending` at all, so it is not in here either.
 */
export function cambiosDePermisos(
  pending: PermisosPendientes,
): Partial<Record<Modulo, Partial<Record<Accion, boolean>>>> {
  const payload: Partial<Record<Modulo, Partial<Record<Accion, boolean>>>> = {};
  for (const [k, value] of Object.entries(pending)) {
    const [modulo, accion] = k.split(".") as [Modulo, Accion];
    (payload[modulo] ??= {})[accion] = value;
  }
  return payload;
}

/**
 * The matrix as it stands once these changes are saved for this role.
 *
 * For the moment the server has said yes: what was pending is now what is
 * stored, and the screen can show that without asking again. A new object all
 * the way down to the role that changed, so nothing that still holds the old
 * matrix sees it move.
 */
export function conPermisosAplicados<M extends { permisos: Record<number, Partial<Record<Modulo, Partial<Record<Accion, boolean>>>>> }>(
  matriz: M,
  rolId: number,
  pending: PermisosPendientes,
): M {
  const delRol = { ...(matriz.permisos[rolId] ?? {}) };
  for (const [modulo, acciones] of Object.entries(cambiosDePermisos(pending)) as [Modulo, Partial<Record<Accion, boolean>>][]) {
    delRol[modulo] = { ...(delRol[modulo] ?? {}), ...acciones };
  }
  return { ...matriz, permisos: { ...matriz.permisos, [rolId]: delRol } };
}

/** What a role may do, boiled down to what fits on one row of a list. */
export interface ResumenDePermisos {
  /** The modules it can open at all — the ones it may `ver` — by their label. */
  modulos: string[];
  /** How many boxes it has ticked, */
  concedidos: number;
  /** out of how many there are. */
  total: number;
}

/**
 * The row of the matrix that belongs to one role, counted.
 *
 * Only the boxes a module really has are counted, on both sides: a module that
 * cannot be archived has no such box, so it is neither a permission the role
 * lacks nor one it could be given.
 */
export function resumenDePermisos(
  matriz: {
    modulos: { key: Modulo; label: string; acciones?: Accion[] }[];
    acciones: { key: Accion }[];
    permisos: Record<number, Partial<Record<Modulo, Partial<Record<Accion, boolean>>>>>;
  },
  rolId: number,
): ResumenDePermisos {
  const delRol = matriz.permisos[rolId] ?? {};
  const resumen: ResumenDePermisos = { modulos: [], concedidos: 0, total: 0 };
  for (const modulo of matriz.modulos) {
    // An API that predates the per-module list sends none; then every action
    // counts, which is what it meant.
    const acciones = modulo.acciones ?? matriz.acciones.map((a) => a.key);
    resumen.total += acciones.length;
    resumen.concedidos += acciones.filter((accion) => delRol[modulo.key]?.[accion]).length;
    if (delRol[modulo.key]?.ver) resumen.modulos.push(modulo.label);
  }
  return resumen;
}
