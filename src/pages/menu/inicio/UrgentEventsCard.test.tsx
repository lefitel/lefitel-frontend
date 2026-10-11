// A tab's counter counts the rows in that tab.
//
// "Obs. crítica" lists every pending event carrying an observation with a
// severity — levels 1 through 9, which is what its own description and tooltip
// say — while its counter counted only level 1, and hid itself at zero. With
// thirty pending events of levels 2 to 9 and none catastrophic, the tab showed
// thirty rows and no number at all, so the reading was "0". Two measurements
// under one label, half a centimetre apart.
//
// The list is the one that matches the description, so the counter is the one
// that was wrong. Level 1 does not stop being visible: the list is sorted by
// severity and the badge on each row carries the colour.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import type { DashboardEvento } from "../../../api/dashboard.api";
import { UrgentEventsCard } from "./UrgentEventsCard";

/** A pending event whose observations carry the given severities. */
function evento(id: number, criticalities: (number | null)[]): DashboardEvento {
  return {
    id,
    description: `Incidencia ${id}`,
    state: false,
    date: new Date("2026-08-01"),
    priority: false,
    id_poste: id,
    poste: { id, name: `P-${id}`, lat: 0, lng: 0 },
    eventoObs: criticalities.map((criticality, i) => ({
      id: id * 100 + i,
      ob: { id: i, name: `Observación ${i}`, criticality },
    })),
  };
}

function renderCard(props: {
  urgentEvents?: DashboardEvento[];
  criticalObsEvents?: DashboardEvento[];
}) {
  return render(
    <MemoryRouter>
      <UrgentEventsCard
        urgentEvents={props.urgentEvents ?? []}
        criticalObsEvents={props.criticalObsEvents ?? []}
        loading={false}
      />
    </MemoryRouter>,
  );
}

const tabCount = (name: RegExp) =>
  screen.getByRole("tab", { name }).textContent?.replace(/\D/g, "") ?? "";

// The card opens on «Obs. crítica», the second tab, at the client's request.
// The row is what proves it: each list holds a different pole, so the selected
// tab and the list under it cannot disagree without this failing.
describe("UrgentEventsCard — la pestaña con la que abre", () => {
  it("abre en las observaciones críticas, no en los urgentes", () => {
    renderCard({
      urgentEvents: [evento(1, [])],
      criticalObsEvents: [evento(2, [3])],
    });

    expect(screen.getByRole("tab", { name: /Obs\. crítica/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("P-2")).toBeTruthy();
    expect(screen.queryByText("P-1")).toBeNull();
  });
});

describe("UrgentEventsCard — los contadores cuentan sus propias filas", () => {
  it("cuenta todos los eventos con observación clasificada, no solo los de nivel 1", () => {
    renderCard({
      criticalObsEvents: [evento(1, [2]), evento(2, [5]), evento(3, [9])],
    });

    expect(tabCount(/Obs\. crítica/)).toBe("3");
  });

  it("sigue contándolos cuando ninguno es catastrófico", () => {
    // The old counter hid itself here, so the tab read as zero next to a list
    // of three.
    renderCard({ criticalObsEvents: [evento(1, [4]), evento(2, [7])] });

    expect(tabCount(/Obs\. crítica/)).toBe("2");
  });

  it("cuenta un evento una sola vez aunque traiga varias observaciones", () => {
    renderCard({ criticalObsEvents: [evento(1, [1, 3, 8])] });

    expect(tabCount(/Obs\. crítica/)).toBe("1");
  });

  it("la pestaña de urgentes sigue contando los suyos", () => {
    renderCard({
      urgentEvents: [evento(1, []), evento(2, [])],
      criticalObsEvents: [evento(3, [1])],
    });

    expect(tabCount(/Urgentes/)).toBe("2");
  });
});
