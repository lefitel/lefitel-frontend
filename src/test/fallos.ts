// Rejections shaped the way the real stack shapes them.
//
// Every api module now propagates instead of handing back a number, so most
// screen tests need a failing call — and a failure that does not look like a
// real one is worse than none: `mockRejectedValue(new Error("x"))` passes
// through `mensajeDeError` untouched and every test then agrees the screen
// shows its own fallback, which is exactly what a broken reader would do too.
//
// These build what `http.ts`'s normalizer really attaches, so a test that
// asserts the server's sentence appears is asserting something the product can
// actually deliver.

import { AxiosError, AxiosHeaders } from "axios";

/**
 * What the server refusing looks like by the time a screen catches it: a real
 * `AxiosError` with its `response`, plus the `normalized` the interceptor adds.
 *
 * Real and not a plain object on purpose. `mensajeDeError` falls back to
 * `axios.isAxiosError(error) && error.response.data.message`, and that guard
 * returns false for anything without `isAxiosError === true` — so a hand-made
 * object would quietly exercise only half of it.
 */
export function rechazoDelServidor(status: number, message?: string): AxiosError {
  const headers = new AxiosHeaders();
  const config = { headers, url: "/api/probeta" };
  const error = new AxiosError(
    message ?? `Request failed with status code ${status}`,
    String(status),
    config as never,
    {},
    { status, statusText: "", headers, config: config as never, data: message ? { message } : {} },
  );
  return Object.assign(error, { normalized: { status, message: message ?? "" } });
}

/**
 * What a request that never reached the server looks like: no `response`,
 * status 0, and the one sentence this layer invents.
 */
export function sinConexion(): AxiosError {
  const headers = new AxiosHeaders();
  const config = { headers, url: "/api/probeta" };
  const error = new AxiosError("Network Error", "ERR_NETWORK", config as never, {});
  return Object.assign(error, { normalized: { status: 0, message: "Sin conexión con el servidor" } });
}
