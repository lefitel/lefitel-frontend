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
export const CLIENT_HEADER_VALUE = "web";

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
