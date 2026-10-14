// A quick filter and its name, the name on top.
//
// The names sat to the left of their controls, on one line with them, and the
// filters ran one after another: "Estado [· · ·] Gravedad [· · · · ·] [· ·]".
// Read across, a name belongs as much to the control before it as to the one
// after, and the third control had no name at all. Stacked, each name can only
// belong to what is under it.
//
// Nothing here lays a page out, so "is it above" cannot be asked. What can be:
// the name comes first in a block that stacks its children, and the block is a
// group that carries that name for whoever is not looking at the screen.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FiltroRapido } from "./FiltroRapido";

const pintar = () =>
  render(
    <FiltroRapido label="Gravedad">
      <button type="button">Críticas</button>
    </FiltroRapido>,
  );

describe("FiltroRapido", () => {
  it("stacks the name over the control, the name first", () => {
    pintar();

    const bloque = screen.getByRole("group", { name: "Gravedad" });
    expect(bloque.className.split(/\s+/)).toContain("flex-col");
    expect(bloque.firstElementChild?.textContent).toBe("Gravedad");
    expect(bloque.lastElementChild).toBe(screen.getByRole("button", { name: "Críticas" }));
  });

  it("names the group after the text it shows, not a copy of it", () => {
    pintar();

    const bloque = screen.getByRole("group", { name: "Gravedad" });
    const nombre = screen.getByText("Gravedad");
    expect(bloque.getAttribute("aria-labelledby")).toBe(nombre.id);
  });
});
