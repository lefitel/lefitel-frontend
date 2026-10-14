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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KpiCards } from "./KpiCards";
import type { KpiData } from "./types";

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

// One fixture for both cards. Each assertion is scoped to its own card: «Postes
// Nuevos» repeats a number the «Creados» bar of Postes Activos already prints,
// so found anywhere on the page "34 de 1686" would pass without the card existing.
const kpis: KpiData = {
  postesTotal: 1686,
  postesConIncidencias: 0,
  eventosTotal: 1376,
  eventosResueltosTotal: 0,
  pendGlobal: 0,
  postesCurr: 34,
  postesPrev: 20,
  postesRevisadosCurr: 71,
  postesRevisadosPrev: 71,
  postesPendientesRevisadosCurr: 0,
  postesSolucionadosCurr: 52,
  eventosSolucionadosCurr: 60,
  eventosSolucionadosPrev: 40,
  postesActivosCurr: 128,
  postesActivosPrev: 128,
};

const tarjeta = (showTrend: boolean, titulo = "Postes Nuevos") => {
  render(
    <KpiCards
      kpis={kpis}
      loading={false}
      period="month"
      setPeriod={vi.fn()}
      showTrend={showTrend}
      setCustomRange={vi.fn()}
      currentDateRange={{ start: new Date(2026, 8, 1), end: new Date(2026, 9, 10) }}
    />,
  );
  const card = screen.getByText(titulo).closest<HTMLElement>('[data-slot="card"]');
  expect(card).not.toBeNull();
  return within(card!);
};

describe("the «Postes Nuevos» card", () => {
  it("says how many of all the poles are new in the period", () => {
    const card = tarjeta(false);

    expect(card.getByText("Del total")).toBeTruthy();
    expect(card.getByText("34 de 1686")).toBeTruthy();
  });

  it("compares against the new poles of the period before, not any other count", () => {
    // 34 against 20. No other pair in the fixture gives +70%, and a missing
    // `prev` reads as 0 and prints +100%, so only the right one produces it.
    const card = tarjeta(true);

    expect(card.getByText(/\+70% vs anterior/)).toBeTruthy();
  });

  it("drops the comparison where there is no period before", () => {
    const card = tarjeta(false);

    expect(card.queryByText(/vs anterior/)).toBeNull();
  });
});

// The fourth card counts repairs, like the chart line of the same name. It
// counted distinct poles before, under the title «Postes Solucionados».
describe("the «Eventos Solucionados» card", () => {
  it("counts repaired events against all events, not poles", () => {
    const card = tarjeta(false, "Eventos Solucionados");

    expect(card.getByText("60 de 1376")).toBeTruthy();
    expect(screen.queryByText("Postes Solucionados")).toBeNull();
  });

  it("compares against the repairs of the period before", () => {
    // 60 against 40.
    const card = tarjeta(true, "Eventos Solucionados");

    expect(card.getByText(/\+50% vs anterior/)).toBeTruthy();
  });
});

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

// The two ⓘ buttons were tooltips, which a finger cannot open. They open on a
// click, and the explanation is drawn as a popover.
describe("the explanations of the KPI rows", () => {
  it.each([
    ["Información sobre el estado del sistema", /total de postes en el sistema/],
    ["Información sobre las métricas del período", /unión única de postes creados/],
  ])("%s opens on a click", async (nombre, frase) => {
    const user = userEvent.setup();
    pintar();

    await user.click(screen.getByRole("button", { name: nombre }));

    expect(screen.getByText(frase).closest('[data-slot="popover-content"]')).not.toBeNull();
    await user.click(screen.getByRole("button", { name: nombre }));
    expect(screen.queryByText(frase)).toBeNull();
  });
});
