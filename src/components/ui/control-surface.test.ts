import { describe, it, expect } from "vitest";

import { chooserTrigger, controlSurface, flatControl } from "./control-surface";
import { cn } from "@/lib/utils";

/**
 * The surface is a `background-image`, and that is not a detail: it decides
 * whether a caller can take it back off.
 *
 * tailwind-merge files `bg-[image:…]` and `bg-white` in different groups, sees
 * no conflict, and keeps both — and an image paints over a colour. Six call
 * sites were passing `bg-transparent shadow-none` and quietly getting a filled,
 * shadowed box: the rename field inside a column pill, the search line in the
 * field picker, four latitude and longitude boxes over a map. Nothing failed;
 * they just stopped looking like what they were written to look like.
 *
 * So the escape hatch is spelled `bg-none` and `shadow-none!`, and these are
 * the assertions that say why.
 */
describe("controlSurface", () => {
  it("is not cancelled by a background colour, which is the trap", () => {
    // Not a wish: a statement of what tailwind-merge does, so that the day it
    // starts merging these two groups, this test says so out loud.
    for (const colour of ["bg-transparent", "bg-white", "bg-muted"]) {
      expect(cn(controlSurface, colour)).toContain("bg-[image:var(--gradient-secondary)]");
    }
  });

  it("is cancelled by `bg-none`, which is the only class in its group", () => {
    expect(cn(controlSurface, "bg-none")).not.toContain("gradient-secondary");
    expect(cn(chooserTrigger, flatControl)).not.toContain("gradient-secondary");
  });

  it("keeps its shadow against a plain `shadow-none`, and yields to the bang", () => {
    // `elevation-control` is a custom `@utility`, which Tailwind 4 emits after
    // the built-in shadows; at equal specificity the later rule wins, so only
    // the important flag settles it. tailwind-merge knows neither class, so it
    // keeps both either way and the outcome is decided at paint time.
    expect(cn(controlSurface, "shadow-none")).toContain("elevation-control");
    expect(flatControl).toContain("shadow-none!");
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
