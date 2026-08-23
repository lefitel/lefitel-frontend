import axios from "axios";
import { urlApi } from "./url";
import type { Accion, Modulo, Permisos } from "../lib/permissions";

export interface RolResumen {
  id: number;
  name: string;
  description: string | null;
}

export interface MatrizPermisos {
  roles: RolResumen[];
  /** The vocabulary comes from the server so a new module appears here on its own. */
  modulos: { key: Modulo; label: string }[];
  acciones: { key: Accion; label: string }[];
  permisos: Record<number, Permisos>;
}

export const getMatrizPermisos = (): Promise<MatrizPermisos> =>
  axios
    .get(urlApi + "permisos")
    .then((r) => r.data as MatrizPermisos);

export const savePermisos = (
  id_rol: number,
  permisos: Partial<Record<Modulo, Partial<Record<Accion, boolean>>>>,
): Promise<{ status: number; message?: string }> =>
  axios
    .put(urlApi + "permisos/" + id_rol, { permisos })
    .then((r) => ({ status: r.status }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      message: e.response?.data?.message ?? "No se pudo guardar.",
    }));
