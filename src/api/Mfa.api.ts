import axios from "axios";
import { urlApi } from "./url";

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
const STEP_UP_PASSWORD_FIELD = "stepup_password";

/**
 * `requireStepUp`'s own discriminator, exported by the server beside `code`
 * so a client can act on *which* remedy applies instead of matching the
 * Spanish sentence. Mirrors
 * `MOTIVO_ESTADO_INCOMPLETO` / `MOTIVO_SIN_FACTOR_RECIENTE` /
 * `MOTIVO_CONTRASENA_INCORRECTA` / `MOTIVO_CONTRASENA_REQUERIDA` in
 * `api/src/middleware/requireStepUp.ts`.
 */
export type MotivoStepUp =
  | "estado-incompleto"
  | "sin-factor-reciente"
  | "contraseña-incorrecta"
  | "contraseña-requerida";

/** `CODIGO_STEP_UP` in `requireStepUp.ts` — the `code` a 403 from that gate
 *  always carries, whichever of the four `motivo`s comes with it. */
export const CODIGO_STEP_UP = "STEP_UP_REQUIRED";

/**
 * Four distinct sentences for four distinct remedies — deliberately **not**
 * a pass-through of the server's own `message`.
 *
 * `requireStepUp.ts` answers `sin-factor-reciente` and `contraseña-incorrecta`
 * with the exact same generic sentence server-side (`MENSAJE`, in that file):
 * "Esta operación necesita que confirmes tu identidad." That is the right
 * call *there* — the server does not want to hint at which comparison it just
 * ran — but showing that same sentence for both on this screen would accuse
 * somebody of mistyping a password they never typed, in the one case where
 * the account has nothing fresh to prove and no password was ever compared.
 * The dispatch brief for this task names this exactly: "Son cuatro frases
 * distintas en pantalla; juntarlas acusa a alguien de teclear mal una
 * contraseña que nunca tecleó." So this table, not `response.message`, is
 * what `TotpSection.tsx` and `RecoveryCodesSection.tsx` read a 403 through.
 */
const MOTIVO_MENSAJE: Record<MotivoStepUp, string> = {
  "estado-incompleto": "Termina de configurar tu segundo factor antes de realizar esta operación.",
  "sin-factor-reciente":
    "Antes de continuar, prueba tu segundo factor actual (o usa un código de recuperación) para confirmar que eres tú.",
  "contraseña-incorrecta": "Esa contraseña no es correcta. Inténtalo de nuevo.",
  "contraseña-requerida": "Escribe tu contraseña actual para continuar.",
};

/**
 * Turn a step-up refusal into the one sentence this screen shows for it.
 *
 * `motivo` wins whenever it is one of the four known values — see
 * `MOTIVO_MENSAJE` above for why the server's own `message` is not trusted
 * for this. Anything else (no `motivo` at all, or a fifth value a future
 * server version might add) falls back to whatever the server actually said,
 * so an unrecognised refusal still shows something rather than nothing.
 */
export function describeStepUpError(motivo: string | undefined, fallbackMessage: string | null): string {
  if (motivo && motivo in MOTIVO_MENSAJE) return MOTIVO_MENSAJE[motivo as MotivoStepUp];
  return fallbackMessage || "Ocurrió un error en el servidor.";
}

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

/**
 * `POST /auth/totp/confirm` — prove the secret `setupTotp` just handed out.
 *
 * Also behind `requireStepUp({ exigeContrasena: true })` — see this file's
 * header comment on `STEP_UP_PASSWORD_FIELD` for why the same password used
 * for `setupTotp` is the one to send here too, rather than asking again.
 */
export const confirmTotp = (codigo: string, stepupPassword: string): Promise<RespuestaMfa> =>
  axios
    .post(`${urlApi}auth/totp/confirm`, { codigo, [STEP_UP_PASSWORD_FIELD]: stepupPassword })
    .then((r) => ({ status: r.status, message: (r.data?.message as string | undefined) ?? null }))
    .catch(respuestaDeError);

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
