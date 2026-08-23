import React, { useCallback, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { SesionInterface, UsuarioInterface } from "../interfaces/interfaces";
import { usuarioExample } from "../data/example";
import { comprobarToken } from "../api/Login.api";
import { url, urlApi } from "../api/url";
import { SesionContext } from "./SesionContext";
import { olvidarPermisos, setPermisos } from "../lib/permissions";

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

/**
 * The header the server puts on every authenticated response, carrying the
 * caller's role as the database has it at that moment.
 *
 * This is what replaced `x-new-token`. The server used to re-sign a JWT on
 * every single response for one reason only — so this file could decode
 * `id_rol` out of it and notice a role change. It stopped re-signing, so that
 * header stopped arriving, so role changes stopped being noticed at all: a
 * promoted user kept seeing the smaller application and a demoted one kept
 * seeing buttons whose only outcome was 403, until they happened to reload.
 * The bare role id is the whole signal that was ever needed here — nothing is
 * authorised by it, and the refresh it triggers asks the server for the
 * actual answer. See `ROLE_HEADER` in `api/src/config/security.ts` for the
 * server's half of the same reasoning.
 *
 * A name and not a shared constant, deliberately: it is a wire format between
 * two repositories deployed separately, exactly like the path in `LOGOUT_URL`.
 */
const ROLE_HEADER = "x-osefi-role";

/** How long before the session dies the warning goes up. */
const WARNING_LEAD_MS = 5 * 60 * 1000;

export const SesionProvider = ({ children }: props) => {
  const [sesion, setSesion] = React.useState<SesionInterface>({ usuario: usuarioExample, autenticado: false });
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
   * source of bugs), so it cannot close over `sesion.autenticado` directly
   * without reading it stale.
   *
   * Derived from `autenticado`, and there is no longer a `sesion.token` to be
   * tempted by: a session restored at startup from `GET /auth/me` has no JWT
   * to hold — only the cookie, which this code cannot read. A ref built from
   * `Boolean(sesion.token)` used to read `false` for the entire life of any
   * session recovered by reloading the page, and `logout()` below then
   * skipped telling the server for as long as that session lasted: the screen
   * went to `/login` while the session row stayed open and the cookie stayed
   * valid in the browser — reachable again on the next reload, and on a
   * shared computer, by the next person who sits down. That is the regression
   * `846e3ae` already fixed once.
   *
   * This is the cheap of the two guards against calling the server with
   * nothing to revoke — most commonly, `logout` running again after its own
   * request already cleared the session. It is not what actually stops that
   * case from looping: see `LOGOUT_URL`'s use in the interceptor below for
   * the guard that does, and does so even if something else calls `logout`
   * a second time before this ref catches up.
   *
   * The effect below keeps it in step with the state, and `logout` writes it
   * directly on the way out rather than waiting for that effect: this is also
   * what tells work already in flight — the role refresh in the interceptor —
   * that there is no longer a session to apply an answer to, and one commit
   * of lag there is one commit in which a stale answer can put back
   * permissions `logout` just forgot.
   */
  const hasSessionRef = useRef(false);
  useEffect(() => {
    hasSessionRef.current = sesion.autenticado;
  }, [sesion.autenticado]);

  /**
   * How long a session survives without being used, as the server measures
   * it — learned from the server, not written down here.
   *
   * The session slides: every request the server answers pushes the row's
   * expiry another window into the future. So a countdown started once, off
   * the `expires_at` this page was handed when it loaded, is wrong for anyone
   * who then keeps working. Their session was renewed and the countdown was
   * not, so it would announce "five minutes left" on a session with days left
   * and then log them out — taking whatever they had typed with it. That is
   * not a warning that merely arrives early; it is a warning that is false,
   * and people who learn to ignore this one lose their work the day it is
   * true.
   *
   * The obvious fix is to ask the server again, and it is a trap: `GET
   * /auth/me` is an authenticated request, so asking *is* using the session,
   * and using it slides it. A page that polled for its own deadline would
   * keep renewing the very thing it was watching — an unattended browser on a
   * shared desk would never idle out, which is the entire point of an idle
   * window. The probe cannot observe without changing what it observes.
   *
   * So this mirrors the server's rule instead of interrogating it: learn how
   * long a window is from the one honest answer that costs nothing
   * (`expires_at` minus the moment it arrived, on the `/auth/me` this page
   * already makes), then push the deadline forward on every answered
   * request — which is precisely what the server does with it. No extra
   * traffic, and no copy of `SESSION_IDLE_DAYS` to keep in step across two
   * repositories: change it server-side and the next page load learns the new
   * number by itself.
   *
   * What is left of the error is the server's touch throttle — it only writes
   * `last_used_at` every few minutes, so the real deadline sits a few minutes
   * either side of this one — and it is bounded by that throttle rather than
   * by how long the tab has been open. That is the difference that matters: a
   * countdown a few minutes off is still telling the truth, and a countdown
   * that ignores sliding is off by however many days the session has slid.
   */
  const sessionWindowRef = useRef<number | null>(null);
  /**
   * Whether the server has already been asked about this session's deadline.
   *
   * Kept apart from `sessionWindowRef` because "asked, and there is nothing to
   * count down" is a real answer and not a missing one: a caller still on the
   * old bearer token has no session row behind it, and `/auth/me` says so with
   * `expires_at: null`. Without this flag the effect below would read that
   * null window as "not asked yet" and ask a second time on every one of
   * those page loads.
   */
  const expiryAskedRef = useRef(false);

  const clearTimers = () => {
    if (timers.current.warning) clearTimeout(timers.current.warning);
    if (timers.current.expiry) clearTimeout(timers.current.expiry);
  };

  const logout = useCallback(() => {
    // Revokes the session row and clears the cookie server-side. Before this
    // app sent credentials, dropping the token was the whole session; now the
    // browser also holds an httpOnly cookie nothing on this page can reach,
    // so without this call "logging out" left it alive and sliding for up to
    // a week on a shared computer anyone could pick up next.
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
    // Now, not one commit from now: see the ref's own comment. A second
    // `logout()` before React re-renders keeps its request off the network,
    // and anything already in flight can tell there is nothing left to apply.
    hasSessionRef.current = false;
    clearTimers();
    // Forgotten along with the session, not merely disarmed: the next login
    // in this same page is a different session with a different deadline, and
    // leaving these behind would let it inherit the dead one's window — and
    // would stop the effect below from ever asking for the real one.
    sessionWindowRef.current = null;
    expiryAskedRef.current = false;
    olvidarPermisos();
    setSesion({ usuario: usuarioExample, autenticado: false });
  }, []);

  /**
   * Puts the warning and the expiry on an absolute deadline (epoch ms).
   *
   * The deadline is trusted to be in the future: `scheduleExpiry` below
   * refuses anything else, and `renewDeadline` builds one out of a window
   * that already passed through it. So the expiry is armed unconditionally,
   * and there is exactly one place — not two shielding each other — where a
   * bad deadline is caught.
   *
   * The warning is conditional, and for a reason of its own: a session whose
   * entire remaining life is shorter than the five minutes of notice has no
   * notice to give. `setTimeout` with a negative delay fires on the next
   * tick, so without this the alarm would go off the instant the page loaded.
   */
  const armTimers = useCallback((deadline: number) => {
    clearTimers();
    const msToExpiry = deadline - Date.now();
    const msToWarning = msToExpiry - WARNING_LEAD_MS;

    if (msToWarning > 0) {
      timers.current.warning = setTimeout(() => {
        toast.warning("Tu sesión vence en 5 minutos. Guardá tu trabajo.", { duration: 10000 });
      }, msToWarning);
    }
    timers.current.expiry = setTimeout(() => {
      toast.error("Tu sesión expiró. Por favor, volvé a iniciar sesión.");
      logout();
    }, msToExpiry);
  }, [logout]);

  /**
   * Starts the countdown from what the server said, and remembers how long a
   * window is so the slide below has something to move.
   *
   * Takes the `expires_at` of `GET /auth/me` — the session row's own expiry,
   * read out of the database — where it used to decode `exp` from a JWT this
   * page no longer holds and no longer wants.
   */
  const scheduleExpiry = useCallback((expiresAt: string | null) => {
    expiryAskedRef.current = true;
    if (!expiresAt) return;
    const deadline = new Date(expiresAt).getTime();
    // The one place a deadline is checked; `armTimers` above trusts what it
    // is handed. An unparseable date, or one already in the past, means there
    // is nothing to count down to: a session the server already considers
    // dead ends on its next 401, not on a timer here, and `setTimeout` with a
    // negative delay fires on the next tick — which would throw out somebody
    // the server has not refused at all. A machine with its clock set a day
    // ahead is enough to produce that.
    //
    // It also keeps a negative or `NaN` window out of the ref below, which
    // `renewDeadline` would otherwise reuse on every later response.
    if (Number.isNaN(deadline) || deadline <= Date.now()) return;
    sessionWindowRef.current = deadline - Date.now();
    armTimers(deadline);
  }, [armTimers]);

  /**
   * Pushes the deadline forward, because the server just did.
   *
   * Called for every answered request to our own API: an answer proves the
   * request arrived, and every request that arrives slides the session. Not
   * called from the error handler, and that is the point rather than an
   * oversight — a 401 is the one response that proves the session is *not*
   * alive, and re-arming a countdown off it would be the plainest lie
   * available.
   *
   * On every single response and not throttled: a report export makes around
   * two thousand of them, and two thousand timer swaps is a cost nobody can
   * measure. A "only re-arm if the deadline moves by more than a minute"
   * guard was written here first and taken back out — it changes no observable
   * behaviour, so no test can hold it, and untestable cleverness in this file
   * is how the last mechanism rotted.
   */
  const renewDeadline = useCallback(() => {
    const windowMs = sessionWindowRef.current;
    if (windowMs === null) return;
    armTimers(Date.now() + windowMs);
  }, [armTimers]);

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

  // Interceptor de axios: sigue el vencimiento deslizante, detecta el cambio
  // de rol y hace auto-logout ante un 401.
  //
  // Declarado ANTES del efecto de arranque de más abajo, y no por casualidad
  // ni por prolijidad: `axios` congela la lista de interceptores de
  // respuesta de forma síncrona, dentro de la propia llamada a `request()`
  // (lo que `axios.get`/`.post` disparan por debajo) — lee lo que haya en
  // `axios.interceptors.response` en ese instante, no lo que se registre
  // después. Los efectos de un componente se montan en el orden en que
  // están escritos, así que para cuando el efecto de arranque dispare su
  // `axios.get`, este ya está puesto: la petición de arranque SÍ pasa por
  // este interceptor. Ver el comentario de la exclusión de `LOGOUT_URL`, más
  // abajo, para por qué eso no es un problema — y el del efecto de arranque
  // para la otra mitad de la misma explicación.
  useEffect(() => {
    /**
     * Only our own API may move this session.
     *
     * The interceptor is global, so it sees every request the app makes —
     * including the image fetches the exporters perform against paths stored in
     * the database. A crafted `image` value such as ".attacker.tld/x.jpg"
     * concatenated onto the API host produces a request to a host the attacker
     * owns, and that host controls its own response headers *and* its own
     * CORS, so it can hand this page any `x-osefi-role` it likes. Unguarded,
     * that buys it a false "your permissions changed" notice and a refetch on
     * demand — and a deadline pushed past the server's, since a stranger
     * answering a request never slid our session.
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
        if (isOurApi(response.config?.url)) {
          renewDeadline();

          /**
           * A role that changed mid-session used to stay invisible until the
           * page was reloaded.
           *
           * The server reads the role from the database on every request — it
           * has to, to notice a demotion or an archived account — and now
           * hands that read back on `ROLE_HEADER` instead of baking it into a
           * re-signed token. The client keeps the permissions it was given
           * when it last asked, so without this comparison somebody promoted
           * keeps seeing the smaller application and somebody demoted keeps
           * seeing buttons whose only outcome is 403. The server refuses
           * correctly throughout; the screen is the part that lies.
           *
           * Only when the role actually changed, so the ordinary case — a
           * header on every single response — costs nothing but a compare.
           */
          const raw = response.headers?.[ROLE_HEADER];
          // A header is text, and `Number("")` is 0: without the emptiness
          // check a header that arrived blank would read as role 0 and look
          // like a change away from every real role.
          const fresh = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
          const known = roleRef.current;
          if (Number.isInteger(fresh) && known !== undefined && fresh !== known) {
            roleRef.current = fresh;
            comprobarToken()
              .then((res) => {
                if (res.status !== 200 || !res.usuario) return;
                // Somebody who logged out while this was in flight is looking
                // at the login screen now. Applying this would put back the
                // permissions `logout()` just forgot — on a session that no
                // longer exists — and the notice below would announce that a
                // screen had updated when nothing on it did. One guard for
                // both, and `logout` writes this ref itself so it is already
                // false here rather than one commit behind.
                if (!hasSessionRef.current) return;
                setSesion((prev) => ({
                  ...prev,
                  usuario: res.usuario as UsuarioInterface,
                  permisos: res.permisos,
                }));
                toast.info("Sus permisos cambiaron. La pantalla se actualizó.");
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
        // `comprobarToken()`'s own request (`GET /auth/me`) is deliberately
        // NOT excluded the way `LOGOUT_URL` is, and this handler genuinely
        // does see it: a 401 on it calls `logout()` like any other request's
        // would. That is safe rather than a problem, because `logout()`'s own
        // request goes to `LOGOUT_URL` — already excluded — so the chain stops
        // one level down regardless. Its three callers land in three places
        // and all three are fine: on an ordinary anonymous boot
        // `hasSessionRef` is still `false` (derived from `autenticado`, which
        // nothing has set to `true` yet), so `logout()`'s own cheap guard
        // keeps that call off the network; the role-change refresh above and
        // the deadline lookup after a login both run mid-session, where a 401
        // genuinely means the session just died — an event `logout()` is the
        // correct answer to, not one to hide from.
        if (error.response?.status === 401 && error.config?.url !== LOGOUT_URL) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [logout, renewDeadline]);

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
  // El interceptor de arriba SÍ ve esta petición — se registra en el efecto
  // anterior, antes de que este dispare el `axios.get` (por eso está
  // declarado antes, no por casualidad) — y ante un 401 aquí llama a
  // `logout()` como ante cualquier otro; no está excluido igual que
  // `LOGOUT_URL`. Es inofensivo: en un arranque anónimo `hasSessionRef`
  // sigue en `false`, así que ese `logout()` no llega a tocar la red. Ver el
  // comentario de la exclusión de `LOGOUT_URL`, arriba, para el resto del
  // porqué.
  //
  // La misma respuesta trae el vencimiento, así que la cuenta atrás arranca
  // aquí y no en una segunda petición: una sesión recuperada al recargar ya
  // sabe cuándo vence antes de dibujarse.
  useEffect(() => {
    comprobarToken()
      .then((res) => {
        if (res.status === 200 && res.usuario) {
          scheduleExpiry(res.expires_at);
          setSesion({
            usuario: res.usuario,
            permisos: res.permisos,
            autenticado: true,
          });
        }
      })
      .finally(() => setLoading(false));
    // Once, on mount, and deliberately not once per identity of
    // `scheduleExpiry`. This asks whether there is a session at all; the day
    // that callback's identity stops being stable, re-running this would ask
    // again mid-session and overwrite a live session with whatever the server
    // answered next. `[]` says "once" outright instead of leaning on a chain
    // of `useCallback`s staying stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Ask for the deadline of a session that arrived without one.
   *
   * The startup effect above gets `expires_at` in the same answer that
   * restores the session, so a reloaded page needs nothing here. A fresh login
   * does: `POST /api/login` answers with the user and the permissions and no
   * expiry at all, so without this the countdown would exist only for people
   * who reloaded the page — while the ordinary way into the ERP is the login
   * form. That is exactly how `x-new-token` died: a mechanism still present in
   * the code and never actually running.
   *
   * One request, once per session, and only when there is no answer on file
   * yet. Declared after the startup effect so the two cannot race over who
   * asks first, and so "the interceptor is registered before anything asks"
   * stays the only ordering anyone has to hold in their head.
   */
  useEffect(() => {
    if (!sesion.autenticado || expiryAskedRef.current) return;
    comprobarToken()
      .then((res) => {
        // Only a 200 counts as an answer. A 401 here means the session died
        // between the login and this question — the interceptor above has
        // already ended it — and marking the question as asked would leave the
        // next login in this same page with no countdown at all.
        if (res.status === 200) scheduleExpiry(res.expires_at);
      })
      .catch(() => undefined);
  }, [sesion.autenticado, scheduleExpiry]);

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
