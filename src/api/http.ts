// How this application talks to the API, decided once.
//
// Two settings, and until both of them existed the whole session cookie was
// unreachable code. www.osefi.net and api.osefi.net are different origins, so a
// browser does two things nobody asked it to: it throws away the `Set-Cookie` of
// a cross-origin response that does not carry
// `Access-Control-Allow-Credentials: true`, and it declines to send the cookie
// back unless the request itself was made in credentials mode. The server half
// is `credentials: true` in `api/src/app.ts`; this is the other half. Without
// it, logging in set a cookie the browser discarded on the spot, and six tasks
// of session work on the server could never have run in production even once.
//
// Set on the axios singleton rather than on an instance, because there is no
// instance: `axios.create` appears nowhere in this repository and all twenty-odd
// api modules import the package default. One place therefore covers all of
// them, and — more to the point — covers the next one somebody writes without
// having read this file.
//
// Imported for its side effects from `main.tsx`, and it has to be: nothing here
// exports anything the application calls, so if that import is ever deleted this
// module simply stops running and every write starts coming back 403 in
// production while every test still passes. `http.test.ts` asserts the import is
// there, for exactly that reason.

import axios from "axios";
import { instalarInterceptorStepUp } from "./stepUpInterceptor";
import { marcarFallo, SIN_CONEXION } from "./fallo";

/**
 * The header every write carries, so the server can tell a request from this
 * application apart from one a page on another site made the browser send.
 *
 * The name is a wire format shared with the API, which checks that it is present
 * and never what it says. That is deliberate on both sides: whatever value we
 * chose would ship inside a bundle anybody can read, so it cannot be a secret,
 * and a value nobody verifies is a value nobody can break by changing. What
 * actually protects the request is that this is not one of the four
 * CORS-safelisted request headers, so a browser refuses to attach it to a
 * cross-site request until the server has granted permission in a preflight —
 * and the API grants that only to this application's own origin.
 */
export const CLIENT_HEADER = "X-Osefi-Client";
/**
 * Which client, and which build of it.
 *
 * It said `"web"` flat until the API standard's E4. The server checks that this
 * header is present and never what it says — see `CSRF_CLIENT_HEADER` in the
 * API's `config/security.ts`, where that is a decision rather than an omission —
 * so the version rides along for free and breaks nothing.
 *
 * What it buys is the question nobody could answer before: **who is still on the
 * old build?** The API writes one log line per request; with the version in it,
 * that is a query instead of a guess. It matters at the deployment cut, when
 * server and client change contract together and an old client is not a slow
 * client but a broken one.
 *
 * Read from `package.json` at build time through the same `__APP_VERSION__` the
 * changelog screen uses, so the two cannot drift.
 */
export const CLIENT_HEADER_VALUE = `web/${__APP_VERSION__}`;

/**
 * The methods the API demands the header on: the ones that change something.
 *
 * Not `headers.common`, and the difference is measured rather than tidy. A
 * non-safelisted header turns an otherwise simple request into one that needs a
 * preflight, and the report exporters fetch photographs one at a time — around
 * two thousand `GET`s for a large export. On `common` that would be four
 * thousand round trips instead of two thousand. On a write it costs nothing: a
 * JSON body is already `Content-Type: application/json`, which is not safelisted
 * either, so those requests were being preflighted anyway.
 */
const WRITE_METHODS = ["post", "put", "patch", "delete"] as const;

/**
 * Every request, including the ones that leave this API.
 *
 * `withCredentials` is global and that is safe, which is worth spelling out
 * because "send credentials everywhere" reads like it should not be. The session
 * cookie is set by the API with no `Domain` attribute, which makes it host-only:
 * a browser sends a host-only cookie when the request host is that exact host and
 * on no other condition — not a parent domain, not a sibling subdomain, not a
 * lookalike. So it cannot travel anywhere but api.osefi.net, whatever URL axios
 * is handed.
 *
 * Which matters for the one place that hands axios a URL built from database
 * content: `lib/exports/reportGeneral.ts` fetches each photograph with
 * `axios.get(src)`, where `src` comes from `imageUrl()`. `imageUrl` exists
 * because concatenating a stored value onto the API host used to be able to
 * produce a request to somebody else's server — see the comment in
 * `lib/imageUrl.ts`, and `imageUrl.test.ts`, which pins the property that the
 * result is always on our own origin. Even without that property the cookie
 * could not follow, for the host-only reason above; with it, the request does not
 * leave in the first place.
 *
 * The genuinely third-party calls this application makes — OpenRouteService in
 * `lib/orsRoute.ts` and Nominatim in `components/map/MapSearch.tsx` — do not go
 * through axios at all; both use `fetch`, whose own default is
 * `credentials: "same-origin"`. So neither of these settings reaches either of
 * them, and `http.test.ts` keeps it that way.
 */
axios.defaults.withCredentials = true;

for (const method of WRITE_METHODS) {
  axios.defaults.headers[method][CLIENT_HEADER] = CLIENT_HEADER_VALUE;
}

/**
 * How a repeated query parameter is written on the wire.
 *
 * 🔴 **Without this, every filter and every sort order in the application was
 * silently discarded by the server**, and had been since the lists started
 * sending them. Axios writes an array as `filterColumn[]=name&filterColumn[]=poste`.
 * Express 5 changed its default query parser from `extended` to `simple`, and
 * `simple` is `querystring.parse`, which does not interpret the brackets: the
 * server received a parameter whose **name** was the seven characters
 * `filterColumn[]` and nothing at all under `filterColumn`. Every controller
 * then read `undefined`, normalised it to `[]`, and answered the unfiltered,
 * unsorted table — with the filter chip still drawn as active on screen.
 *
 * `indexes: null` writes `filterColumn=name&filterColumn=poste` instead, which
 * `querystring.parse` turns into the array the controllers expect, and a single
 * value into a plain string, which they already handle.
 *
 * **Why here and not on the server.** The other one-line fix is
 * `app.set("query parser", "extended")`, which swaps in `qs` for every route in
 * the API at once — and `qs` also reads `?a[b][c]=1` as a nested object where
 * every handler in the codebase expects a string. Widening the shape of
 * `req.query` across the whole surface to fix how one client writes a list is
 * the larger change, and the riskier one. The repeated-key form is also what
 * the API's own tests have always sent (`supertest` writes arrays that way), so
 * this makes the client agree with the contract the server was already tested
 * against, rather than moving the contract.
 *
 * Nothing was measuring the join: the client's tests mock the API modules and
 * the server's tests speak to it through `supertest`, so no test in either
 * repository ever put an array through axios and pulled it out of Express.
 * `listado.test.ts` does now.
 */
axios.defaults.paramsSerializer = { indexes: null };


// El interceptor del step-up, registrado a nivel de módulo desde aquí — no
// dentro de un efecto de React. El porqué está en su propio fichero: en un
// efecto, `React.StrictMode` invierte el orden de registro en desarrollo y no
// en producción, así que probarlo con `npm run dev` no dice nada de lo que
// hará desplegado.
//
// Se instala aquí y no en `main.tsx` porque este módulo ya es el único punto
// donde se configura cómo habla la aplicación con la API, y `http.test.ts` ya
// vigila que `main.tsx` lo importe.
export const ID_INTERCEPTOR_STEP_UP = instalarInterceptorStepUp();

/**
 * El traductor de fallos, y va **después** del interceptor del segundo factor.
 *
 * Lo que hace: a todo rechazo de axios le engancha `error.normalized = {status,
 * message}` y lo vuelve a rechazar **tal cual**, con el `AxiosError` original.
 * Antes de esto, un 403 por permiso, un 500 del servidor y una red caída
 * llegaban los tres a la pantalla como el número 400, porque la capa de `api/`
 * los aplastaba con `.catch(() => 400)`. La información se destruía antes de
 * que nadie pudiera mirarla.
 *
 * **Las dos reglas de aquí abajo protegen cosas distintas, y confundirlas
 * rompe una de las dos en silencio.** Medido contra el axios instalado, no
 * razonado:
 *
 * - **El orden es defensa, no lo que sostiene el segundo factor hoy.** Axios
 *   ejecuta los manejadores de respuesta en orden de registro, también los de
 *   error, así que el del segundo factor ve el fallo antes que esto. Pero
 *   medido: **ponerlo delante tampoco lo cegaría**, porque esto sólo añade un
 *   campo y vuelve a rechazar el mismo objeto, con su `response.status` y su
 *   `data.code` intactos. El orden importaría el día que alguien hiciera que
 *   rechazara con otra cosa — que es justo lo que la regla de abajo prohibe—,
 *   y por eso se fija igualmente.
 * - **Rechazar con el error original protege al cierre de sesión.**
 *   `SesionProvider` registra el suyo al montarse, o sea siempre después de
 *   éste: ningún orden lo salva. Lee `error.config`, `error.response.headers` y
 *   `error.response.status === 401`. Si esto rechazara con un objeto plano, se
 *   quedaría sin las tres y **una sesión revocada dejaría de echar a nadie**.
 *   Y con él caerían los treinta sitios de `src/api` y de las pantallas que
 *   leen `error.response`, incluido `opcionesDenegadas`, que es lo que
 *   distingue «denegado» de «falló» en las ocho pantallas de C2.
 *
 * **El manejador de éxito es la identidad y tiene que serlo.** El interceptor
 * del segundo factor reintenta la petición desde dentro de su rama de error, y
 * esa llamada recorre la cadena entera otra vez: medido, los manejadores de
 * éxito que van detrás corren **dos veces** por cada reintento. Contar, medir o
 * registrar algo aquí saldría duplicado.
 */
export const ID_NORMALIZADOR = axios.interceptors.response.use(
  (respuesta) => respuesta,
  (error: unknown) => {
    // Una petición que alguien canceló no es un fallo de red, y la pantalla del
    // generador ya distingue las dos con `axios.isCancel`. Marcarla diría «sin
    // conexión» sobre una exportación que la persona misma acaba de parar.
    if (!axios.isCancel(error) && axios.isAxiosError(error)) {
      const respuesta = error.response;
      const datos = respuesta?.data as { message?: unknown; code?: unknown } | undefined;
      const suyo = datos?.message;
      // Una negativa del protocolo del segundo factor se queda sin frase, y a
      // propósito: `code` sólo aparece en esa respuesta de todo el servidor, y
      // el interceptor que la lee **ya ha sacado su propio aviso** —con su
      // botón «Configurarlo»— antes de volver a rechazar. Sin esta línea, los
      // cuarenta `catch` nuevos sacarían un segundo aviso con exactamente el
      // mismo texto y sin el botón.
      const delProtocolo = typeof datos?.code === "string";
      marcarFallo(error, {
        status: respuesta?.status ?? 0,
        // Sin respuesta, la frase es nuestra. Con respuesta, o es la del
        // servidor o no hay ninguna: la genérica la pone la pantalla, que sabe
        // qué estaba haciendo.
        message: respuesta === undefined ? SIN_CONEXION : !delProtocolo && typeof suyo === "string" ? suyo : "",
      });
    }
    return Promise.reject(error);
  },
);
