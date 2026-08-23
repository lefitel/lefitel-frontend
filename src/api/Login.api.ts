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
          // Left false on purpose: this wrapper only shuttles what the server
          // sent back, it does not decide session semantics. LoginPage.tsx is
          // the single place that turns "the request succeeded" into
          // "authenticated" — see the comment at its call site.
          autenticado: false,
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
 * Who is logged in right now, according to the server.
 *
 * Calls `GET /api/auth/me` rather than the old `GET /api/login`: the answer
 * comes from the database and not from a token's own payload, because a token
 * lasts a week and somebody moved to another role in the meantime would
 * otherwise keep the old one — and the old buttons with it — until it expired.
 *
 * No longer takes a token: the session cookie already authenticates this
 * request, and the cookie is invisible to this code, which is the whole
 * reason both callers in `SesionProvider.tsx` ask instead of checking
 * anything client-side first.
 *
 * A non-200 answer (401 with no session, or a real network/server failure)
 * folds into the same shape here — `usuario: null` — rather than throwing:
 * neither caller treats "no session" as an error, so there is nothing for a
 * `.catch()` at the call site to do that this one has not already done.
 * `status` still tells the two apart for whoever wants to (nothing does today).
 *
 * `expires_at` rides along unused by both of today's callers — task 7's
 * expiry timers read it off this same call, and this is the only place that
 * shape is built.
 */
export const comprobarToken = (): Promise<{
  status: number;
  usuario: UsuarioInterface | null;
  permisos?: Permisos;
  expires_at: string | null;
}> => {
  return axios
    .get(`${urlApi}auth/me`)
    .then((response) => ({
      status: response.status,
      usuario: response.data.usuario as UsuarioInterface,
      permisos: response.data.permisos as Permisos | undefined,
      expires_at: (response.data.expires_at as string | null) ?? null,
    }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      usuario: null,
      expires_at: null,
    }));
};
