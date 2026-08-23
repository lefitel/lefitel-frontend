// The property that lets `withCredentials` be a global default.
//
// `api/http.ts` turns credentials on for every axios request this application
// makes, and one of those requests is built from database content:
// `exports/reportGeneral.ts` fetches each photograph with `axios.get(src)`, where
// `src` is `imageUrl(row.image)` and `row.image` is a text column any account
// that can edit an event can write.
//
// So the question that has to have an answer is whether a crafted stored value
// can point that request at a host somebody else owns. Two independent things say
// no, and this file pins the second one:
//
//  1. The session cookie is set with no `Domain` attribute, which makes it
//     host-only. A browser sends a host-only cookie when the request host is that
//     exact host and under no other condition — not to a parent domain, not to a
//     sibling subdomain, not to a name that merely looks similar. So even a
//     request that did leave for another host would leave without it.
//  2. `imageUrl` always returns a URL on the API's own origin. That is what this
//     file asserts, and it is not hypothetical: the concatenation it replaced —
//     `${url}${path}` with no separator — turned a stored ".attacker.tld/x.jpg"
//     into a request to "https://our-api.example.attacker.tld/x.jpg". The
//     response interceptor in `context/SesionProvider.tsx` carries the other half
//     of that same story: such a host controls its own response headers, so it
//     could answer with an `x-osefi-role` of its choosing — which is why that
//     interceptor acts on nothing that did not come from our own origin.
//
// Nothing here asserted that property before, so the separator could have gone
// back to being a template string at any point and only the comment would have
// noticed.

import { describe, expect, it } from "vitest";

import { imageUrl } from "./imageUrl";
import { url } from "../api/url";

/** The origin every result has to be on, read from the same place the code reads it. */
const NUESTRO = new URL(url).origin;

/**
 * Stored values written to escape the API's host, one shape per trick.
 *
 * A protocol-relative prefix, a leading slash run, a backslash (which some URL
 * parsers treat as a separator), an absolute URL of its own, the legacy
 * "images/" prefix used as cover, and a userinfo `@` that makes everything before
 * it credentials and everything after it the host.
 */
const HOSTILES = [
  ".attacker.example/x.jpg",
  "//attacker.example/x.jpg",
  "///attacker.example/x.jpg",
  "\\\\attacker.example\\x.jpg",
  "/\\attacker.example/x.jpg",
  "http://attacker.example/x.jpg",
  "https://attacker.example/x.jpg",
  "images//attacker.example/x.jpg",
  "images/../../attacker.example/x.jpg",
  "@attacker.example/x.jpg",
  "  //attacker.example/x.jpg  ",
];

describe("imageUrl", () => {
  it("cannot be talked into pointing at another host", () => {
    for (const stored of HOSTILES) {
      const built = imageUrl(stored);

      expect(built, stored).not.toBeNull();
      expect(new URL(built as string).origin, stored).toBe(NUESTRO);
      // The stronger form of the same claim: not merely the right origin after
      // the browser has normalised it, but a string that begins with our base
      // and a separator. This is the invariant the function exists to hold.
      expect((built as string).startsWith(`${url}/`), stored).toBe(true);
    }
  });

  it("still resolves the three shapes the database actually holds", () => {
    // The other half of why this function exists: successive versions of the
    // upload code left three formats in the column, and only two of them used to
    // resolve — roughly one photograph link in eight was dead.
    expect(imageUrl("/foto.webp")).toBe(`${url}/foto.webp`);
    expect(imageUrl("images/foto.jpg")).toBe(`${url}/foto.jpg`);
    expect(imageUrl("foto.jpg")).toBe(`${url}/foto.jpg`);
  });

  it("answers nothing for a row with no photograph", () => {
    for (const empty of [null, undefined, "", "   ", "/", "images/"]) {
      expect(imageUrl(empty), JSON.stringify(empty)).toBeNull();
    }
  });
});
