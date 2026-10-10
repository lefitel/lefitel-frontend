import axios from "axios";
import { urlApi } from "./url";
import {
  CODIGO_STEP_UP,
  cuerpoDeCanje,
  describeStepUpError,
  TIMEOUT_CONFIRMACION_MS,
  type MetodoSegundoFactor,
  type MotivoStepUp,
} from "./stepUp";

export { CODIGO_STEP_UP, describeStepUpError };
export type { MotivoStepUp };

/**
 * **None of the calls in this file carries a password.** `POST
 * /auth/totp/setup`, `POST /auth/totp/confirm`, `DELETE /auth/totp` and `POST
 * /auth/recovery-codes` sit behind the step-up gate, and until 2026-10-10 each
 * of them demanded the password in the body on every request — so
 * `TotpSection.tsx` and `RecoveryCodesSection.tsx` asked for it in a form of
 * their own, and an account with a factor was then asked for it a second time
 * by the step-up dialog. Isaias put every gated route inside the ten-minute
 * window that day: one confirmation, one method, good for a few minutes.
 *
 * So these functions send what the operation needs and nothing else. When the
 * gate refuses, the global interceptor (`stepUpInterceptor.ts`) opens the
 * dialog, proves whatever the server asked for, and sends the request again —
 * the promise returned here resolves with the retried answer, and the screen
 * never sees the 403 unless the person cancelled.
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

// Exportada desde el plan 4C: `Webauthn.api.ts` pliega sus errores con la
// misma forma, y una segunda copia es como dos ficheros acaban discrepando.
export function respuestaDeError(e: unknown): RespuestaMfa {
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
export const setupTotp = (): Promise<SetupTotpResult> =>
  axios
    .post(`${urlApi}auth/totp/setup`, {})
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
 * Behind the gate like `setupTotp`, and covered by the window that call
 * just opened: confirming does not ask for anything again.
 *
 * **Confirming now also, sometimes, issues the account's first ten recovery
 * codes** (Isaias, 2026-09-02) — see `ConfirmTotpResult.codigos` above and
 * `totp.controller.ts`'s own comment on `confirmTotp` for the full decision.
 */
export const confirmTotp = (codigo: string): Promise<ConfirmTotpResult> =>
  axios
    .post(`${urlApi}auth/totp/confirm`, { codigo })
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
 * Answers 404 (`MENSAJE_SIN_FACTOR`) when there is nothing to delete. That
 * is not an error `TotpSection.tsx` should raise an alarm over: it means
 * "there was nothing to remove", which is worth saying plainly rather than
 * as a red toast.
 */
export const deleteTotp = (): Promise<RespuestaMfa> =>
  axios
    .delete(`${urlApi}auth/totp`)
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
 * the gate, inside the window like everything else here.
 */
export const generateRecoveryCodes = (): Promise<GenerarCodigosResult> =>
  axios
    .post(`${urlApi}auth/recovery-codes`, {})
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
 * llama a cuál lo decide `useStepUpCeremony.ts` mirando el estado de la sesión.
 *
 * Acepta `codigo` y, desde el plan 4E, un `metodo` opcional. Sin él, seis
 * dígitos se leen como TOTP y cualquier otra cosa como código de recuperación
 * — la distinción la hace el servidor, como siempre. **El código del correo
 * son también seis dígitos**, así que ése tiene que ir con `metodo: "correo"`
 * o el servidor lo probará contra la aplicación, lo dará por erróneo y cargará
 * un intento contra el bloqueo con el código correcto tecleado. Qué clase
 * viaja lo decide `useStepUpCeremony.ts`, a partir del selector de la ventana.
 *
 * `intentosRestantes` es lo que evita que alguien se quede fuera del ERP sin
 * haber leído un aviso: el mensaje de error es el mismo para un código mal
 * tecleado, uno ya usado y una cuenta bloqueada.
 */
export const probarStepUp = (
  codigo: string,
  metodo?: MetodoSegundoFactor,
): Promise<{ status: number; message: string | null; intentosRestantes?: number }> =>
  axios
    .post(urlApi + "auth/stepup", cuerpoDeCanje(codigo, undefined, metodo), { timeout: TIMEOUT_CONFIRMACION_MS })
    .then((response) => ({
      status: response.status,
      message: (response.data?.message as string | undefined) ?? null,
    }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      message: e.response?.data?.message ?? "No se pudo confirmar tu identidad.",
      intentosRestantes: e.response?.data?.intentosRestantes as number | undefined,
    }));

/** Lo que `POST /auth/mfa/email-code` contesta, en cualquiera de sus salidas. */
export interface EnvioCodigoCorreo {
  status: number;
  message: string | null;
  /** La dirección a la que fue, ya enmascarada por el servidor (`i***@osefi.net`); `null` si no salió. */
  enviado_a: string | null;
  /** Segundos hasta poder pedir otro: viene en el 200 (el cooldown) y en el 429 (lo que falte del tope). */
  reintento_en_s: number | null;
}

/**
 * `POST /auth/mfa/email-code` — pedir un código de seis cifras al correo
 * verificado de la propia cuenta (plan 4E).
 *
 * Sin cuerpo: la cuenta y la dirección son las de la sesión, y una petición
 * que pudiera nombrar otra dirección sería la puerta que §3.4 del diseño cierra.
 * Se manda `{}` y no nada, por el motivo que `stepUpInterceptor.ts` mide: sin
 * segundo argumento, axios deja `Content-Type: application/x-www-form-urlencoded`
 * y el servidor sólo monta `express.json()`.
 *
 * 🔴 **Nunca se llama al montar una pantalla** (S4 de la preauditoría): cada
 * envío gasta cuota del correo, y la pestaña del correo se abre también por
 * curiosidad. Lo llama un botón, y sólo un botón.
 *
 * Cuatro respuestas, y la pantalla tiene que distinguirlas: 200 con la
 * dirección enmascarada y el cooldown; 429 con `reintento_en_s` del servidor,
 * que es el valor que manda la cuenta atrás (no uno inventado aquí); 503 —
 * ningún proveedor pudo enviarlo, y el código anterior sigue vivo — con la
 * frase que dice «prueba otro método»; 400 sin correo verificado. Por eso el
 * estado se conserva y no se pliega a 500.
 *
 * El plazo es `TIMEOUT_CONFIRMACION_MS` (20 s): el servidor acota su propio
 * envío a 12 s antes de contestar, así que 20 deja margen sin dejar a la
 * persona mirando un botón que gira para siempre.
 */
export const pedirCodigoPorCorreo = (): Promise<EnvioCodigoCorreo> =>
  axios
    .post(`${urlApi}auth/mfa/email-code`, {}, { timeout: TIMEOUT_CONFIRMACION_MS })
    .then((r) => ({
      status: r.status,
      message: (r.data?.message as string | undefined) ?? null,
      enviado_a: (r.data?.enviado_a as string | undefined) ?? null,
      reintento_en_s: (r.data?.reintento_en_s as number | undefined) ?? null,
    }))
    .catch((e) => ({
      status: e.response?.status ?? 500,
      message: e.response?.data?.message ?? "No se pudo enviar el código.",
      enviado_a: null,
      reintento_en_s: (e.response?.data?.reintento_en_s as number | undefined) ?? null,
    }));
