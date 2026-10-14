// The ⓘ beside the title was a tooltip, which a finger cannot open. It opens
// on a click.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TopPostesCard } from "./TopPostesCard";

describe("TopPostesCard — la explicación", () => {
  it("se abre con un clic y se cierra con otro", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TopPostesCard topPostes={[{ name: "P-1", count: 3 }]} loading={false} />
      </MemoryRouter>,
    );
    const boton = screen.getByRole("button", { name: "¿Cómo se calcula el top?" });

    await user.click(boton);

    const frase = screen.getByText(/Top 6 ordenado de mayor a menor/);
    expect(frase.closest('[data-slot="popover-content"]')).not.toBeNull();
    await user.click(boton);
    expect(screen.queryByText(/Top 6 ordenado de mayor a menor/)).toBeNull();
  });
});
