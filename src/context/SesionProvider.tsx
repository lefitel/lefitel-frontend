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
 *
 * **What this does not notice, declared rather than left to be discovered.**
 * It compares role *ids*, so it sees a person moved to another role and
 * nothing else. `PUT /api/permisos/:id_rol` changes what a role may do without
 * changing anybody's id, so granting rol 2 the `generador` module leaves every
 * rol 2 with the ERP already open on the old menu, and `ModuleRoute` in
 * `App.tsx` bounces them back if they type the URL by hand — with nothing on
 * screen saying to reload. Not a regression (the `x-new-token` mechanism
 * decoded the same id and had the same blind spot) and not fixable from this
 * repository: the server would have to hand back something that changes when
 * the matrix does — a version or a hash of the role's row — for this
 * comparison to have anything to compare. Written down here because the notice
 * this file shows, "Sus permisos cambiaron. La pantalla se actualizó.", reads
 * like the case is covered, and it is not. The dangerous half *is* covered
 * elsewhere: `PermisosPanel.tsx` disables the checkboxes of one's own role and
 * the server refuses it besides, so nobody can edit their way out of their own
 * screen.
 */
const ROLE_HEADER = "x-osefi-role";

/**
 * The header the server puts on every authenticated response, carrying the
 * instant that session stops working — ISO 8601 in UTC, the exact output of
 * `Date.prototype.toISOString()`.
 *
 * This is the only thing in this repository that knows when a session dies,
 * and that is the fix rather than an accident. The countdown used to be built
 * from the `expires_at` of `GET /auth/me`: a window measured once at page
 * load, then pushed forward locally by mirroring the server's sliding rule on
 * every 2xx. Two things were wrong with mirroring, and both were measured.
 * The window came off the row as it stood *before* that request slid it, so
 * somebody returning to the ERP with ten minutes left on the row learned a
 * ten-minute window while the server had just granted them another seven days
 * — and their browser then warned them and logged them out, taking whatever
 * form was open with it. And only 2xx pushed the deadline, while the server
 * slides a session on *any* authenticated request: a 422 from a missing field
 * renewed the session for a week and the client did not count it.
 *
 * A header states the answer instead of inferring it, and it rides on the
 * error responses too, because `authenticate` runs before any controller. The
 * value is the *effective* deadline, with the absolute ceiling already
 * applied, so there is no second rule to keep in step across two repositories.
 *
 * **Absent means "no news", never "expired", and this is the part that is easy
 * to get wrong.** A proxy that strips headers it does not recognise produces
 * exactly the same absence as a server that never sent one, so reading absence
 * as expiry would throw people out over a network configuration. `POST /login`
 * does not carry it either — it does not pass through `authenticate` — so the
 * ordinary way into the ERP starts with no deadline at all and learns one from
 * the first ordinary response. Nothing here is allowed to cancel a deadline on
 * account of a header that did not arrive; only a value that did arrive may
 * move it. See `SESSION_EXPIRES_HEADER` in `api/src/config/security.ts`.
 */
const SESSION_EXPIRES_HEADER = "x-osefi-session-expires";

/** How long before the session dies the warning goes up. */
const WARNING_LEAD_MS = 5 * 60 * 1000;

/**
 * The largest delay `setTimeout` can hold, and the reason `armTimers` below
 * re-arms in stages instead of asking for the whole wait at once.
 *
 * The delay is stored as a signed 32-bit integer, so anything past this
 * overflows and the timer fires on the *next tick* instead of in three weeks.
 * Measured: a window of thirty days produced `autenticado: false`, a warning
 * and an expiry toast one tick after the page rendered — every session in the
 * ERP ended the instant it began. Reachable by one edit nowhere near this
 * file: `SESSION_IDLE_DAYS` is 7 on the server and this comment used to
 * promise that raising it was safe because "the next page load learns the new
 * number by itself". It learned it and then choked on it. Anything above
 * ~24.8 days crosses the line.
 */
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Ends the session on the server, and says so when it cannot.
 *
 * The local cleanup in `logout()` happens whether this succeeds or not, and
 * has to: somebody who pressed "log out" must not be left sitting in front of
 * an application that still says they are logged in. But this call is the only
 * thing that revokes the session row and clears the cookie, and the cookie is
 * a persistent one — it carries an `expires`, so closing the browser does not
 * drop it. So a failure here is not cosmetic: the session stays open and
 * usable for up to a week, and on the shared field laptop the next person to
 * open the ERP is inside the previous person's account. That failure used to
 * be swallowed by a bare `.catch(() => undefined)`, which meant the one case
 * where it matters was also the one case nobody could see.
 *
 * So the failure is announced, it does not expire on its own, and it comes
 * with the only thing the person can actually do about it — send the request
 * again. A retry is the right offer because the reachable causes are transient
 * (no signal in the field, the API restarting): the credential is still in the
 * browser, so a later attempt still authenticates. It says the session "may
 * still be open" rather than "is": a request that never got an answer might
 * have been carried out anyway.
 *
 * "The credential is still in the browser" is the premise, and it is the one
 * that expires — not the toast. A login in the same tab replaces the cookie,
 * and then that same button revokes the session in front of the person instead
 * of the one it named. `credentialGeneration` below is what makes the offer
 * lapse together with its premise.
 *
 * One id shared by the failure, every retry of it and the confirmation, so
 * that each of them replaces the last instead of stacking. Without it a
 * successful retry leaves two toasts on screen at once saying opposite things
 * — "may still be open", which never expires, sitting next to "closed on the
 * server" — and somebody pressing the button four times with no signal
 * collects four copies of the same warning.
 */
const REVOKE_TOAST_ID = "logout-revoke";

/**
 * How many credentials this page has held.
 *
 * `POST /auth/logout` names no session. It revokes whatever the session cookie
 * points at when the request leaves, and this code cannot read that cookie —
 * which is fine for the first attempt, made a moment after the session it is
 * about, and is the whole problem for a retry offered by a toast that never
 * expires. Logging in again in the same tab replaces the cookie, so "send the
 * same request again" stops meaning the same request, with nothing on screen
 * to show it: the button still says "Reintentar".
 *
 * Counting logins is what makes that difference visible from here. Every call
 * below carries the number it was made for and refuses to act once the number
 * has moved. Without it, pressing that button after logging back in revoked
 * the session the person had *just opened*, replaced the warning with "Sesión
 * cerrada en el servidor." — a confirmation of the opposite of what happened —
 * and left the abandoned row it had offered to close still open, still valid
 * for a week. That is worse than the swallowed failure this whole mechanism
 * replaced: a silent failure leaves a session open, this one closed the good
 * session and said it had closed the other.
 *
 * A module-level counter and not a ref, because `revokeOnServer` is a module
 * function: the retry outlives the component tree that offered it.
 */
let credentialGeneration = 0;

const revokeOnServer = (generation: number, isRetry: boolean) => {
  /**
   * Whether the browser has been handed a different credential since this call
   * was made for its own. Called at each moment it matters rather than read
   * once, because the thing it reports on changes *while* a toast that does
   * not expire waits on screen for somebody to press it.
   */
  const superseded = () => generation !== credentialGeneration;

  // The refusal that makes the wrong request impossible rather than unlikely.
  // It is reached by the one gesture the wording invites — "Reintentá cuando
  // vuelva la conexión", pressed after logging back in — and the request it
  // stops would carry the new cookie and revoke the live session. The
  // provider's effect drops this toast the moment a session exists, so in
  // practice there is no button left to press; that is a React effect and
  // this is the send path, and the send path is where the guarantee has to
  // live. The toast goes too: it is about a session this browser can no
  // longer close (see the `catch` below for what closed it instead).
  if (superseded()) {
    toast.dismiss(REVOKE_TOAST_ID);
    return;
  }

  // Only on a retry. Confirming the ordinary case would put a toast on screen
  // every single time anybody logs out, for news they already have — the login
  // form is in front of them. And nothing is confirmed once the credential has
  // moved on: that answer is about a row the person is no longer looking at,
  // so it would read as a claim about the session on screen.
  const done = () => {
    if (isRetry && !superseded()) toast.success("Sesión cerrada en el servidor.", { id: REVOKE_TOAST_ID });
  };

  axios
    .post(LOGOUT_URL)
    .then(done)
    .catch((error: { response?: { status?: number } }) => {
      // A 401 is not a failure to revoke: it is the server saying this
      // credential is not authenticated, so there is no session left to close.
      // Reached on the most ordinary path there is — the expiry timer calls
      // `logout()` on a session the server has already dropped — and without
      // this branch everybody whose session ran out with the tab open would be
      // told, in a toast that never expires, that their session might still be
      // open. A false alarm on the one screen where alarms have to be believed.
      if (error?.response?.status === 401) {
        done();
        return;
      }
      // A failure somebody's next login already settled, so there is nothing
      // to announce. `issueSession` on the server revokes whatever session the
      // incoming cookie names before opening the next one (`rotateOut`, in
      // `api/src/auth/issueSession.ts`), and the login request carries that
      // cookie for the very reason this call is in its `catch` — the logout
      // never got through, so nothing cleared it. So the row this failure is
      // about is closed by the act of logging in again. Reachable whenever the
      // request takes longer to give up than the person takes to log back in,
      // which on a dead link is the ordinary case rather than a narrow one,
      // and without this the alarm would go up *behind* a working session,
      // never expiring, offering a button the guard above refuses.
      if (superseded()) return;
      toast.error(
        "No se pudo cerrar tu sesión en el servidor: puede seguir abierta en este equipo. Reintentá cuando vuelva la conexión.",
        {
          id: REVOKE_TOAST_ID,
          // Until it is dismissed or acted on. A four-second toast about a
          // session left open on a shared computer is the same as no toast.
          duration: Infinity,
          action: { label: "Reintentar", onClick: () => revokeOnServer(generation, true) },
        },
      );
    });
};

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
   * Whether a permission refresh is already on its way back.
   *
   * The role header rides on every response, so without this the handful of
   * responses that arrive while one refresh is in flight would each start
   * another. It exists as its own flag rather than being implied by `roleRef`
   * having been moved forward, which is how this used to be done and is what
   * finding 6 of the audit was: `roleRef` was set to the new role *before*
   * asking, so a single failed refresh — one dropped wifi, and in the field
   * they drop — left the comparison permanently satisfied and the screen
   * showing the old role's buttons for the rest of the session, every click
   * returning 403. Separating "what the screen was drawn for" from "a request
   * is out" means a failure leaves the first one alone, and the next response
   * carrying the same header tries again.
   */
  const roleRefreshRef = useRef(false);
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
   * what tells work already in flight — the role refresh in the interceptor,
   * and any deadline still on its way back — that there is no longer a session
   * to apply an answer to, and one commit of lag there is one commit in which
   * a stale answer can put back permissions `logout` just forgot.
   */
  const hasSessionRef = useRef(false);
  useEffect(() => {
    hasSessionRef.current = sesion.autenticado;
    if (!sesion.autenticado) return;
    // A session was just opened, which means the browser is holding this
    // session's cookie and not whatever a pending logout failure was about.
    // Two things follow, and both are about the one toast in this file that
    // never goes away on its own.
    //
    // The count moves, so any retry still holding the old number refuses to
    // send — see `credentialGeneration`. And the toast itself goes, because
    // what it warns about has just been dealt with by the login: the login
    // request carried the old cookie (the failed logout never cleared it) and
    // `rotateOut` on the server revokes that row before opening this one. So
    // the abandoned session it was offering to close is already closed, and a
    // warning saying it "puede seguir abierta" would now be false — quite
    // apart from its button, which would revoke this session instead.
    //
    // Dismissing unconditionally rather than only when such a toast exists:
    // `toast.dismiss` on an id that is not on screen does nothing, and the
    // alternative is a second piece of module state saying whether one is.
    credentialGeneration += 1;
    toast.dismiss(REVOKE_TOAST_ID);
  }, [sesion.autenticado]);

  const clearTimers = () => {
    if (timers.current.warning) clearTimeout(timers.current.warning);
    if (timers.current.expiry) clearTimeout(timers.current.expiry);
  };

  const logout = useCallback(() => {
    // Revokes the session row and clears the cookie server-side. Before this
    // app sent credentials, dropping the token was the whole session; now the
    // browser also holds an httpOnly cookie nothing on this page can reach,
    // so without this call "logging out" left it alive and sliding for up to
    // a week on a shared computer anyone could pick up next. See
    // `revokeOnServer` for what happens when that call does not get through.
    //
    // Skipped when there is no session to begin with: a request that can
    // only answer 401 (see the interceptor below for the request this one
    // has to be told apart from) is not merely wasted, it is the other half
    // of the loop this whole guard exists to break.
    //
    // The local cleanup below runs either way and does not wait for it, so
    // nobody ends up stuck looking authenticated on a screen that already
    // sent them back to the login form.
    if (hasSessionRef.current) {
      // Tagged with the credential it is about, read now rather than when the
      // answer comes back: the retry this may end up offering has to be able
      // to tell that the cookie underneath it changed. See
      // `credentialGeneration`.
      revokeOnServer(credentialGeneration, false);
    }
    // Now, not one commit from now: see the ref's own comment. A second
    // `logout()` before React re-renders keeps its request off the network,
    // and anything already in flight can tell there is nothing left to apply.
    hasSessionRef.current = false;
    clearTimers();
    olvidarPermisos();
    setSesion({ usuario: usuarioExample, autenticado: false });
  }, []);

  /**
   * Puts the warning and the expiry on an absolute deadline (epoch ms).
   *
   * The deadline is trusted to be in the future: `learnDeadline` below refuses
   * anything else, so the expiry is armed unconditionally and there is exactly
   * one place — not two shielding each other — where a bad deadline is caught.
   *
   * The warning is conditional, and for a reason of its own: a session whose
   * entire remaining life is shorter than the five minutes of notice has no
   * notice to give. `setTimeout` with a negative delay fires on the next
   * tick, so without this the alarm would go off the instant the page loaded.
   *
   * Both are armed in stages when the wait is longer than a `setTimeout` can
   * express — see `MAX_TIMEOUT_MS`. `arm` waits at most one stage, then asks
   * the clock again and decides afresh, so a thirty-day window costs two
   * timers instead of throwing everybody out on the next tick. Reading the
   * clock each stage rather than counting down a remainder also means a laptop
   * that was asleep for a week wakes up and fires immediately instead of
   * waiting out a stage that already elapsed.
   */
  const armTimers = useCallback((deadline: number) => {
    clearTimers();

    const arm = (slot: "warning" | "expiry", at: number, fire: () => void) => {
      const delay = at - Date.now();
      timers.current[slot] =
        delay > MAX_TIMEOUT_MS
          ? setTimeout(() => arm(slot, at, fire), MAX_TIMEOUT_MS)
          : setTimeout(fire, Math.max(delay, 0));
    };

    const warnAt = deadline - WARNING_LEAD_MS;
    if (warnAt > Date.now()) {
      arm("warning", warnAt, () => {
        toast.warning("Tu sesión vence en 5 minutos. Guardá tu trabajo.", { duration: 10000 });
      });
    }
    arm("expiry", deadline, () => {
      toast.error("Tu sesión expiró. Por favor, volvé a iniciar sesión.");
      logout();
    });
  }, [logout]);

  /**
   * Takes the deadline the server just stated and points the countdown at it.
   *
   * Called for every response from our own API that carried
   * `SESSION_EXPIRES_HEADER`, which is every response the server answered with
   * a session cookie — the errors included, because that is what makes this
   * honest. Nothing is computed here: the header holds the instant, ceiling
   * already applied, so there is no window to remember and no sliding rule to
   * mirror.
   *
   * Three ways to be handed nothing usable, and all three mean the same thing:
   * leave the countdown exactly as it is.
   *
   *   - No header. "No news" — see `SESSION_EXPIRES_HEADER` on why absence
   *     must never be read as expiry.
   *   - An unparseable date. A garbled value is not information; cancelling a
   *     deadline over one would let a single mangled response silently remove
   *     the warning that protects unsaved work.
   *   - An instant already past. A session the server considers dead ends on
   *     its next 401, not on a timer here, and `setTimeout` with a negative
   *     delay fires on the next tick — which would throw out somebody the
   *     server has not refused at all. A machine with its clock set a day
   *     ahead is enough to produce that.
   *
   * And nothing is armed unless there is a session to arm it for. Two
   * responses always arrive after the session is over: `logout()`'s own — the
   * server writes this header before the controller revokes the row, so that
   * one is stale by construction — and whatever else was in flight when the
   * person logged out. Without this guard those would put a five-minute
   * warning and an expiry on a session that no longer exists: measured, the
   * warning landed in front of the login form, and a second login in the same
   * tab inherited the dead session's countdown and was cut short by it.
   * `logout()` writes `hasSessionRef` itself, so it is already false here
   * rather than one commit behind — which is also why a 401 needs no exclusion
   * of its own: whichever order the handler below runs in, either this guard
   * refuses the deadline or `logout()`'s `clearTimers()` throws it away.
   */
  const learnDeadline = useCallback((raw: unknown) => {
    if (!hasSessionRef.current) return;
    if (typeof raw !== "string" || raw.trim() === "") return;
    const deadline = new Date(raw).getTime();
    if (Number.isNaN(deadline) || deadline <= Date.now()) return;
    armTimers(deadline);
  }, [armTimers]);

  /**
   * The role the permissions on screen were fetched for.
   *
   * In an effect rather than during render — writing a ref while rendering is
   * not allowed — and this is the catch-all: `setSesion` is handed to the login
   * screen through the context, so there is no single call site to hook, and
   * the state itself is what every writer passes through.
   *
   * A commit of lag, which is soon enough for every writer but one. The
   * interceptor only refreshes when it has a role to compare against, so a
   * login leaves nothing to get wrong — the permissions are fresh already. The
   * exception is the refresh in the interceptor itself, which releases its own
   * in-flight flag microtasks before this effect runs and so would leave the
   * comparison satisfied by a stale role: it writes this ref itself, with the
   * same expression, rather than waiting here. See the comment at that write.
   */
  useEffect(() => {
    roleRef.current = sesion.permisos ? sesion.usuario.id_rol : undefined;
  }, [sesion.permisos, sesion.usuario.id_rol]);

  // Interceptor de axios: sigue el vencimiento que dice el servidor, detecta
  // el cambio de rol y hace auto-logout ante un 401.
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
     * CORS, so it can hand this page any `x-osefi-role` or any deadline it
     * likes. Unguarded, that buys it a false "your permissions changed" notice
     * and a refetch on demand — and a countdown pointed wherever it wants,
     * since a stranger answering a request never touched our session row.
     *
     * A relative `url` is resolved the way axios itself resolved it: against
     * `baseURL` when the request had one, and only against the page otherwise.
     * Resolving unconditionally against `window.location` was a live trap —
     * the day somebody sets a `baseURL` (there is no `axios.create` in this
     * repository today, so nobody has), every request's `url` becomes the bare
     * path, every path resolves to the *frontend's* origin, and this guard
     * quietly stops matching: role detection and the countdown both go away
     * with no test able to notice, since the tests build absolute URLs. Taking
     * the base from the request keeps the guard honest either way. It cannot
     * be turned against us, because `baseURL` is set by this application and
     * `url` is the half that can come out of the database — and an absolute
     * `url` ignores the base it is resolved against, so a stranger's host
     * still resolves to a stranger's origin.
     */
    const isOurApi = (config: { url?: string; baseURL?: string } | undefined): boolean => {
      if (!config?.url) return false;
      try {
        return new URL(config.url, config.baseURL || window.location.href).origin === new URL(url).origin;
      } catch {
        return false;
      }
    };

    const interceptor = axios.interceptors.response.use(
      (response) => {
        if (isOurApi(response.config)) {
          learnDeadline(response.headers?.[SESSION_EXPIRES_HEADER]);

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
          if (Number.isInteger(fresh) && known !== undefined && fresh !== known && !roleRefreshRef.current) {
            roleRefreshRef.current = true;
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
                // The same value the effect above computes, written a commit
                // early, and the commit of lag is the whole reason. `finally`
                // releases `roleRefreshRef` in this promise's own microtask
                // chain, while React commits `setSesion` a macrotask later: in
                // between, the flag says "no refresh out" and `roleRef` still
                // holds the *old* role. The header rides on every response, so
                // any answer landing in that window matched the comparison
                // again and started a second `/auth/me` — and a second "Sus
                // permisos cambiaron", for one role change. It was called
                // unobservable when this line was removed for want of a test;
                // it is observable by whoever reads the same notice twice, and
                // the test below now sees it.
                //
                // `res.usuario.id_rol` and not the header's role, deliberately:
                // this ref means "the role the permissions on screen were
                // fetched for", so when the answer disagrees with the header,
                // the answer is the one that describes the screen. Same
                // expression as the effect, off the state this `setSesion` is
                // about to commit, so the two cannot disagree.
                //
                // What must not come back is the write that used to sit
                // *before* the request: that one made a failed refresh satisfy
                // the comparison for good. See `roleRefreshRef`.
                roleRef.current = res.permisos ? res.usuario.id_rol : undefined;
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
                // `roleRef` is deliberately untouched, so the next response
                // still carrying the new role starts this again.
              })
              .finally(() => {
                roleRefreshRef.current = false;
              });
          }
        }
        return response;
      },
      (error) => {
        // An answer with an error is still an answer, and the session slid to
        // produce it: `authenticate` runs before any controller, so a 422 from
        // a missing field renewed the session for another window just as much
        // as a successful read did. Learning only from the 2xx path meant
        // somebody who saved a form, got a validation error back, and kept
        // working was counted down to a deadline the server had already moved.
        // A 401 needs no exception here — see `learnDeadline`, which refuses
        // to arm anything once there is no session, whichever order these two
        // statements run in.
        if (isOurApi(error.config)) {
          learnDeadline(error.response?.headers?.[SESSION_EXPIRES_HEADER]);
        }

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
        // one level down regardless. Its two callers land in two places and
        // both are fine: on an ordinary anonymous boot `hasSessionRef` is
        // still `false` (derived from `autenticado`, which nothing has set to
        // `true` yet), so `logout()`'s own cheap guard keeps that call off the
        // network; the role-change refresh above runs mid-session, where a 401
        // genuinely means the session just died — an event `logout()` is the
        // correct answer to, not one to hide from.
        if (error.response?.status === 401 && error.config?.url !== LOGOUT_URL) {
          // Why the screen just changed. This branch is how a session ends
          // when it was not this browser's decision: an administrator revoked
          // the laptop somebody left on a bus, or the idle window ran out
          // while the tab was asleep and no timer was there to announce it.
          // Until this line it took somebody mid-sentence in an event form
          // straight to the login screen with no message at all, and nothing
          // on screen to distinguish it from the application breaking.
          // Expiry and revocation cannot be told apart from here — the server
          // answers 401 to both — so the wording covers both rather than
          // guessing.
          //
          // Guarded by the session, and both halves of that guard matter: an
          // anonymous page load answers its own startup question with a 401
          // and must not be told a session ended, and the expiry timer above
          // has already had its say before calling `logout()`, so a 401
          // arriving behind it does not say it twice.
          if (hasSessionRef.current) {
            toast.error("Tu sesión se cerró. Volvé a iniciar sesión.");
          }
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [logout, learnDeadline]);

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
  // sigue en `false`, así que ese `logout()` no llega a tocar la red ni a
  // anunciar nada. Ver el comentario de la exclusión de `LOGOUT_URL`, arriba,
  // para el resto del porqué.
  //
  // Esta pregunta NO arma la cuenta atrás, y no le hace falta: el vencimiento
  // llega en la cabecera de cada respuesta autenticada, así que la primera
  // petición que haga la pantalla ya recién montada lo trae. Este efecto
  // decide si hay sesión y nada más — antes también leía un `expires_at` del
  // cuerpo, que era el mismo dato por un segundo camino, y dos caminos para un
  // dato se separan.
  useEffect(() => {
    comprobarToken()
      .then((res) => {
        if (res.status === 200 && res.usuario) {
          setSesion({
            usuario: res.usuario,
            permisos: res.permisos,
            autenticado: true,
          });
        }
      })
      .finally(() => setLoading(false));
    // Once, on mount. This asks whether there is a session at all; re-running
    // it mid-session would overwrite a live session with whatever the server
    // answered next. `[]` says "once" outright.
  }, []);

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
