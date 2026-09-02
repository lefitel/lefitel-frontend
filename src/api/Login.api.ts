import axios from "axios";
import { urlApi } from "./url";
import { SesionActivaInterface, SesionInterface, UsuarioInterface } from "../interfaces/interfaces";
import type { EstadoSesion } from "../interfaces/interfaces";
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
 * flattening is what `LoginPage.tsx` is written around, and it is the only
 * screen entitled to be: it has one question to ask and one place to show the
 * answer.
 *
 * **Nothing else may use this function to check a password.**
 * `UsuarioDetallePage.tsx` did, to confirm a change of your own username, and it
 * decided the password was right by finding `status === 500` — a number the real
 * refusal (400) only ever reached because of the flattening above. It worked, by
 * accident, and would have stopped working the day any real status arrived
 * unflattened, with nothing turning red.
 *
 * There is no confirmation wrapper here to point at instead, and that is the
 * point: the password now rides on the request that performs the change —
 * `editUserName` and `editUserPass` in `Usuario.api.ts` — and the server
 * compares it there. So there is no status code anywhere for a screen to be
 * accidentally right about, and nothing on this side deciding whether a
 * credential was good.
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
 * `confirmarPassword` used to live here, and it is retired along with the
 * `POST /api/auth/confirm-password` it called. Written down rather than simply
 * deleted, because the reason is a design decision and the next plan is the one
 * most likely to want it back.
 *
 * **What it was for.** `UsuarioDetallePage.tsx` asked it "is this really my
 * password?" before renaming your own account. That was already the second
 * attempt: the first called `loginUsuario` above and read `status === 500`,
 * which opened a second session, revoked the very one the tab was using, wrote
 * "Inició sesión" into the bitácora for a login nobody performed, and counted a
 * typo as a failed login attempt — so mistyping your password a few times while
 * renaming yourself locked you out of the ERP.
 *
 * **Why the replacement went too.** A confirmation that lives only in the client
 * is optional by definition: whoever does not want to type the password uses the
 * other screen, or `curl`. So the server was made to demand it on the write, and
 * the screens send it there — `oldPass` on `editUserName` and `editUserPass` in
 * `Usuario.api.ts`. That left this asking a question nothing needed answered,
 * and the rule it broke is the one the whole plan turns on: the credential that
 * authorises an operation travels in the request that performs it. Confirming
 * first *and* sending it would compare one password twice, out of two budgets,
 * from two pieces of code that have to agree.
 *
 * **The step-up of the MFA plan does not bring it back.** That design has the
 * first enrolment of a factor re-ask for the password, and under the same rule
 * that means `pass` on the enrolment request itself, not a confirmation
 * beforehand; everything else on its list is satisfied by how recently the
 * factor was used, not by a password at all.
 *
 * **What keeping it cost.** It was the only endpoint in the API that compared a
 * password with no operation behind it, reachable by any authenticated session,
 * drinking from the same five-per-quarter-hour ration as the two gates people
 * actually use — so an unreachable path could spend the budget that renaming
 * yourself and changing your password depend on.
 */

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
/**
 * `POST /auth/email/send` — register (or replace) the recovery address on my
 * own account, and ask me to confirm it.
 *
 * Takes `pass`, the caller's *current* password, and it is not optional: the
 * server refuses this call without it. That requirement is not in the
 * original design for this screen — it was added after the fact to close a
 * real account-takeover chain (steal a live session, point recovery at an
 * address you control, verify it, wait, then reset the password and lock the
 * real owner out through the very door meant to let them back in). See
 * `api/src/controllers/email.controller.ts`'s comment on `sendVerificationEmail`
 * for the full chain. `PerfilPage.tsx` is what collects this password; it is
 * never the record's own `pass` field, which on this side is a hash.
 *
 * **Status is preserved, not folded to 500 the way `loginUsuario` above folds
 * it.** That flattening is deliberate there, for a screen with one question
 * and one place to show the answer — see its own comment. Here it would be a
 * bug: `PerfilPage.tsx` has to tell a 429 (rate limit — say so in plain words)
 * apart from a 401 with `CUENTA_INACTIVA` ("su cuenta ya no está activa", not a
 * wrong password) apart from a 401 for an actually wrong password, and all
 * three arrive as different `message`s on the *same or different* status
 * codes. Collapsing the status here would still leave `message` readable, but
 * it is not a chance worth taking on the one screen that changes how somebody
 * gets back into their account.
 *
 * The uniform 200 (`EMAIL_ENVIO_RESPUESTA`, Global Constraint #1) is passed
 * through untouched — this wrapper does not know and must not guess whether
 * the address was free, already claimed by another unverified account, or
 * whether the mail actually went out.
 */
export const sendVerificationEmail = (
  email: string,
  pass: string
): Promise<{ status: number; message: string | null }> => {
  return axios
    .post(urlApi + "auth/email/send", { email, pass })
    .then((response) => ({
      status: response.status,
      message: (response.data?.message as string | undefined) ?? null,
    }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      message: e.response?.data?.message ?? "No se pudo conectar con el servidor.",
    }));
};

/**
 * `POST /auth/email/verify` — redeem the token from the verification link.
 *
 * The link is `{origin}/perfil#verify_email=TOKEN` — the token rides in the
 * URL *fragment*, never the query string, precisely so it never reaches this
 * server, a proxy, or a `Referer` header. `PerfilPage.tsx` is the only caller,
 * and it reads that fragment, calls this, and strips the fragment from the
 * address bar before this promise even settles — see its own comment for why
 * the order matters. Nothing in this function ever receives or logs the token
 * beyond handing it straight to the one request it is for.
 *
 * Same reasoning as `sendVerificationEmail` above for keeping the real status
 * on a failure: `TOKEN_INVALIDO` (400) covers four different server-side
 * causes on purpose (expired, already used, never existed, or the address it
 * named got claimed by someone else in the meantime) and a 429 from
 * `emailVerifyLimiter` needs to read as "espera un rato", not as a broken
 * link.
 */
export const verifyEmailToken = (
  token: string
): Promise<{ status: number; message: string | null }> => {
  return axios
    .post(urlApi + "auth/email/verify", { token })
    .then((response) => ({
      status: response.status,
      message: (response.data?.message as string | undefined) ?? null,
    }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      message: e.response?.data?.message ?? "No se pudo conectar con el servidor.",
    }));
};

/**
 * `POST /auth/password/forgot` — ask for a reset link when locked out.
 *
 * No `authenticate` in front of this route by definition — whoever calls it
 * cannot log in — so unlike `sendVerificationEmail` above there is no current
 * password to send alongside the address. Same reasoning as that function for
 * keeping the real status on failure: `ForgotPasswordPage.tsx` has to tell a
 * 429 (three separate buckets — see `passwordForgotRateLimit` in
 * `recoveryLimiters.ts`) apart from a 400 about the request's own shape, and
 * folding both to 500 the way `loginUsuario` does would leave nothing to tell
 * them apart with.
 *
 * The 200 body is the one sentence Global Constraint #1 fixes — sent whether
 * or not an account exists behind the address, whether or not its email is
 * verified — and this wrapper passes it through untouched rather than
 * guessing at, or replacing, what the server decided to say.
 */
export const forgotPassword = (
  email: string
): Promise<{ status: number; message: string | null }> => {
  return axios
    .post(urlApi + "auth/password/forgot", { email })
    .then((response) => ({
      status: response.status,
      message: (response.data?.message as string | undefined) ?? null,
    }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      message: e.response?.data?.message ?? "No se pudo conectar con el servidor.",
    }));
};

/**
 * `POST /auth/password/reset` — redeem the token from a reset link and set a
 * new password.
 *
 * Sends only `token` and `pass`, per Global Constraint #4: this route decides
 * whose account it is from the token's own row alone, and this function's
 * signature has no field for an id or an email to ride along with it even by
 * accident.
 *
 * A 400 here means one of two entirely different things — the link is dead
 * (expired, already used, or never existed, all three worded identically on
 * purpose) or the chosen password failed the server's own rule — and telling
 * them apart is `ResetPasswordPage.tsx`'s job, not this wrapper's, so the real
 * status and message are both preserved rather than folded down the way
 * `loginUsuario` folds every failure to 500.
 */
export const resetPassword = (
  token: string,
  pass: string
): Promise<{ status: number; message: string | null }> => {
  return axios
    .post(urlApi + "auth/password/reset", { token, pass })
    .then((response) => ({
      status: response.status,
      message: (response.data?.message as string | undefined) ?? null,
    }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      message: e.response?.data?.message ?? "No se pudo conectar con el servidor.",
    }));
};

/**
 * `estado` is mapped straight off `response.data.estado` — plan 4B's addition
 * to this body, next to `usuario` and `permisos`. Every real 200 carries one
 * of the three `EstadoSesion` strings; it is optional here only because a
 * mock or a stub answer built before this field existed still has to type-check.
 *
 * Two callers read this: `SesionProvider.tsx`'s startup effect, and
 * `LoginPage.tsx`'s own second call once a login comes back with no
 * `permisos` (see that file for why the login body cannot say `estado`
 * itself). Both turn `estado === "parcial"` into "not logged in yet" rather
 * than trusting the 200 alone — hallazgo A10/D4's loop has exactly these two
 * entries, and this is the one field that lets either of them tell a
 * finished login from one still owing a factor.
 */
export const comprobarToken = (): Promise<{
  status: number;
  usuario: UsuarioInterface | null;
  permisos?: Permisos;
  estado?: EstadoSesion;
}> => {
  return axios
    .get(`${urlApi}auth/me`)
    .then((response) => ({
      status: response.status,
      usuario: response.data.usuario as UsuarioInterface,
      permisos: response.data.permisos as Permisos | undefined,
      estado: response.data.estado as EstadoSesion | undefined,
    }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      usuario: null,
    }));
};

/**
 * `POST /auth/mfa/verify` — prove the second factor a `parcial` session still
 * owes, with either a six-digit TOTP code or a recovery code. The server
 * tells the two apart by shape (plan 4B, Task 7/11); this wrapper sends
 * whatever the person typed under the same `codigo` field
 * `api/src/controllers/totp.controller.ts`'s `confirmTotp` already uses, so
 * there is one name for "the code" across both endpoints rather than two.
 *
 * Real status and message kept on failure, same reasoning as
 * `sendVerificationEmail` above: a session the server just destroyed for five
 * wrong attempts (see the spec's rate-limit table) and a merely wrong code
 * are two different sentences arriving on the same endpoint, and the screen
 * has to show whichever one actually came back rather than one written here
 * that guesses.
 *
 * **No third sentence for a diagnosed clock skew, checked against
 * `api/src/controllers/mfa.controller.ts` as it actually ships.** The plan's
 * Task 7 Step 4 reads as though there would be one; what got built instead
 * logs `MFA_CLOCK_SKEW_DETECTED` to the bitácora only — the response is the
 * same `CODIGO_MFA_INVALIDO` whether the code was garbage or off by a
 * consistent number of steps. Kept general (`message` shown verbatim,
 * whatever it says) rather than written around a sentence that does not
 * exist today, so this needs no change the day that decision is revisited.
 *
 * **`recordar` — hallazgo E-7/F16.** `api/src/config/security.ts`'s
 * `REMEMBER_DEVICE_FIELD` and `mfa.controller.ts`'s `verify` handler have
 * read this field since the arc that built them; nothing on this side ever
 * sent it, so `dispositivo_recordado` could never gain a row. `undefined`
 * when the caller does not pass it, which `JSON.stringify` drops from the
 * body entirely — the same as never asking — so this stays a no-op for every
 * caller that predates the checkbox in `pages/login/SegundoFactorPage.tsx`.
 */
export const verifySecondFactor = (
  codigo: string,
  recordar?: boolean,
): Promise<{ status: number; message: string | null }> =>
  axios
    .post(urlApi + "auth/mfa/verify", { codigo, recordar }, { timeout: TIMEOUT_CONFIRMACION_MS })
    .then((response) => ({
      status: response.status,
      message: (response.data?.message as string | undefined) ?? null,
    }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      message: e.response?.data?.message ?? "No se pudo verificar el código.",
    }));

// `CODIGO_STEP_UP` y `esRechazoStepUp` vivían aquí y también en `Mfa.api.ts`.
// Ahora viven una sola vez en `stepUp.ts`; se reexportan porque la pantalla de
// login y `SesionProvider` ya los importan desde este fichero.
export { CODIGO_STEP_UP, esRechazoStepUp } from "./stepUp";
import { TIMEOUT_CONFIRMACION_MS } from "./stepUp";


/**
 * `GET /api/auth/sessions` — the devices this account is logged in on.
 *
 * Written here rather than in a file of its own because everything that reads
 * or ends a session is auth-scoped and already lives in this module: `login`
 * opens one, `comprobarToken` asks whether one is still good, and these three
 * are the rest of the same surface.
 *
 * The list is returned empty on any failure rather than thrown, and that is a
 * decision about the screen, not laziness. `PerfilPage` asks for this beside
 * the profile itself; a 500 here must not take the page down with it, because
 * everything else on it — the name, the phone, the recovery address — is
 * independent and still worth showing. The section simply does not render.
 */
export const getSessions = (): Promise<SesionActivaInterface[]> =>
  axios
    .get(`${urlApi}auth/sessions`)
    .then((r) => (r.data?.sesiones as SesionActivaInterface[]) ?? [])
    .catch(() => []);

/**
 * `DELETE /api/auth/sessions/:id` — end one of my own sessions.
 *
 * The id is a UUID the server itself sent in `getSessions`, and it is put in
 * the path unencoded for the same reason nothing else here encodes one: it is
 * a UUID, which has no character that means anything in a path segment. Should
 * that ever stop being true — a different id format — this is the line that
 * has to change.
 *
 * Answers 404 both for a session that does not exist and for one belonging to
 * somebody else, deliberately, so this endpoint cannot be used to find out who
 * is logged in right now. The screen therefore says the same thing for both,
 * which is the truth it is allowed to know: that row is not yours to close.
 */
export const endSession = (
  id: string
): Promise<{ status: number; message: string | null }> =>
  axios
    // Mismo motivo que `archiveRol` y `deleteUsuario`: sin `data` no hay
    // cuerpo donde el interceptor de step-up pueda meter la contraseña.
    .delete(`${urlApi}auth/sessions/${id}`, { data: {} })
    .then((r) => ({ status: r.status, message: r.data?.message ?? null }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      message: e.response?.data?.message ?? "No se pudo cerrar la sesión.",
    }));

/**
 * `POST /api/auth/logout-all` — end every session of this account, this one
 * included.
 *
 * The caller's own cookie is cleared by the server on the way out, so whoever
 * presses this is logged out here too. That is the point of the button and not
 * a side effect: it exists for the laptop left open somewhere, and a version
 * that spared the current device would leave the person unsure which sessions
 * actually died. `cerradas` is how many rows were revoked, which is what the
 * screen tells them afterwards.
 */
export const logoutAllSessions = (): Promise<{
  status: number;
  message: string | null;
  cerradas: number;
}> =>
  axios
    .post(`${urlApi}auth/logout-all`)
    .then((r) => ({
      status: r.status,
      message: r.data?.message ?? null,
      cerradas: (r.data?.cerradas as number) ?? 0,
    }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      message: e.response?.data?.message ?? "No se pudieron cerrar las sesiones.",
      cerradas: 0,
    }));

/**
 * `POST /api/auth/logout` — end the session behind whatever cookie this
 * browser is currently holding, proven or not.
 *
 * **Not `SesionProvider.tsx`'s own `logout()`.** That one only reaches the
 * server when `hasSessionRef` is already `true`, and that ref is derived from
 * `sesion.autenticado` — which `SesionInterface` deliberately keeps `false`
 * for a `parcial` session (a password typed, a factor still unproven). So the
 * one screen that ever holds a `parcial` session, `pages/login/
 * SegundoFactorPage.tsx`, could never reach the server through the context's
 * own `logout()` no matter how it called it.
 *
 * The server opened this exact route to `parcial` on purpose —
 * `api/src/auth/sessionState.ts`'s `PARCIAL` allow-list carries `/api/auth/
 * logout` (never `/logout-all`, which would also end that account's other,
 * genuinely open sessions elsewhere) — with the reasoning spelled out there:
 * abandoning the session in hand is the one thing anybody must always be able
 * to do. Hallazgo E-10/F13 is this gap: "Cancelar y volver a iniciar sesión"
 * used to reset only this tab's own state and leave the row — and the cookie,
 * good for up to seven days — alive for whoever opens the same machine next.
 *
 * Fire-and-forget by design, unlike `revokeOnServer` in `SesionProvider.tsx`:
 * there is no unsaved work behind this screen for a failed revoke to put at
 * risk, so a second UI surface reporting that failure back would be
 * answering a question nobody watching this screen is asking. The person is
 * on their way to `/login` regardless of whether this request lands.
 */
export const abandonPartialSession = (): Promise<void> =>
  axios
    .post(`${urlApi}auth/logout`)
    .then(() => undefined)
    .catch(() => undefined);
