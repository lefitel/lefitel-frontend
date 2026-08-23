import axios from "axios";
import { urlApi } from "./url";
import { SesionInterface, UsuarioInterface } from "../interfaces/interfaces";
import type { Permisos } from "../lib/permissions";

export const loginUsuario = (
  data: UsuarioInterface
): Promise<{
  status: number;
  message: string | null;
  usuario: SesionInterface | null;
}> => {
  return axios
    .post(urlApi + "login", data)
    .then((response) => {
      return {
        status: response.status,
        message: null,
        usuario: {
          token: response.data.usuario.token,
          usuario: response.data.usuario,
          permisos: response.data.permisos,
        },
      };
    })
    .catch((e) => {
      return {
        status: 500,
        message: e.response?.data?.message ?? "No se pudo conectar con el servidor.",
        usuario: null,
      };
    });
};

/**
 * Who this token belongs to, and what they may do.
 *
 * The answer comes from the database rather than from the token's own payload:
 * a token lasts a week, and somebody moved to another role in the meantime would
 * otherwise keep the old one — and the old buttons with it — until it expired.
 *
 * No longer takes a token: the session cookie already authenticates this
 * request. Kept in the simplest shape that compiles rather than redesigned —
 * this whole bootstrap flow (and its two callers in `SesionProvider.tsx`) is
 * replaced wholesale in task 6.
 */
export const comprobarToken = (): Promise<{
  status: number;
  usuario: UsuarioInterface | null;
  permisos?: Permisos;
}> => {
  return axios
    .get(urlApi + "login")
    .then((response) => {
      return {
        status: response.status,
        usuario: response.data,
        permisos: response.data?.permisos as Permisos | undefined,
      };
    })
    .catch(() => ({
      status: 500,
      usuario: null,
    }));
};
