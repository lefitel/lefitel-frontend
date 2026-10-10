// The period row of the dashboard: a date range on the left, the period
// buttons on the right, sharing one line.
//
// The date range took the shared trigger style when every control got one skin,
// and that style is full-width — right for a form field, wrong here: it ate the
// row and squeezed the period buttons until «Todo» was cut off.
//
// A class name is what there is to assert. Nothing in this environment lays a
// page out, so "how wide is it" cannot be asked; "does it still claim the whole
// row" can.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCards } from "./KpiCards";

const pintar = () =>
  render(
    <KpiCards
      kpis={null}
      loading={false}
      period="month"
      setPeriod={vi.fn()}
      showTrend={false}
      setCustomRange={vi.fn()}
      currentDateRange={{ start: new Date(2026, 8, 1), end: new Date(2026, 9, 10) }}
    />,
  );

describe("the period row of the dashboard", () => {
  it("leaves the date range as wide as its dates, not as wide as the row", () => {
    pintar();

    // The only button that shows the range itself.
    const picker = screen.getByRole("button", { name: /01\/09\/2026/ });
    const classes = picker.className.split(/\s+/);

    expect(classes).toContain("w-auto");
    expect(classes).not.toContain("w-full");
    // And it does not give way either: the buttons beside it scroll, it does not.
    expect(classes).toContain("shrink-0");
  });

  it("still offers every period beside it", () => {
    pintar();

    const periods = screen.getByRole("tablist", { name: "Período del dashboard" });
    for (const label of ["15 días", "Este mes", "3 meses", "Este año", "Todo"]) {
      expect(periods.textContent).toContain(label);
    }
  });
});
