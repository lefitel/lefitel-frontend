import axios from "axios";
import { urlApi } from "./url";
import { mensajeDeError } from "./descarga";
import type { Accion, Modulo, Permisos } from "../lib/permissions";

export interface RolResumen {
  id: number;
  name: string;
  description: string | null;
}

export interface MatrizPermisos {
  roles: RolResumen[];
  /**
   * The vocabulary comes from the server so a new module appears here on its own.
   *
   * `acciones` per module is what the grid is drawn from; the flat list beside
   * it is the dictionary of labels, kept because dropping it would break any
   * bundle older than this deploy — and with `registerType: "prompt"` one can
   * sit in a tab for days.
   */
  modulos: { key: Modulo; label: string; acciones: Accion[] }[];
  acciones: { key: Accion; label: string }[];
  permisos: Record<number, Permisos>;
}

export const getMatrizPermisos = (): Promise<MatrizPermisos> =>
  axios
    .get(urlApi + "permiso")
    .then((r) => r.data as MatrizPermisos);

/**
 * 🔴 **`mensajeDeError` and not `e.response.data.message`, for the same reason
 * the wrappers in `Usuario.api.ts` do it — see the note above them.**
 *
 * This route is behind the step-up gate, so saving the matrix can open the
 * re-authentication dialog. Read straight from the body, cancelling that
 * dialog showed the gate's own "Introduce tu contraseña actual para completar
 * esta operación." on the permissions screen, one moment after the person
 * closed the box that was asking for it. `mensajeDeError` reads
 * `error.normalized`, which is where `http.ts` copies what the interceptor
 * knows.
 */
export const savePermisos = (
  id_rol: number,
  permisos: Partial<Record<Modulo, Partial<Record<Accion, boolean>>>>,
): Promise<{ status: number; message?: string }> =>
  axios
    .put(urlApi + "permiso/" + id_rol, { permisos })
    .then((r) => ({ status: r.status }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      message: mensajeDeError(e, "No se pudo guardar."),
    }));
