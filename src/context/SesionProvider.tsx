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

export const SesionProvider = ({ children }: props) => {
  const [sesion, setSesion] = React.useState<SesionInterface>({ token: "", usuario: usuarioExample });
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
    // Fired and forgotten: the local cleanup below must happen whether this
    // succeeds or not, so nobody ends up stuck looking authenticated on a
    // screen that already sent them back to the login form.
    axios.post(`${urlApi}auth/logout`).catch(() => undefined);
    clearTimers();
    localStorage.removeItem("token");
    olvidarPermisos();
    setSesion({ token: "", usuario: usuarioExample });
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

  // Verificar token almacenado al iniciar (evita flicker al recargar)
  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (!stored) { setLoading(false); return; }

    comprobarToken(stored)
      .then((res) => {
        if (res.status === 200 && res.usuario) {
          setSesion({
            token: stored,
            usuario: res.usuario as UsuarioInterface,
            permisos: res.permisos,
          });
        } else {
          localStorage.removeItem("token");
        }
      })
      .catch(() => localStorage.removeItem("token"))
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
          localStorage.setItem("token", newToken);
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
            comprobarToken(newToken)
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
        if (error.response?.status === 401) {
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
