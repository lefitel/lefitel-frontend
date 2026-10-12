// What the chart says it draws.
//
// It drew two series of events under names that only made sense as a pair —
// «Entraron» and «Se repararon» — in four views. It now draws three lines, one
// of them poles, so each name has to say what it counts, and the views that
// stacked or filled two event series are gone: stacking poles on events adds up
// two different things.
//
// Nothing here lays a chart out, so the lines themselves cannot be asserted.
// The legend and the view switch are what there is to read.

import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ActivityChart } from "./ActivityChart";
import { chartBuckets } from "./helpers";

// The one piece of layout these tests supply: a size. The chart sizes itself to
// its container and jsdom gives every container zero, so nothing would be drawn.
// With a size the axes are in the DOM. Their text still measures zero wide, so
// no label is ever dropped for lack of room: what can be asserted is which
// labels the chart asks for, not which survive on a narrow screen.
vi.mock("recharts", async (original) => ({
  ...(await original<typeof import("recharts")>()),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) =>
    cloneElement(children, { width: 900, height: 350 }),
}));

/** 29 September to 2 October 2026, by day: a month ends in the middle. */
const { buckets } = chartBuckets(new Date(2026, 8, 29), new Date(2026, 9, 2));
const chartData = buckets.map((b, i) => ({ label: b.label, desde: b.desde, postes: i, entraron: 5, salieron: 2 }));

const pintar = () =>
  render(
    <ActivityChart
      chartData={chartData}
      granularity="day"
      loading={false}
      xAxisLabel="29/9/2026 — 2/10/2026 · por día"
      period="custom"
    />,
  );

describe("the activity chart", () => {
  it("names its three lines by what each one counts", () => {
    pintar();

    for (const label of ["Postes nuevos", "Eventos nuevos", "Eventos solucionados"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("offers the lines and the balance, and nothing else", () => {
    pintar();

    expect(screen.getByRole("button", { name: "Líneas" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Balance" })).toBeTruthy();
    for (const gone of ["Área", "Compuesto", "Barras"]) {
      expect(screen.queryByRole("button", { name: gone })).toBeNull();
    }
  });

  it("opens on the lines", () => {
    pintar();

    expect(screen.getByRole("button", { name: "Líneas" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Balance" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("swaps the legend for the balance one, which has no poles in it", () => {
    pintar();

    fireEvent.click(screen.getByRole("button", { name: "Balance" }));

    expect(screen.getByText("Mejora")).toBeTruthy();
    expect(screen.queryByText("Postes nuevos")).toBeNull();
  });

  // The dates under the points, on two rows. The months have an axis of their
  // own because the library drops the labels that do not fit, and the one it
  // drops may be the first of the month: a month hung from a day would vanish
  // with it.
  it("writes the day under each point, and each month once", async () => {
    const { container } = pintar();
    const textos = () => Array.from(container.querySelectorAll("svg text")).map((t) => t.textContent);

    // The library lays its axes out a pass after the first render.
    await waitFor(() => expect(textos()).toContain("Sep '26"));
    const escrito = textos();

    for (const dia of ["29", "30", "1"]) expect(escrito).toContain(dia);
    expect(escrito.filter((t) => t === "Sep '26")).toHaveLength(1);
    expect(escrito.filter((t) => t === "Oct '26")).toHaveLength(1);
    // And not the whole date at every point, which is what did not fit.
    expect(escrito).not.toContain("29/9");
  });
});

