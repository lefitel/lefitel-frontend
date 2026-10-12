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

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ActivityChart } from "./ActivityChart";

const pintar = () =>
  render(
    <ActivityChart
      chartData={[{ label: "Ene", postes: 3, entraron: 5, salieron: 2 }]}
      loading={false}
      xAxisLabel="Mes — 2026"
      period="year"
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
});
