import { describe, it, expect } from "vitest";

import { chooserTrigger, controlSurface, flatControl } from "./control-surface";
import { cn } from "@/lib/utils";

/**
 * The surface is a background colour, and that is not a detail: it decides
 * whether a caller can take it back off.
 *
 * It was a `background-image` once — a gradient — and tailwind-merge files
 * those and `bg-white` in different groups, sees no conflict, and keeps both.
 * Six call sites were passing `bg-transparent shadow-none` and quietly getting
 * a filled, shadowed box: the rename field inside a column pill, the search
 * line in the field picker, four latitude and longitude boxes over a map.
 * Nothing failed; they just stopped looking like what they were written to
 * look like.
 *
 * Flat, the fill and the colour a caller passes are in the same group, and
 * these are the assertions that hold it there: put a gradient or a custom
 * shadow utility back on the surface and they say so.
 */
describe("controlSurface", () => {
  it("is a plain fill, with no gradient and no shadow of its own", () => {
    for (const skin of [controlSurface, chooserTrigger]) {
      expect(skin).toContain("bg-secondary");
      expect(skin).not.toMatch(/gradient|elevation-|shadow/);
    }
  });

  it("yields its fill to a background colour a caller passes", () => {
    for (const colour of ["bg-transparent", "bg-white", "bg-muted"]) {
      const merged = cn(controlSurface, colour);
      expect(merged).toContain(colour);
      expect(merged).not.toContain("bg-secondary");
    }
  });

  it("comes off entirely through `flatControl`", () => {
    const merged = cn(chooserTrigger, flatControl);
    expect(merged).toContain("bg-transparent");
    expect(merged).not.toContain("bg-secondary");
    // The width goes; the colour stays on the class list with nothing to paint.
    expect(merged).toContain("border-0");
    expect(merged).not.toMatch(/(^|\s)border(\s|$)/);
  });

  it("still lets a caller change size, shape and border", () => {
    // The overrides that always did work, held onto so that the fix for the
    // ones that did not cannot quietly break them.
    const merged = cn(chooserTrigger, "h-8 w-36 rounded-lg border-destructive");
    expect(merged).toContain("h-8");
    expect(merged).toContain("w-36");
    expect(merged).toContain("rounded-lg");
    expect(merged).toContain("border-destructive");
    expect(merged).not.toContain("h-9");
    expect(merged).not.toContain("border-transparent");
  });
});
