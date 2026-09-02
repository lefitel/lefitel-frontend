import axios from "axios";
import { urlApi } from "./url";
import {
  STEP_UP_PASSWORD_FIELD,
  CODIGO_STEP_UP,
  describeStepUpError,
  TIMEOUT_CONFIRMACION_MS,
  type MotivoStepUp,
} from "./stepUp";

export { CODIGO_STEP_UP, describeStepUpError };
export type { MotivoStepUp };

/**
 * The field every step-up-gated route reads the caller's current password
 * from — `STEP_UP_PASSWORD_FIELD` in `api/src/config/security.ts`, copied
 * rather than imported for the same reason `LOGOUT_URL` and `ROLE_HEADER` in
 * `SesionProvider.tsx` are: this is a wire format between two repositories
 * deployed separately, not a shared constant either can import.
 *
 * `POST /auth/totp/setup`, `POST /auth/totp/confirm`, `DELETE /auth/totp` and
 * `POST /auth/recovery-codes` all read this field and none other — a `pass`
 * or an `oldPass` alongside it, the names the rest of this codebase uses for
 * a password, is never read. Verified against
 * `api/src/routes/totp.routes.ts`: all three TOTP routes mount
 * `requireStepUp({ exigeContrasena: true })`, which means **every one of
 * them demands the password, every time — including `confirm`, and including
 * a session that just typed the right six-digit code a moment ago.** That is
 * not an oversight this file works around; it is hallazgo C1's fix. Without
 * it, a stolen session cookie with no password could register its own
 * factor, and from that instant `tieneAlgunFactor` would deny the real
 * owner the password fallback too — a permanent lockout, not a narrower one.
 * `TotpSection.tsx` is built around that: it asks for the password once, at
 * the start of a registration attempt, and threads the same value through
 * both the `setup` and the immediate `confirm` that follows it, rather than
 * asking twice for one continuous action the person chose to start.
 */
// El contrato del step-up vive ahora en `stepUp.ts`, una sola vez. Estaba
// duplicado entre este fichero y `Login.api.ts`, y el interceptor del plan 4D
// es un tercer consumidor: tres copias de una constante compartida con otro
// repositorio es como acaban diciendo cosas distintas.
//
// Se reexportan `CODIGO_STEP_UP`, `MotivoStepUp` y `describeStepUpError`
// porque las pantallas del segundo factor ya importan esos nombres de aquí, y
// mover el fichero de origen no debería obligarlas a cambiar su import.

/** The shape every one of this file's calls can fail with, on top of
 *  whatever it succeeds with: a step-up refusal (`code`/`motivo`), a rate
 *  limit, or a plain network failure. `status` is never folded to 500 the
 *  way `loginUsuario` folds it in `Login.api.ts` — every screen built on
 *  this file has to tell a 409 apart from a 403 apart from a 503, and each
 *  of those is a different sentence and a different next action. */
export interface RespuestaMfa {
  status: number;
  message: string | null;
  code?: string;
  motivo?: MotivoStepUp;
}

function respuestaDeError(e: unknown): RespuestaMfa {
  const err = e as { response?: { status?: number; data?: { message?: string; code?: string; motivo?: string } } };
  return {
    status: err.response?.status ?? 500,
    message: err.response?.data?.message ?? "No se pudo conectar con el servidor.",
    code: err.response?.data?.code,
    motivo: err.response?.data?.motivo as MotivoStepUp | undefined,
  };
}

export interface SetupTotpResult extends RespuestaMfa {
  /** `null` on any non-200 — there is nothing to read a secret out of. */
  otpauth: string | null;
  secreto: string | null;
}

/**
 * `POST /auth/totp/setup` — start registering a TOTP factor.
 *
 * A fresh call always answers with a secret nobody has seen before, even for
 * an account that already has a setup pending — `api/src/controllers/totp.controller.ts`
 * replaces the unconfirmed row rather than reusing it. So this function is
 * safe to call again if the person closes the QR screen and comes back; it
 * is never "resuming" a previous attempt.
 *
 * 409 means one of two things `TotpSection.tsx` has to tell apart by
 * `message` (the server sends no `code` for either): the account's email is
 * not verified yet, or a *confirmed* factor already exists. Both are read
 * from `message` because, unlike the step-up motivos, the server has no
 * shared discriminator for them — there was never a need for one until this
 * screen existed to read it.
 */
export const setupTotp = (stepupPassword: string): Promise<SetupTotpResult> =>
  axios
    .post(`${urlApi}auth/totp/setup`, { [STEP_UP_PASSWORD_FIELD]: stepupPassword })
    .then((r) => ({
      status: r.status,
      message: (r.data?.message as string | undefined) ?? null,
      otpauth: (r.data?.otpauth as string | undefined) ?? null,
      secreto: (r.data?.secreto as string | undefined) ?? null,
    }))
    .catch((e) => ({ ...respuestaDeError(e), otpauth: null, secreto: null }));

export interface ConfirmTotpResult extends RespuestaMfa {
  /**
   * The account's first ten recovery codes, in clear — `null` on any
   * non-200, and **also** `null` on a 200 where the account already had an
   * outstanding, unspent sheet. `api/src/controllers/totp.controller.ts`'s
   * `confirmTotp` sends `codigos: null` explicitly rather than omitting the
   * field in that second case, precisely so this is "nothing was minted",
   * distinguishable from "the field does not exist yet" — see that
   * function's own comment on why regenerating there would have silently
   * invalidated a sheet already sitting in a drawer.
   *
   * Shown exactly once, the same rule `GenerarCodigosResult.codigos` below
   * documents for the standalone regenerate-codes endpoint: there is no
   * request anywhere that hands these back a second time, so a component
   * reading this field is the only place in the whole app that ever sees
   * them.
   */
  codigos: string[] | null;
}

/**
 * `POST /auth/totp/confirm` — prove the secret `setupTotp` just handed out.
 *
 * Also behind `requireStepUp({ exigeContrasena: true })` — see this file's
 * header comment on `STEP_UP_PASSWORD_FIELD` for why the same password used
 * for `setupTotp` is the one to send here too, rather than asking again.
 *
 * **Confirming now also, sometimes, issues the account's first ten recovery
 * codes** (Isaias, 2026-09-02) — see `ConfirmTotpResult.codigos` above and
 * `totp.controller.ts`'s own comment on `confirmTotp` for the full decision.
 */
export const confirmTotp = (codigo: string, stepupPassword: string): Promise<ConfirmTotpResult> =>
  axios
    .post(`${urlApi}auth/totp/confirm`, { codigo, [STEP_UP_PASSWORD_FIELD]: stepupPassword })
    .then((r) => ({
      status: r.status,
      message: (r.data?.message as string | undefined) ?? null,
      codigos: (r.data?.codigos as string[] | undefined) ?? null,
    }))
    .catch((e) => ({ ...respuestaDeError(e), codigos: null }));

/**
 * `DELETE /auth/totp` — remove the caller's own TOTP factor, confirmed or
 * still pending confirmation.
 *
 * The body rides on `config.data`, not a second positional argument — that
 * is how axios sends a body on a DELETE, and it is the only place in this
 * file that needs it: every other call here is a POST or a GET.
 *
 * Answers 404 (`MENSAJE_SIN_FACTOR`) when there is nothing to delete. That
 * is not an error `TotpSection.tsx` should raise an alarm over: it means
 * "there was nothing to remove", which is worth saying plainly rather than
 * as a red toast.
 */
export const deleteTotp = (stepupPassword: string): Promise<RespuestaMfa> =>
  axios
    .delete(`${urlApi}auth/totp`, { data: { [STEP_UP_PASSWORD_FIELD]: stepupPassword } })
    .then((r) => ({ status: r.status, message: (r.data?.message as string | undefined) ?? null }))
    .catch(respuestaDeError);

export interface GenerarCodigosResult extends RespuestaMfa {
  /**
   * The ten codes, in clear, exactly once. `null` on any non-200 — this
   * function has no path that returns a partial list, and there is no
   * endpoint anywhere that hands them back a second time. If this component
   * ever needs to show them again, that always means calling this function
   * again, which invalidates the ten it is about to replace.
   */
  codigos: string[] | null;
}

/**
 * `POST /auth/recovery-codes` — issue a fresh set of ten codes, first time or
 * regeneration alike (the server does not distinguish the two calls). Behind
 * `requireStepUp({ exigeContrasena: true })`, same as the three TOTP routes
 * above: hallazgo C14, so that a printed sheet alone can never regenerate
 * itself into a fresh ten.
 */
export const generateRecoveryCodes = (stepupPassword: string): Promise<GenerarCodigosResult> =>
  axios
    .post(`${urlApi}auth/recovery-codes`, { [STEP_UP_PASSWORD_FIELD]: stepupPassword })
    .then((r) => ({
      status: r.status,
      message: (r.data?.message as string | undefined) ?? null,
      codigos: (r.data?.codigos as string[] | undefined) ?? null,
    }))
    .catch((e) => ({ ...respuestaDeError(e), codigos: null }));

/**
 * `GET /auth/recovery-codes` — how many of the ten are still unspent. Never
 * the codes themselves; the server has no code path that returns them here,
 * only a count.
 *
 * Folds any failure to `restantes: null` rather than throwing, matching
 * `getSessions` in `Login.api.ts`: this number is one section of a page that
 * has other, independent things to show, and a failed count must not be
 * read as "zero left" — that would tell somebody they have no recovery codes
 * when the truth is this request simply did not come back.
 */
export const getRecoveryCodesRemaining = (): Promise<{ status: number; restantes: number | null }> =>
  axios
    .get(`${urlApi}auth/recovery-codes`)
    .then((r) => ({ status: r.status, restantes: (r.data?.restantes as number | undefined) ?? null }))
    .catch((e) => ({ status: (e as { response?: { status?: number } }).response?.status ?? 500, restantes: null }));

/**
 * `POST /auth/stepup` — volver a acreditar una sesión **ya completa** cuya
 * ventana de diez minutos ha vencido.
 *
 * 🔴 **No es lo mismo que `verifySecondFactor`, y elegir mal deja a alguien
 * atascado.** Aquélla (`POST /auth/mfa/verify`, en `Login.api.ts`) es la que
 * *levanta* una sesión a medias. Ésta sólo sirve cuando la sesión ya está
 * completa: el servidor filtra por ese estado, así que llamarla desde una
 * sesión a medias no falla con un mensaje útil — **carga un intento fallido
 * contra el bloqueo de la cuenta**, con el código correcto tecleado. Quién
 * llama a cuál lo decide `StepUpDialog` mirando el estado de la sesión.
 *
 * Acepta un solo campo, `codigo`: seis dígitos se leen como TOTP y cualquier
 * otra cosa como código de recuperación. La distinción la hace el servidor.
 *
 * `intentosRestantes` es lo que evita que alguien se quede fuera del ERP sin
 * haber leído un aviso: el mensaje de error es el mismo para un código mal
 * tecleado, uno ya usado y una cuenta bloqueada.
 */
export const probarStepUp = (
  codigo: string,
): Promise<{ status: number; message: string | null; intentosRestantes?: number }> =>
  axios
    .post(urlApi + "auth/stepup", { codigo }, { timeout: TIMEOUT_CONFIRMACION_MS })
    .then((response) => ({
      status: response.status,
      message: (response.data?.message as string | undefined) ?? null,
    }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      message: e.response?.data?.message ?? "No se pudo confirmar tu identidad.",
      intentosRestantes: e.response?.data?.intentosRestantes as number | undefined,
    }));
