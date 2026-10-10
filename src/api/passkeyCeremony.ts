// La ceremonia con el navegador, en un solo sitio, para las tres pantallas que
// la disparan: la ventana de step-up, la sección de llaves, y el segundo paso
// del login.
//
// 🔴 **Lo que la auditoría midió en `@simplewebauthn/browser` v14, y que el
// plan tenía mal:**
//
// - `startAuthentication`/`startRegistration` **no aceptan `signal`**. La
//   librería crea su propio `AbortController` desde un singleton de módulo
//   (`WebAuthnAbortService`), y **empezar una segunda ceremonia aborta la
//   primera** en todo el proceso. Cancelar es `cancelarCeremonia()`, no un
//   controlador propio. Un doble clic en «usar mi llave» aborta el diálogo del
//   sistema que estaba abierto: por eso el botón se deshabilita mientras dura.
// - La persona cancela el diálogo del sistema → `WebAuthnError` con
//   `name === "NotAllowedError"`. Nuestro abort → `name === "AbortError"`. Los
//   dos son silencio: la ventana se queda abierta, sin toast rojo.
// - Registrar en un autenticador que ya tiene una llave de esta cuenta →
//   `code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"`. Tiene su propia
//   frase, porque «no se pudo verificar» sería mentira.
// - Navegador sin WebAuthn → un `Error` plano, no un `WebAuthnError`. Se
//   detecta antes con `soportaPasskeys()` y no se pinta el botón; no se
//   captura después.
// - Safari exige activación transitoria (un clic reciente) para
//   `navigator.credentials.*`, y caduca en segundos. La petición de opciones
//   va **primero y sin nada en medio** después del clic; si aun así caduca, el
//   fallo se presenta como `NotAllowedError`, indistinguible de cancelar — y
//   se trata igual: silencio y la opción de repetir.
// - Los cuerpos son JSON con cadenas base64url. Ningún `ArrayBuffer` toca
//   axios, así que el interceptor del step-up los reenvía sin destruirlos.

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
} from "@simplewebauthn/browser";
import type { MotivoStepUp } from "./stepUp";
import type { SesionInterface } from "../interfaces/interfaces";
import {
  loginOptions,
  loginVerify,
  passwordlessOptions,
  passwordlessVerify,
  registerOptions,
  registerVerify,
} from "./Webauthn.api";

/** Si este navegador puede ejecutar una ceremonia. Se consulta antes de
 *  pintar cualquier botón de llave: en `jsdom` es `false`. */
export const soportaPasskeys = (): boolean => browserSupportsWebAuthn();

/** Aborta la ceremonia en curso, si la hay. Idempotente. */
export const cancelarCeremonia = (): void => {
  WebAuthnAbortService.cancelCeremony();
};

/** Lo que el navegador dijo cuando la ceremonia no terminó. */
type Fallo =
  | { cancelado: true }
  | { cancelado: false; yaRegistrada: boolean; message: string };

// Por `name` primero y por `code` después, sin mirar la clase: `WebAuthnError`
// copia el `name` del error del navegador (`name ?? cause.name`), así que un
// `NotAllowedError` se reconoce igual venga envuelto o crudo, y una sola
// comprobación es una sola cosa que mutar.
const clasificar = (err: unknown, alFallar: string): Fallo => {
  const e = (err ?? {}) as { name?: string; code?: string };
  if (e.name === "NotAllowedError" || e.name === "AbortError") return { cancelado: true };
  if (e.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
    return {
      cancelado: false,
      yaRegistrada: true,
      message: "Este dispositivo ya tiene una llave registrada para tu cuenta.",
    };
  }
  return { cancelado: false, yaRegistrada: false, message: alFallar };
};

export type ResultadoCeremonia =
  | { ok: true }
  /** La persona cerró el diálogo del sistema, o se abortó desde aquí. No es
   *  un error y no se enseña como tal. */
  | { ok: false; cancelado: true }
  | { ok: false; cancelado: false; status: number; message: string };

/**
 * Probar una llave que la cuenta ya tiene: opciones → diálogo del sistema →
 * canje. Sirve para terminar un login a medias y para reabrir la ventana de
 * step-up; el servidor decide cuál de las dos según la sesión.
 *
 * **Se llama desde un clic, nunca desde un efecto.** Y no toca `codigo` ni
 * llama a `/auth/stepup` o `/auth/mfa/verify`: el factor queda probado por la
 * aserción, y canjear un código vacío por costumbre cargaría un intento
 * fallido contra el bloqueo de la cuenta.
 */
export async function probarPasskey(): Promise<ResultadoCeremonia> {
  const opts = await loginOptions();
  if (opts.status !== 200 || !opts.opciones) {
    return {
      ok: false,
      cancelado: false,
      status: opts.status,
      message: opts.message ?? "No se pudo preparar la llave.",
    };
  }

  let respuesta;
  try {
    respuesta = await startAuthentication({ optionsJSON: opts.opciones });
  } catch (err) {
    const fallo = clasificar(err, "No se pudo usar la llave en este dispositivo.");
    if (fallo.cancelado) return { ok: false, cancelado: true };
    return { ok: false, cancelado: false, status: 0, message: fallo.message };
  }

  const canje = await loginVerify(respuesta);
  if (canje.status !== 200) {
    return {
      ok: false,
      cancelado: false,
      status: canje.status,
      message: canje.message ?? "No se pudo comprobar la llave.",
    };
  }
  return { ok: true };
}

export type ResultadoRegistro =
  | { ok: true; codigos: string[] | null }
  | { ok: false; cancelado: true }
  | {
      ok: false;
      cancelado: false;
      status: number;
      message: string;
      code?: string;
      motivo?: MotivoStepUp;
      /** El autenticador ya tenía una llave de esta cuenta: no es un fallo
       *  de la persona, y la frase lo dice. */
      yaRegistrada: boolean;
    };

/**
 * Registrar una llave nueva: opciones → diálogo del sistema → canje. Sin
 * contraseña: si la puerta pide probar algo, lo hace la ventana global al
 * contestar las opciones, **antes** del diálogo del sistema — ver
 * `Webauthn.api.ts`. Esa ventana es un clic más entre el botón y
 * `startRegistration`, y es el clic el que renueva la activación que Safari
 * exige; si aun así caduca, sale como una cancelación y se repite.
 */
export async function registrarPasskey(nombre: string): Promise<ResultadoRegistro> {
  const opts = await registerOptions();
  if (opts.status !== 200 || !opts.opciones) {
    return {
      ok: false,
      cancelado: false,
      status: opts.status,
      message: opts.message ?? "No se pudo empezar el registro de la llave.",
      code: opts.code,
      motivo: opts.motivo,
      yaRegistrada: false,
    };
  }

  let respuesta;
  try {
    respuesta = await startRegistration({ optionsJSON: opts.opciones });
  } catch (err) {
    const fallo = clasificar(err, "No se pudo crear la llave en este dispositivo.");
    if (fallo.cancelado) return { ok: false, cancelado: true };
    return {
      ok: false,
      cancelado: false,
      status: 0,
      message: fallo.message,
      yaRegistrada: fallo.yaRegistrada,
    };
  }

  const canje = await registerVerify(nombre, respuesta);
  if (canje.status !== 201) {
    return {
      ok: false,
      cancelado: false,
      status: canje.status,
      message: canje.message ?? "No se pudo registrar la llave.",
      code: canje.code,
      motivo: canje.motivo,
      yaRegistrada: false,
    };
  }
  return { ok: true, codigos: canje.codigos };
}

export type ResultadoEntrada =
  /** Dentro: la cookie ya está puesta y `sesion` es lo que dijo el servidor,
   *  con la forma que `LoginPage.tsx` ya sabe abrir. */
  | { ok: true; sesion: SesionInterface }
  | { ok: false; cancelado: true }
  | { ok: false; cancelado: false; status: number; message: string };

/**
 * Entrar con una llave y nada más — plan 4C, fase 2. Opciones → diálogo del
 * sistema → canje, sin sesión detrás: es la única ceremonia de este fichero
 * que se hace desde fuera. `entrarSinContrasena` y no «entrar con llave»,
 * porque el segundo paso del login ya llama así a lo suyo, que es otra cosa:
 * terminar un login que la contraseña empezó.
 *
 * **Desde un clic, nunca desde un efecto, y con las opciones como primera
 * petición después del clic.** Safari exige activación reciente para abrir
 * el diálogo y la caduca en segundos; una petición de más por delante y el
 * diálogo llega como `NotAllowedError`, indistinguible de cancelar.
 *
 * Cancelar el diálogo, o que nuestro propio abort lo cierre, es silencio: la
 * pantalla se queda como estaba. Cualquier otro fallo trae la frase del
 * servidor — la única que hay para todos los rechazos de esta puerta — o la
 * de conexión, y `status` real para quien quiera distinguir un 503.
 */
export async function entrarSinContrasena(): Promise<ResultadoEntrada> {
  const opts = await passwordlessOptions();
  if (opts.status !== 200 || !opts.opciones) {
    return {
      ok: false,
      cancelado: false,
      status: opts.status,
      message: opts.message ?? "No se pudo preparar la llave.",
    };
  }

  let respuesta;
  try {
    respuesta = await startAuthentication({ optionsJSON: opts.opciones });
  } catch (err) {
    const fallo = clasificar(err, "No se pudo usar la llave en este dispositivo.");
    if (fallo.cancelado) return { ok: false, cancelado: true };
    return { ok: false, cancelado: false, status: 0, message: fallo.message };
  }

  const canje = await passwordlessVerify(respuesta);
  if (canje.status !== 200 || !canje.usuario) {
    return {
      ok: false,
      cancelado: false,
      status: canje.status,
      message: canje.message ?? "No se pudo iniciar sesión con esa llave.",
    };
  }
  return { ok: true, sesion: canje.usuario };
}
