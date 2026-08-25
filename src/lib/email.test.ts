// A hand-written masking function is easy to get wrong in ways that either
// throw (turning a table cell into an error boundary) or leak the whole
// address (defeating the point of masking it at all) — and it happens
// silently, inside a column an administrator glances at rather than reads
// closely. These are the shapes that break a naive `local[0] + "***@" +
// domain.split("@")[1]`-style implementation.

import { describe, it, expect } from "vitest";
import { maskEmail } from "./email";

describe("maskEmail", () => {
  it("keeps the first letter and the whole domain, and nothing else", () => {
    expect(maskEmail("isaias@osefi.net")).toBe("i***@osefi.net");
  });

  it("masks a one-letter local part without revealing it twice", () => {
    // "a@x.com" — the first letter *is* the whole local part, so the mask
    // cannot hide it. What it must not do is throw or return the input
    // unmasked because there was "nothing left" after the first character.
    expect(maskEmail("a@x.com")).toBe("a***@x.com");
  });

  it("does not assume the domain has a dot", () => {
    // Internal/test mailboxes and bare hostnames are real rows in this
    // database. A version that splits the domain on "." to find a TLD comes
    // back empty-handed here and either throws or drops the domain.
    expect(maskEmail("isaias@localhost")).toBe("i***@localhost");
  });

  it("treats everything before the last @ as the local part, and only reveals its first character", () => {
    // Not a valid address, but `lastIndexOf` is what keeps this from
    // throwing or, worse, echoing the extra "@b" back in the visible half.
    expect(maskEmail("a@b@osefi.net")).toBe("a***@osefi.net");
  });

  it("refuses to guess at anything that is not an address", () => {
    expect(maskEmail("sin-arroba")).toBe("***");
    expect(maskEmail("@empieza-por-arroba.com")).toBe("***");
    expect(maskEmail("acaba-en-arroba@")).toBe("***");
  });
});
