import React, { useCallback, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { SesionInterface, UsuarioInterface } from "../interfaces/interfaces";
import { usuarioExample } from "../data/example";
import { comprobarToken } from "../api/Login.api";
import { url, urlApi } from "../api/url";
import { SesionContext } from "./SesionContext";
import { olvidarPermisos, setPermisos } from "../lib/permissions";

/** Lee el cuerpo del JWT sin verificar la firma. Solo para lo que ya es nuestro. */
const readToken = (token: string): { exp?: number; id_rol?: number } | null => {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
};

/** Decodifica el campo `exp` del JWT (en ms). No verifica firma. */
const getTokenExp = (token: string): number | null => {
  const exp = readToken(token)?.exp;
  return typeof exp === "number" ? exp * 1000 : null;
};

interface props {
  children: React.ReactNode;
}

/**
 * `logout()`'s own request. Read by both halves of the loop this exists to
 * break: `logout()` itself, and the response interceptor below that would
 * otherwise treat this request's own 401 as one more reason to call
 * `logout()` again.
 */
const LOGOUT_URL = `${urlApi}auth/logout`;

export const SesionProvider = ({ children }: props) => {
  const [sesion, setSesion] = React.useState<SesionInterface>({ token: "", usuario: usuarioExample, autenticado: false });
  const [loading, setLoading] = React.useState(true);
  const timers = useRef<{ warning: ReturnType<typeof setTimeout> | null; expiry: ReturnType<typeof setTimeout> | null }>({ warning: null, expiry: null });
  /**
   * The role the permissions on screen were fetched for.
   *
   * A ref because the interceptor is installed once and would otherwise close
   * over the role from the render that installed it — and comparing against a
   * stale role is the same as not comparing at all.
   */
  const roleRef = useRef<number | undefined>(undefined);
  /**
   * Whether there is currently a session for `logout` to end, kept in a ref
   * for the same reason `roleRef` is: `logout` is a stable callback with no
   * dependencies (the response interceptor's registration effect depends on
   * its identity, and re-registering it on every login would be its own
   * source of bugs), so it cannot close over `sesion.token` directly without
   * reading it stale.
   *
   * This is the cheap of the two guards against calling the server with
   * nothing to revoke — most commonly, `logout` running again after its own
   * request already cleared the session. It is not what actually stops that
   * case from looping: see `LOGOUT_URL`'s use in the interceptor below for
   * the guard that does, and does so even if something else calls `logout`
   * a second time before this ref catches up.
   */
  const hasSessionRef = useRef(false);
  useEffect(() => {
    hasSessionRef.current = Boolean(sesion.token);
  }, [sesion.token]);

  const clearTimers = () => {
    if (timers.current.warning) clearTimeout(timers.current.warning);
    if (timers.current.expiry) clearTimeout(timers.current.expiry);
  };

  const logout = useCallback(() => {
    // Revokes the session row and clears the cookie server-side. Before this
    // app sent credentials, dropping the token below was the whole session;
    // now the browser also holds an httpOnly cookie nothing on this page can
    // reach, so without this call "logging out" left it alive and sliding
    // for up to a week on a shared computer anyone could pick up next.
    //
    // Skipped when there is no session to begin with: a request that can
    // only answer 401 (see the interceptor below for the request this one
    // has to be told apart from) is not merely wasted, it is the other half
    // of the loop this whole guard exists to break.
    //
    // Fired and forgotten otherwise: the local cleanup below must happen
    // whether this succeeds or not, so nobody ends up stuck looking
    // authenticated on a screen that already sent them back to the login
    // form.
    if (hasSessionRef.current) {
      axios.post(LOGOUT_URL).catch(() => undefined);
    }
    clearTimers();
    // No `localStorage.removeItem` here any more — there is nothing left in
    // it to remove. `setSesion` below is what actually ends the session on
    // screen; it did that already, this call just used to also clear a key
    // that shared the job.
    olvidarPermisos();
    setSesion({ token: "", usuario: usuarioExample, autenticado: false });
  }, []);

  const scheduleExpiry = useCallback((token: string) => {
    clearTimers();
    const exp = getTokenExp(token);
    if (!exp) return;
    const now = Date.now();
    const msToExpiry = exp - now;
    const msToWarning = msToExpiry - 5 * 60 * 1000;

    if (msToWarning > 0) {
      timers.current.warning = setTimeout(() => {
        toast.warning("Tu sesión vence en 5 minutos. Guardá tu trabajo.", { duration: 10000 });
      }, msToWarning);
    }
    if (msToExpiry > 0) {
      timers.current.expiry = setTimeout(() => {
        toast.error("Tu sesión expiró. Por favor, volvé a iniciar sesión.");
        logout();
      }, msToExpiry);
    }
  }, [logout]);

  // Activar timers de expiración cada vez que el token cambia (login, sliding)
  useEffect(() => {
    if (sesion.token) scheduleExpiry(sesion.token);
  }, [sesion.token, scheduleExpiry]);

  /**
   * The role the permissions on screen were fetched for.
   *
   * In an effect rather than during render — writing a ref while rendering is
   * not allowed — and after the commit is soon enough: the interceptor only
   * refreshes when it has a role to compare against, so the one window this
   * leaves is the instant after a login, where the permissions are fresh
   * already.
   *
   * `setSesion` is handed to the login screen through the context, so there is
   * no single call site to hook; the state itself is what every writer passes
   * through.
   */
  useEffect(() => {
    roleRef.current = sesion.permisos ? sesion.usuario.id_rol : undefined;
  }, [sesion.permisos, sesion.usuario.id_rol]);

  // Preguntar al servidor si hay sesión, al arrancar (evita flicker al
  // recargar).
  //
  // Sin guardián de `localStorage`: la credencial es la cookie, y esta línea
  // no puede leerla — la única forma de saber si hay sesión es preguntar,
  // siempre, aunque no haya nada guardado en el navegador. Un guardián que
  // solo pregunta cuando `localStorage` tiene algo dejó de tener sentido en
  // cuanto el token dejó de ser la credencial: el día que el login deje de
  // devolver un JWT en el cuerpo, esa clave nunca se escribiría y todo el
  // mundo perdería la sesión al recargar, con la cookie todavía válida.
  //
  // `loading` cubre la llamada entera — se apaga en el `finally`, después de
  // que la respuesta llegó — para que las puertas de la Tarea 4 no decidan
  // nada con `autenticado` todavía en su valor inicial.
  //
  // Un 401 no es un error: es la respuesta a "¿tengo sesión?" cuando no la
  // hay. El estado inicial ya es anónimo, así que la rama que no es 200 no
  // tiene nada que hacer — ni un toast, ni nada que sugiera que algo se
  // rompió la primera vez que alguien abre el ERP en el día.
  //
  // El interceptor de más abajo también ve esta petición y, ante su 401,
  // llama a `logout()` como a cualquier otra — deliberadamente no está
  // excluido igual que `LOGOUT_URL`. Ver el comentario junto a esa exclusión
  // para el porqué.
  useEffect(() => {
    comprobarToken()
      .then((res) => {
        if (res.status === 200 && res.usuario) {
          setSesion({
            token: "",
            usuario: res.usuario,
            permisos: res.permisos,
            autenticado: true,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Interceptor de axios: renueva el token en cada respuesta (sliding) y auto-logout en 401
  useEffect(() => {
    /**
     * Only our own API may hand us a session token.
     *
     * The interceptor is global, so it sees every request the app makes —
     * including the image fetches the exporters perform against paths stored in
     * the database. A crafted `image` value such as ".attacker.tld/x.jpg"
     * concatenated onto the API host produces a request to a host the attacker
     * owns; if that host replies with an `x-new-token` header, an unconditional
     * interceptor would adopt the attacker's session as ours.
     */
    const isOurApi = (requestUrl: string | undefined): boolean => {
      if (!requestUrl) return false;
      try {
        return new URL(requestUrl, window.location.href).origin === new URL(url).origin;
      } catch {
        return false;
      }
    };

    const interceptor = axios.interceptors.response.use(
      (response) => {
        const newToken = response.headers["x-new-token"];
        if (newToken && isOurApi(response.config?.url)) {
          // No `localStorage.setItem` here any more — nothing reads that key
          // back. The in-memory session below is what the sliding-expiry
          // timers (task 7) actually use.
          setSesion((prev) => (prev.token ? { ...prev, token: newToken } : prev));

          /**
           * A role that changed mid-session used to stay invisible until the
           * page was reloaded.
           *
           * The server reads the role from the database on every request and
           * puts the fresh one into the token it hands back — that part was
           * already right — and the client adopted the new token while keeping
           * the permissions it was given at login. So somebody promoted kept
           * seeing the smaller application, and somebody demoted kept seeing
           * buttons whose only outcome was 403. The server was refusing
           * correctly the whole time; the screen was the part that lied.
           *
           * Only when the role actually changed, so the ordinary case — a token
           * renewed on every single response — costs nothing.
           */
          const fresh = readToken(newToken)?.id_rol;
          const known = roleRef.current;
          if (typeof fresh === "number" && known !== undefined && fresh !== known) {
            roleRef.current = fresh;
            comprobarToken()
              .then((res) => {
                if (res.status === 200 && res.usuario) {
                  setSesion((prev) =>
                    prev.token
                      ? {
                          ...prev,
                          usuario: res.usuario as UsuarioInterface,
                          permisos: res.permisos,
                        }
                      : prev,
                  );
                  toast.info("Sus permisos cambiaron. La pantalla se actualizó.");
                }
              })
              .catch(() => {
                // Left as it was: a failed refresh must not end a working
                // session, and the server is the one enforcing the change.
              });
          }
        }
        return response;
      },
      (error) => {
        // 401 means "not authenticated" and ends the session. 403 means
        // "authenticated but not allowed here", which is an ordinary answer to
        // an ordinary request: logging out on it threw users to the login
        // screen, losing unsaved work, merely for opening someone else's report.
        //
        // Excluding LOGOUT_URL is the guard that actually stops the loop, not
        // just makes it rarer: this interceptor is global and unconditional,
        // so a session that is already dead makes *any* request 401,
        // including the one `logout()` itself just sent. Without this check,
        // that response would call `logout()` again, which would call the
        // server again, which would 401 again — self-sustaining, and the
        // most ordinary way to reach it is simply a session that expired on
        // its own. This is the barrier that holds even if something else
        // calls `logout()` from elsewhere in the future; `hasSessionRef`
        // above only makes the ordinary, non-looping case cheaper.
        //
        // `comprobarToken()`'s own request (`GET /auth/me`, asked at startup
        // and again below on a role change) is deliberately NOT excluded the
        // way `LOGOUT_URL` is. A 401 on it can only ever lead to `logout()`,
        // whose own request goes to `LOGOUT_URL` — already excluded — so the
        // chain stops one level down regardless of whether this one is
        // excluded too. Excluding it would only skip the harmless, no-network
        // cleanup `logout()` runs on an ordinary anonymous boot (`hasSessionRef`
        // is still `false` then, so the cheap guard in `logout()` already
        // keeps it off the network); and the same call is also made mid-session
        // by the role-change refresh below, where a 401 genuinely means the
        // session just died — an event `logout()` is the correct answer to,
        // not one to hide from.
        if (error.response?.status === 401 && error.config?.url !== LOGOUT_URL) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [logout]);

  // Mirrored during render, not in an effect.
  //
  // `can()` is a plain function reading a module-level value, because it is
  // called from inside render expressions in 57 places. An effect runs *after*
  // the children have rendered, so the first paint of every screen would ask the
  // question before the answer had arrived and draw an empty application. Doing
  // it here means React has updated the mirror before it renders anything below.
  // It is a pure function of state and running it twice changes nothing.
  if (sesion.permisos) setPermisos(sesion.usuario.id_rol, sesion.permisos);

  return (
    <SesionContext.Provider value={{ sesion, setSesion, loading, logout }}>
      {children}
    </SesionContext.Provider>
  );
};
