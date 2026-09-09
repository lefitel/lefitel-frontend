import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/**
 * One attribute, and a whole panel's appearance hangs off it.
 *
 * `Calendar` paints `bg-background` and cancels it with
 * `in-data-[slot=popover-content]:bg-transparent`. While this panel did not
 * name itself, that never fired: the date picker showed a square of the wrong
 * colour over a rounded panel of the right one, and it was the only popup in
 * the application with square corners.
 *
 * The class that does the work is a Tailwind variant, so no assertion here can
 * see it resolve — jsdom computes no styles. What can be held onto is the name
 * the variant matches on, which is the half that went missing.
 */
describe("PopoverContent", () => {
  it("names itself, because what it holds paints by that name", () => {
    render(
      <Popover open>
        <PopoverTrigger>Abrir</PopoverTrigger>
        <PopoverContent>contenido</PopoverContent>
      </Popover>,
    );

    const panel = screen.getByText("contenido");
    expect(panel).toHaveAttribute("data-slot", "popover-content");
    // And it is the rounded, popover-coloured surface the calendar expects to
    // find behind it.
    expect(panel.className).toContain("rounded-md");
    expect(panel.className).toContain("bg-popover");
  });
});
