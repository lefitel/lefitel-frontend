import axios from "axios";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { urlApi } from "./url";
import { STEP_UP_PASSWORD_FIELD, TIMEOUT_CONFIRMACION_MS } from "./stepUp";
import { respuestaDeError, type RespuestaMfa } from "./Mfa.api";
import type { SesionInterface } from "../interfaces/interfaces";
import type { Permisos } from "../lib/permissions";

/**
 * Las llaves de acceso (passkeys) — plan 4C, fase 1. Sólo HTTP: la ceremonia
 * con el navegador vive en `passkeyCeremony.ts`, que llama a esto.
 *
 * **Misma forma que `Mfa.api.ts`, y por el mismo motivo.** `POST
 * /auth/webauthn/register/options` y `/register/verify` están las dos detrás
 * de `requireStepUp({ exigeContrasena: true })`, así que registrar una llave
 * son **dos** peticiones que piden la contraseña. Dejar que las conteste el
 * interceptor global sería: 403 → ventana de contraseña → opciones → **el
 * diálogo biométrico del sistema** → 403 → ventana de contraseña otra vez.
 * Tres avisos para un solo gesto. Y peor: el reto que emiten las opciones
 * caduca a los dos minutos (`WEBAUTHN_CHALLENGE_TTL_MS`), así que una segunda
 * ventana con tiempo de tecleo humano dentro lo agota, y la persona lee «vuelve
 * a intentarlo desde el principio» sin saber por qué. Así que la sección pide
 * la contraseña una vez y la manda en las dos, como `TotpSection` hace con
 * `setup` y `confirm`.
 *
 * `loginOptions`/`loginVerify` no llevan puerta ni contraseña: las llama una
 * sesión a medias que aún no ha probado nada, y sirven igual para terminar un
 * login que para reabrir la ventana de step-up de una sesión completa.
 */

export interface RegisterOptionsResult extends RespuestaMfa {
  /** `null` en todo lo que no sea 200. */
  opciones: PublicKeyCredentialCreationOptionsJSON | null;
}

export const registerOptions = (stepupPassword: string): Promise<RegisterOptionsResult> =>
  axios
    .post(`${urlApi}auth/webauthn/register/options`, {
      [STEP_UP_PASSWORD_FIELD]: stepupPassword,
    })
    .then((r) => ({
      status: r.status,
      message: null,
      opciones: (r.data as PublicKeyCredentialCreationOptionsJSON | undefined) ?? null,
    }))
    .catch((e) => ({ ...respuestaDeError(e), opciones: null }));

export interface RegisterVerifyResult extends RespuestaMfa {
  /**
   * Los diez códigos de recuperación de la cuenta, en claro, **sólo** cuando
   * esta llave es el primer factor que se registra y no había una hoja sin
   * gastar. `null` en cualquier otro caso — igual que `confirmTotp`, y por la
   * misma razón: no hay ningún endpoint que los devuelva una segunda vez.
   */
  codigos: string[] | null;
}

export const registerVerify = (
  nombre: string,
  respuesta: RegistrationResponseJSON,
  stepupPassword: string,
): Promise<RegisterVerifyResult> =>
  axios
    .post(`${urlApi}auth/webauthn/register/verify`, {
      nombre,
      respuesta,
      [STEP_UP_PASSWORD_FIELD]: stepupPassword,
    })
    .then((r) => ({
      status: r.status,
      message: (r.data?.message as string | undefined) ?? null,
      codigos: (r.data?.codigosRecuperacion as string[] | undefined) ?? null,
    }))
    .catch((e) => ({ ...respuestaDeError(e), codigos: null }));

export interface LoginOptionsResult {
  status: number;
  message: string | null;
  /** `null` en todo lo que no sea 200 — un 400 significa «esta cuenta no
   *  tiene ninguna llave», que la pantalla ya sabe antes de llamar. */
  opciones: PublicKeyCredentialRequestOptionsJSON | null;
}

export const loginOptions = (): Promise<LoginOptionsResult> =>
  axios
    .post(`${urlApi}auth/webauthn/login/options`, {}, { timeout: TIMEOUT_CONFIRMACION_MS })
    .then((r) => ({
      status: r.status,
      message: null,
      opciones: (r.data as PublicKeyCredentialRequestOptionsJSON | undefined) ?? null,
    }))
    .catch((e) => ({ ...respuestaDeError(e), opciones: null }));

/**
 * `POST /auth/webauthn/login/verify` — canjear la aserción.
 *
 * Contesta 200 tanto si levantó una sesión a medias como si reabrió la ventana
 * de una completa; el cliente no distingue los dos casos ni necesita hacerlo.
 * Un fallo de firma **no** carga contra el bloqueo de la cuenta (decisión D7),
 * pero sí contra un cupo de treinta ceremonias por sesión y cuarto de hora, y
 * ese 429 llega sin `code`: sólo con su frase.
 */
export const loginVerify = (respuesta: AuthenticationResponseJSON): Promise<RespuestaMfa> =>
  axios
    .post(`${urlApi}auth/webauthn/login/verify`, { respuesta }, { timeout: TIMEOUT_CONFIRMACION_MS })
    .then((r) => ({ status: r.status, message: (r.data?.message as string | undefined) ?? null }))
    .catch(respuestaDeError);

/**
 * `POST /auth/webauthn/passwordless/options` — el reto para entrar **sin
 * contraseña y sin sesión** (plan 4C, fase 2).
 *
 * No manda nada en el cuerpo, y el servidor no lee nada: no hay usuario que
 * nombrar, porque preguntar «¿tiene llave esta cuenta?» sería un oráculo que
 * dice a quién hacerle phishing de contraseña. Las opciones vuelven con
 * `allowCredentials` vacío y el navegador ofrece las llaves que tenga.
 *
 * Sin cookie no hay interceptor de sesión que reaccione, y el de step-up
 * excluye esta ruta por nombre. Lo que sí puede venir es un 429 del cubo por
 * dirección — «Demasiados intentos con la llave desde esta red» — o un 403
 * de la puerta de origen; los dos llegan con su frase y sin `code`.
 */
export const passwordlessOptions = (): Promise<LoginOptionsResult> =>
  axios
    .post(`${urlApi}auth/webauthn/passwordless/options`, {}, { timeout: TIMEOUT_CONFIRMACION_MS })
    .then((r) => ({
      status: r.status,
      message: null,
      opciones: (r.data as PublicKeyCredentialRequestOptionsJSON | undefined) ?? null,
    }))
    .catch((e) => ({ ...respuestaDeError(e), opciones: null }));

/**
 * Lo que devuelve `passwordlessVerify`: **la misma forma que `loginUsuario`**
 * en `Login.api.ts`, porque un login por llave que sale bien tiene que aterrizar
 * en la misma pantalla que uno por contraseña, y `LoginPage.tsx` ya sabe leer
 * esta forma — `usuario` con `permisos` es una sesión entera; sin `permisos`,
 * hay que preguntarle a `/auth/me`.
 *
 * Una diferencia, y es a propósito: aquí `status` es el **real**, no el 500
 * al que `loginUsuario` pliega todo fallo. Esta puerta contesta 400 con una
 * frase única para cualquier rechazo, 429 desde el cubo por dirección, 503 si
 * no pudo abrir la sesión y 403 desde la puerta de origen; la pantalla no
 * distingue entre ellos más que por la frase, pero un número plegado a mano
 * es lo que hizo que otra pantalla acertara «por accidente» durante meses.
 */
export interface PasswordlessVerifyResult {
  status: number;
  message: string | null;
  usuario: SesionInterface | null;
}

/**
 * `POST /auth/webauthn/passwordless/verify` — canjear la aserción por una
 * sesión. El 200 trae `{ usuario, permisos, message }`, el mismo cuerpo que
 * `POST /auth/login` para una sesión completa, y la cookie viene puesta.
 */
/**
 * Cuánto se espera al canje antes de rendirse. Tres veces el tope de las
 * ceremonias con sesión, y el motivo de que no sea infinito ni de veinte
 * segundos: el servidor abre la sesión y pone la cookie **antes** de
 * contestar, así que un canje cortado a los veinte segundos en una conexión
 * de campo dejaría a la persona dentro leyendo «no se pudo conectar». Pero
 * sin tope ninguno, un enlace colgado deja las **dos** puertas del login
 * deshabilitadas —el botón de la llave, el de la contraseña y la tecla
 * Enter— durante los minutos que el navegador tarde en rendirse solo, con un
 * spinner por toda explicación. Sesenta segundos, y la frase de abajo dice lo
 * que de verdad puede haber pasado.
 */
export const TIMEOUT_CANJE_MS = 60_000;

export const MENSAJE_CANJE_SIN_RESPUESTA =
  "El servidor tardó demasiado en contestar. Puede que la sesión se haya abierto igual: recargá la página antes de volver a intentarlo.";

export const passwordlessVerify = (
  respuesta: AuthenticationResponseJSON,
): Promise<PasswordlessVerifyResult> =>
  axios
    .post(`${urlApi}auth/webauthn/passwordless/verify`, { respuesta }, { timeout: TIMEOUT_CANJE_MS })
    .then((r) => {
      // Sin persona en el cuerpo no hay sesión que abrir, y la pantalla no debe
      // recibir una vacía que la mande a «sin acceso» con la cabecera en
      // blanco. `loginUsuario` llega al mismo `null` por otro camino (su
      // destructuración revienta y el `catch` lo pliega); aquí se dice.
      const persona = r.data?.usuario as (SesionInterface["usuario"] & { token?: unknown }) | undefined;
      if (!persona) {
        return { status: r.status, message: (r.data?.message as string | undefined) ?? null, usuario: null };
      }
      // Misma limpieza que `loginUsuario`: nada pone un `token` en este cuerpo,
      // y se quita igual, porque es lo único que se interpone entre un campo
      // futuro y el objeto de sesión que lee toda la aplicación.
      const { token: _jwt, ...usuario } = persona;
      return {
        status: r.status,
        message: (r.data?.message as string | undefined) ?? null,
        usuario: {
          usuario,
          permisos: r.data?.permisos as Permisos | undefined,
          // `false` a propósito, como en `loginUsuario`: este envoltorio sólo
          // transporta lo que dijo el servidor; quien decide «autenticado» es
          // `LoginPage.tsx`, en un solo sitio.
          autenticado: false,
        },
      };
    })
    .catch((e) => {
      const error = e as { code?: string; response?: { status?: number; data?: { message?: string } } };
      const sinRespuesta = !error.response;
      return {
        status: error.response?.status ?? 500,
        message:
          error.response?.data?.message ??
          (sinRespuesta && error.code === "ECONNABORTED"
            ? MENSAJE_CANJE_SIN_RESPUESTA
            : "No se pudo conectar con el servidor."),
        usuario: null,
      };
    });

export interface Credencial {
  id: number;
  nombre: string;
  /** ISO. */
  created_at: string;
  /** ISO, o `null` hasta el primer uso. Con `created_at`, lo único que
   *  distingue dos llaves llamadas «mi móvil»: no hay unicidad de nombre. */
  last_used_at: string | null;
  /** Tal como lo guarda el servidor: una cadena separada por comas
   *  (`"internal,hybrid"`) o `null`. **No** es una lista. */
  transports: string | null;
}

/**
 * `GET /auth/webauthn/credentials` — las llaves de la cuenta que llama.
 *
 * Cualquier fallo se pliega a `credenciales: null` en vez de lanzar, como
 * `getRecoveryCodesRemaining`: esta lista es una sección de una página con
 * otras cosas que enseñar, y una petición que no volvió no puede leerse como
 * «no tienes llaves».
 */
export const listCredentials = (): Promise<{ status: number; credenciales: Credencial[] | null }> =>
  axios
    .get(`${urlApi}auth/webauthn/credentials`)
    .then((r) => ({
      status: r.status,
      credenciales: (r.data?.credenciales as Credencial[] | undefined) ?? null,
    }))
    .catch((e) => ({
      status: (e as { response?: { status?: number } }).response?.status ?? 500,
      credenciales: null,
    }));

export interface DeleteCredentialResult extends RespuestaMfa {
  /**
   * 🔴 `true` cuando el servidor acaba de cerrar **todas** las sesiones de la
   * cuenta, la de este navegador incluida, porque la llave borrada era el
   * último factor (o no pudo comprobar si lo era y cerró por precaución).
   * La siguiente petición será un 401 pelado y `SesionProvider` sacará a la
   * persona al login: la sección no debe volver a pedir la lista —llegaría
   * un segundo aviso contradictorio encima del primero— y el mensaje tiene
   * que ir en un toast, que sobrevive a esa navegación; un texto en línea no.
   */
  sesionCerrada: boolean;
}

/**
 * `DELETE /auth/webauthn/credentials/:id` — quitar una llave propia.
 *
 * El cuerpo va en `config.data`, como `deleteTotp`. 404 es «esa llave no
 * existe», la misma frase sea de quien sea — no es un error que enseñar en
 * rojo. Un 500 con `code: "REVOCACION_FALLIDA"` es el único caso que la
 * pantalla tiene que distinguir de un 500 cualquiera: la llave se borró y las
 * sesiones **no** se cerraron; el remedio está en la frase.
 */
export const deleteCredential = (id: number, stepupPassword: string): Promise<DeleteCredentialResult> =>
  axios
    .delete(`${urlApi}auth/webauthn/credentials/${id}`, {
      data: { [STEP_UP_PASSWORD_FIELD]: stepupPassword },
    })
    .then((r) => ({
      status: r.status,
      message: (r.data?.message as string | undefined) ?? null,
      sesionCerrada: r.data?.sesion_cerrada === true,
    }))
    .catch((e) => ({ ...respuestaDeError(e), sesionCerrada: false }));
