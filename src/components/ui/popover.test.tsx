import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { DatePicker } from "./date-picker";

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
  });

  it("is what a date picker's calendar finds above itself", async () => {
    // The contract, rather than the attribute: the compiled rule is
    // `:where([data-slot="popover-content"]) .in-data-\[…\]:bg-transparent`,
    // which is a plain ancestor relationship and therefore assertable here even
    // though jsdom computes no styles. Asserting the attribute alone would stay
    // green if a wrapper or a second portal were ever introduced between the
    // panel and the calendar — and the square, wrongly-coloured corners would
    // be back with nothing to say so.
    const user = userEvent.setup();
    render(<DatePicker value={new Date(2026, 2, 15)} ariaLabel="Fecha" />);
    await user.click(screen.getByLabelText(/^Fecha/));

    const grid = await screen.findByRole("grid");
    expect(grid.closest('[data-slot="popover-content"]')).not.toBeNull();
  });
});
