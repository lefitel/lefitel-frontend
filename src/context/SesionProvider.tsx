import React, { useCallback, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { SesionInterface, UsuarioInterface } from "../interfaces/interfaces";
import { usuarioExample } from "../data/example";
import { comprobarToken } from "../api/Login.api";
import { url } from "../api/url";
import { SesionContext } from "./SesionContext";

/** Decodifica el campo `exp` del JWT (en ms). No verifica firma. */
const getTokenExp = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000;
  } catch {
    return null;
  }
};

interface props {
  children: React.ReactNode;
}

export const SesionProvider = ({ children }: props) => {
  const [sesion, setSesion] = React.useState<SesionInterface>({ token: "", usuario: usuarioExample });
  const [loading, setLoading] = React.useState(true);
  const timers = useRef<{ warning: ReturnType<typeof setTimeout> | null; expiry: ReturnType<typeof setTimeout> | null }>({ warning: null, expiry: null });

  const clearTimers = () => {
    if (timers.current.warning) clearTimeout(timers.current.warning);
    if (timers.current.expiry) clearTimeout(timers.current.expiry);
  };

  const logout = useCallback(() => {
    clearTimers();
    localStorage.removeItem("token");
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

  // Verificar token almacenado al iniciar (evita flicker al recargar)
  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (!stored) { setLoading(false); return; }

    comprobarToken(stored)
      .then((res) => {
        if (res.status === 200 && res.usuario) {
          setSesion({ token: stored, usuario: res.usuario as UsuarioInterface });
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

  return (
    <SesionContext.Provider value={{ sesion, setSesion, loading, logout }}>
      {children}
    </SesionContext.Provider>
  );
};
