// The ⓘ in the banner was a tooltip, which a finger cannot open. It opens on a
// click, and its text carries the threshold the banner is built from.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { DashboardEvento } from "../../../api/dashboard.api";
import { AlertBanner } from "./AlertBanner";

const evento: DashboardEvento = {
  id: 1,
  description: "Poste caído",
  state: false,
  date: new Date("2026-08-01"),
  priority: true,
  id_poste: 1,
  poste: { id: 1, name: "P-1", lat: 0, lng: 0 },
  eventoObs: [],
};

describe("AlertBanner — la explicación", () => {
  it("se abre con un clic, con el umbral dentro, y se cierra con otro", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AlertBanner alerts={{ events: [evento], thresholdDays: 30 } as never} loading={false} />
      </MemoryRouter>,
    );
    const boton = screen.getByRole("button", { name: "¿Qué cuenta esta alerta?" });

    await user.click(boton);

    const frase = screen.getByText(/sin resolver, y cuya fecha del incidente tiene/);
    expect(frase.closest('[data-slot="popover-content"]')).not.toBeNull();
    expect(frase.textContent).toContain("30 días o más");
    await user.click(boton);
    expect(screen.queryByText(/sin resolver, y cuya fecha del incidente tiene/)).toBeNull();
  });
});
