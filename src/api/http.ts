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
instalarInterceptorStepUp();
