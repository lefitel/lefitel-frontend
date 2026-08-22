// The two settings without which the session cookie does not exist as far as the
// browser is concerned, and the reach of them.
//
// **`curl` proves nothing about any of this**, which is why it is asserted here.
// curl implements no CORS and has no cookie jar policy to speak of: it sends the
// headers it is told to and keeps whatever comes back, so it would report a
// perfectly healthy login against a server missing
// `Access-Control-Allow-Credentials` and a frontend missing `withCredentials`
// alike. What can be checked is what axios actually puts on the wire, and the
// cheapest honest way to see that is to let axios build the request and read it
// back from a fake adapter — the same object the real adapter would have sent.
//
// Asserting on `axios.defaults` alone would not be enough: axios applies
// per-method header defaults during request assembly, not at the call site, so a
// value sitting in `defaults.headers.post` and a value that reaches a POST are
// two different claims.

import { describe, expect, it } from "vitest";
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CLIENT_HEADER, CLIENT_HEADER_VALUE } from "./http";

type Method = "get" | "head" | "post" | "put" | "patch" | "delete";

/**
 * The request axios would have sent, without sending it.
 *
 * A custom adapter is a documented axios extension point, and it sits at the far
 * end of the pipeline: interceptors, config merging and the per-method header
 * defaults have all run by the time it is handed a config.
 */
async function outgoing(method: Method): Promise<InternalAxiosRequestConfig> {
  let seen: InternalAxiosRequestConfig | undefined;

  await axios.request({
    url: "https://api.osefi.net/api/ciudad",
    method,
    adapter: async (config) => {
      seen = config;
      return {
        data: null,
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      } as AxiosResponse;
    },
  });

  if (!seen) throw new Error("el adaptador no recibió la petición");
  return seen;
}

const ESCRITURAS: Method[] = ["post", "put", "patch", "delete"];
const LECTURAS: Method[] = ["get", "head"];

describe("the session cookie's half of the deal", () => {
  it("sends credentials, which is what makes the cookie travel at all", async () => {
    // Both directions depend on this one flag. Without it the browser discards
    // the `Set-Cookie` the login returns — api.osefi.net is a different origin
    // from www.osefi.net — and never sends the cookie back on a later request. So
    // the login appears to work, `GET /auth/me` answers 401, and nothing anywhere
    // says why.
    for (const method of [...ESCRITURAS, ...LECTURAS]) {
      expect((await outgoing(method)).withCredentials, method).toBe(true);
    }
  });
});

describe("the CSRF header", () => {
  it("rides on every method that writes", async () => {
    // The API refuses a cookie-authenticated write that does not carry this, so
    // without this loop's subject every button in the application answers 403
    // the moment the cookie starts travelling. The two halves of this task have
    // to land together for either to be usable.
    for (const method of ESCRITURAS) {
      expect((await outgoing(method)).headers.get(CLIENT_HEADER), method).toBe(CLIENT_HEADER_VALUE);
    }
  });

  it("stays off the methods that only read", async () => {
    // Not tidiness: a non-safelisted header forces a preflight, and one large
    // report export fetches photographs one at a time in the low thousands. On
    // `headers.common` that would double the round trips for nothing, since the
    // server does not check reads.
    for (const method of LECTURAS) {
      expect((await outgoing(method)).headers.get(CLIENT_HEADER), method).toBeUndefined();
    }
  });
});

describe("the reach of a global default", () => {
  it("is loaded by the entry point, or none of it happens", () => {
    // A source-level assertion, because the defect it guards against is a
    // deleted line rather than a wrong value. This module exports two constants
    // and does its real work as a side effect of being imported, so dropping
    // `import './api/http'` from `main.tsx` breaks nothing that any other test
    // can see: this file would still import it directly and still pass, while
    // the built application sent no cookie and no header at all.
    const main = readFileSync(join(__dirname, "..", "main.tsx"), "utf-8");
    expect(main).toMatch(/import\s+['"]\.\/api\/http['"]/);
  });

  it("leaves the one third-party call outside axios, so neither setting reaches it", () => {
    // The safety argument for setting these globally rests on there being no
    // third-party axios call. OpenRouteService is the only external service this
    // application talks to and it uses `fetch`, whose own default is
    // `credentials: "same-origin"` — so the cookie cannot go there and neither
    // can the header. Rewriting that file with axios would send an unknown header
    // and a credentialed request to a host that answers
    // `Access-Control-Allow-Origin: *`, which a browser refuses outright: every
    // route on the map would stop drawing.
    const ors = readFileSync(join(__dirname, "..", "lib", "orsRoute.ts"), "utf-8");
    expect(ors).not.toMatch(/\baxios\b/);
  });
});
