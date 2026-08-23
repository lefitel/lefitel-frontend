import axios from "axios";
import { urlApi } from "./url";
import { SesionInterface, UsuarioInterface } from "../interfaces/interfaces";
import type { Permisos } from "../lib/permissions";

/**
 * Log in. Posts to `POST /api/auth/login`, not the old `POST /api/login`.
 *
 * The two addresses answer identically today — the server mounted the old one
 * on the new handler rather than deleting it, so a browser running a cached
 * copy of this file can still get in. This asks for the address the design
 * keeps, which is what lets the other one be measured to zero and removed
 * without a second change in this repository.
 *
 * A non-2xx answer folds into `status: 500` with the server's own sentence in
 * `message`, whatever the real status was. That is deliberate and load-bearing
 * for one case: a 503 means the API could not open a session — the database is
 * down, not the password wrong — and `LoginPage.tsx` shows `message` on any
 * non-200, so the person reads "inténtelo de nuevo en unos minutos" rather
 * than being left to conclude they have forgotten their password. The
 * flattening to 500 is why `UsuarioDetallePage.tsx` can compare against one
 * number.
 */
export const loginUsuario = (
  data: UsuarioInterface
): Promise<{
  status: number;
  message: string | null;
  usuario: SesionInterface | null;
}> => {
  return axios
    .post(urlApi + "auth/login", data)
    .then((response) => {
      /**
       * Nothing puts a `token` in this body any more, and it is still stripped
       * here.
       *
       * That is belt on braces, not a description of the server: the old `POST
       * /api/login` signed a seven-day JWT into `usuario` and this line is what
       * kept it out of React state. The signing is gone — there is no
       * `jwt.sign` left in the API — so on every real response this destructure
       * removes nothing.
       *
       * It stays because it costs one line and it is the only thing standing
       * between a future response field and the session object the whole
       * application reads. The compiler cannot help here: `response.data` is
       * `any`, and a credential riding *inside* `usuario` is not an excess
       * property, so nothing but this would notice. The test beside it pins
       * both halves — that the strip still works, and that the address asked
       * for is the new one.
       */
      const { token: _jwt, ...usuario } = response.data.usuario;
      return {
        status: response.status,
        message: null,
        usuario: {
          usuario,
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
 * The response body also carries `expires_at`, and it is deliberately not
 * picked up here. The session's deadline arrives on the
 * `x-osefi-session-expires` header of every authenticated response — see
 * `SESSION_EXPIRES_HEADER` in `SesionProvider.tsx` — which is the only source
 * that keeps up as the session slides, since the server pushes a new value on
 * every answer instead of only on this one. Reading the body as well would put
 * the same fact in two places, and the one read once is the one that goes
 * stale: that is exactly the countdown that warned people five minutes before
 * a deadline the server had already moved by days. Leaving the field out of
 * this shape is what makes that unwriteable rather than merely discouraged —
 * there is nothing here for a future caller to pick up by mistake.
 */
export const comprobarToken = (): Promise<{
  status: number;
  usuario: UsuarioInterface | null;
  permisos?: Permisos;
}> => {
  return axios
    .get(`${urlApi}auth/me`)
    .then((response) => ({
      status: response.status,
      usuario: response.data.usuario as UsuarioInterface,
      permisos: response.data.permisos as Permisos | undefined,
    }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      usuario: null,
    }));
};
